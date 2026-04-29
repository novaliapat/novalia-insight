// SOURCE DE VÉRITÉ — Contrat des données fiscales extraites.
// Toute modification ici doit être répercutée dans le miroir Deno
// supabase/functions/_shared/contracts/extractedDataContract.ts
// Le test de parité (contractsParity.test.ts) verrouille cet alignement.

import { z } from "zod";

export const TaxCategoryEnum = z.enum([
  "ifu",
  "scpi",
  "life_insurance",
  "real_estate_income",
  "dividends",
  "interests",
  "capital_gains",
  "foreign_accounts",
  "per",
  "tax_credits",
  "deductible_expenses",
  "other",
]);
export type TaxCategory = z.infer<typeof TaxCategoryEnum>;

export const ConfidenceLevelEnum = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>;

export const TaxpayerSchema = z.object({
  fullName: z.string().optional(),
  fiscalNumber: z.string().optional(),
  taxHousehold: z.string().optional(),
  address: z.string().optional(),
});

const ConfidentField = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    confidence: ConfidenceLevelEnum,
    sourceDocument: z.string().optional(),
    note: z.string().optional(),
  });

export const ConfidentNumberSchema = ConfidentField(z.number());

export const IFUEntrySchema = z.object({
  institution: z.string(),
  accountNumber: z.string().optional(),
  dividends: ConfidentNumberSchema.optional(),
  interests: ConfidentNumberSchema.optional(),
  capitalGains: ConfidentNumberSchema.optional(),
  withholdingTax: ConfidentNumberSchema.optional(),
  socialContributions: ConfidentNumberSchema.optional(),
});

export const SCPIEntrySchema = z.object({
  scpiName: z.string(),
  managementCompany: z.string().optional(),
  frenchIncome: ConfidentNumberSchema.optional(),
  foreignIncome: ConfidentNumberSchema.optional(),
  deductibleInterests: ConfidentNumberSchema.optional(),
  socialContributions: ConfidentNumberSchema.optional(),
});

export const LifeInsuranceEntrySchema = z.object({
  contractName: z.string(),
  insurer: z.string().optional(),
  contractAge: z.enum(["less_than_8", "more_than_8"]).optional(),
  withdrawals: ConfidentNumberSchema.optional(),
  taxableShare: ConfidentNumberSchema.optional(),
  withholdingTax: ConfidentNumberSchema.optional(),
});

export const GenericCategoryEntrySchema = z.object({
  label: z.string(),
  items: z.array(z.record(z.string(), z.unknown())).default([]),
  notes: z.string().optional(),
});

/**
 * ExtractedDataSchema = données fiscales PURES.
 * Aucune métadonnée système (version prompt, timestamp, modèle) ici :
 * elles vivent dans ExtractionMetadataSchema, injectées par l'edge function.
 *
 * Mode .strip() (défaut Zod) : tout champ inattendu retourné par l'IA
 * (ex: hallucination de "form" / "case" / "extractionPromptVersion")
 * est silencieusement supprimé — pas de leak vers la base.
 */
export const ExtractedDataSchema = z.object({
  taxpayer: TaxpayerSchema,
  taxYear: z.number().int(),
  detectedCategories: z.array(TaxCategoryEnum).default([]),
  ifu: z.array(IFUEntrySchema).default([]),
  scpi: z.array(SCPIEntrySchema).default([]),
  lifeInsurance: z.array(LifeInsuranceEntrySchema).default([]),
  realEstateIncome: GenericCategoryEntrySchema.optional(),
  dividends: GenericCategoryEntrySchema.optional(),
  interests: GenericCategoryEntrySchema.optional(),
  capitalGains: GenericCategoryEntrySchema.optional(),
  foreignAccounts: GenericCategoryEntrySchema.optional(),
  retirementSavings: GenericCategoryEntrySchema.optional(),
  deductibleExpenses: GenericCategoryEntrySchema.optional(),
  taxCredits: GenericCategoryEntrySchema.optional(),
  warnings: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
  globalConfidence: ConfidenceLevelEnum.default("medium"),
});
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
