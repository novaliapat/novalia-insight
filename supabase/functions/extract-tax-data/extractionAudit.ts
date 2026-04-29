// Helpers de comptage utilisés pour construire l'audit côté edge.
// Le type ExtractionAudit / ConsistencyIssue vit dans le miroir partagé.

import type { ExtractionAudit } from "../_shared/contracts/extractionContracts.ts";
export type { ExtractionAudit };

interface ConfidentField { value: number; confidence: string; }

function isConfidentField(v: unknown): v is ConfidentField {
  return typeof v === "object" && v !== null && "value" in v &&
    typeof (v as Record<string, unknown>).value === "number";
}

export function countExtractedFields(data: {
  ifu: Array<Record<string, unknown>>;
  scpi: Array<Record<string, unknown>>;
  lifeInsurance: Array<Record<string, unknown>>;
}): number {
  let n = 0;
  for (const arr of [data.ifu, data.scpi, data.lifeInsurance]) {
    for (const entry of arr) {
      if (entry && typeof entry === "object") {
        for (const v of Object.values(entry)) if (isConfidentField(v)) n += 1;
      }
    }
  }
  return n;
}
