// Statut d'extraction officiel — règle de dérivation calculée côté backend.
// Le type vit dans le miroir partagé (_shared/contracts/extractionContracts.ts).

import type { ConsistencyIssue, ExtractionStatus } from "../_shared/contracts/extractionContracts.ts";

export type { ExtractionStatus };

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
