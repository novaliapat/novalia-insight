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

// ---------------------------------------------------------------------------
// Détection des preuves faibles (evidence absente ou document_name_only)
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

/**
 * Émet un review item de type `weak_evidence` pour chaque champ chiffré
 * dont la preuve documentaire se limite au nom de fichier (pas de page,
 * pas d'extrait, pas de zone visuelle). Severity = "info".
 *
 * dedupKey stable : `weak_evidence:<bucket>:<index>:<champ>` — permet de
 * régénérer plusieurs extractions sans doublons.
 */
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
