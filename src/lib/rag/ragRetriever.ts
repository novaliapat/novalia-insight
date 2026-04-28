/**
 * RAG Retriever — V1 mockée.
 *
 * Contrat (à respecter en V2) :
 *  - UNE recherche par catégorie, dans la bibliothèque correspondante.
 *  - Aucun mélange de sources entre catégories.
 *  - Si aucune source ne dépasse RAG_RELEVANCE_THRESHOLD → isInsufficient = true.
 */
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import { MOCK_RAG_SOURCES } from "./ragMockSources";
import { RAG_RELEVANCE_THRESHOLD, type RagSearchResult } from "./ragSchemas";

export interface RagSearchInput {
  category: TaxCategory;
  query: string;
}

/** Recherche dans UNE bibliothèque catégorielle. */
export async function searchRagLibrary(input: RagSearchInput): Promise<RagSearchResult> {
  const sources = MOCK_RAG_SOURCES[input.category] ?? [];
  const topScore = sources.reduce((m, s) => Math.max(m, s.relevanceScore ?? 0), 0);
  return {
    category: input.category,
    query: input.query,
    sources,
    isInsufficient: sources.length === 0 || topScore < RAG_RELEVANCE_THRESHOLD,
  };
}

/** Recherche en parallèle dans plusieurs bibliothèques (une par catégorie). */
export async function searchRagByCategories(
  inputs: RagSearchInput[],
): Promise<RagSearchResult[]> {
  return Promise.all(inputs.map(searchRagLibrary));
}
