import type {
  ExtractedData,
  ExtractionMetadata,
} from "@/lib/declaration/schemas/extractedDataSchema";
import type { ConsistencyIssue } from "@/lib/declaration/validation/extractionConsistencyChecks";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractionAudit {
  declarationId: string;
  extractedAt: string;
  extractionPromptVersion: string;
  modelUsed?: string;
  dryRun: boolean;
  detectedCategories: string[];
  globalConfidence: "high" | "medium" | "low";
  numberOfFiles: number;
  numberOfExtractedFields: number;
  numberOfWarnings: number;
  numberOfMissingData: number;
  numberOfConsistencyIssues: number;
  consistencyIssues: ConsistencyIssue[];
  warnings: string[];
  missingData: string[];
}

interface ConfidentField {
  value: number;
  confidence: string;
}

function isConfidentField(v: unknown): v is ConfidentField {
  return (
    typeof v === "object" &&
    v !== null &&
    "value" in v &&
    typeof (v as Record<string, unknown>).value === "number"
  );
}

function countExtractedFields(data: ExtractedData): number {
  let n = 0;
  const buckets: Array<unknown[]> = [data.ifu, data.scpi, data.lifeInsurance];
  for (const arr of buckets) {
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

export function buildExtractionAudit(params: {
  declarationId: string;
  data: ExtractedData;
  metadata: ExtractionMetadata;
  numberOfFiles: number;
  consistencyIssues: ConsistencyIssue[];
}): ExtractionAudit {
  const { declarationId, data, metadata, numberOfFiles, consistencyIssues } = params;
  return {
    declarationId,
    extractedAt: metadata.extractedAt,
    extractionPromptVersion: metadata.extractionPromptVersion,
    modelUsed: metadata.modelUsed,
    dryRun: metadata.dryRun,
    detectedCategories: data.detectedCategories,
    globalConfidence: data.globalConfidence,
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

/**
 * Sauvegarde l'audit côté backend (declaration_audit_logs).
 * Best-effort : n'interrompt pas le flow si échec.
 */
export async function persistExtractionAudit(audit: ExtractionAudit): Promise<void> {
  try {
    const { error } = await supabase.from("declaration_audit_logs").insert({
      declaration_id: audit.declarationId,
      action: "extraction_audit_generated",
      metadata: audit as unknown as Record<string, unknown>,
    });
    if (error) {
      console.warn("[extractionAudit] persist failed", error.message);
    }
  } catch (e) {
    console.warn("[extractionAudit] persist threw", e);
  }
}
