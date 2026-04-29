import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  EXTRACTION_PROMPT_VERSION,
} from "./extractionPrompt.ts";
import { runExtractionConsistencyChecks } from "./consistencyChecks.ts";
import { deriveExtractionStatus } from "./extractionStatus.ts";
import { countExtractedFields } from "./extractionAudit.ts";
import { countEvidenceMetrics } from "../_shared/audit/evidenceMetrics.ts";
import {
  deriveReviewItemsFromAudit,
  deriveWeakEvidenceReviewItems,
} from "../_shared/review/deriveReviewItems.ts";
import {
  computeReviewStatusFromItems,
  type ReviewItemStatus,
} from "../_shared/review/computeReviewStatus.ts";
import {
  ExtractedDataSchema,
  ExtractTaxDataResponseSchema,
  type ExtractedData,
  type ExtractionAudit,
  type ExtractionStatus,
} from "../_shared/contracts/extractionContracts.ts";
import { normalizeAiExtractionResponse, shapeOf } from "./normalizeAiResponse.ts";

const MODEL_USED = "google/gemini-2.5-pro";

// ---------------- Input ----------------

const RequestSchema = z.object({
  declarationId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
});

// ---------------- Tool schema (structured output IA) ----------------

const CONFIDENT_NUMBER_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    value: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    sourceDocument: { type: "string" },
    note: { type: "string" },
  },
  required: ["value", "confidence"],
};

const IFU_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    institution: { type: "string" },
    accountNumber: { type: "string" },
    dividends: CONFIDENT_NUMBER_SCHEMA,
    interests: CONFIDENT_NUMBER_SCHEMA,
    capitalGains: CONFIDENT_NUMBER_SCHEMA,
    withholdingTax: CONFIDENT_NUMBER_SCHEMA,
    socialContributions: CONFIDENT_NUMBER_SCHEMA,
  },
  required: ["institution"],
};

const SCPI_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    scpiName: { type: "string" },
    managementCompany: { type: "string" },
    frenchIncome: CONFIDENT_NUMBER_SCHEMA,
    foreignIncome: CONFIDENT_NUMBER_SCHEMA,
    deductibleInterests: CONFIDENT_NUMBER_SCHEMA,
    socialContributions: CONFIDENT_NUMBER_SCHEMA,
  },
  required: ["scpiName"],
};

const LIFE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    contractName: { type: "string" },
    insurer: { type: "string" },
    contractAge: { type: "string", enum: ["less_than_8", "more_than_8"] },
    withdrawals: CONFIDENT_NUMBER_SCHEMA,
    taxableShare: CONFIDENT_NUMBER_SCHEMA,
    withholdingTax: CONFIDENT_NUMBER_SCHEMA,
  },
  required: ["contractName"],
};

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_extraction",
    description: "Soumettre les données fiscales extraites des documents.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        taxpayer: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            fiscalNumber: { type: "string" },
            taxHousehold: { type: "string" },
            address: { type: "string" },
          },
        },
        taxYear: { type: "integer" },
        detectedCategories: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "ifu", "scpi", "life_insurance", "real_estate_income",
              "dividends", "interests", "capital_gains", "foreign_accounts",
              "per", "tax_credits", "deductible_expenses", "other",
            ],
          },
        },
        ifu: { type: "array", items: IFU_ITEM_SCHEMA },
        scpi: { type: "array", items: SCPI_ITEM_SCHEMA },
        lifeInsurance: { type: "array", items: LIFE_ITEM_SCHEMA },
        warnings: { type: "array", items: { type: "string" } },
        missingData: { type: "array", items: { type: "string" } },
        globalConfidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: [
        "taxpayer", "taxYear", "detectedCategories",
        "ifu", "scpi", "lifeInsurance",
        "warnings", "missingData", "globalConfidence",
      ],
    },
  },
};

