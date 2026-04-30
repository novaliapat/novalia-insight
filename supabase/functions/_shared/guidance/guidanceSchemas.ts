// SOURCE DE VÉRITÉ — Schémas du Guide Déclaratif
// Étape 1 (fondations). Aucune génération réelle ici, uniquement les contrats.
//
// Distinction explicite des sources :
// - declarationFormSources[] : notices/formulaires DGFiP, BOFiP — pour les cases.
// - legalBasisSources[]      : articles CGI / Légifrance — base légale.
//   Reste vide pour ce lot (Légifrance non branché).
import { z } from "https://esm.sh/zod@3.23.8";
import { TaxCategoryEnum, ConfidenceLevelEnum } from "../contracts/extractionContracts.ts";

// Identifiants formulaires couverts en V1
// "preparation" : étapes préalables (rubriques à cocher sur impots.gouv.fr)
// "recap"       : tableau récapitulatif + checklist finale
export const TaxFormIdEnum = z.enum([
  "preparation",
  "2042",
  "2042C",
  "2042-RICI",
  "2044",
  "2047",
  "recap",
  "other",
]);
export type TaxFormId = z.infer<typeof TaxFormIdEnum>;

// Statut de pré-remplissage d'une case sur impots.gouv.fr
export const PrefillStatusEnum = z.enum([
  "to_enter",      // À saisir manuellement
  "prefilled",     // Pré-rempli, à vérifier
  "auto_report",   // Reporté automatiquement depuis une annexe (2044/2047)
  "do_not_modify", // Pré-rempli, NE PAS MODIFIER
]);
export type PrefillStatus = z.infer<typeof PrefillStatusEnum>;

// Statut d'une entrée catalogue (formulaire / case / annexe)
export const CatalogStatusEnum = z.enum([
  "confirmed",   // source officielle clairement identifiée
  "needs_review",
  "deprecated",
  "unknown",
]);
export type CatalogStatus = z.infer<typeof CatalogStatusEnum>;

// Origine d'une source RAG / documentaire
export const SourceProvenanceEnum = z.enum([
  "manual_seed",        // résumé synthétique rédigé à la main, à vérifier
  "official_brochure",  // extrait structuré de la Brochure IR (page sourcée)
  "official_fetch",     // ingéré depuis URL officielle (phase 2)
  "verified",           // relu et confirmé
  "deprecated",
]);
export type SourceProvenance = z.infer<typeof SourceProvenanceEnum>;

// Source documentaire pour le PARCOURS DÉCLARATIF (notices, formulaires, BOFiP)
export const FormSourceSchema = z.object({
  documentId: z.string().optional(),
  chunkId: z.string().optional(),
  title: z.string(),
  sourceName: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  sourceType: z.string().optional(),
  taxYear: z.number().int().nullable().optional(),
  isOfficialSource: z.boolean().default(false),
  provenance: SourceProvenanceEnum.default("manual_seed"),
  // Ancrage brochure / formulaire / section
  pageNumber: z.number().int().positive().optional(),
  formId: TaxFormIdEnum.optional(),
  sectionLabel: z.string().optional(),
  boxCodes: z.array(z.string()).optional(),
  excerpt: z.string().max(600).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  warning: z.string().optional(),
});
export type FormSource = z.infer<typeof FormSourceSchema>;

// Source LÉGALE (CGI / Légifrance) — séparée, vide pour ce lot
export const LegalBasisSourceSchema = z.object({
  articleCode: z.string(),       // "CGI"
  articleNumber: z.string(),     // "150-0 A"
  title: z.string(),
  url: z.string().nullable().optional(),
  excerpt: z.string().max(600).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  verifiedAt: z.string().datetime().optional(),
});
export type LegalBasisSource = z.infer<typeof LegalBasisSourceSchema>;

// Catégorie manquante — bloque la confiance, n'invente rien
export const MissingSourceSchema = z.object({
  category: TaxCategoryEnum,
  reason: z.string(),
  suggestedSources: z.array(z.string()).default([]),
  blocksHighConfidence: z.boolean().default(true),
});
export type MissingSource = z.infer<typeof MissingSourceSchema>;

