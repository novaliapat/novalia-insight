// Vérifications déterministes appliquées APRÈS génération de l'analyse fiscale.
// Ne bloquent jamais : ajoutent des warnings et forcent requiresManualReview
// quand des invariants sont violés.

import type { FiscalAnalysis, TaxCase } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

export interface SafetyIssue {
  code: string;
  caseId?: string;
  message: string;
}

export interface SafetyCheckResult {
  analysis: FiscalAnalysis;
  issues: SafetyIssue[];
}

const HIGH_CONFIDENCE_MIN_RELEVANCE = 0.7;

export function applyAnalysisSafetyChecks(input: FiscalAnalysis): SafetyCheckResult {
  const issues: SafetyIssue[] = [];
  const fixedCases: TaxCase[] = input.taxCases.map((tc) => {
    let next: TaxCase = { ...tc, ragSources: [...tc.ragSources] };

    // 1) Cloisonnement des sources : aucune source d'une autre catégorie
    const wrongCatSources = next.ragSources.filter((s) => s.category !== next.category);
    if (wrongCatSources.length > 0) {
      issues.push({
        code: "rag_source_wrong_category",
        caseId: next.id,
        message: `Case ${next.id} (${next.category}) avait ${wrongCatSources.length} source(s) d'une autre catégorie — retirées.`,
      });
      next.ragSources = next.ragSources.filter((s) => s.category === next.category);
    }

    // 2) Au moins une source RAG par taxCase
    if (next.ragSources.length === 0) {
      issues.push({
        code: "rag_source_missing",
        caseId: next.id,
        message: `Case ${next.id} sans source RAG — marquée à vérifier manuellement.`,
      });
      next = {
        ...next,
        requiresManualReview: true,
        warning: next.warning ?? "Aucune source RAG identifiée pour cette case.",
      };
    }

    // 3) Explication obligatoire
    if (!next.explanation || next.explanation.trim().length < 10) {
      issues.push({
        code: "explanation_missing",
        caseId: next.id,
        message: `Case ${next.id} sans explication — marquée à vérifier.`,
      });
      next = { ...next, requiresManualReview: true };
    }

    // 4) Montant : number ou null. Pas de NaN.
    if (next.amount !== null && (typeof next.amount !== "number" || Number.isNaN(next.amount))) {
      issues.push({
        code: "amount_invalid",
        caseId: next.id,
        message: `Case ${next.id} : montant invalide → null.`,
      });
      next = { ...next, amount: null, requiresManualReview: true };
    }

    // 5) Pas de montant négatif (sauf si explicitement signalé dans l'explication)
    if (
      next.amount !== null &&
      next.amount < 0 &&
      !/négatif|moins-value|deficit|déficit/i.test(next.explanation ?? "")
    ) {
      issues.push({
        code: "amount_negative",
        caseId: next.id,
        message: `Case ${next.id} : montant négatif sans justification — vérifier.`,
      });
      next = { ...next, requiresManualReview: true };
    }

    // 6) confidence=high requiert au moins une source officielle OU très pertinente
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
          message: `Case ${next.id} : confidence=high sans source officielle ni source forte — abaissée à medium.`,
        });
        next = { ...next, confidence: "medium" };
      }
    }

    // 7) Source insuffisante → manualReview forcé
    const insufficient = next.ragSources.every(
      (s) => typeof s.relevanceScore === "number" && s.relevanceScore < 0.55,
    );
    if (next.ragSources.length > 0 && insufficient && !next.requiresManualReview) {
      issues.push({
        code: "rag_relevance_low",
        caseId: next.id,
        message: `Case ${next.id} : sources peu pertinentes — marquée à vérifier.`,
      });
      next = { ...next, requiresManualReview: true };
    }

    return next;
  });

  const extraWarnings: string[] = [];
  if (issues.length > 0) {
    extraWarnings.push(
      `Contrôles de prudence : ${issues.length} point(s) ajusté(s) automatiquement.`,
    );
  }

  return {
    analysis: {
      ...input,
      taxCases: fixedCases,
      warnings: [...input.warnings, ...extraWarnings],
    },
    issues,
  };
}

/** Calcule analysis_status à partir des résultats. */
export function computeAnalysisStatus(
  analysis: FiscalAnalysis,
): "analysis_completed" | "analysis_completed_with_warnings" | "analysis_needs_review" {
  const anyManual = analysis.taxCases.some((c) => c.requiresManualReview);
  if (anyManual) return "analysis_needs_review";
  if (analysis.warnings.length > 0) return "analysis_completed_with_warnings";
  return "analysis_completed";
}
