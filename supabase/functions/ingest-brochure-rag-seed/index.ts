import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { extractKeywords } from "../_shared/rag/ragChunking.ts";
import { isRagCategory } from "../_shared/rag/ragCategories.ts";
import { embedText } from "../_shared/rag/ragEmbedding.ts";
import { BROCHURE_IR_2025_SEED, type BrochureSeedChunk } from "../_shared/seed/brochureIr2025Seed.ts";

const BROCHURE_NAME = "Brochure pratique IR 2025 — Déclaration des revenus 2024";
const BROCHURE_URL =
  "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/brochure_pratique_ir.pdf";
const SOURCE_TYPE = "official_brochure";
const TAX_YEAR = 2025;

function dedupKeyFor(c: BrochureSeedChunk): string {
  // Clé stable : sourceName + taxYear + formId + boxCodes + pageNumber + title
  const boxes = (c.boxCodes ?? []).slice().sort().join(",");
  return [
    c.sourceName,
    c.taxYear,
    c.formId,
    boxes,
    c.pageNumber,
    c.title,
  ].join("|");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Optionnel : vérifier rôle admin si la table user_roles est utilisée
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    // Politique souple : admin OK ; sinon n'importe quel user authentifié peut seeder
    // (les chunks resteront ratachés à son uploaded_by, mais marqués official_source).
    void isAdmin;

    // Grouper les chunks par catégorie
    const byCategory = new Map<string, BrochureSeedChunk[]>();
    for (const c of BROCHURE_IR_2025_SEED) {
      if (!isRagCategory(c.category)) continue;
      const arr = byCategory.get(c.category) ?? [];
      arr.push(c);
      byCategory.set(c.category, arr);
    }

    let insertedDocuments = 0;
    let insertedChunks = 0;
    let skippedChunks = 0;
    const categories: string[] = [];

    for (const [category, chunks] of byCategory.entries()) {
      categories.push(category);
      const docTitle = `Brochure IR 2025 — ${category}`;

      // 1) Récupère ou crée le document RAG pour cette catégorie
      const { data: existingDocs } = await admin
        .from("tax_rag_documents")
        .select("id, metadata")
        .eq("source_type", SOURCE_TYPE)
        .eq("category", category)
        .eq("tax_year", TAX_YEAR)
        .eq("title", docTitle)
        .limit(1);

      let docId: string;
      if (existingDocs && existingDocs.length > 0) {
        docId = existingDocs[0].id as string;
      } else {
        const { data: newDoc, error: insErr } = await admin
          .from("tax_rag_documents")
          .insert({
            title: docTitle,
            category,
            tax_year: TAX_YEAR,
            source_type: SOURCE_TYPE,
            source_name: BROCHURE_NAME,
            source_url: BROCHURE_URL,
            is_official_source: true,
            uploaded_by: userId,
            status: "active",
            metadata: { provenance: "official_brochure", income_year: 2024 },
          })
          .select("id")
          .single();
        if (insErr || !newDoc) {
          console.error("ingest brochure: doc insert error", insErr);
          continue;
        }
        docId = newDoc.id as string;
        insertedDocuments += 1;
      }

      // 2) Récupère les dedupKeys déjà présents dans ce document
      const { data: existingChunks } = await admin
        .from("tax_rag_chunks")
        .select("metadata")
        .eq("document_id", docId);

      const existingKeys = new Set<string>(
        (existingChunks ?? [])
          .map((r) => (r.metadata as Record<string, unknown> | null)?.dedupKey)
          .filter((k): k is string => typeof k === "string"),
      );

      // 3) Insert chunks manquants
      const rows: Record<string, unknown>[] = [];
      let nextIndex = existingChunks?.length ?? 0;
      for (const c of chunks) {
        const key = dedupKeyFor(c);
        if (existingKeys.has(key)) {
          skippedChunks += 1;
          continue;
        }
        rows.push({
          document_id: docId,
          category,
          tax_year: TAX_YEAR,
          chunk_index: nextIndex++,
          content: c.content,
          summary: c.excerpt,
          keywords: c.keywords?.length ? c.keywords : extractKeywords(c.content),
          embedding: embedText(c.content) as unknown as string,
          metadata: {
            dedupKey: key,
            provenance: "official_brochure",
            sourceType: SOURCE_TYPE,
            sourceName: c.sourceName,
            sourceUrl: c.sourceUrl,
            pageNumber: c.pageNumber,
            formId: c.formId,
            sectionLabel: c.sectionLabel,
            boxCodes: c.boxCodes,
            title: c.title,
            warning: c.warning,
          },
        });
      }

      if (rows.length > 0) {
        const { error: chErr } = await admin.from("tax_rag_chunks").insert(rows);
        if (chErr) {
          console.error("ingest brochure: chunks insert error", chErr);
          continue;
        }
        insertedChunks += rows.length;
      }
    }

    return json({
      insertedDocuments,
      insertedChunks,
      skippedChunks,
      categories,
      totalSeedChunks: BROCHURE_IR_2025_SEED.length,
    });
  } catch (e) {
    console.error("ingest-brochure-rag-seed fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
