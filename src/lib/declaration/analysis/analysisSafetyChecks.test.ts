import { describe, it, expect } from "vitest";
import {
  applyAnalysisSafetyChecks,
  computeAnalysisStatus,
} from "./analysisSafetyChecks";
import type { FiscalAnalysis, TaxCase } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

const baseCase = (over: Partial<TaxCase> = {}): TaxCase => ({
  id: "tc-1",
  category: "scpi",
  form: "2044",
  box: "4BA",
  label: "Revenus fonciers SCPI",
  amount: 1234,
  explanation: "Revenus fonciers issus de la SCPI déclarés au régime réel.",
  confidence: "medium",
  ragSources: [],
  requiresManualReview: false,
  ...over,
});

const wrap = (cases: TaxCase[]): FiscalAnalysis => ({
  summary: "s",
  taxYear: 2024,
  analyzedCategories: [],
  taxForms: [],
  taxCases: cases,
  amountsByCategory: [],
  warnings: [],
  uncertaintyPoints: [],
  requiredDocuments: [],
  finalChecklist: [],
});

describe("analysisSafetyChecks", () => {
  it("retire les sources d'une autre catégorie (cloisonnement)", () => {
    const a = wrap([
      baseCase({
        ragSources: [
          { category: "life_insurance", documentTitle: "AV BOFIP", relevanceScore: 0.9 },
          { category: "scpi", documentTitle: "SCPI BOFIP", relevanceScore: 0.8, isOfficialSource: true },
        ],
      }),
    ]);
    const r = applyAnalysisSafetyChecks(a);
    expect(r.analysis.taxCases[0].ragSources).toHaveLength(1);
    expect(r.analysis.taxCases[0].ragSources[0].category).toBe("scpi");
    expect(r.issues.some((i) => i.code === "rag_source_wrong_category")).toBe(true);
  });

  it("force requiresManualReview si aucune source RAG", () => {
    const r = applyAnalysisSafetyChecks(wrap([baseCase({ ragSources: [] })]));
    expect(r.analysis.taxCases[0].requiresManualReview).toBe(true);
    expect(r.issues.some((i) => i.code === "rag_source_missing")).toBe(true);
  });

  it("abaisse confidence=high sans source officielle ni source forte", () => {
    const r = applyAnalysisSafetyChecks(
      wrap([
        baseCase({
          confidence: "high",
          ragSources: [{ category: "scpi", documentTitle: "x", relevanceScore: 0.5 }],
        }),
      ]),
    );
    expect(r.analysis.taxCases[0].confidence).toBe("medium");
    expect(r.issues.some((i) => i.code === "high_confidence_unsupported")).toBe(true);
  });

  it("garde confidence=high si source officielle", () => {
    const r = applyAnalysisSafetyChecks(
      wrap([
        baseCase({
          confidence: "high",
          ragSources: [{ category: "scpi", documentTitle: "BOFIP", relevanceScore: 0.5, isOfficialSource: true }],
        }),
      ]),
    );
    expect(r.analysis.taxCases[0].confidence).toBe("high");
  });

  it("force manualReview si toutes les sources ont relevance < 0.55", () => {
    const r = applyAnalysisSafetyChecks(
      wrap([
        baseCase({
          ragSources: [
            { category: "scpi", documentTitle: "x", relevanceScore: 0.3 },
            { category: "scpi", documentTitle: "y", relevanceScore: 0.4 },
          ],
        }),
      ]),
    );
    expect(r.analysis.taxCases[0].requiresManualReview).toBe(true);
    expect(r.issues.some((i) => i.code === "rag_relevance_low")).toBe(true);
  });

  it("rejette montant négatif sans justification", () => {
    const r = applyAnalysisSafetyChecks(
      wrap([
        baseCase({
          amount: -500,
          ragSources: [{ category: "scpi", documentTitle: "x", relevanceScore: 0.8, isOfficialSource: true }],
        }),
      ]),
    );
    expect(r.analysis.taxCases[0].requiresManualReview).toBe(true);
    expect(r.issues.some((i) => i.code === "amount_negative")).toBe(true);
  });

  it("autorise montant négatif si justifié (déficit)", () => {
    const r = applyAnalysisSafetyChecks(
      wrap([
        baseCase({
          amount: -500,
          explanation: "Déficit foncier reportable selon BOFIP.",
          ragSources: [{ category: "scpi", documentTitle: "x", relevanceScore: 0.8, isOfficialSource: true }],
        }),
      ]),
    );
    expect(r.issues.some((i) => i.code === "amount_negative")).toBe(false);
  });
});

describe("computeAnalysisStatus", () => {
  it("needs_review si une case est requiresManualReview", () => {
    const a = wrap([baseCase({ requiresManualReview: true })]);
    expect(computeAnalysisStatus(a)).toBe("analysis_needs_review");
  });

  it("completed_with_warnings si warnings présents et aucun manualReview", () => {
    const a = { ...wrap([baseCase()]), warnings: ["test"] };
    expect(computeAnalysisStatus(a)).toBe("analysis_completed_with_warnings");
  });

  it("completed si tout est propre", () => {
    expect(computeAnalysisStatus(wrap([baseCase()]))).toBe("analysis_completed");
  });
});
