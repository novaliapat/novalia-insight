import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { RagIngestRequestSchema } from "../_shared/rag/ragSchemas.ts";
import { chunkText, extractKeywords } from "../_shared/rag/ragChunking.ts";
import { embedText, EMBEDDING_MODEL } from "../_shared/rag/ragEmbedding.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const parsed = RagIngestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Insert document
    const { data: doc, error: docErr } = await admin
      .from("tax_rag_documents")
      .insert({
        title: input.title,
        category: input.category,
        tax_year: input.taxYear ?? null,
        source_type: input.sourceType,
        source_name: input.sourceName ?? null,
        source_url: input.sourceUrl ?? null,
        document_date: input.documentDate ?? null,
        is_official_source: input.isOfficialSource,
        uploaded_by: userId,
        status: "active",
        metadata: { embedding_model: EMBEDDING_MODEL },
      })
      .select()
      .single();

    if (docErr || !doc) {
      console.error("ingest doc error", docErr);
      return json({ error: "Could not create document", details: docErr?.message }, 500);
    }

    // 2) Chunk + embed
    const chunks = chunkText(input.content);
    if (chunks.length === 0) {
      return json({ error: "Empty content after chunking" }, 400);
    }

    const rows = chunks.map((c) => ({
      document_id: doc.id,
      category: input.category, // hérite OBLIGATOIREMENT de la catégorie du document
      tax_year: input.taxYear ?? null,
      chunk_index: c.index,
      content: c.content,
      keywords: extractKeywords(c.content),
      embedding: embedText(c.content) as unknown as string,
    }));

    const { error: chunksErr } = await admin.from("tax_rag_chunks").insert(rows);
    if (chunksErr) {
      console.error("ingest chunks error", chunksErr);
      // rollback : supprimer le document pour éviter un doc orphelin sans chunks
      await admin.from("tax_rag_documents").delete().eq("id", doc.id);
      return json({ error: "Could not create chunks", details: chunksErr.message }, 500);
    }

    return json({
      documentId: doc.id,
      chunksCreated: rows.length,
      embeddingModel: EMBEDDING_MODEL,
    });
  } catch (e) {
    console.error("ingest fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
