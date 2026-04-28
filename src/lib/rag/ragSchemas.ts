import { z } from "zod";
import { TaxCategoryEnum } from "@/lib/declaration/schemas/extractedDataSchema";

/** Une source RAG retournée par une bibliothèque catégorielle. */
export const RagSourceSchema = z.object({
  category: TaxCategoryEnum,
  documentTitle: z.string(),
  reference: z.string().optional(),
  excerpt: z.string().optional(),
  url: z.string().url().optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
});
export type RagSource = z.infer<typeof RagSourceSchema>;

/** Résultat d'une recherche RAG dans UNE bibliothèque catégorielle. */
export const RagSearchResultSchema = z.object({
  category: TaxCategoryEnum,
  query: z.string(),
  sources: z.array(RagSourceSchema),
  /** true si aucune source n'a dépassé le seuil de pertinence */
  isInsufficient: z.boolean().default(false),
});
export type RagSearchResult = z.infer<typeof RagSearchResultSchema>;

/** Seuil de pertinence en deçà duquel on flag requiresManualReview. */
export const RAG_RELEVANCE_THRESHOLD = 0.5;
