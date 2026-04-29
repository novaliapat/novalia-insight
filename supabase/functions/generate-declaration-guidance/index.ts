import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

import { ExtractedDataSchema } from "../_shared/contracts/extractionContracts.ts";
import { DeclarationGuidanceSchema, type FormSource } from "../_shared/guidance/guidanceSchemas.ts";
import {
  buildDeclarationGuidance,
  type CategoryRagPayload,
} from "../_shared/guidance/guidanceBuilder.ts";

const InputSchema = z.object({
  declarationId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let declarationId: string | null = null;
  let dryRun = false;
  let userId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
    }
    declarationId = parsed.data.declarationId;
    dryRun = parsed.data.dryRun;

    admin = createClient(supabaseUrl, serviceKey);

    // ── 1) Vérification de la propriété de la déclaration ───────────────
    const { data: decl, error: declErr } = await admin
      .from("declarations")
      .select("id, user_id, tax_year")
      .eq("id", declarationId)
      .maybeSingle();
    if (declErr || !decl) return json({ error: "Declaration not found" }, 404);
    if (decl.user_id !== userId) return json({ error: "Forbidden" }, 403);

    const taxYear = (decl.tax_year as number | null) ?? new Date().getFullYear() - 1;

    // ── 2) Données validées (source de vérité) ──────────────────────────
    const { data: validatedRow, error: vErr } = await admin
      .from("declaration_validated_data")
      .select("validated_data")
      .eq("declaration_id", declarationId)
      .maybeSingle();
    if (vErr) {
      console.error("validated data fetch error", vErr);
      return await failAndAudit(
        admin,
        declarationId,
        userId,
        dryRun,
        "Erreur de chargement des données validées.",
      );
    }
    if (!validatedRow || !validatedRow.validated_data) {
      return json(
        { error: "Aucune donnée validée disponible pour générer le guide déclaratif." },
        409,
      );
    }
    const validatedParse = ExtractedDataSchema.safeParse(validatedRow.validated_data);
    if (!validatedParse.success) {
      console.error("validated data invalid", validatedParse.error.flatten());
      return await failAndAudit(
        admin,
        declarationId,
        userId,
        dryRun,
        "Données validées non conformes au schéma.",
      );
    }
    const validatedData = validatedParse.data;
    const detectedCategories = (validatedData.detectedCategories ?? []) as string[];

    // ── 3) Sources RAG par catégorie (chunks officiels uniquement, dédupliqués) ──
    const ragByCategory: Record<string, CategoryRagPayload> = {};
    if (detectedCategories.length > 0) {
      const { data: chunkRows } = await admin
        .from("tax_rag_chunks")
        .select(
          "id, document_id, category, content, summary, metadata, " +
            "tax_rag_documents:document_id(title, source_name, source_url, is_official_source, tax_year)",
        )
        .in("category", detectedCategories as never)
        .limit(200);

      type Row = {
        id: string;
        category: string;
        summary: string | null;
        content: string;
        metadata: Record<string, unknown> | null;
        tax_rag_documents: {
          title: string;
          source_name: string | null;
          source_url: string | null;
          is_official_source: boolean;
          tax_year: number | null;
        } | null;
      };

      for (const r of (chunkRows ?? []) as unknown as Row[]) {
        const doc = r.tax_rag_documents;
        if (!doc) continue;
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        const provenance =
          (meta.provenance as string | undefined) ??
          (doc.is_official_source ? "official_brochure" : "manual_seed");

        const source: FormSource = {
          documentId: r.id,
          chunkId: r.id,
          title: doc.title,
          sourceName: doc.source_name,
          sourceUrl: doc.source_url,
          sourceType: typeof meta.sourceType === "string" ? (meta.sourceType as string) : undefined,
          taxYear: doc.tax_year,
          isOfficialSource: !!doc.is_official_source,
          provenance: provenance as never,
          pageNumber: typeof meta.pageNumber === "number" ? (meta.pageNumber as number) : undefined,
          formId: typeof meta.formId === "string" ? (meta.formId as never) : undefined,
          sectionLabel:
            typeof meta.sectionLabel === "string" ? (meta.sectionLabel as string) : undefined,
          boxCodes: Array.isArray(meta.boxCodes) ? (meta.boxCodes as string[]) : undefined,
          excerpt: r.summary ?? r.content.slice(0, 500),
          warning: typeof meta.warning === "string" ? (meta.warning as string) : undefined,
        };

        const cat = r.category;
        const payload =
          ragByCategory[cat] ??
          ({ category: cat as never, sources: [], hasOfficial: false } as CategoryRagPayload);
        // Dédup par titre + page + boxes
        const key = `${source.title}|${source.pageNumber ?? ""}|${(source.boxCodes ?? []).join(",")}`;
        if (
          !payload.sources.some(
            (s) =>
              `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}` === key,
          )
        ) {
          payload.sources.push(source);
        }
        if (source.isOfficialSource) payload.hasOfficial = true;
        ragByCategory[cat] = payload;

        // Trace tax_rag_sources_used (best effort, non bloquant)
        await admin
          .from("tax_rag_sources_used")
          .insert({
            declaration_id: declarationId,
            chunk_id: r.id,
            document_id: r.document_id,
            category: cat as never,
            relevance_score: source.isOfficialSource ? 0.9 : 0.5,
            used_in_answer: true,
          })
          .then(
            () => undefined,
            (e) => console.warn("rag sources used insert", e?.message),
          );
      }
    }

    // ── 4) Construire le guidance ───────────────────────────────────────
    const built = buildDeclarationGuidance({
      taxYear,
      validatedData,
      ragByCategory,
    });

    // Validation Zod finale
    const validatedGuidance = DeclarationGuidanceSchema.safeParse(built.guidance);
    if (!validatedGuidance.success) {
      console.error("guidance schema invalid", validatedGuidance.error.flatten());
      return await failAndAudit(
        admin,
        declarationId,
        userId,
        dryRun,
        "Guide généré non conforme au schéma.",
      );
    }
    const guidance = validatedGuidance.data;
    const status = built.status;

    // ── 5) Persistance (sauf dryRun) ────────────────────────────────────
    if (!dryRun) {
      const { error: upErr } = await admin
        .from("declaration_guidance")
        .upsert(
          {
            declaration_id: declarationId,
            tax_year: taxYear,
            guidance: guidance as never,
            missing_sources: guidance.missingSources as never,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "declaration_id" },
        );
      if (upErr) {
        console.error("declaration_guidance upsert error", upErr);
      }
    }

    // ── 6) Audit log ────────────────────────────────────────────────────
    await admin.from("declaration_audit_logs").insert({
      declaration_id: declarationId,
      user_id: userId,
      action: "declaration_guidance_generated",
      metadata: {
        declarationId,
        generatedAt: new Date().toISOString(),
        taxYear,
        numberOfRequiredForms: guidance.requiredForms.length,
        numberOfSteps: guidance.declarationSteps.length,
        numberOfTaxBoxProposals: guidance.taxBoxProposals.length,
        numberOfManualReviewItems: guidance.manualReviewItems.length,
        numberOfMissingSources: guidance.missingSources.length,
        confidence: guidance.confidence,
        status,
        dryRun,
        warnings: built.warnings,
      },
    });

    return json({ status, guidance, dryRun });
  } catch (e) {
    console.error("generate-declaration-guidance fatal", e);
    if (admin && declarationId && userId) {
      await admin.from("declaration_audit_logs").insert({
        declaration_id: declarationId,
        user_id: userId,
        action: "declaration_guidance_failed",
        metadata: { error: (e as Error).message, dryRun },
      });
    }
    return json({ error: (e as Error).message }, 500);
  }
});

async function failAndAudit(
  admin: ReturnType<typeof createClient>,
  declarationId: string,
  userId: string,
  dryRun: boolean,
  message: string,
) {
  await admin.from("declaration_audit_logs").insert({
    declaration_id: declarationId,
    user_id: userId,
    action: "declaration_guidance_failed",
    metadata: { reason: message, dryRun },
  });
  return json({ error: message }, 422);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
