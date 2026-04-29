// Miroir Deno — doit rester ALIGNÉ avec
// src/lib/declaration/review/deriveReviewItems.ts (logique pure).

import type { ConsistencyIssue } from "../contracts/extractionContracts.ts";

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
  dedupKey: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 240);
}

export function deriveReviewItemsFromAudit(audit: {
  consistencyIssues: ConsistencyIssue[];
  warnings: string[];
  missingData: string[];
}): DerivedReviewItem[] {
  const items: DerivedReviewItem[] = [];

  for (const issue of audit.consistencyIssues) {
    items.push({
      sourceType: "consistency_issue",
      sourceCode: issue.code,
      severity: issue.severity,
      field: issue.field ?? null,
      message: issue.message,
      dedupKey: `consistency:${issue.code}:${issue.field ?? ""}`,
    });
  }
  audit.warnings.forEach((w, i) => {
    items.push({
      sourceType: "warning",
      sourceCode: null,
      severity: "warning",
      field: null,
      message: w,
      dedupKey: `warning:${normalize(w) || `idx_${i}`}`,
    });
  });
  audit.missingData.forEach((m, i) => {
    items.push({
      sourceType: "missing_data",
      sourceCode: null,
      severity: "info",
      field: null,
      message: m,
      dedupKey: `missing:${normalize(m) || `idx_${i}`}`,
    });
  });

  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.dedupKey)) return false;
    seen.add(it.dedupKey);
    return true;
  });
}
