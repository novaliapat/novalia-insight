import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  EXTRACTION_PROMPT_VERSION,
} from "./extractionPrompt.ts";

const MODEL_USED = "google/gemini-2.5-pro";

// ---------------- Schémas Zod (mirror du front) ----------------

const ConfidenceLevelEnum = z.enum(["high", "medium", "low"]);

const TaxCategoryEnum = z.enum([
  "ifu",
  "scpi",
  "life_insurance",
  "real_estate_income",
  "dividends",
  "interests",
  "capital_gains",
  "foreign_accounts",
  "per",
  "tax_credits",
  "deductible_expenses",
  "other",
]);

const ConfidentNumber = z.object({
  value: z.number(),
  confidence: ConfidenceLevelEnum,
  sourceDocument: z.string().optional(),
  note: z.string().optional(),
});

const TaxpayerSchema = z.object({
  fullName: z.string().optional(),
  fiscalNumber: z.string().optional(),
  taxHousehold: z.string().optional(),
  address: z.string().optional(),
});

const IFUEntrySchema = z.object({
  institution: z.string(),
  accountNumber: z.string().optional(),
  dividends: ConfidentNumber.optional(),
  interests: ConfidentNumber.optional(),
  capitalGains: ConfidentNumber.optional(),
  withholdingTax: ConfidentNumber.optional(),
  socialContributions: ConfidentNumber.optional(),
});

const SCPIEntrySchema = z.object({
  scpiName: z.string(),
  managementCompany: z.string().optional(),
  frenchIncome: ConfidentNumber.optional(),
  foreignIncome: ConfidentNumber.optional(),
  deductibleInterests: ConfidentNumber.optional(),
  socialContributions: ConfidentNumber.optional(),
});

const LifeInsuranceEntrySchema = z.object({
  contractName: z.string(),
  insurer: z.string().optional(),
  contractAge: z.enum(["less_than_8", "more_than_8"]).optional(),
  withdrawals: ConfidentNumber.optional(),
  taxableShare: ConfidentNumber.optional(),
  withholdingTax: ConfidentNumber.optional(),
});

const ExtractedDataSchema = z.object({
  taxpayer: TaxpayerSchema,
  taxYear: z.number().int(),
  detectedCategories: z.array(TaxCategoryEnum).default([]),
  ifu: z.array(IFUEntrySchema).default([]),
  scpi: z.array(SCPIEntrySchema).default([]),
  lifeInsurance: z.array(LifeInsuranceEntrySchema).default([]),
  warnings: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
  globalConfidence: ConfidenceLevelEnum.default("medium"),
  extractionPromptVersion: z.string().optional(),
  extractedAt: z.string().optional(),
  modelUsed: z.string().optional(),
});

type ExtractedData = z.infer<typeof ExtractedDataSchema>;

// ---------------- Input ----------------

const RequestSchema = z.object({
  declarationId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
});

// ---------------- Prompts ----------------
// Voir extractionPrompt.ts (séparé pour pouvoir itérer indépendamment).

// ---------------- Tool schema (structured output) ----------------

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
        ifu: { type: "array", items: { type: "object" } },
        scpi: { type: "array", items: { type: "object" } },
        lifeInsurance: { type: "array", items: { type: "object" } },
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
    const { declarationId } = parsedBody.data;

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

    // Marquer "extraction_pending"
    await admin
      .from("declarations")
      .update({ status: "extraction_pending" })
      .eq("id", declarationId);

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
      // Lovable AI / OpenAI-compatible : image_url accepte data URLs (images & pdf selon modèle)
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
        model: "google/gemini-2.5-pro",
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

    const validated = ExtractedDataSchema.safeParse(raw);
    if (!validated.success) {
      console.error("Zod validation failed", validated.error.flatten());
      return jsonError(502, "Réponse IA non conforme au schéma", validated.error.flatten());
    }
    const extracted: ExtractedData = validated.data;

    // --- Persistance ---
    const confidenceScore =
      extracted.globalConfidence === "high" ? 0.9 :
      extracted.globalConfidence === "medium" ? 0.6 : 0.3;

    // upsert manuel : delete + insert (pas de contrainte unique)
    await admin.from("declaration_extracted_data").delete().eq("declaration_id", declarationId);
    const { error: insErr } = await admin.from("declaration_extracted_data").insert({
      declaration_id: declarationId,
      extracted_data: extracted as unknown as Record<string, unknown>,
      detected_categories: extracted.detectedCategories,
      confidence_score: confidenceScore,
    });
    if (insErr) {
      console.error("insert extracted_data failed", insErr);
      return jsonError(500, "Persistance des données extraites échouée");
    }

    await admin
      .from("declarations")
      .update({ status: "extraction_done" })
      .eq("id", declarationId);

    await admin.from("declaration_audit_logs").insert({
      declaration_id: declarationId,
      user_id: userId,
      action: "extraction_completed",
      metadata: {
        files_count: files.length,
        confidence: extracted.globalConfidence,
        detected_categories: extracted.detectedCategories,
      },
    });

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-tax-data error:", e);
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
