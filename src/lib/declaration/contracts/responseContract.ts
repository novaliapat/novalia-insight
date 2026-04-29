// Contrat unique de réponse de l'edge function `extract-tax-data`.
// Utilisé côté serveur (avant d'envoyer) ET côté client (à la réception).

import { z } from "zod";
import { ExtractedDataSchema } from "./extractedDataContract";
import { ExtractionMetadataSchema } from "./extractionResultContract";
import { ExtractionAuditSchema } from "./auditContract";
import { ExtractionStatusEnum } from "./statusContract";

export const ExtractTaxDataResponseSchema = z.object({
  data: ExtractedDataSchema,
  metadata: ExtractionMetadataSchema,
  audit: ExtractionAuditSchema,
  status: ExtractionStatusEnum,
});
export type ExtractTaxDataResponse = z.infer<typeof ExtractTaxDataResponseSchema>;
