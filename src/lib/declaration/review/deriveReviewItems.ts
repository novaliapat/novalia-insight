// Dérive la liste des "review items" (points à traiter) à partir d'un audit
// d'extraction officiel. Utilisable côté front (visualisation) et côté edge
// (génération automatique persistée). La logique doit rester PURE et stable :
// la `dedupKey` sert de clé d'idempotence côté DB.

import type { ExtractionAudit, ConsistencyIssue } from "../contracts/auditContract";

export type ReviewItemSourceType =
  | "consistency_issue"
  | "warning"
  | "missing_data"
  | "weak_evidence";
export type ReviewItemSeverity = "info" | "warning" | "error";

export interface DerivedReviewItem {
  sourceType: ReviewItemSourceType;
  sourceCode: string | null;
  severity: ReviewItemSeverity;
  field: string | null;
  message: string;
  /** Clé d'idempotence : permet d'éviter les doublons lors de plusieurs extractions. */
  dedupKey: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 240);
}

function fromConsistency(issue: ConsistencyIssue): DerivedReviewItem {
  const field = issue.field ?? null;
  return {
    sourceType: "consistency_issue",
    sourceCode: issue.code,
    severity: issue.severity,
    field,
    message: issue.message,
    dedupKey: `consistency:${issue.code}:${field ?? ""}`,
  };
}

function fromWarning(message: string, idx: number): DerivedReviewItem {
  return {
    sourceType: "warning",
    sourceCode: null,
    severity: "warning",
    field: null,
    message,
    // On hash le contenu (normalisé) pour rester stable d'une extraction à l'autre.
    dedupKey: `warning:${normalize(message) || `idx_${idx}`}`,
  };
}

function fromMissing(message: string, idx: number): DerivedReviewItem {
  return {
    sourceType: "missing_data",
    sourceCode: null,
    severity: "info",
    field: null,
    message,
    dedupKey: `missing:${normalize(message) || `idx_${idx}`}`,
  };
}

export function deriveReviewItemsFromAudit(audit: {
  consistencyIssues: ConsistencyIssue[];
  warnings: string[];
  missingData: string[];
}): DerivedReviewItem[] {
  const items: DerivedReviewItem[] = [];
  for (const issue of audit.consistencyIssues) items.push(fromConsistency(issue));
  audit.warnings.forEach((w, i) => items.push(fromWarning(w, i)));
  audit.missingData.forEach((m, i) => items.push(fromMissing(m, i)));

  // Dédupe interne au cas où deux sources produiraient la même clé.
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.dedupKey)) return false;
    seen.add(it.dedupKey);
    return true;
  });
}

export type { ExtractionAudit };
