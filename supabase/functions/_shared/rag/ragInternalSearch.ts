// Helper backend (Deno) : recherche RAG par catégorie en accédant directement
// à la base via le client admin (pas de saut HTTP entre edge fns).
// Garantit le cloisonnement par filtre SQL strict.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { embedText, tokenize } from "../rag/ragEmbedding.ts";
import { scoreRagChunk, RAG_RELEVANCE_MEDIUM } from "../rag/ragScoring.ts";

export interface InternalRagSource {
  documentId: string;
  chunkId: string;
  title: string;
  sourceName: string | null;
  sourceUrl: string | null;
  taxYear: number | null;
  isOfficialSource: boolean;
  excerpt: string;
  similarity: number;
  relevanceScore: number;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface InternalRagResponse {
  category: string;
  query: string;
  taxYear: number | null;
  sources: InternalRagSource[];
  missingSources: boolean;
  warning: string | null;
}

export interface InternalRagSearchInput {
  admin: SupabaseClient;
  category: string;
  query: string;
  taxYear: number | null;
  limit?: number;
}

export async function searchRagInternal(
  input: InternalRagSearchInput,
): Promise<InternalRagResponse> {
  const { admin, category, query, taxYear } = input;
  const limit = input.limit ?? 6;

  const queryEmbedding = embedText(query);

  const { data: matches, error } = await admin.rpc("match_tax_rag_chunks", {
    query_embedding: queryEmbedding as unknown as string,
    match_category: category,
    match_tax_year: taxYear ?? null,
    match_count: limit,
  });

  if (error) {
    console.error("searchRagInternal rpc error", error);
    return {
      category,
      query,
      taxYear,
      sources: [],
      missingSources: true,
      warning: "Recherche RAG en erreur — point à vérifier",
    };
  }

  const queryTokens = tokenize(query);

  const sources: InternalRagSource[] = (matches ?? [])
    // Garde-fou strict : aucune source d'une autre catégorie ne passe.
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

  return {
    category,
    query,
    taxYear,
    sources,
    missingSources,
    warning: missingSources ? "Source insuffisante — point à vérifier" : null,
  };
}

/** Crée un admin client à partir des env vars standards. */
export function makeAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
