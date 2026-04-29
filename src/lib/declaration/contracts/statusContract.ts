// Statut d'extraction officiel — calculé côté backend, affiché côté front.

import { z } from "zod";

export const ExtractionStatusEnum = z.enum([
  "extraction_not_started",
  "extraction_processing",
  "extraction_completed",
  "extraction_completed_with_warnings",
  "extraction_failed",
  "extraction_needs_review",
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatusEnum>;
