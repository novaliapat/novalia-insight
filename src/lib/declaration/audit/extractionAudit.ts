import type {
  ExtractedData,
  ExtractionMetadata,
} from "@/lib/declaration/schemas/extractedDataSchema";
import type { ConsistencyIssue } from "@/lib/declaration/validation/extractionConsistencyChecks";
import type { ExtractionStatus } from "@/lib/declaration/status/extractionStatus";

/**
 * SOURCE DE VÉRITÉ : l'audit officiel est généré et persisté par
 * l'edge function `extract-tax-data`. Le front n'écrit plus jamais
 * dans `declaration_audit_logs` pour `extraction_audit_generated`.
 *
 * Ce module reste utile pour :
 *  - le typage de l'audit retourné par l'edge function
 *  - un fallback de calcul UI si l'audit backend est absent (rétrocompat)
 */

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

/**
 * Fallback uniquement : utilisé si l'edge function n'a pas renvoyé d'audit
 * (cas legacy / extraction historique). Ne sert PAS de source de vérité.
 */
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
