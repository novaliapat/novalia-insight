// Helpers d'appel des edge functions RAG depuis le front.
import { supabase } from "@/integrations/supabase/client";
import type { TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";

export interface RagSourceResult {
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

export interface RagSearchResponse {
  category: TaxCategory;
  query: string;
  taxYear: number | null;
  sources: RagSourceResult[];
  missingSources: boolean;
  warning: string | null;
}

export interface RagSearchInput {
  declarationId?: string | null;
  category: TaxCategory;
  query: string;
  taxYear?: number | null;
  limit?: number;
}

/** Recherche RAG dans UNE catégorie via l'edge function. */
export async function searchRagCategory(input: RagSearchInput): Promise<RagSearchResponse> {
  const { data, error } = await supabase.functions.invoke<RagSearchResponse>(
    "search-tax-rag",
    {
      body: {
        declarationId: input.declarationId ?? null,
        category: input.category,
        query: input.query,
        taxYear: input.taxYear ?? null,
        limit: input.limit ?? 6,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error("Empty RAG response");
  return data;
}

export interface RagIngestInput {
  title: string;
  category: TaxCategory;
  taxYear?: number | null;
  sourceType: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  documentDate?: string | null;
  isOfficialSource: boolean;
  content: string;
}

export interface RagIngestResponse {
  documentId: string;
  chunksCreated: number;
  embeddingModel: string;
}

export async function ingestRagDocument(input: RagIngestInput): Promise<RagIngestResponse> {
  const { data, error } = await supabase.functions.invoke<RagIngestResponse>(
    "ingest-tax-rag-document",
    { body: input },
  );
  if (error) throw error;
  if (!data) throw new Error("Empty ingest response");
  return data;
}
