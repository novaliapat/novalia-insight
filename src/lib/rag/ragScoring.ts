// SOURCE DE VÉRITÉ — Scoring RAG côté front. Doit rester aligné avec
// supabase/functions/_shared/rag/ragScoring.ts.

export interface RagScoringInput {
  similarity: number;
  isOfficialSource: boolean;
  chunkTaxYear: number | null;
  documentDate: string | null;
  queryTaxYear: number | null;
  queryKeywords: string[];
  chunkKeywords: string[];
  chunkContent: string;
}

export type RagConfidence = "high" | "medium" | "low";

export interface RagScoringOutput {
  relevanceScore: number;
  confidence: RagConfidence;
  warnings: string[];
}

const HIGH_THRESHOLD = 0.75;
const MED_THRESHOLD = 0.55;

const normalizeWord = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export function scoreRagChunk(input: RagScoringInput): RagScoringOutput {
  const warnings: string[] = [];
  let score = Math.max(0, Math.min(1, input.similarity));

  if (input.isOfficialSource) score += 0.08;

  if (input.queryTaxYear !== null) {
    if (input.chunkTaxYear === input.queryTaxYear) {
      score += 0.06;
    } else if (input.chunkTaxYear !== null && input.chunkTaxYear !== input.queryTaxYear) {
      score -= 0.1;
      warnings.push(
        `Année fiscale différente : source ${input.chunkTaxYear} vs requête ${input.queryTaxYear}`,
      );
    }
  }

  if (input.documentDate) {
    const year = Number(input.documentDate.slice(0, 4));
    const refYear = input.queryTaxYear ?? new Date().getFullYear();
    const age = refYear - year;
    if (age >= 5) {
      score -= 0.05;
      warnings.push(`Source ancienne (${year})`);
    }
  }

  const queryNorm = new Set(
    input.queryKeywords.map(normalizeWord).filter((w) => w.length >= 3),
  );
  const chunkNorm = new Set([
    ...input.chunkKeywords.map(normalizeWord),
    ...input.chunkContent
      .split(/\s+/)
      .map(normalizeWord)
      .filter((w) => w.length >= 4),
  ]);
  let matches = 0;
  queryNorm.forEach((w) => {
    if (chunkNorm.has(w)) matches += 1;
  });
  if (queryNorm.size > 0) {
    const ratio = matches / queryNorm.size;
    score += Math.min(0.1, ratio * 0.1);
  }

  score = Math.max(0, Math.min(1, score));

  let confidence: RagConfidence = "low";
  if (score >= HIGH_THRESHOLD) confidence = "high";
  else if (score >= MED_THRESHOLD) confidence = "medium";

  return { relevanceScore: Number(score.toFixed(4)), confidence, warnings };
}

export const RAG_RELEVANCE_HIGH = HIGH_THRESHOLD;
export const RAG_RELEVANCE_MEDIUM = MED_THRESHOLD;
