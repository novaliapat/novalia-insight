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

// ---------------------------------------------------------------------------
// Détection des preuves faibles (mirroir front)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  dividends: "Dividendes",
  interests: "Intérêts",
  capitalGains: "Plus-values",
  withholdingTax: "Prélèvement",
  socialContributions: "Prélèvements sociaux",
  frenchIncome: "Revenus France",
  foreignIncome: "Revenus étrangers",
  deductibleInterests: "Intérêts déductibles",
  withdrawals: "Rachats",
  taxableShare: "Part imposable",
};

interface BucketsForEvidence {
  ifu: Array<Record<string, unknown>>;
  scpi: Array<Record<string, unknown>>;
  lifeInsurance: Array<Record<string, unknown>>;
}

function isWeakEvidence(v: unknown): v is { value: number; sourceDocument?: string; evidence?: { evidenceType?: string } } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.value !== "number") return false;
  const ev = r.evidence as { evidenceType?: string } | undefined;
  if (!ev) return true;
  return ev.evidenceType === "document_name_only";
}

export function deriveWeakEvidenceReviewItems(buckets: BucketsForEvidence): DerivedReviewItem[] {
  const out: DerivedReviewItem[] = [];
  const titleKeys: Record<keyof BucketsForEvidence, string> = {
    ifu: "institution",
    scpi: "scpiName",
    lifeInsurance: "contractName",
  };
  (Object.keys(buckets) as Array<keyof BucketsForEvidence>).forEach((bucket) => {
    const arr = buckets[bucket] ?? [];
    arr.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return;
      const title = (entry[titleKeys[bucket]] as string) ?? bucket;
      for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
        if (!isWeakEvidence(v)) continue;
        const fieldLabel = FIELD_LABELS[k] ?? k;
        const sourceDoc =
          (v.sourceDocument as string | undefined) ?? "document non précisé";
        out.push({
          sourceType: "weak_evidence",
          sourceCode: null,
          severity: "info",
          field: `${title} — ${fieldLabel}`,
          message: `La donnée « ${fieldLabel} » de « ${title} » est rattachée uniquement au fichier « ${sourceDoc} », sans extrait ni page précise.`,
          dedupKey: `weak_evidence:${bucket}:${idx}:${k}`,
        });
      }
    });
  });
  return out;
}
