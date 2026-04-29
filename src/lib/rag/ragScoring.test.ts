import { describe, it, expect } from "vitest";
import { scoreRagChunk, RAG_RELEVANCE_HIGH, RAG_RELEVANCE_MEDIUM } from "./ragScoring";

const base = {
  similarity: 0.7,
  isOfficialSource: false,
  chunkTaxYear: null,
  documentDate: null,
  queryTaxYear: null,
  queryKeywords: [],
  chunkKeywords: [],
  chunkContent: "",
};

describe("ragScoring", () => {
  it("source officielle reçoit un bonus", () => {
    const a = scoreRagChunk(base);
    const b = scoreRagChunk({ ...base, isOfficialSource: true });
    expect(b.relevanceScore).toBeGreaterThan(a.relevanceScore);
  });

  it("année exacte favorise, année différente pénalise et warn", () => {
    const exact = scoreRagChunk({ ...base, queryTaxYear: 2024, chunkTaxYear: 2024 });
    const diff = scoreRagChunk({ ...base, queryTaxYear: 2024, chunkTaxYear: 2018 });
    expect(exact.relevanceScore).toBeGreaterThan(diff.relevanceScore);
    expect(diff.warnings.some((w) => /Année fiscale/i.test(w))).toBe(true);
  });

  it("source ancienne (>=5 ans) génère un warning", () => {
    const r = scoreRagChunk({
      ...base,
      similarity: 0.8,
      queryTaxYear: 2024,
      documentDate: "2018-01-01",
    });
    expect(r.warnings.some((w) => /ancienne/i.test(w))).toBe(true);
  });

  it("confidence high si score >= 0.75", () => {
    const r = scoreRagChunk({ ...base, similarity: 0.78, isOfficialSource: true });
    expect(r.confidence).toBe("high");
    expect(r.relevanceScore).toBeGreaterThanOrEqual(RAG_RELEVANCE_HIGH);
  });

  it("confidence low si score sous 0.55", () => {
    const r = scoreRagChunk({ ...base, similarity: 0.2 });
    expect(r.confidence).toBe("low");
    expect(r.relevanceScore).toBeLessThan(RAG_RELEVANCE_MEDIUM);
  });

  it("keywords matchant la query bonifient le score", () => {
    const without = scoreRagChunk({
      ...base,
      similarity: 0.5,
      queryKeywords: ["scpi", "revenus", "fonciers"],
      chunkKeywords: [],
      chunkContent: "Texte sans rapport",
    });
    const withMatch = scoreRagChunk({
      ...base,
      similarity: 0.5,
      queryKeywords: ["scpi", "revenus", "fonciers"],
      chunkKeywords: ["scpi", "revenus", "fonciers"],
      chunkContent: "SCPI revenus fonciers",
    });
    expect(withMatch.relevanceScore).toBeGreaterThan(without.relevanceScore);
  });
});
