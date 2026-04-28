import type { RagSource } from "./ragSchemas";
import { RAG_RELEVANCE_THRESHOLD } from "./ragSchemas";

export const isRagInsufficient = (sources: RagSource[]): boolean => {
  if (sources.length === 0) return true;
  const top = sources.reduce((m, s) => Math.max(m, s.relevanceScore ?? 0), 0);
  return top < RAG_RELEVANCE_THRESHOLD;
};

export const formatRelevance = (score?: number): string => {
  if (score === undefined) return "—";
  return `${Math.round(score * 100)}%`;
};
