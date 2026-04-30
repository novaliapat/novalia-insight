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

/**
 * DocumentEvidence — preuve documentaire d'un champ extrait.
 *
 * Règles de validité (superRefine) :
 *  - text_excerpt    → extractedText obligatoire (non vide)
 *  - page_reference  → pageNumber obligatoire (>= 1)
 *  - visual_region   → boundingBox obligatoire (et pageNumber recommandé)
 *  - document_name_only → aucun champ supplémentaire requis
 *
 * L'IA ne doit JAMAIS fabriquer un extrait : si elle ne peut pas pointer
 * une page ou un texte, elle remplit `evidenceType="document_name_only"`.
 */
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

const ConfidentField = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    confidence: ConfidenceLevelEnum,
    sourceDocument: z.string().optional(),
    /** Preuve documentaire enrichie — optionnelle pour rétrocompat. */
    evidence: DocumentEvidenceSchema.optional(),
    note: z.string().optional(),
  });

export const TaxpayerSchema = z.object({
  fullName: z.string().optional(),
  fiscalNumber: z.string().optional(),
  taxHousehold: z.string().optional(),
  address: z.string().optional(),
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
  csgDeductible: ConfidentNumberSchema.optional(), // 2BH ou 2CG
});

export const SCPICountryIncomeSchema = z.object({
  country: z.string(),
  income: ConfidentNumberSchema,
  taxTreatment: z.enum(["tax_credit", "effective_rate", "exempt"]).optional(),
});

export const SCPIEntrySchema = z.object({
  scpiName: z.string(),
  managementCompany: z.string().optional(),

  // Annexe 2044 — lignes 111 à 114
  grossIncome: ConfidentNumberSchema.optional(),         // Ligne 111 total (revenus bruts)
  frenchIncome: ConfidentNumberSchema.optional(),        // Ligne 111 part France
  foreignIncome: ConfidentNumberSchema.optional(),       // Ligne 111 part étranger
  expenses: ConfidentNumberSchema.optional(),            // Ligne 112 (frais et charges hors intérêts)
  scpiLoanInterests: ConfidentNumberSchema.optional(),   // Ligne 113 (intérêts d'emprunt de la SCPI)
  netIncome: ConfidentNumberSchema.optional(),           // Ligne 114 (bénéfice ou déficit)

  // Intérêts d'emprunt personnels (attestation bancaire)
  personalLoanInterests: ConfidentNumberSchema.optional(),

  // Reports déclaration principale 2042
  exemptIncome: ConfidentNumberSchema.optional(),        // 4EA
  microFoncierExempt: ConfidentNumberSchema.optional(),  // 4EB
  foreignTaxCredit: ConfidentNumberSchema.optional(),    // 8TK

  // Ventilation par pays
  incomeByCountry: z.array(SCPICountryIncomeSchema).optional(),

  // Prélèvements sociaux
  socialContributions: ConfidentNumberSchema.optional(),

  // IFI
  ifiValuePerShare: ConfidentNumberSchema.optional(),
  numberOfShares: ConfidentNumberSchema.optional(),

  // DEPRECATED — remplacé par personalLoanInterests / scpiLoanInterests.
  // Conservé optionnel pour ne pas invalider les déclarations existantes.
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
