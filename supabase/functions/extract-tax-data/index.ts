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
import {
  callAiExtraction,
  isRetryableErrorCode,
  type AiExtractionResult,
  type ExtractionAiErrorCode,
} from "./callAiExtraction.ts";
import { mergeExtractedDataResults } from "./mergeExtractedDataResults.ts";
import { deriveNormalizationReviewItems } from "./deriveNormalizationReviewItems.ts";

const MODEL_USED = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1500;
const PER_FILE_FALLBACK_THRESHOLD = 3; // > 2 fichiers → on tentera batching après échec

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
    csgDeductible: CONFIDENT_NUMBER_SCHEMA,
  },
  required: ["institution"],
};

const SCPI_COUNTRY_INCOME_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    country: { type: "string" },
    income: CONFIDENT_NUMBER_SCHEMA,
    taxTreatment: { type: "string", enum: ["tax_credit", "effective_rate", "exempt"] },
  },
  required: ["country", "income"],
};

const SCPI_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    scpiName: { type: "string" },
    managementCompany: { type: "string" },
    // Annexe 2044
    grossIncome: CONFIDENT_NUMBER_SCHEMA,
    frenchIncome: CONFIDENT_NUMBER_SCHEMA,
    foreignIncome: CONFIDENT_NUMBER_SCHEMA,
    expenses: CONFIDENT_NUMBER_SCHEMA,
    scpiLoanInterests: CONFIDENT_NUMBER_SCHEMA,
    netIncome: CONFIDENT_NUMBER_SCHEMA,
    // Intérêts emprunt personnels
    personalLoanInterests: CONFIDENT_NUMBER_SCHEMA,
    // Reports 2042
    exemptIncome: CONFIDENT_NUMBER_SCHEMA,
    microFoncierExempt: CONFIDENT_NUMBER_SCHEMA,
    foreignTaxCredit: CONFIDENT_NUMBER_SCHEMA,
    // Ventilation pays
    incomeByCountry: { type: "array", items: SCPI_COUNTRY_INCOME_SCHEMA },
    // PS
    socialContributions: CONFIDENT_NUMBER_SCHEMA,
    // IFI
    ifiValuePerShare: CONFIDENT_NUMBER_SCHEMA,
    numberOfShares: CONFIDENT_NUMBER_SCHEMA,
    // Deprecated
    deductibleInterests: CONFIDENT_NUMBER_SCHEMA,
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

// Erreur "métier" propagée jusqu'au handler pour réponse propre + audit log.
class ExtractionError extends Error {
  constructor(
    public readonly code: ExtractionAiErrorCode | "ZOD_INVALID" | "EMPTY_FILES",
    public readonly userMessage: string,
    public readonly providerError?: string,
    public readonly retryable: boolean = false,
    public readonly httpStatus: number = 502,
    public readonly details?: unknown,
  ) {
    super(userMessage);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------- Handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let declarationIdForLog: string | null = null;
  let userIdForLog: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

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
    userIdForLog = userId;

    // --- Body ---
    const body = await req.json().catch(() => ({}));
    const parsedBody = RequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return jsonError(400, "Paramètres invalides", parsedBody.error.flatten());
    }
    const { declarationId, dryRun, debug } = parsedBody.data;
    declarationIdForLog = declarationId;

    // --- Ownership ---
    admin = createClient(supabaseUrl, supabaseServiceKey);
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

