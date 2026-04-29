// Audit officiel — généré et persisté par l'edge function extract-tax-data.

import { z } from "zod";
import { ConfidenceLevelEnum } from "./extractedDataContract";
import { ExtractionStatusEnum } from "./statusContract";

export const ConsistencyIssueSeverityEnum = z.enum(["info", "warning", "error"]);
export type ConsistencyIssueSeverity = z.infer<typeof ConsistencyIssueSeverityEnum>;

export const ConsistencyIssueSchema = z.object({
  code: z.string(),
  severity: ConsistencyIssueSeverityEnum,
  message: z.string(),
  field: z.string().optional(),
});
export type ConsistencyIssue = z.infer<typeof ConsistencyIssueSchema>;

export const ExtractionAuditSchema = z.object({
  declarationId: z.string(),
  extractedAt: z.string(),
  extractionPromptVersion: z.string(),
  modelUsed: z.string().optional(),
  dryRun: z.boolean(),
  detectedCategories: z.array(z.string()),
  globalConfidence: ConfidenceLevelEnum,
  status: ExtractionStatusEnum,
  numberOfFiles: z.number().int().nonnegative(),
  numberOfExtractedFields: z.number().int().nonnegative(),
  numberOfWarnings: z.number().int().nonnegative(),
  numberOfMissingData: z.number().int().nonnegative(),
  numberOfConsistencyIssues: z.number().int().nonnegative(),
  // Métriques de qualité de preuve (rétrocompat : default 0 si absent).
  numberOfEvidenceItems: z.number().int().nonnegative().default(0),
  numberOfWeakEvidence: z.number().int().nonnegative().default(0),
  numberOfTextExcerpts: z.number().int().nonnegative().default(0),
  numberOfPageReferences: z.number().int().nonnegative().default(0),
  numberOfVisualRegions: z.number().int().nonnegative().default(0),
  consistencyIssues: z.array(ConsistencyIssueSchema),
  warnings: z.array(z.string()),
  missingData: z.array(z.string()),
});
export type ExtractionAudit = z.infer<typeof ExtractionAuditSchema>;
