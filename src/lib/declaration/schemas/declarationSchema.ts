import { z } from "zod";

export const DeclarationStatusEnum = z.enum([
  "draft",
  "extraction_pending",
  "extraction_done",
  "validation_pending",
  "analysis_pending",
  "finalized",
]);
export type DeclarationStatus = z.infer<typeof DeclarationStatusEnum>;

export const DeclarationStatusLabel: Record<DeclarationStatus, string> = {
  draft: "Brouillon",
  extraction_pending: "Extraction en cours",
  extraction_done: "Extraction terminée",
  validation_pending: "Validation en attente",
  analysis_pending: "Analyse en cours",
  finalized: "Analyse finalisée",
};

export const DeclarationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  status: DeclarationStatusEnum,
  tax_year: z.number().int().min(2000).max(2100),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Declaration = z.infer<typeof DeclarationSchema>;

export const DeclarationFileSchema = z.object({
  id: z.string().uuid(),
  declaration_id: z.string().uuid(),
  file_name: z.string(),
  file_type: z.string().nullable(),
  storage_path: z.string(),
  size_bytes: z.number().nullable(),
  created_at: z.string(),
});
export type DeclarationFile = z.infer<typeof DeclarationFileSchema>;
