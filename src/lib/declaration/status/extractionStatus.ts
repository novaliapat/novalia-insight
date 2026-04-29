// Statut d'extraction — la définition canonique vit dans
// `@/lib/declaration/contracts/statusContract`. Ce fichier ajoute
// uniquement les helpers d'affichage (label/tone) et un dérivateur
// utilisé en fallback UI quand le backend n'a pas renvoyé de statut.
//
// /!\ La règle officielle de dérivation vit côté edge function
// (supabase/functions/extract-tax-data/extractionStatus.ts).

import {
  ExtractionStatusEnum,
  type ExtractionStatus,
} from "@/lib/declaration/contracts/statusContract";
import type { ExtractedData } from "@/lib/declaration/contracts/extractedDataContract";
import type { ExtractionMetadata } from "@/lib/declaration/contracts/extractionResultContract";
import type { ConsistencyIssue } from "@/lib/declaration/contracts/auditContract";

export { ExtractionStatusEnum };
export type { ExtractionStatus };

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

/** Fallback UI uniquement — ne pas utiliser si `backendStatus` existe. */
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
