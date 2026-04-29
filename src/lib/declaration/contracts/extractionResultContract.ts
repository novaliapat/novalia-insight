// Wrapper officiel de résultat d'extraction.
// data = sortie IA validée. metadata = traçabilité système (serveur).

import { z } from "zod";
import { ExtractedDataSchema } from "./extractedDataContract";

export const ExtractionMetadataSchema = z.object({
  extractionPromptVersion: z.string(),
  extractedAt: z.string(), // ISO 8601 UTC
  modelUsed: z.string().optional(),
  dryRun: z.boolean().default(false),
});
export type ExtractionMetadata = z.infer<typeof ExtractionMetadataSchema>;

export const ExtractionResultSchema = z.object({
  data: ExtractedDataSchema,
  metadata: ExtractionMetadataSchema,
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
