// Edge function: generate-tax-summary-pdf
// Lot 5 — Génère un PDF de synthèse fiscale, le stocke dans le bucket privé
// `tax-summary-pdfs`, enregistre l'export en base et renvoie une URL signée.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { buildTaxSummaryPdf } from "./pdfBuilder.ts";

const BodySchema = z.object({
  declarationId: z.string().uuid(),
  includeAudit: z.boolean().optional().default(false),
  includeRagSources: z.boolean().optional().default(true),
  includeReviewItems: z.boolean().optional().default(true),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
    const user = userData.user;

    let body: z.infer<typeof BodySchema>;
    try {
      const parsed = BodySchema.safeParse(await req.json());
      if (!parsed.success) return json(400, { error: parsed.error.flatten() });
      body = parsed.data;
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Charger la déclaration et vérifier la propriété
    const { data: decl, error: declErr } = await admin
      .from("declarations").select("*").eq("id", body.declarationId).maybeSingle();
    if (declErr) return json(500, { error: declErr.message });
    if (!decl) return json(404, { error: "Declaration introuvable" });
    if (decl.user_id !== user.id) return json(403, { error: "Accès refusé" });

    // Charger les données associées
    const [extractedRes, validatedRes, analysisRes, guidanceRes, reviewRes, auditRes, sourcesRes, profileRes] = await Promise.all([
      admin.from("declaration_extracted_data").select("*").eq("declaration_id", body.declarationId).maybeSingle(),
      admin.from("declaration_validated_data").select("*").eq("declaration_id", body.declarationId).maybeSingle(),
      admin.from("declaration_fiscal_analysis").select("*").eq("declaration_id", body.declarationId).maybeSingle(),
      admin.from("declaration_guidance").select("guidance, status").eq("declaration_id", body.declarationId).maybeSingle(),
      body.includeReviewItems
        ? admin.from("declaration_review_items").select("*").eq("declaration_id", body.declarationId).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      body.includeAudit
        ? admin.from("declaration_audit_logs").select("*").eq("declaration_id", body.declarationId).order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      body.includeRagSources
        ? admin.from("tax_rag_sources_used").select("*, doc:tax_rag_documents(title, source_name, source_url, is_official_source, tax_year)").eq("declaration_id", body.declarationId)
        : Promise.resolve({ data: [], error: null }),
      admin.from("profiles").select("display_name, email").eq("user_id", user.id).maybeSingle(),
    ]);

    const extracted = extractedRes.data;
    const validated = validatedRes.data;
    const analysis = analysisRes.data;
    const guidanceRow = guidanceRes.data;

    if (!analysis) {
      return json(409, { error: "Analyse fiscale manquante. Lancez l'analyse avant d'exporter." });
    }
    if (!guidanceRow?.guidance) {
      return json(409, { error: "Guide déclaratif manquant. Générez le guide avant d'exporter." });
    }

    const ragSourcesUsed = (sourcesRes.data ?? []).map((r: any) => ({
      ...r,
      title: r.doc?.title,
      source_name: r.doc?.source_name,
      source_url: r.doc?.source_url,
      is_official_source: r.doc?.is_official_source,
      tax_year: r.doc?.tax_year,
    }));

    const generatedAt = new Date();
    const pdfBytes = await buildTaxSummaryPdf({
      declaration: decl,
      contribuable: profileRes.data?.display_name ?? profileRes.data?.email ?? null,
      generatedAt,
      extracted: extracted as any,
      detectedCategories: (extracted as any)?.detected_categories ?? [],
      validated: validated as any,
      analysis: analysis?.analysis ?? null,
      reviewItems: reviewRes.data ?? [],
      auditLogs: auditRes.data ?? [],
      ragSourcesUsed,
      options: {
        includeAudit: body.includeAudit,
        includeRagSources: body.includeRagSources,
        includeReviewItems: body.includeReviewItems,
      },
    });

    const ts = generatedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `synthese-fiscale-${decl.tax_year}-${ts}.pdf`;
    const storagePath = `${user.id}/${decl.id}/${fileName}`;

    const { error: upErr } = await admin.storage
      .from("tax-summary-pdfs")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      await admin.from("declaration_audit_logs").insert({
        declaration_id: decl.id, user_id: user.id,
        action: "tax_summary_pdf_failed",
        metadata: { declaration_id: decl.id, error: upErr.message, failed_at: generatedAt.toISOString() },
      });
      return json(500, { error: `Échec stockage PDF: ${upErr.message}` });
    }

    const { data: exportRow, error: insErr } = await admin
      .from("declaration_exports").insert({
        declaration_id: decl.id,
        user_id: user.id,
        export_type: "tax_summary_pdf",
        storage_path: storagePath,
        file_name: fileName,
        include_audit: body.includeAudit,
        include_rag_sources: body.includeRagSources,
        include_review_items: body.includeReviewItems,
        metadata: { tax_year: decl.tax_year, size_bytes: pdfBytes.byteLength, generated_at: generatedAt.toISOString() },
      }).select().single();

    if (insErr) {
      await admin.storage.from("tax-summary-pdfs").remove([storagePath]);
      return json(500, { error: `Échec enregistrement export: ${insErr.message}` });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("tax-summary-pdfs").createSignedUrl(storagePath, 60 * 10);
    if (signErr) return json(500, { error: signErr.message });

    await admin.from("declaration_audit_logs").insert({
      declaration_id: decl.id, user_id: user.id,
      action: "tax_summary_pdf_generated",
      metadata: {
        declaration_id: decl.id,
        export_id: exportRow.id,
        include_audit: body.includeAudit,
        include_rag_sources: body.includeRagSources,
        include_review_items: body.includeReviewItems,
        generated_at: generatedAt.toISOString(),
        file_name: fileName,
        storage_path: storagePath,
      },
    });

    return json(200, {
      exportId: exportRow.id,
      fileName,
      storagePath,
      signedUrl: signed.signedUrl,
      sizeBytes: pdfBytes.byteLength,
    });
  } catch (e) {
    console.error("[generate-tax-summary-pdf]", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
