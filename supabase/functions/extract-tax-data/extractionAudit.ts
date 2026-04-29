// Construction de l'audit officiel — côté edge function.
import type { ConsistencyIssue } from "./consistencyChecks.ts";
import type { ExtractionStatus } from "./extractionStatus.ts";

export interface ExtractionAudit {
  declarationId: string;
  extractedAt: string;
  extractionPromptVersion: string;
  modelUsed?: string;
  dryRun: boolean;
  detectedCategories: string[];
  globalConfidence: "high" | "medium" | "low";
  status: ExtractionStatus;
  numberOfFiles: number;
  numberOfExtractedFields: number;
  numberOfWarnings: number;
  numberOfMissingData: number;
  numberOfConsistencyIssues: number;
  consistencyIssues: ConsistencyIssue[];
  warnings: string[];
  missingData: string[];
}

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
