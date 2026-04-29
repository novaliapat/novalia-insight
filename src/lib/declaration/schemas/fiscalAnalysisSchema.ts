import { z } from "zod";
import { TaxCategoryEnum, ConfidenceLevelEnum } from "./extractedDataSchema";

/**
 * Schéma FiscalAnalysis
 * Conçu pour le RAG par catégorie : chaque case fiscale conserve
 * sa catégorie d'origine et ses sources RAG (jamais mélangées).
 */

export const RAGSourceSchema = z.object({
  category: TaxCategoryEnum,
  documentTitle: z.string(),
  excerpt: z.string().optional(),
  reference: z.string().optional(), // ex: "BOI-RPPM-RCM-20-10-20-50"
  url: z.string().optional(), // url() trop strict pour mocks/tests
  relevanceScore: z.number().min(0).max(1).optional(),
  // ----- Champs ajoutés pour le RAG réel (Lot 4) -----
  documentId: z.string().optional(),
  chunkId: z.string().optional(),
  sourceName: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  isOfficialSource: z.boolean().optional(),
  taxYear: z.number().int().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
export type RAGSource = z.infer<typeof RAGSourceSchema>;


export const TaxCaseSchema = z.object({
  id: z.string(),
  category: TaxCategoryEnum,
  form: z.string(),                  // ex: "2042", "2044", "2047"
  box: z.string(),                   // ex: "2DC", "4BA"
  label: z.string(),
  amount: z.number().nullable(),
  explanation: z.string(),
  confidence: ConfidenceLevelEnum,
  ragSources: z.array(RAGSourceSchema).default([]),
  sourceDocument: z.string().optional(),
  warning: z.string().optional(),
  /** true si aucune source RAG suffisamment pertinente n'a été trouvée */
  requiresManualReview: z.boolean().default(false),
});
export type TaxCase = z.infer<typeof TaxCaseSchema>;

export const FiscalAnalysisSchema = z.object({
  summary: z.string(),
  taxYear: z.number().int(),

  /** Catégories analysées (chacune via sa propre bibliothèque RAG) */
  analyzedCategories: z.array(TaxCategoryEnum).default([]),

  /** Formulaires concernés (ex: ["2042", "2044", "2047"]) */
  taxForms: z.array(z.string()).default([]),

  /** Cases fiscales — regroupées par catégorie côté UI */
  taxCases: z.array(TaxCaseSchema).default([]),

  /** Vue agrégée par catégorie pour l'affichage */
  amountsByCategory: z
    .array(
      z.object({
        category: TaxCategoryEnum,
        totalAmount: z.number(),
        caseCount: z.number().int(),
      })
    )
    .default([]),

  warnings: z.array(z.string()).default([]),
  uncertaintyPoints: z.array(z.string()).default([]),
  requiredDocuments: z.array(z.string()).default([]),
  finalChecklist: z.array(z.string()).default([]),

  /** Notes globales sur les limites de l'analyse */
  limitations: z.string().optional(),
});

export type FiscalAnalysis = z.infer<typeof FiscalAnalysisSchema>;
