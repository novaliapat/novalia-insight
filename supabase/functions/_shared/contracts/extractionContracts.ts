// MIROIR Deno du contrat front (`src/lib/declaration/contracts/extractedDataContract.ts`).
// /!\ Toute modification ici DOIT être répercutée côté front et vérifiée par
// le test de parité (supabase/functions/_shared/contracts/parity_test.ts).

import { z } from "https://esm.sh/zod@3.23.8";

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

export const EvidenceTypeEnum = z.enum([
  "document_name_only",
  "text_excerpt",
  "page_reference",
  "visual_region",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const DocumentEvidenceSchema = z
  .object({
    sourceDocument: z.string(),
    pageNumber: z.number().int().positive().optional(),
    sectionLabel: z.string().optional(),
    extractedText: z.string().optional(),
    boundingBox: BoundingBoxSchema.optional(),
    confidence: ConfidenceLevelEnum,
    evidenceType: EvidenceTypeEnum,
    note: z.string().optional(),
  })
  .superRefine((ev, ctx) => {
    if (ev.evidenceType === "text_excerpt") {
      if (!ev.extractedText || ev.extractedText.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["extractedText"],
          message: "extractedText requis pour evidenceType=text_excerpt",
        });
      }
    }
    if (ev.evidenceType === "page_reference") {
      if (typeof ev.pageNumber !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pageNumber"],
          message: "pageNumber requis pour evidenceType=page_reference",
        });
      }
    }
    if (ev.evidenceType === "visual_region") {
      if (!ev.boundingBox) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["boundingBox"],
          message: "boundingBox requis pour evidenceType=visual_region",
        });
      }
    }
  });
export type DocumentEvidence = z.infer<typeof DocumentEvidenceSchema>;

export const TaxpayerSchema = z.object({
  fullName: z.string().optional(),
  fiscalNumber: z.string().optional(),
  taxHousehold: z.string().optional(),
  address: z.string().optional(),
});

export const ConfidentNumberSchema = z.object({
  value: z.number(),
  confidence: ConfidenceLevelEnum,
  sourceDocument: z.string().optional(),
  evidence: DocumentEvidenceSchema.optional(),
  note: z.string().optional(),
});

export const IFUEntrySchema = z.object({
  institution: z.string(),
  accountNumber: z.string().optional(),
  dividends: ConfidentNumberSchema.optional(),
  interests: ConfidentNumberSchema.optional(),
  capitalGains: ConfidentNumberSchema.optional(),
  withholdingTax: ConfidentNumberSchema.optional(),
  socialContributions: ConfidentNumberSchema.optional(),
  csgDeductible: ConfidentNumberSchema.optional(), // 2BH ou 2CG
});

export const SCPICountryIncomeSchema = z.object({
  country: z.string(),
  income: ConfidentNumberSchema,
  taxTreatment: z.enum(["tax_credit", "effective_rate", "exempt"]).optional(),
});

export const SCPICountryBreakdownSchema = z.object({
  country: z.string(),
  percentage: z.number(),
});

export const SCPIEntrySchema = z.object({
  scpiName: z.string(),
  managementCompany: z.string().optional(),
  numberOfShares: ConfidentNumberSchema.optional(),

  // Annexe 2044 — lignes 111 à 114
  grossIncome: ConfidentNumberSchema.optional(),
  frenchIncome: ConfidentNumberSchema.optional(),
  foreignIncome: ConfidentNumberSchema.optional(),
  expenses: ConfidentNumberSchema.optional(),
  scpiLoanInterests: ConfidentNumberSchema.optional(),
  netIncome: ConfidentNumberSchema.optional(),

  // Clé géographique
  geographicBreakdown: z.array(SCPICountryBreakdownSchema).optional(),

  // Reports 2042
  exemptIncome: ConfidentNumberSchema.optional(),
  foreignTaxCredit: ConfidentNumberSchema.optional(),

  // RCM associés à la SCPI
  rcmInterests: ConfidentNumberSchema.optional(),
  rcmCsgDeductible: ConfidentNumberSchema.optional(),
  rcmWithholdingTax: ConfidentNumberSchema.optional(),
  capitalGains: ConfidentNumberSchema.optional(),

  // IFI
  ifiValuePerShare: ConfidentNumberSchema.optional(),

  // PS
  socialContributions: ConfidentNumberSchema.optional(),

  // DEPRECATED
  deductibleInterests: ConfidentNumberSchema.optional(),
});

export const LifeInsuranceEntrySchema = z.object({
  contractName: z.string(),
  insurer: z.string().optional(),
  contractAge: z.enum(["less_than_8", "more_than_8"]).optional(),
  withdrawals: ConfidentNumberSchema.optional(),
  taxableShare: ConfidentNumberSchema.optional(),
  withholdingTax: ConfidentNumberSchema.optional(),
});

export const LoanEntrySchema = z.object({
  bank: z.string(),
  loanNumber: z.string().optional(),
  principal: ConfidentNumberSchema.optional(),
  firstDrawdownDate: z.string().optional(),
  annualInterests: ConfidentNumberSchema,
  year: z.number().int().optional(),
  linkedScpis: z.array(z.string()).default([]),
});

export const GenericCategoryEntrySchema = z.object({
  label: z.string(),
  items: z.array(z.record(z.string(), z.unknown())).default([]),
  notes: z.string().optional(),
});

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

export const ExtractionMetadataSchema = z.object({
  extractionPromptVersion: z.string(),
  extractedAt: z.string(),
  modelUsed: z.string().optional(),
  dryRun: z.boolean().default(false),
});
export type ExtractionMetadata = z.infer<typeof ExtractionMetadataSchema>;

export const ExtractionResultSchema = z.object({
  data: ExtractedDataSchema,
  metadata: ExtractionMetadataSchema,
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const ExtractionStatusEnum = z.enum([
  "extraction_not_started",
  "extraction_processing",
  "extraction_completed",
  "extraction_completed_with_warnings",
  "extraction_failed",
  "extraction_needs_review",
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatusEnum>;

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

export const ExtractTaxDataResponseSchema = z.object({
  data: ExtractedDataSchema,
  metadata: ExtractionMetadataSchema,
  audit: ExtractionAuditSchema,
  status: ExtractionStatusEnum,
});
export type ExtractTaxDataResponse = z.infer<typeof ExtractTaxDataResponseSchema>;
