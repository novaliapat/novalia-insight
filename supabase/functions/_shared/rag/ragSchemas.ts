// Schemas partagés (Deno) pour le RAG.
import { z } from "https://esm.sh/zod@3.23.8";
import { RAG_CATEGORIES } from "./ragCategories.ts";

export const RagCategoryEnum = z.enum(RAG_CATEGORIES);

export const RagConfidenceEnum = z.enum(["high", "medium", "low"]);

export const RagSourceResultSchema = z.object({
  documentId: z.string().uuid(),
  chunkId: z.string().uuid(),
  title: z.string(),
  sourceName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  taxYear: z.number().int().nullable(),
  isOfficialSource: z.boolean(),
  excerpt: z.string(),
  similarity: z.number(),
  relevanceScore: z.number(),
  confidence: RagConfidenceEnum,
  warnings: z.array(z.string()),
});
export type RagSourceResult = z.infer<typeof RagSourceResultSchema>;

export const RagSearchResponseSchema = z.object({
  category: RagCategoryEnum,
  query: z.string(),
  taxYear: z.number().int().nullable(),
  sources: z.array(RagSourceResultSchema),
  missingSources: z.boolean(),
  warning: z.string().nullable(),
});
export type RagSearchResponse = z.infer<typeof RagSearchResponseSchema>;

export const RagIngestRequestSchema = z.object({
  title: z.string().min(2).max(300),
  category: RagCategoryEnum,
  taxYear: z.number().int().nullable().optional(),
  sourceType: z.string().min(2).max(60),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  documentDate: z.string().nullable().optional(), // ISO date
  isOfficialSource: z.boolean().default(false),
  content: z.string().min(20),
});
export type RagIngestRequest = z.infer<typeof RagIngestRequestSchema>;

export const RagSearchRequestSchema = z.object({
  declarationId: z.string().uuid().nullable().optional(),
  category: RagCategoryEnum,
  query: z.string().min(2).max(2000),
  taxYear: z.number().int().nullable().optional(),
  limit: z.number().int().min(1).max(20).default(6),
});
export type RagSearchRequest = z.infer<typeof RagSearchRequestSchema>;
