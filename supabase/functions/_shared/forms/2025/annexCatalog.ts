// Catalogue des annexes — règles "tu dois ouvrir telle annexe si telle catégorie est détectée".
import type { TaxFormId, CatalogStatus } from "../../guidance/guidanceSchemas.ts";
import type { TaxCategory } from "../../contracts/extractionContracts.ts";

export interface AnnexRule {
  formId: TaxFormId;
  triggerCategories: TaxCategory[];
  // condition supplémentaire optionnelle (ex: revenus étrangers spécifiquement)
  requiresForeign?: boolean;
  reason: string;
  status: CatalogStatus;
}

export const ANNEX_RULES_2025: AnnexRule[] = [
  {
    formId: "2042",
    triggerCategories: [
      "ifu", "dividends", "interests", "life_insurance",
      "real_estate_income", "scpi", "foreign_accounts",
    ],
    reason: "La 2042 est la déclaration principale, toujours requise.",
    status: "confirmed",
  },
  {
    formId: "2044",
    triggerCategories: ["scpi", "real_estate_income", "deductible_expenses"],
    reason:
      "Revenus fonciers ou parts de SCPI françaises au régime réel : annexe 2044 nécessaire " +
      "pour détailler recettes, charges et intérêts d'emprunt.",
    status: "confirmed",
  },
  {
    formId: "2047",
    triggerCategories: ["scpi", "real_estate_income", "dividends", "interests", "foreign_accounts"],
    requiresForeign: true,
    reason:
      "Revenus de source étrangère détectés : annexe 2047 nécessaire pour appliquer " +
      "la convention fiscale (taux effectif ou crédit d'impôt).",
    status: "confirmed",
  },
];