// ---------------- Handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return jsonError(500, "LOVABLE_API_KEY non configurée");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonError(401, "Unauthorized");
    const userId = claims.claims.sub as string;

    // --- Body ---
    const body = await req.json().catch(() => ({}));
    const parsedBody = RequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return jsonError(400, "Paramètres invalides", parsedBody.error.flatten());
    }
    const { declarationId, dryRun, debug } = parsedBody.data;

    // --- Ownership ---
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: decl, error: declErr } = await admin
      .from("declarations")
      .select("id, user_id, tax_year")
      .eq("id", declarationId)
      .single();
    if (declErr || !decl) return jsonError(404, "Déclaration introuvable");
    if (decl.user_id !== userId) return jsonError(403, "Accès refusé");

    // --- Files ---
    const { data: files, error: filesErr } = await admin
      .from("declaration_files")
      .select("id, file_name, file_type, storage_path")
      .eq("declaration_id", declarationId);
    if (filesErr) return jsonError(500, "Lecture des fichiers échouée");
    if (!files || files.length === 0) return jsonError(400, "Aucun fichier à analyser");

    if (!dryRun) {
      await admin
        .from("declarations")
        .update({ status: "extraction_pending" })
        .eq("id", declarationId);
    }

    // --- Téléchargement + base64 ---
    const aiContent: Array<Record<string, unknown>> = [
      { type: "text", text: EXTRACTION_USER_PROMPT },
    ];
    for (const f of files) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("declaration-files")
        .download(f.storage_path);
      if (dlErr || !blob) {
        console.error("download failed", f.storage_path, dlErr);
        continue;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      const b64 = base64Encode(buf);
      const mime = f.file_type || guessMime(f.file_name);
      aiContent.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}` },
      });
      aiContent.push({ type: "text", text: `↑ Document: ${f.file_name}` });
    }

    // --- Appel Lovable AI ---
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_USED,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: aiContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_extraction" } },
      }),
    });

    if (aiResp.status === 429) return jsonError(429, "Limite de débit atteinte. Réessayez dans un instant.");
    if (aiResp.status === 402) return jsonError(402, "Crédits IA épuisés. Ajoutez des crédits dans votre espace Lovable.");
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return jsonError(500, `Erreur IA (${aiResp.status})`);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(aiJson));
      return jsonError(502, "Réponse IA invalide (aucune extraction structurée)");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return jsonError(502, "Réponse IA non parsable", String(e));
    }

    // --- Logs de debug propres (jamais le contenu doc) ---
    console.log("[extract-tax-data] AI response received", {
      declarationId,
      numberOfFiles: files.length,
      fileNames: files.map((f) => f.file_name),
      modelUsed: MODEL_USED,
      extractionPromptVersion: EXTRACTION_PROMPT_VERSION,
      rawShape: shapeOf(raw),
    });

    // --- Normalisation défensive AVANT Zod ---
    const normResult = normalizeAiExtractionResponse(raw);
    if (normResult.changed) {
      console.warn("[extract-tax-data] normalisation appliquée", {
        declarationId,
        warnings: normResult.warnings,
      });
    }

    const validated = ExtractedDataSchema.safeParse(normResult.normalized);
    if (!validated.success) {
      const zodErrors = validated.error.flatten();
      console.error("[extract-tax-data] Zod validation failed", {
        declarationId,
        zodErrors,
        normalizationWarnings: normResult.warnings,
        normalizedShape: shapeOf(normResult.normalized),
      });
      return jsonError(
        502,
        "Réponse IA non conforme au schéma",
        debug
          ? {
              zodErrors,
              normalizationWarnings: normResult.warnings,
              normalizedCandidate: normResult.normalized,
              rawModelShape: shapeOf(raw),
            }
          : { zodErrors, normalizationWarnings: normResult.warnings },
      );
    }
    const extracted: ExtractedData = validated.data;

    // Métadonnées système — injectées EXCLUSIVEMENT par le serveur.
    const extractedAt = new Date().toISOString();
    const metadata = {
      extractionPromptVersion: EXTRACTION_PROMPT_VERSION,
      extractedAt,
      modelUsed: MODEL_USED,
      dryRun,
    };

    // --- Audit + statut officiels ---
    const consistencyIssues = runExtractionConsistencyChecks({
      taxYear: extracted.taxYear,
      detectedCategories: extracted.detectedCategories,
      ifu: extracted.ifu as unknown as Array<Record<string, unknown>>,
      scpi: extracted.scpi as unknown as Array<Record<string, unknown>>,
      lifeInsurance: extracted.lifeInsurance as unknown as Array<Record<string, unknown>>,
      warnings: extracted.warnings,
      missingData: extracted.missingData,
      globalConfidence: extracted.globalConfidence,
    });
    const status: ExtractionStatus = deriveExtractionStatus({
      hasError: false,
      globalConfidence: extracted.globalConfidence,
      warnings: extracted.warnings,
      missingData: extracted.missingData,
      consistencyIssues,
    });
    const evidenceMetrics = countEvidenceMetrics({
      ifu: extracted.ifu as unknown as Array<Record<string, unknown>>,
      scpi: extracted.scpi as unknown as Array<Record<string, unknown>>,
      lifeInsurance: extracted.lifeInsurance as unknown as Array<Record<string, unknown>>,
    });
    const audit: ExtractionAudit = {
      declarationId,
      extractedAt,
      extractionPromptVersion: EXTRACTION_PROMPT_VERSION,
      modelUsed: MODEL_USED,
      dryRun,
      detectedCategories: extracted.detectedCategories,
      globalConfidence: extracted.globalConfidence,
      status,
      numberOfFiles: files.length,
      numberOfExtractedFields: countExtractedFields({
        ifu: extracted.ifu as unknown as Array<Record<string, unknown>>,
        scpi: extracted.scpi as unknown as Array<Record<string, unknown>>,
        lifeInsurance: extracted.lifeInsurance as unknown as Array<Record<string, unknown>>,
      }),
      numberOfWarnings: extracted.warnings.length,
      numberOfMissingData: extracted.missingData.length,
      numberOfConsistencyIssues: consistencyIssues.length,
      ...evidenceMetrics,
      consistencyIssues,
      warnings: extracted.warnings,
      missingData: extracted.missingData,
    };

    // --- Validation du contrat de réponse AVANT envoi (filet de sécurité) ---
    const responsePayload = { data: extracted, metadata, audit, status };
    const responseValidated = ExtractTaxDataResponseSchema.safeParse(responsePayload);
    if (!responseValidated.success) {
      console.error("Response contract violation", responseValidated.error.flatten());
      return jsonError(500, "Contrat de réponse invalide", responseValidated.error.flatten());
    }

    // --- Mode dry-run : pas de persistance ---
    if (dryRun) {
      console.log("[extract-tax-data] dryRun=true → no DB write", { declarationId, status });
      return new Response(JSON.stringify(responseValidated.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Persistance ---
    const confidenceScore =
      extracted.globalConfidence === "high" ? 0.9 :
      extracted.globalConfidence === "medium" ? 0.6 : 0.3;

    await admin.from("declaration_extracted_data").delete().eq("declaration_id", declarationId);
    const { error: insErr } = await admin.from("declaration_extracted_data").insert({
      declaration_id: declarationId,
      extracted_data: extracted as unknown as Record<string, unknown>,
      detected_categories: extracted.detectedCategories,
      confidence_score: confidenceScore,
      metadata: metadata as unknown as Record<string, unknown>,
      extraction_status: status,
    });
    if (insErr) {
      console.error("insert extracted_data failed", insErr);
      await admin.from("declaration_audit_logs").insert({
        declaration_id: declarationId,
        user_id: userId,
        action: "extraction_failed",
        metadata: { stage: "persist_extracted_data", error: insErr.message },
      });
      return jsonError(500, "Persistance des données extraites échouée");
    }

    await admin
      .from("declarations")
      .update({ status: "extraction_done" })
      .eq("id", declarationId);

    const { data: auditLogRow } = await admin
      .from("declaration_audit_logs")
      .insert({
        declaration_id: declarationId,
        user_id: userId,
        action: "extraction_audit_generated",
        metadata: JSON.parse(JSON.stringify(audit)),
      })
      .select("id")
      .single();

    // --- Génération automatique des "review items" (idempotent via dedup_key) ---
    try {
      const derived = [
        ...deriveReviewItemsFromAudit({
          consistencyIssues: audit.consistencyIssues,
          warnings: audit.warnings,
          missingData: audit.missingData,
        }),
        ...deriveWeakEvidenceReviewItems({
          ifu: extracted.ifu as unknown as Array<Record<string, unknown>>,
          scpi: extracted.scpi as unknown as Array<Record<string, unknown>>,
          lifeInsurance: extracted.lifeInsurance as unknown as Array<Record<string, unknown>>,
        }),
      ];
      if (derived.length > 0) {
        const rows = derived.map((d) => ({
          declaration_id: declarationId,
          audit_log_id: auditLogRow?.id ?? null,
          source_type: d.sourceType,
          source_code: d.sourceCode,
          severity: d.severity,
          field: d.field,
          message: d.message,
          dedup_key: d.dedupKey,
        }));
        const { error: reviewErr } = await admin
          .from("declaration_review_items")
          .upsert(rows, { onConflict: "declaration_id,dedup_key", ignoreDuplicates: true });
        if (reviewErr) console.warn("review items upsert failed", reviewErr);
      }
      // Recalcul du review_status après (re)génération des items
      const { data: allItems } = await admin
        .from("declaration_review_items")
        .select("status")
        .eq("declaration_id", declarationId);
      const statuses = (allItems ?? []).map((r) => r.status as ReviewItemStatus);
      const reviewStatus = computeReviewStatusFromItems(statuses);
      await admin
        .from("declarations")
        .update({ review_status: reviewStatus })
        .eq("id", declarationId);
    } catch (e) {
      console.warn("derive review items failed", e);
    }


    return new Response(JSON.stringify(responseValidated.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-tax-data error:", e);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const body = await req.clone().json().catch(() => null);
      const declId = body?.declarationId;
      if (supabaseUrl && supabaseServiceKey && typeof declId === "string") {
        const admin = createClient(supabaseUrl, supabaseServiceKey);
        await admin.from("declaration_audit_logs").insert({
          declaration_id: declId,
          action: "extraction_failed",
          metadata: { stage: "handler", error: e instanceof Error ? e.message : String(e) },
        });
      }
    } catch (logErr) {
      console.warn("failed to log extraction_failed", logErr);
    }
    return jsonError(500, e instanceof Error ? e.message : "Erreur inconnue");
  }
});

function jsonError(status: number, error: string, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
