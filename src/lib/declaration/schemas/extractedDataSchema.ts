import { z } from "zod";

/**
 * Schémas Zod — Squelette extensible
 * Modélise précisément IFU, SCPI et assurance-vie en V1.
 * Les autres catégories sont structurées avec une enveloppe générique
 * extensible (`items: z.unknown()`) pour itérer rapidement.
 */

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

/** Champ générique avec niveau de confiance */
const ConfidentField = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value,
    confidence: ConfidenceLevelEnum,
    sourceDocument: z.string().optional(),
    note: z.string().optional(),
  });

// --- Catégories détaillées ---

export const IFUEntrySchema = z.object({
  institution: z.string(),
  accountNumber: z.string().optional(),
  dividends: ConfidentField(z.number()).optional(),
  interests: ConfidentField(z.number()).optional(),
  capitalGains: ConfidentField(z.number()).optional(),
  withholdingTax: ConfidentField(z.number()).optional(),
  socialContributions: ConfidentField(z.number()).optional(),
});

export const SCPIEntrySchema = z.object({
  scpiName: z.string(),
  managementCompany: z.string().optional(),
  frenchIncome: ConfidentField(z.number()).optional(),
  foreignIncome: ConfidentField(z.number()).optional(),
  deductibleInterests: ConfidentField(z.number()).optional(),
  socialContributions: ConfidentField(z.number()).optional(),
});

export const LifeInsuranceEntrySchema = z.object({
  contractName: z.string(),
  insurer: z.string().optional(),
  contractAge: z.enum(["less_than_8", "more_than_8"]).optional(),
  withdrawals: ConfidentField(z.number()).optional(),
  taxableShare: ConfidentField(z.number()).optional(),
  withholdingTax: ConfidentField(z.number()).optional(),
});

/** Catégorie générique (extensible) */
export const GenericCategoryEntrySchema = z.object({
  label: z.string(),
  items: z.array(z.record(z.string(), z.unknown())).default([]),
  notes: z.string().optional(),
});

// --- Schéma principal ---

export const ExtractedDataSchema = z.object({
  taxpayer: TaxpayerSchema,
  taxYear: z.number().int(),

  detectedCategories: z.array(TaxCategoryEnum).default([]),

  // Catégories modélisées finement
  ifu: z.array(IFUEntrySchema).default([]),
  scpi: z.array(SCPIEntrySchema).default([]),
  lifeInsurance: z.array(LifeInsuranceEntrySchema).default([]),

  // Catégories génériques (extensibles)
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

  // Traçabilité de l'extraction
  extractionPromptVersion: z.string().optional(),
  extractedAt: z.string().optional(), // ISO 8601
  modelUsed: z.string().optional(),
});

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
