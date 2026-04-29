import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { RagSearchRequestSchema, type RagSearchResponse } from "../_shared/rag/ragSchemas.ts";
import { embedText, tokenize } from "../_shared/rag/ragEmbedding.ts";
import { scoreRagChunk, RAG_RELEVANCE_MEDIUM } from "../_shared/rag/ragScoring.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const parsed = RagSearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
    }
    const { declarationId, category, query, taxYear, limit } = parsed.data;

    // Si declarationId fourni, vérifier la propriété
    if (declarationId) {
      const { data: ownsRows, error: ownsErr } = await userClient
        .from("declarations")
        .select("id")
        .eq("id", declarationId)
        .maybeSingle();
      if (ownsErr || !ownsRows) {
        return json({ error: "Declaration not found or not owned" }, 403);
      }
    }

    // Embed query
    const queryEmbedding = embedText(query);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: matches, error: matchErr } = await admin.rpc("match_tax_rag_chunks", {
      query_embedding: queryEmbedding as unknown as string,
      match_category: category,
      match_tax_year: taxYear ?? null,
      match_count: limit,
    });

    if (matchErr) {
      console.error("match rpc error", matchErr);
      return json({ error: "Search failed", details: matchErr.message }, 500);
    }

    const queryTokens = tokenize(query);

    const sources = (matches ?? [])
      // GARDE-FOU dur : refuse tout chunk qui n'aurait pas la bonne catégorie
      .filter((row: any) => row.category === category)
      .map((row: any) => {
        const sim = Number(row.similarity ?? 0);
        const scored = scoreRagChunk({
          similarity: sim,
          isOfficialSource: !!row.is_official_source,
          chunkTaxYear: row.tax_year ?? null,
          documentDate: row.document_date ?? null,
          queryTaxYear: taxYear ?? null,
          queryKeywords: queryTokens,
          chunkKeywords: (row.keywords as string[] | null) ?? [],
          chunkContent: row.content,
        });
        return {
          documentId: row.document_id,
          chunkId: row.chunk_id,
          title: row.title,
          sourceName: row.source_name ?? null,
          sourceUrl: row.source_url ?? null,
          taxYear: row.tax_year ?? null,
          isOfficialSource: !!row.is_official_source,
          excerpt: String(row.content).slice(0, 600),
          similarity: sim,
          relevanceScore: scored.relevanceScore,
          confidence: scored.confidence,
          warnings: scored.warnings,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const topScore = sources[0]?.relevanceScore ?? 0;
    const missingSources = sources.length === 0 || topScore < RAG_RELEVANCE_MEDIUM;
    const warning = missingSources
      ? "Source insuffisante — point à vérifier"
      : null;

    // Log query
    await admin.from("tax_rag_queries").insert({
      declaration_id: declarationId ?? null,
      user_id: userId,
      category,
      query,
      retrieved_chunk_ids: sources.map((s) => s.chunkId),
      top_score: topScore,
    });

    const response: RagSearchResponse = {
      category,
      query,
      taxYear: taxYear ?? null,
      sources,
      missingSources,
      warning,
    };

    return json(response);
  } catch (e) {
    console.error("search fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
