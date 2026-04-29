// Calcul des métriques de qualité de preuve documentaire.
// Pure — utilisable côté front et miroir Deno (sans dépendance externe).

export interface EvidenceMetrics {
  numberOfEvidenceItems: number;
  numberOfWeakEvidence: number;
  numberOfTextExcerpts: number;
  numberOfPageReferences: number;
  numberOfVisualRegions: number;
}

interface ConfidentLike {
  value?: unknown;
  confidence?: unknown;
  sourceDocument?: unknown;
  evidence?: {
    evidenceType?: string;
    pageNumber?: number;
    extractedText?: string;
    boundingBox?: unknown;
  } | null;
}

function isConfidentField(v: unknown): v is ConfidentLike {
  return (
    typeof v === "object" &&
    v !== null &&
    "value" in (v as Record<string, unknown>) &&
    typeof (v as Record<string, unknown>).value === "number"
  );
}

/**
 * Parcourt récursivement les buckets ifu/scpi/lifeInsurance et compte
 * les preuves selon leur evidenceType. Si le champ chiffré n'a pas de
 * `evidence` enrichi, il est compté comme "document_name_only" → faible.
 */
export function countEvidenceMetrics(data: {
  ifu: Array<Record<string, unknown>>;
  scpi: Array<Record<string, unknown>>;
  lifeInsurance: Array<Record<string, unknown>>;
}): EvidenceMetrics {
  const m: EvidenceMetrics = {
    numberOfEvidenceItems: 0,
    numberOfWeakEvidence: 0,
    numberOfTextExcerpts: 0,
    numberOfPageReferences: 0,
    numberOfVisualRegions: 0,
  };

  const buckets = [data.ifu, data.scpi, data.lifeInsurance];
  for (const arr of buckets) {
    for (const entry of arr ?? []) {
      if (!entry || typeof entry !== "object") continue;
      for (const v of Object.values(entry as Record<string, unknown>)) {
        if (!isConfidentField(v)) continue;
        m.numberOfEvidenceItems += 1;
        const ev = v.evidence;
        const type = ev?.evidenceType ?? "document_name_only";
        switch (type) {
          case "text_excerpt":
            m.numberOfTextExcerpts += 1;
            break;
          case "page_reference":
            m.numberOfPageReferences += 1;
            break;
          case "visual_region":
            m.numberOfVisualRegions += 1;
            break;
          case "document_name_only":
          default:
            m.numberOfWeakEvidence += 1;
            break;
        }
      }
    }
  }

  return m;
}
