import type { DeclarationWithExtraction } from "@/hooks/useDeclarationHistory";

export type DashboardFilter =
  | "all"
  | "to_process"
  | "review_completed"
  | "extraction_with_warnings"
  | "extraction_failed";

export const DashboardFilterLabel: Record<DashboardFilter, string> = {
  all: "Toutes les analyses",
  to_process: "À traiter",
  review_completed: "Revue terminée",
  extraction_with_warnings: "Extraction avec alertes",
  extraction_failed: "Extraction échouée",
};

export function isToProcess(d: DeclarationWithExtraction): boolean {
  if (d.review_status === "review_pending") return true;
  if (d.extraction_status === "extraction_needs_review") return true;
  if (d.extraction_status === "extraction_completed_with_warnings") return true;
  if (d.extraction_status === "extraction_failed") return true;
  return false;
}

export function isReviewCompleted(d: DeclarationWithExtraction): boolean {
  return d.review_status === "review_completed";
}

export function isExtractionWithWarnings(d: DeclarationWithExtraction): boolean {
  return (
    d.extraction_status === "extraction_completed_with_warnings" ||
    d.extraction_status === "extraction_needs_review"
  );
}

export function isExtractionFailed(d: DeclarationWithExtraction): boolean {
  return d.extraction_status === "extraction_failed";
}

export function applyFilter(
  declarations: DeclarationWithExtraction[],
  filter: DashboardFilter,
): DeclarationWithExtraction[] {
  switch (filter) {
    case "all":
      return declarations;
    case "to_process":
      return declarations.filter(isToProcess);
    case "review_completed":
      return declarations.filter(isReviewCompleted);
    case "extraction_with_warnings":
      return declarations.filter(isExtractionWithWarnings);
    case "extraction_failed":
      return declarations.filter(isExtractionFailed);
  }
}

/**
 * Priorité (1 = plus urgent) :
 * 1. extraction_failed
 * 2. extraction_needs_review
 * 3. review_pending avec items error
 * 4. extraction_completed_with_warnings
 * 5. review_pending simple
 * 99. autre
 */
export function priorityScore(d: DeclarationWithExtraction): number {
  if (d.extraction_status === "extraction_failed") return 1;
  if (d.extraction_status === "extraction_needs_review") return 2;
  if (d.review_status === "review_pending" && d.has_pending_error) return 3;
  if (d.extraction_status === "extraction_completed_with_warnings") return 4;
  if (d.review_status === "review_pending") return 5;
  return 99;
}

export function sortByPriority(
  declarations: DeclarationWithExtraction[],
): DeclarationWithExtraction[] {
  return [...declarations].sort((a, b) => {
    const pa = priorityScore(a);
    const pb = priorityScore(b);
    if (pa !== pb) return pa - pb;
    // À priorité égale, plus récent d'abord
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export interface DashboardCounts {
  total: number;
  toProcess: number;
  reviewCompleted: number;
  extractionFailed: number;
}

export function computeDashboardCounts(
  declarations: DeclarationWithExtraction[],
): DashboardCounts {
  return {
    total: declarations.length,
    toProcess: declarations.filter(isToProcess).length,
    reviewCompleted: declarations.filter(isReviewCompleted).length,
    extractionFailed: declarations.filter(isExtractionFailed).length,
  };
}