    // --- Téléchargement + base64 (1 seule fois) ---
    type DownloadedFile = { name: string; mime: string; b64: string };
    const downloaded: DownloadedFile[] = [];
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
      downloaded.push({ name: f.file_name, mime, b64 });
    }
    if (downloaded.length === 0) {
      return jsonError(500, "Téléchargement des fichiers échoué");
    }

    // ---------------- Pipeline IA ----------------
    // 1) tentative globale
    // 2) si échec retryable → 1 retry avec délai
    // 3) si échec et > seuil fichiers → fallback "1 appel par fichier" + merge
    const auditCalls: Array<{ phase: string; code?: string; providerError?: string }> = [];
    let extracted: ExtractedData | null = null;
    let normalizationWarnings: string[] = [];
    let finalRawShape: unknown = null;
    let finalNormalizedShape: unknown = null;
    let modelUsedFinal = MODEL_USED;
    let usedPerFileFallback = false;

    const buildContent = (filesSubset: DownloadedFile[]) => {
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: EXTRACTION_USER_PROMPT },
      ];
      for (const f of filesSubset) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${f.mime};base64,${f.b64}` },
        });
        content.push({ type: "text", text: `↑ Document: ${f.name}` });
      }
      return content;
    };

    // Helper qui fait : appel IA -> parse -> normalize -> Zod, sur un sous-ensemble.
    const runOnce = async (
      filesSubset: DownloadedFile[],
      phase: string,
    ): Promise<ExtractedData> => {
      const aiResult: AiExtractionResult = await callAiExtraction({
        apiKey: lovableApiKey,
        model: MODEL_USED,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        userContent: buildContent(filesSubset),
        toolSchema: TOOL_SCHEMA,
        toolName: "submit_extraction",
      });

      if (!aiResult.ok) {
        auditCalls.push({
          phase,
          code: aiResult.code,
          providerError: aiResult.providerError,
        });
        if (aiResult.code === "RATE_LIMITED") {
          throw new ExtractionError(
            "RATE_LIMITED",
            "Limite de débit atteinte. Réessayez dans un instant.",
            aiResult.providerError, false, 429,
          );
        }
        if (aiResult.code === "PAYMENT_REQUIRED") {
          throw new ExtractionError(
            "PAYMENT_REQUIRED",
            "Crédits IA épuisés. Ajoutez des crédits dans votre espace Lovable.",
            aiResult.providerError, false, 402,
          );
        }
        throw new ExtractionError(
          aiResult.code,
          aiResult.code === "NO_TOOL_CALL"
            ? "Aucun résultat structuré retourné par le modèle"
            : "Erreur côté fournisseur IA",
          aiResult.providerError,
          isRetryableErrorCode(aiResult.code),
          502,
        );
      }

      let raw: unknown;
      try {
        raw = JSON.parse(aiResult.rawArguments);
      } catch (e) {
        auditCalls.push({ phase, code: "UNPARSABLE", providerError: String(e) });
        throw new ExtractionError(
          "UNPARSABLE",
          "Réponse IA non parsable",
          String(e),
          false,
          502,
        );
      }
      finalRawShape = shapeOf(raw);
      const norm = normalizeAiExtractionResponse(raw);
      finalNormalizedShape = shapeOf(norm.normalized);
      if (norm.changed) {
        console.warn("[extract-tax-data] normalisation appliquée", {
          declarationId,
          phase,
          warnings: norm.warnings,
        });
      }
      normalizationWarnings = [...normalizationWarnings, ...norm.warnings];

      const validated = ExtractedDataSchema.safeParse(norm.normalized);
      if (!validated.success) {
        const zodErrors = validated.error.flatten();
        console.error("[extract-tax-data] Zod validation failed", {
          declarationId,
          phase,
          zodErrors,
          normalizationWarnings: norm.warnings,
          normalizedShape: shapeOf(norm.normalized),
        });
        throw new ExtractionError(
          "ZOD_INVALID",
          "Réponse IA non conforme au schéma",
          undefined,
          false,
          502,
          { zodErrors, normalizationWarnings: norm.warnings },
        );
      }
      return validated.data;
    };

    // -------- Tentative principale + 1 retry --------
    try {
      try {
        extracted = await runOnce(downloaded, "primary");
      } catch (e) {
        if (e instanceof ExtractionError && e.retryable) {
          console.warn("[extract-tax-data] retry après erreur retryable", {
            declarationId,
            reason: e.code,
            attempt: 2,
            modelUsed: MODEL_USED,
          });
          await admin.from("declaration_audit_logs").insert({
            declaration_id: declarationId,
            user_id: userId,
            action: "extraction_retry_attempted",
            metadata: {
              reason: e.code,
              attempt: 2,
              modelUsed: MODEL_USED,
              providerError: e.providerError,
            },
          });
          await sleep(RETRY_DELAY_MS);
          extracted = await runOnce(downloaded, "retry");
        } else {
          throw e;
        }
      }
    } catch (e) {
      // -------- Fallback batching par fichier --------
      const canFallback =
        e instanceof ExtractionError &&
        (e.code === "NO_TOOL_CALL" || e.code === "PROVIDER_UNAVAILABLE" || e.code === "TIMEOUT") &&
        downloaded.length >= PER_FILE_FALLBACK_THRESHOLD;
      if (!canFallback) throw e;

      console.warn("[extract-tax-data] fallback per-file batching", {
        declarationId,
        files: downloaded.length,
      });
      await admin.from("declaration_audit_logs").insert({
        declaration_id: declarationId,
        user_id: userId,
        action: "extraction_retry_attempted",
        metadata: {
          reason: "PER_FILE_FALLBACK",
          attempt: "per_file",
          modelUsed: MODEL_USED,
          files: downloaded.length,
        },
      });

      const partialResults: ExtractedData[] = [];
      const failedFiles: string[] = [];
      for (const f of downloaded) {
        try {
          const r = await runOnce([f], `per_file:${f.name}`);
          partialResults.push(r);
        } catch (err) {
          failedFiles.push(f.name);
          console.warn("[extract-tax-data] fichier ignoré (per-file)", {
            file: f.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (partialResults.length === 0) {
        // tous ont échoué → on remonte l'erreur initiale
        throw e;
      }
      extracted = mergeExtractedDataResults(partialResults);
      usedPerFileFallback = true;
      if (failedFiles.length > 0) {
        extracted = {
          ...extracted,
          warnings: [
            ...extracted.warnings,
            `[fallback] ${failedFiles.length} fichier(s) non extraits : ${failedFiles.join(", ")}`,
          ],
          globalConfidence: "low",
        };
      }
    }

    if (!extracted) {
      throw new ExtractionError(
        "NO_TOOL_CALL",
        "Aucun résultat structuré retourné par le modèle",
        undefined, true, 502,
      );
    }

    console.log("[extract-tax-data] extraction OK", {
      declarationId,
      numberOfFiles: downloaded.length,
      fileNames: downloaded.map((d) => d.name),
      modelUsed: modelUsedFinal,
      extractionPromptVersion: EXTRACTION_PROMPT_VERSION,
      usedPerFileFallback,
      auditCalls,
      rawShape: finalRawShape,
      normalizedShape: finalNormalizedShape,
    });

    // Métadonnées système — injectées EXCLUSIVEMENT par le serveur.
    const extractedAt = new Date().toISOString();
    const metadata = {
      extractionPromptVersion: EXTRACTION_PROMPT_VERSION,
      extractedAt,
      modelUsed: modelUsedFinal,
      dryRun,
      ...(usedPerFileFallback ? { perFileFallback: true } : {}),
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
      modelUsed: modelUsedFinal,
      dryRun,
      detectedCategories: extracted.detectedCategories,
      globalConfidence: extracted.globalConfidence,
      status,
      numberOfFiles: downloaded.length,
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

    // --- Validation du contrat de réponse AVANT envoi ---
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
        ...deriveNormalizationReviewItems(normalizationWarnings),
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
    // ----- Gestion centralisée erreurs métier vs inconnues -----
    if (e instanceof ExtractionError) {
      console.error("[extract-tax-data] ExtractionError", {
        code: e.code,
        retryable: e.retryable,
        providerError: e.providerError,
        declarationId: declarationIdForLog,
      });
      // Audit log structuré
      try {
        if (admin && declarationIdForLog) {
          await admin.from("declaration_audit_logs").insert({
            declaration_id: declarationIdForLog,
            user_id: userIdForLog,
            action: "extraction_failed",
            metadata: {
              code: e.code,
              providerError: e.providerError ?? null,
              modelUsed: MODEL_USED,
              retryable: e.retryable,
              declarationId: declarationIdForLog,
              failedAt: new Date().toISOString(),
            },
          });
          // Marquer le statut pour que l'UI affiche "extraction_failed"
          await admin
            .from("declarations")
            .update({ status: "extraction_failed" })
            .eq("id", declarationIdForLog);
        }
      } catch (logErr) {
        console.warn("failed to log extraction_failed", logErr);
      }
      return new Response(
        JSON.stringify({
          error: e.userMessage,
          code: e.code,
          providerError: e.providerError,
          retryable: e.retryable,
          details: e.details,
        }),
        {
          status: e.httpStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.error("extract-tax-data error:", e);
    try {
      if (admin && declarationIdForLog) {
        await admin.from("declaration_audit_logs").insert({
          declaration_id: declarationIdForLog,
          user_id: userIdForLog,
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
