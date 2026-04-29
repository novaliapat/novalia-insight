// Catalogue minimal des cases / lignes — millésime 2025 (revenus 2024).
// Règle d'or : aucune entrée "confirmed" sans source officielle identifiée.
// En cas de doute → status "needs_review" + confidence "low/medium".
import type { TaxFormId, CatalogStatus } from "@/lib/declaration/guidance/guidanceSchemas";
import type { TaxCategory, ConfidenceLevel } from "@/lib/declaration/contracts/extractedDataContract";

export interface BoxCatalogEntry {
  formId: TaxFormId;
  boxOrLine: string;       // "2TR", "4BA", "8TK", ligne 211, etc.
  label: string;
  category: TaxCategory;
  description: string;
  sourceName: string | null;
  sourceUrl: string | null;
  taxYear: 2025;
  confidence: ConfidenceLevel;
  status: CatalogStatus;
}

// Cases couvrant uniquement les catégories actuellement traitées par l'extraction.
// Volontairement restreint : ~15-20 entrées max, chacune sourçable.
export const BOX_CATALOG_2025: BoxCatalogEntry[] = [
  // ── 2042 — Revenus de capitaux mobiliers (IFU) ─────────────────────────────
  {
    formId: "2042",
    boxOrLine: "2TR",
    label: "Intérêts et autres produits de placement à revenu fixe",
    category: "interests",
    description:
      "À reporter depuis l'IFU (case équivalente). Soumis par défaut au PFU 12,8 % " +
      "sauf option globale au barème.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
  {
    formId: "2042",
    boxOrLine: "2DC",
    label: "Revenus des actions et parts (dividendes éligibles abattement 40 %)",
    category: "dividends",
    description:
      "Dividendes éligibles à l'abattement de 40 % en cas d'option globale au barème. " +
      "À vérifier dans l'IFU.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
  {
    formId: "2042",
    boxOrLine: "2CK",
    label: "Crédit d'impôt prélèvement forfaitaire non libératoire",
    category: "ifu",
    description:
      "Acompte de 12,8 % déjà prélevé sur dividendes/intérêts, à reporter pour imputation. " +
      "Présent sur l'IFU.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
  {
    formId: "2042",
    boxOrLine: "2BH",
    label: "Revenus déjà soumis aux prélèvements sociaux",
    category: "ifu",
    description: "Montant des revenus mobiliers ayant déjà supporté les prélèvements sociaux.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "low",
    status: "needs_review",
  },

  // ── 2042 — Assurance-vie ───────────────────────────────────────────────────
  {
    formId: "2042",
    boxOrLine: "2CH",
    label: "Produits d'assurance-vie ouvrant droit à abattement (contrats > 8 ans)",
    category: "life_insurance",
    description:
      "Produits issus de rachats sur contrats de plus de 8 ans, après abattement " +
      "(4 600 € célibataire / 9 200 € couple).",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "low",
    status: "needs_review",
  },

  // ── 2044 — Revenus fonciers / SCPI françaises ──────────────────────────────
  {
    formId: "2044",
    boxOrLine: "Ligne 211",
    label: "Recettes brutes — SCPI / parts de sociétés immobilières (France)",
    category: "scpi",
    description:
      "Quote-part des revenus fonciers français distribués par les SCPI. " +
      "À reporter depuis le relevé fiscal SCPI.",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2044",
    boxOrLine: "Ligne 250",
    label: "Intérêts d'emprunt déductibles",
    category: "deductible_expenses",
    description:
      "Intérêts d'emprunts contractés pour l'acquisition, la conservation, la construction, " +
      "la réparation ou l'amélioration des immeubles donnés en location.",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2044",
    boxOrLine: "Ligne 420",
    label: "Résultat foncier — report vers la 2042",
    category: "real_estate_income",
    description:
      "Résultat foncier net (bénéfice ou déficit) à reporter sur la 2042 (cases 4BA/4BB/4BC).",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2042",
    boxOrLine: "4BA",
    label: "Revenus fonciers imposables (report 2044)",
    category: "real_estate_income",
    description: "Bénéfice foncier imposable, report depuis la ligne 420 de la 2044.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },

  // ── 2047 — Revenus étrangers ──────────────────────────────────────────────
  {
    formId: "2047",
    boxOrLine: "Cadre 4 — Revenus fonciers étrangers",
    label: "Revenus fonciers de source étrangère (SCPI européennes notamment)",
    category: "scpi",
    description:
      "Revenus fonciers encaissés hors de France, à déclarer également selon la convention " +
      "fiscale applicable (taux effectif ou crédit d'impôt).",
    sourceName: "Notice 2047 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2047/declaration-des-revenus-encaisses-letranger",
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
  {
    formId: "2047",
    boxOrLine: "Cadre 6 — Crédit d'impôt étranger",
    label: "Crédit d'impôt correspondant à l'impôt étranger",
    category: "foreign_accounts",
    description:
      "Crédit d'impôt accordé en application de la convention fiscale, à reporter sur la 2042.",
    sourceName: "Notice 2047 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2047/declaration-des-revenus-encaisses-letranger",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
  {
    formId: "2042",
    boxOrLine: "8TK",
    label: "Revenus étrangers ouvrant droit à crédit d'impôt = impôt français",
    category: "foreign_accounts",
    description:
      "Report depuis la 2047. Montant des revenus étrangers déjà imposés à l'étranger " +
      "ouvrant droit à un crédit d'impôt égal à l'impôt français.",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    taxYear: 2025,
    confidence: "medium",
    status: "needs_review",
  },
];

export function getBoxesForCategory(category: TaxCategory): BoxCatalogEntry[] {
  return BOX_CATALOG_2025.filter((b) => b.category === category);
}

export function getBoxesForForm(formId: TaxFormId): BoxCatalogEntry[] {
  return BOX_CATALOG_2025.filter((b) => b.formId === formId);
}
