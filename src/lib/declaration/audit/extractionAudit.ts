// Le contrat ExtractionAudit / ConsistencyIssue est défini dans
// `@/lib/declaration/contracts/auditContract`. Ce module expose les
// helpers de comptage et le fallback de construction côté UI.

import type {
  ExtractedData,
} from "@/lib/declaration/contracts/extractedDataContract";
import type { ExtractionMetadata } from "@/lib/declaration/contracts/extractionResultContract";
import type {
  ConsistencyIssue,
  ExtractionAudit,
} from "@/lib/declaration/contracts/auditContract";
import type { ExtractionStatus } from "@/lib/declaration/contracts/statusContract";

export type { ConsistencyIssue, ExtractionAudit };

interface ConfidentField { value: number; confidence: string; }

function isConfidentField(v: unknown): v is ConfidentField {
  return typeof v === "object" && v !== null && "value" in v &&
    typeof (v as Record<string, unknown>).value === "number";
}

export function countExtractedFields(data: ExtractedData): number {
  let n = 0;
  for (const arr of [data.ifu, data.scpi, data.lifeInsurance]) {
    for (const entry of arr) {
      if (entry && typeof entry === "object") {
        for (const v of Object.values(entry as Record<string, unknown>)) {
          if (isConfidentField(v)) n += 1;
        }
      }
    }
  }
  return n;
}

/** Fallback uniquement (legacy) — l'audit officiel vient de l'edge function. */
export function buildExtractionAuditFallback(params: {
  declarationId: string;
  data: ExtractedData;
  metadata: ExtractionMetadata;
  numberOfFiles: number;
  consistencyIssues: ConsistencyIssue[];
  status: ExtractionStatus;
}): ExtractionAudit {
  const { declarationId, data, metadata, numberOfFiles, consistencyIssues, status } = params;
  return {
    declarationId,
    extractedAt: metadata.extractedAt,
    extractionPromptVersion: metadata.extractionPromptVersion,
    modelUsed: metadata.modelUsed,
    dryRun: metadata.dryRun,
    detectedCategories: data.detectedCategories,
    globalConfidence: data.globalConfidence,
    status,
    numberOfFiles,
    numberOfExtractedFields: countExtractedFields(data),
    numberOfWarnings: data.warnings.length,
    numberOfMissingData: data.missingData.length,
    numberOfConsistencyIssues: consistencyIssues.length,
    consistencyIssues,
    warnings: data.warnings,
    missingData: data.missingData,
  };
}
