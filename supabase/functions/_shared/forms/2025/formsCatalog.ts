// Catalogue des formulaires fiscaux — millésime 2025 (revenus 2024)
// Minimal mais sourcé. Aucune entrée "confirmed" sans source officielle identifiée.
import type { TaxFormId, CatalogStatus } from "../../guidance/guidanceSchemas.ts";
import type { TaxCategory, ConfidenceLevel } from "../../contracts/extractionContracts.ts";

export interface FormCatalogEntry {
  formId: TaxFormId;
  label: string;
  purpose: string;
  categories: TaxCategory[];
  sourceName: string | null;
  sourceUrl: string | null;
  taxYear: 2025;
  confidence: ConfidenceLevel;
  status: CatalogStatus;
}

export const FORMS_CATALOG_2025: FormCatalogEntry[] = [
  {
    formId: "2042",
    label: "Déclaration principale 2042",
    purpose:
      "Déclaration des revenus du foyer fiscal : salaires, revenus de capitaux mobiliers, " +
      "produits d'assurance-vie, reports issus des annexes.",
    categories: ["ifu", "dividends", "interests", "life_insurance"],
    sourceName: "Notice 2041 / Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2042C",
    label: "Déclaration complémentaire 2042-C",
    purpose:
      "Revenus et plus-values complémentaires non couverts par la 2042 standard. " +
      "À ouvrir uniquement si situation spécifique identifiée.",
    categories: ["capital_gains", "dividends", "interests"],
    sourceName: "Notice 2042-C — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042-c/declaration-complementaire",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
  {
    formId: "2044",
    label: "Annexe 2044 — Revenus fonciers (régime réel)",
    purpose:
      "Détail des revenus fonciers au régime réel : loyers, charges déductibles, " +
      "intérêts d'emprunt, SCPI françaises au réel.",
    categories: ["real_estate_income", "scpi", "deductible_expenses"],
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2047",
    label: "Annexe 2047 — Revenus de source étrangère",
    purpose:
      "Déclaration des revenus encaissés à l'étranger (loyers étrangers, SCPI européennes, " +
      "dividendes/intérêts étrangers). Indispensable pour appliquer correctement les conventions fiscales.",
    categories: ["scpi", "real_estate_income", "dividends", "interests", "foreign_accounts"],
    sourceName: "Notice 2047 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2047/declaration-des-revenus-encaisses-letranger",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
];

export function getFormById(formId: TaxFormId): FormCatalogEntry | undefined {
  return FORMS_CATALOG_2025.find((f) => f.formId === formId);
}
