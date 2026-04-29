// Statut d'analyse fiscale officiel — séparé de extraction_status et review_status.
import { z } from "zod";

export const AnalysisStatusEnum = z.enum([
  "analysis_not_started",
  "analysis_processing",
  "analysis_completed",
  "analysis_completed_with_warnings",
  "analysis_needs_review",
  "analysis_failed",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;

export const AnalysisStatusLabel: Record<AnalysisStatus, string> = {
  analysis_not_started: "Analyse non démarrée",
  analysis_processing: "Analyse en cours",
  analysis_completed: "Analyse terminée",
  analysis_completed_with_warnings: "Analyse terminée avec avertissements",
  analysis_needs_review: "Analyse — points à vérifier",
  analysis_failed: "Analyse échouée",
};
