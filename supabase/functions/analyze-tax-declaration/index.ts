// Edge function : analyze-tax-declaration (Lot 4 — analyse fiscale réelle).
//
// Pipeline :
//  1. Auth + ownership
//  2. Charge declaration + validated_data (fallback extracted_data si pas validé)
//  3. Pour chaque catégorie détectée : recherche RAG SÉPARÉE (cloisonnée)
//  4. Appel IA via Lovable AI Gateway (tool calling structuré)
//  5. Parse + Zod
//  6. Safety checks déterministes
//  7. Calcul analysis_status
//  8. Si dryRun=false : persiste analyse, sources utilisées, statut, audit log

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { searchRagInternal, makeAdminClient } from "../_shared/rag/ragInternalSearch.ts";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_TOOL_SCHEMA,
  ANALYSIS_PROMPT_VERSION,
  ANALYSIS_MODEL,
  buildAnalysisUserPrompt,
  CATEGORY_QUERY,
} from "./analysisPrompt.ts";
import { applyAnalysisSafetyChecks, computeAnalysisStatus } from "../_shared/analysis/analysisSafetyChecks.ts";

const RequestSchema = z.object({
  declarationId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
});

// Schéma de validation minimal (la vérité côté front est FiscalAnalysisSchema).
const RagSourceSchema = z.object({
  category: z.string(),
  documentTitle: z.string(),
  excerpt: z.string().optional(),
  reference: z.string().optional(),
  url: z.string().optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  documentId: z.string().optional(),
  chunkId: z.string().optional(),
  sourceName: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  isOfficialSource: z.boolean().optional(),
  taxYear: z.number().int().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

const TaxCaseSchema = z.object({
  id: z.string(),
  category: z.string(),
  form: z.string(),
  box: z.string(),
  label: z.string(),
  amount: z.number().nullable(),
  explanation: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  ragSources: z.array(RagSourceSchema).default([]),
  sourceDocument: z.string().optional(),
  warning: z.string().optional(),
  requiresManualReview: z.boolean().default(false),
});

const FiscalAnalysisSchema = z.object({
  summary: z.string(),
  taxYear: z.number().int(),
  analyzedCategories: z.array(z.string()).default([]),
  taxForms: z.array(z.string()).default([]),
  taxCases: z.array(TaxCaseSchema).default([]),
  amountsByCategory: z
    .array(z.object({ category: z.string(), totalAmount: z.number(), caseCount: z.number().int() }))
    .default([]),
  warnings: z.array(z.string()).default([]),
  uncertaintyPoints: z.array(z.string()).default([]),
  requiredDocuments: z.array(z.string()).default([]),
  finalChecklist: z.array(z.string()).default([]),
  limitations: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let declarationId: string | null = null;
  let dryRun = false;
  const admin = makeAdminClient();

  try {
    // ---------- Auth ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    // ---------- Input ----------
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
    declarationId = parsed.data.declarationId;
    dryRun = parsed.data.dryRun ?? false;

    // ---------- Ownership ----------
    const { data: declRow, error: declErr } = await userClient
      .from("declarations")
      .select("id, tax_year, user_id")
      .eq("id", declarationId)
      .maybeSingle();
    if (declErr || !declRow) return json({ error: "Declaration not found" }, 404);

    // ---------- analysis_status = processing ----------
    if (!dryRun) {
      await admin
        .from("declarations")
        .update({ analysis_status: "analysis_processing" })
        .eq("id", declarationId);
    }

    // ---------- Validated data (fallback extracted) ----------
    const { data: vRow } = await admin
      .from("declaration_validated_data")
      .select("validated_data")
      .eq("declaration_id", declarationId)
      .maybeSingle();
    const { data: eRow } = await admin
      .from("declaration_extracted_data")
      .select("extracted_data, detected_categories")
      .eq("declaration_id", declarationId)
      .maybeSingle();

    const validatedData = (vRow?.validated_data ?? eRow?.extracted_data ?? {}) as Record<string, unknown>;
    const detectedCategories: string[] = Array.isArray((validatedData as any).detectedCategories)
      ? (validatedData as any).detectedCategories
      : (eRow?.detected_categories ?? []) as string[];

    if (detectedCategories.length === 0) {
      const empty = await persistOrReturn({
        admin,
        declarationId,
        dryRun,
        userId: userData.user.id,
        analysis: {
          summary: "Aucune catégorie fiscale détectée — analyse non produite.",
          taxYear: declRow.tax_year,
          analyzedCategories: [],
          taxForms: [],
          taxCases: [],
          amountsByCategory: [],
          warnings: ["Aucune catégorie détectée à analyser."],
          uncertaintyPoints: [],
          requiredDocuments: [],
          finalChecklist: [],
          limitations: DEFAULT_LIMITATIONS,
        },
        ragByCategory: {},
        safetyIssues: [],
        analysisStatus: "analysis_completed_with_warnings",
      });
      return json(empty);
    }

    // ---------- Recherche RAG par catégorie (séparée !) ----------
    const taxYear = declRow.tax_year as number;
    const ragByCategory: Record<string, Awaited<ReturnType<typeof searchRagInternal>>> = {};
    await Promise.all(
      detectedCategories.map(async (cat) => {
        const query = CATEGORY_QUERY[cat] ?? `règles fiscales ${cat}`;
        const res = await searchRagInternal({ admin, category: cat, query, taxYear, limit: 6 });
        // Sécurité supplémentaire : on vérifie que la catégorie de retour matche.
        if (res.category !== cat) {
          ragByCategory[cat] = { ...res, category: cat, sources: [] };
        } else {
          ragByCategory[cat] = res;
        }
      }),
    );

    // ---------- Appel IA ----------
    const userPrompt = buildAnalysisUserPrompt({ taxYear, validatedData, ragByCategory });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [ANALYSIS_TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "produce_fiscal_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      await failAndAudit(admin, declarationId, userData.user.id, dryRun, {
        reason: `AI gateway ${aiRes.status}`,
        body: t.slice(0, 1000),
      });
      if (aiRes.status === 429) return json({ error: "Rate limits exceeded — réessayez dans un instant." }, 429);
      if (aiRes.status === 402) return json({ error: "Crédits IA épuisés. Ajoutez des fonds dans votre workspace Lovable AI." }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      await failAndAudit(admin, declarationId, userData.user.id, dryRun, { reason: "No tool call" });
      return json({ error: "AI did not return a tool call" }, 500);
    }
    let rawAnalysis: unknown;
    try {
      rawAnalysis = JSON.parse(args);
    } catch (e) {
      await failAndAudit(admin, declarationId, userData.user.id, dryRun, { reason: "Invalid JSON" });
      return json({ error: "AI returned invalid JSON", details: (e as Error).message }, 500);
    }

    // ---------- Validation Zod ----------
    const zParsed = FiscalAnalysisSchema.safeParse(rawAnalysis);
    if (!zParsed.success) {
      console.error("Zod fail", zParsed.error.flatten());
      await failAndAudit(admin, declarationId, userData.user.id, dryRun, {
        reason: "Zod validation failed",
        details: zParsed.error.flatten(),
      });
      return json({ error: "Invalid analysis shape", details: zParsed.error.flatten() }, 500);
    }

    // ---------- Safety checks déterministes ----------
    const safety = applyAnalysisSafetyChecks(zParsed.data);
    const finalAnalysis = safety.analysis;
    const analysisStatus = computeAnalysisStatus(finalAnalysis);

    // ---------- Persist (sauf dryRun) ----------
    return json(
      await persistOrReturn({
        admin,
        declarationId,
        dryRun,
        userId: userData.user.id,
        analysis: finalAnalysis,
        ragByCategory,
        safetyIssues: safety.issues,
        analysisStatus,
      }),
    );
  } catch (e) {
    console.error("analyze-tax-declaration fatal", e);
    if (declarationId) {
      try {
        await admin
          .from("declarations")
          .update({ analysis_status: "analysis_failed" })
          .eq("id", declarationId);
        await admin.from("declaration_audit_logs").insert({
          declaration_id: declarationId,
          action: "fiscal_analysis_failed",
          metadata: { reason: (e as Error).message, dryRun },
        });
      } catch (_) { /* swallow */ }
    }
    return json({ error: (e as Error).message }, 500);
  }
});

const DEFAULT_LIMITATIONS =
  "Cette analyse est une aide à la préparation de votre déclaration fiscale. " +
  "Les cases proposées doivent être vérifiées avant toute déclaration officielle. " +
  "En cas de doute, rapprochez-vous de l'administration fiscale ou de votre conseil habituel.";

interface PersistInput {
  admin: ReturnType<typeof makeAdminClient>;
  declarationId: string;
  dryRun: boolean;
  userId: string;
  analysis: any;
  ragByCategory: Record<string, any>;
  safetyIssues: any[];
  analysisStatus: "analysis_completed" | "analysis_completed_with_warnings" | "analysis_needs_review";
}

async function persistOrReturn(input: PersistInput) {
  const {
    admin, declarationId, dryRun, userId, analysis, ragByCategory, safetyIssues, analysisStatus,
  } = input;

  // Force la limitation par défaut si absente
  if (!analysis.limitations) analysis.limitations = DEFAULT_LIMITATIONS;

  const ragQueriesByCategory: Record<string, number> = {};
  const ragSourcesUsedByCategory: Record<string, number> = {};
  Object.entries(ragByCategory).forEach(([cat, r]: [string, any]) => {
    ragQueriesByCategory[cat] = 1;
    ragSourcesUsedByCategory[cat] = (r?.sources?.length ?? 0);
  });

  const auditMeta = {
    declarationId,
    analyzedAt: new Date().toISOString(),
    modelUsed: ANALYSIS_MODEL,
    promptVersion: ANALYSIS_PROMPT_VERSION,
    analyzedCategories: analysis.analyzedCategories ?? [],
    numberOfTaxCases: analysis.taxCases?.length ?? 0,
    numberOfTaxCasesWithSources:
      analysis.taxCases?.filter((c: any) => (c.ragSources?.length ?? 0) > 0).length ?? 0,
    numberOfManualReviewCases:
      analysis.taxCases?.filter((c: any) => c.requiresManualReview).length ?? 0,
    numberOfWarnings: analysis.warnings?.length ?? 0,
    ragQueriesByCategory,
    ragSourcesUsedByCategory,
    safetyCheckIssues: safetyIssues.length,
    dryRun,
  };

  if (dryRun) {
    return {
      analysis,
      analysisStatus,
      ragByCategory,
      safetyIssues,
      audit: auditMeta,
      dryRun: true,
    };
  }

  // Upsert analysis
  await admin.from("declaration_fiscal_analysis").delete().eq("declaration_id", declarationId);
  const { data: insRow, error: insErr } = await admin
    .from("declaration_fiscal_analysis")
    .insert({
      declaration_id: declarationId,
      analysis,
      model_used: ANALYSIS_MODEL,
      prompt_version: ANALYSIS_PROMPT_VERSION,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  const analysisId = insRow.id;

  // Sources réellement utilisées dans les taxCases
  const usedRows: any[] = [];
  for (const tc of analysis.taxCases ?? []) {
    for (const src of tc.ragSources ?? []) {
      if (!src.documentId || !src.chunkId) continue;
      // GARDE-FOU : refuse de tracer une source qui ne matcherait pas la catégorie de la case
      if (src.category !== tc.category) continue;
      usedRows.push({
        declaration_id: declarationId,
        analysis_id: analysisId,
        category: tc.category,
        document_id: src.documentId,
        chunk_id: src.chunkId,
        relevance_score: src.relevanceScore ?? null,
        used_in_answer: true,
      });
    }
  }
  if (usedRows.length > 0) {
    await admin.from("tax_rag_sources_used").insert(usedRows);
  }

  // Statut
  await admin
    .from("declarations")
    .update({ analysis_status: analysisStatus })
    .eq("id", declarationId);

  // Audit log
  await admin.from("declaration_audit_logs").insert({
    declaration_id: declarationId,
    user_id: userId,
    action: "fiscal_analysis_generated",
    metadata: auditMeta,
  });

  return {
    analysis,
    analysisId,
    analysisStatus,
    ragByCategory,
    safetyIssues,
    audit: auditMeta,
    dryRun: false,
  };
}

async function failAndAudit(
  admin: ReturnType<typeof makeAdminClient>,
  declarationId: string,
  userId: string,
  dryRun: boolean,
  metadata: Record<string, unknown>,
) {
  if (dryRun) return;
  try {
    await admin
      .from("declarations")
      .update({ analysis_status: "analysis_failed" })
      .eq("id", declarationId);
    await admin.from("declaration_audit_logs").insert({
      declaration_id: declarationId,
      user_id: userId,
      action: "fiscal_analysis_failed",
      metadata,
    });
  } catch (_) { /* swallow */ }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
