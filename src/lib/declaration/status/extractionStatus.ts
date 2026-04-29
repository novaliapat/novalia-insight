import type { ExtractedData, ExtractionMetadata } from "@/lib/declaration/schemas/extractedDataSchema";
import type { ConsistencyIssue } from "@/lib/declaration/validation/extractionConsistencyChecks";

export type ExtractionStatus =
  | "extraction_not_started"
  | "extraction_processing"
  | "extraction_completed"
  | "extraction_completed_with_warnings"
  | "extraction_failed"
  | "extraction_needs_review";

export const ExtractionStatusLabel: Record<ExtractionStatus, string> = {
  extraction_not_started: "Extraction non démarrée",
  extraction_processing: "Extraction en cours",
  extraction_completed: "Extraction terminée",
  extraction_completed_with_warnings: "Extraction terminée avec alertes",
  extraction_failed: "Extraction échouée",
  extraction_needs_review: "Revue manuelle requise",
};

export type ExtractionStatusTone = "neutral" | "info" | "success" | "warning" | "destructive";

export const ExtractionStatusTone: Record<ExtractionStatus, ExtractionStatusTone> = {
  extraction_not_started: "neutral",
  extraction_processing: "info",
  extraction_completed: "success",
  extraction_completed_with_warnings: "warning",
  extraction_failed: "destructive",
  extraction_needs_review: "warning",
};

/**
 * Dérive le statut détaillé à partir des données extraites + alertes.
 * - confidence low → needs_review (priorité)
 * - warnings/missingData/issues → completed_with_warnings
 * - sinon → completed
 */
export function deriveExtractionStatus(params: {
  hasError: boolean;
  isProcessing: boolean;
  data: ExtractedData | null;
  issues?: ConsistencyIssue[];
}): ExtractionStatus {
  if (params.hasError) return "extraction_failed";
  if (params.isProcessing) return "extraction_processing";
  if (!params.data) return "extraction_not_started";
  if (params.data.globalConfidence === "low") return "extraction_needs_review";
  const hasWarnings =
    params.data.warnings.length > 0 ||
    params.data.missingData.length > 0 ||
    (params.issues?.length ?? 0) > 0;
  return hasWarnings ? "extraction_completed_with_warnings" : "extraction_completed";
}

export function summarizeMetadata(meta: ExtractionMetadata | null): string {
  if (!meta) return "—";
  const date = new Date(meta.extractedAt).toLocaleString("fr-FR");
  return `${meta.modelUsed ?? "modèle inconnu"} · prompt ${meta.extractionPromptVersion} · ${date}${meta.dryRun ? " · dry-run" : ""}`;
}
