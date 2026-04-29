// Statut d'extraction officiel — calculé côté backend.
// Le front peut afficher mais ne doit pas redéfinir cette règle.

import type { ConsistencyIssue } from "./consistencyChecks.ts";

export type ExtractionStatus =
  | "extraction_not_started"
  | "extraction_processing"
  | "extraction_completed"
  | "extraction_completed_with_warnings"
  | "extraction_failed"
  | "extraction_needs_review";

export function deriveExtractionStatus(params: {
  hasError: boolean;
  globalConfidence: "high" | "medium" | "low";
  warnings: string[];
  missingData: string[];
  consistencyIssues: ConsistencyIssue[];
}): ExtractionStatus {
  if (params.hasError) return "extraction_failed";
  if (params.globalConfidence === "low") return "extraction_needs_review";
  const hasAnyAlert =
    params.warnings.length > 0 ||
    params.missingData.length > 0 ||
    params.consistencyIssues.length > 0;
  return hasAnyAlert ? "extraction_completed_with_warnings" : "extraction_completed";
}