// Formulaire requis dans le parcours
export const RequiredFormSchema = z.object({
  formId: TaxFormIdEnum,
  label: z.string(),
  reason: z.string(),
  required: z.boolean(),
  confidence: ConfidenceLevelEnum,
  status: CatalogStatusEnum,
  sources: z.array(FormSourceSchema).default([]),
  legalBasisSources: z.array(LegalBasisSourceSchema).default([]),
});
export type RequiredForm = z.infer<typeof RequiredFormSchema>;

// Action proposée dans une étape
export const StepActionTypeEnum = z.enum([
  "open_form",
  "check_box",
  "enter_amount",
  "verify_amount",
  "attach_annex",
  "manual_review",
]);
export type StepActionType = z.infer<typeof StepActionTypeEnum>;

export const DeclarationStepSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string(),
  formId: TaxFormIdEnum,
  sectionLabel: z.string().optional(),
  actionType: StepActionTypeEnum,
  amount: z.number().nullable().optional(),
  targetBox: z.string().optional(),
  targetLine: z.string().optional(),
  sourceData: z.object({
    category: TaxCategoryEnum,
    field: z.string().optional(),
    documentName: z.string().optional(),
  }).optional(),
  ragSources: z.array(FormSourceSchema).default([]),
  warning: z.string().optional(),
  requiresManualReview: z.boolean().default(false),
  // Pédagogie pas-à-pas (impots.gouv-style)
  calculationNote: z.string().optional(), // note de calcul détaillée (1-3 lignes)
  prefillStatus: PrefillStatusEnum.optional(),
});
export type DeclarationStep = z.infer<typeof DeclarationStepSchema>;

export const TaxBoxProposalSchema = z.object({
  formId: TaxFormIdEnum,
  boxOrLine: z.string(),
  label: z.string(),
  amount: z.number().nullable(),
  category: TaxCategoryEnum,
  explanation: z.string(),
  confidence: ConfidenceLevelEnum,
  status: CatalogStatusEnum,
  ragSources: z.array(FormSourceSchema).default([]),
  legalBasisSources: z.array(LegalBasisSourceSchema).default([]),
  requiresManualReview: z.boolean().default(false),
  blockingReason: z.string().optional(),
});
export type TaxBoxProposal = z.infer<typeof TaxBoxProposalSchema>;

export const ManualReviewItemSchema = z.object({
  id: z.string(),
  category: TaxCategoryEnum,
  reason: z.string(),
  suggestedAction: z.string(),
  relatedFormId: TaxFormIdEnum.optional(),
  relatedBox: z.string().optional(),
});
export type ManualReviewItem = z.infer<typeof ManualReviewItemSchema>;

export const TaxpayerSummarySchema = z.object({
  taxYear: z.number().int(),
  detectedCategories: z.array(TaxCategoryEnum).default([]),
  hasForeignIncome: z.boolean().default(false),
  hasRealEstateIncome: z.boolean().default(false),
});
export type TaxpayerSummary = z.infer<typeof TaxpayerSummarySchema>;

export const DeclarationGuidanceSchema = z.object({
  taxYear: z.number().int(),
  taxpayerSummary: TaxpayerSummarySchema,
  detectedSituations: z.array(z.string()).default([]),
  requiredForms: z.array(RequiredFormSchema).default([]),
  declarationSteps: z.array(DeclarationStepSchema).default([]),
  taxBoxProposals: z.array(TaxBoxProposalSchema).default([]),
  manualReviewItems: z.array(ManualReviewItemSchema).default([]),
  missingSources: z.array(MissingSourceSchema).default([]),
  warnings: z.array(z.string()).default([]),
  confidence: ConfidenceLevelEnum,
  // Disclaimer obligatoire — toujours rappelé
  disclaimer: z.string().default(
    "Ce guide est une aide à la préparation. Les cases proposées doivent être vérifiées " +
    "avant toute déclaration officielle. En cas de doute, rapprochez-vous de l'administration " +
    "fiscale ou de votre conseil habituel.",
  ),
});
export type DeclarationGuidance = z.infer<typeof DeclarationGuidanceSchema>;
