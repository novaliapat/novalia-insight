// Mirror Deno de src/lib/declaration/analysis/analysisSafetyChecks.ts
// Toute modification ici doit rester alignée avec la version front.

interface RagSrc {
  category: string;
  documentTitle?: string;
  relevanceScore?: number;
  isOfficialSource?: boolean;
  [k: string]: unknown;
}
interface TaxCase {
  id: string;
  category: string;
  amount: number | null;
  explanation: string;
  confidence: "high" | "medium" | "low";
  ragSources: RagSrc[];
  warning?: string;
  requiresManualReview: boolean;
  [k: string]: unknown;
}
interface FiscalAnalysis {
  taxCases: TaxCase[];
  warnings: string[];
  [k: string]: unknown;
}

export interface SafetyIssue {
  code: string;
  caseId?: string;
  message: string;
}

const HIGH_CONFIDENCE_MIN_RELEVANCE = 0.7;

export function applyAnalysisSafetyChecks(input: FiscalAnalysis): {
  analysis: FiscalAnalysis;
  issues: SafetyIssue[];
} {
  const issues: SafetyIssue[] = [];
  const fixedCases: TaxCase[] = input.taxCases.map((tc) => {
    let next: TaxCase = { ...tc, ragSources: [...(tc.ragSources ?? [])] };

    const wrongCat = next.ragSources.filter((s) => s.category !== next.category);
    if (wrongCat.length > 0) {
      issues.push({
        code: "rag_source_wrong_category",
        caseId: next.id,
        message: `Case ${next.id} (${next.category}) avait ${wrongCat.length} source(s) d'une autre catégorie — retirées.`,
      });
      next.ragSources = next.ragSources.filter((s) => s.category === next.category);
    }

    if (next.ragSources.length === 0) {
      issues.push({
        code: "rag_source_missing",
        caseId: next.id,
        message: `Case ${next.id} sans source RAG — à vérifier.`,
      });
      next.requiresManualReview = true;
      next.warning = next.warning ?? "Aucune source RAG identifiée.";
    }

    if (!next.explanation || next.explanation.trim().length < 10) {
      issues.push({ code: "explanation_missing", caseId: next.id, message: `Case ${next.id} sans explication.` });
      next.requiresManualReview = true;
    }

    if (next.amount !== null && (typeof next.amount !== "number" || Number.isNaN(next.amount))) {
      issues.push({ code: "amount_invalid", caseId: next.id, message: `Case ${next.id} : montant invalide.` });
      next.amount = null;
      next.requiresManualReview = true;
    }

    if (
      next.amount !== null &&
      next.amount < 0 &&
      !/négatif|moins-value|deficit|déficit/i.test(next.explanation ?? "")
    ) {
      issues.push({ code: "amount_negative", caseId: next.id, message: `Case ${next.id} : montant négatif.` });
      next.requiresManualReview = true;
    }

    if (next.confidence === "high") {
      const hasStrong = next.ragSources.some(
        (s) =>
          s.isOfficialSource === true ||
          (typeof s.relevanceScore === "number" && s.relevanceScore >= HIGH_CONFIDENCE_MIN_RELEVANCE),
      );
      if (!hasStrong) {
        issues.push({
          code: "high_confidence_unsupported",
          caseId: next.id,
          message: `Case ${next.id} : confidence=high sans source forte → medium.`,
        });
        next.confidence = "medium";
      }
    }

    const insufficient =
      next.ragSources.length > 0 &&
      next.ragSources.every(
        (s) => typeof s.relevanceScore === "number" && s.relevanceScore < 0.55,
      );
    if (insufficient && !next.requiresManualReview) {
      issues.push({ code: "rag_relevance_low", caseId: next.id, message: `Case ${next.id} : sources peu pertinentes.` });
      next.requiresManualReview = true;
    }

    return next;
  });

  const extraWarnings = issues.length > 0
    ? [`Contrôles de prudence : ${issues.length} point(s) ajusté(s).`]
    : [];

  return {
    analysis: {
      ...input,
      taxCases: fixedCases,
      warnings: [...input.warnings, ...extraWarnings],
    },
    issues,
  };
}

export function computeAnalysisStatus(
  analysis: FiscalAnalysis,
): "analysis_completed" | "analysis_completed_with_warnings" | "analysis_needs_review" {
  const anyManual = analysis.taxCases.some((c) => c.requiresManualReview);
  if (anyManual) return "analysis_needs_review";
  if (analysis.warnings.length > 0) return "analysis_completed_with_warnings";
  return "analysis_completed";
}
