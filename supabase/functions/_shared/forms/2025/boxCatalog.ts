// Catalogue des cases / lignes — millésime 2025 (revenus 2024).
// Règle d'or : aucune case en `confidence: "high"` / `status: "confirmed"` sans
// pageNumber identifié dans la Brochure pratique IR 2025 (sourceType official_brochure).
import type { TaxFormId, CatalogStatus } from "../../guidance/guidanceSchemas.ts";
import type { TaxCategory, ConfidenceLevel } from "../../contracts/extractionContracts.ts";
import { brochureChunksForBox } from "../../seed/brochureIr2025Seed.ts";

export interface BoxCatalogEntry {
  formId: TaxFormId;
  boxOrLine: string;
  label: string;
  category: TaxCategory;
  description: string;
  sourceType: "official_brochure" | "manual_seed" | "official_fetch";
  sourceName: string | null;
  sourceUrl: string | null;
  pageNumber: number | null;
  taxYear: 2025;
  confidence: ConfidenceLevel;
  status: CatalogStatus;
}

const BROCHURE_NAME = "Brochure pratique IR 2025 — Déclaration des revenus 2024";
const BROCHURE_URL =
  "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/brochure_pratique_ir.pdf";

/**
 * Construit une entrée catalogue automatiquement raccordée à un chunk
 * de la Brochure IR 2025 (si présent). En l'absence de chunk → confidence="medium",
 * status="needs_review", pageNumber=null.
 */
function brochureBox(args: {
  formId: TaxFormId;
  boxOrLine: string;
  label: string;
  category: TaxCategory;
  description: string;
  /** Le code utilisé pour rechercher le chunk dans la brochure (par défaut = boxOrLine). */
  brochureBoxCode?: string;
}): BoxCatalogEntry {
  const lookup = args.brochureBoxCode ?? args.boxOrLine;
  const chunks = brochureChunksForBox(lookup);
  const hasBrochure = chunks.length > 0;
  const pageNumber = hasBrochure ? chunks[0].pageNumber : null;

  return {
    formId: args.formId,
    boxOrLine: args.boxOrLine,
    label: args.label,
    category: args.category,
    description: args.description,
    sourceType: hasBrochure ? "official_brochure" : "manual_seed",
    sourceName: hasBrochure ? BROCHURE_NAME : "Notice DGFiP",
    sourceUrl: hasBrochure ? BROCHURE_URL : null,
    pageNumber,
    taxYear: 2025,
    confidence: hasBrochure && pageNumber && pageNumber > 0 ? "high" : "medium",
    status: hasBrochure && pageNumber && pageNumber > 0 ? "confirmed" : "needs_review",
  };
}

export const BOX_CATALOG_2025: BoxCatalogEntry[] = [
  // ── 2042 — Revenus de capitaux mobiliers ────────────────────────────────
  brochureBox({
    formId: "2042",
    boxOrLine: "2DC",
    label: "Revenus des actions et parts (dividendes éligibles abattement 40 %)",
    category: "dividends",
    description:
      "Dividendes d'actions et produits de parts sociales. Abattement 40 % uniquement en cas " +
      "d'option globale au barème (case 2OP).",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2TR",
    label: "Intérêts et autres produits de placement à revenu fixe",
    category: "interests",
    description:
      "Intérêts de livrets fiscalisés, comptes à terme, obligations, comptes courants d'associés. " +
      "PFU 12,8 % par défaut, option barème via 2OP.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2CK",
    label: "Crédit d'impôt — prélèvement forfaitaire non libératoire",
    category: "ifu",
    description:
      "Acompte de 12,8 % déjà prélevé à la source sur dividendes/intérêts. S'impute sur l'IR ; " +
      "excédent restitué.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2AB",
    label: "Crédits d'impôt sur valeurs mobilières étrangères",
    category: "foreign_accounts",
    description:
      "Contrepartie de la retenue à la source étrangère sur revenus mobiliers, lorsque la " +
      "convention fiscale prévoit l'imputation.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2BH",
    label: "Revenus déjà soumis aux prélèvements sociaux (CSG déductible si 2OP)",
    category: "ifu",
    description:
      "Revenus mobiliers ayant déjà supporté les prélèvements sociaux. Ouvre droit à la CSG " +
      "déductible uniquement si option globale barème (2OP).",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2CG",
    label: "Revenus déjà soumis aux prélèvements sociaux sans CSG déductible",
    category: "ifu",
    description: "Revenus déclarés ligne 2FU déjà soumis aux contributions sociales d'activité.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2OP",
    label: "Option pour l'imposition au barème progressif",
    category: "ifu",
    description:
      "Option globale et irrévocable pour l'année. Soumet TOUS les revenus mobiliers et gains " +
      "de cession au barème au lieu du PFU.",
  }),

  // ── 2042 — Assurance-vie ───────────────────────────────────────────────
  brochureBox({
    formId: "2042",
    boxOrLine: "2DH",
    label: "Produits AV ≥ 8 ans, primes avant 27.9.2017 (PFL 7,5 %)",
    category: "life_insurance",
    description: "Produits soumis au prélèvement libératoire de 7,5 %. Abattement 4 600 € / 9 200 €.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2CH",
    label: "Produits AV ≥ 8 ans, primes 26.9.1997 → 26.9.2017 sans PFL (barème)",
    category: "life_insurance",
    description: "Imposition au barème après abattement annuel 4 600 € / 9 200 €.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2UU",
    label: "Produits AV > 8 ans, versements ≥ 27.9.2017 — montant total",
    category: "life_insurance",
    description: "Préremrpli, à ventiler entre 2VV (≤150 k€) et 2WW (>150 k€).",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2VV",
    label: "Produits AV > 8 ans — primes ≤ 150 000 € (taux 7,5 %)",
    category: "life_insurance",
    description: "Part des produits 2UU correspondant à des primes inférieures à 150 000 €.",
    brochureBoxCode: "2VV",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2WW",
    label: "Produits AV > 8 ans — primes > 150 000 € (taux 12,8 %)",
    category: "life_insurance",
    description: "Part des produits 2UU correspondant à des primes supérieures à 150 000 €.",
    brochureBoxCode: "2WW",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2XX",
    label: "Produits AV < 8 ans, primes avant 27.9.2017, soumis au PFL",
    category: "life_insurance",
    description: "PFL 35 % (<4 ans) ou 15 % (4-8 ans), déjà acquitté à la source.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2YY",
    label: "Produits AV avant 27.9.2017 sans PFL — barème d'office",
    category: "life_insurance",
    description: "Imposition au barème même sans option 2OP.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "2ZZ",
    label: "Produits AV soumis au barème uniquement sur option globale (2OP)",
    category: "life_insurance",
    description: "Imposition au barème sur option 2OP.",
  }),

  // ── 2042 — Revenus fonciers ────────────────────────────────────────────
  brochureBox({
    formId: "2042",
    boxOrLine: "4BE",
    label: "Régime micro-foncier (recettes brutes ≤ 15 000 €)",
    category: "real_estate_income",
    description:
      "Déclaration directe sans annexe 2044, abattement forfaitaire de 30 % appliqué " +
      "automatiquement.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BK",
    label: "Revenus fonciers étrangers compris dans 4BE — crédit d'impôt = IR français",
    category: "real_estate_income",
    description:
      "Part étrangère des revenus déclarés en 4BE ouvrant droit à un crédit d'impôt égal à " +
      "l'impôt français. Neutralise l'acompte PAS.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BA",
    label: "Revenus fonciers (régime réel) — report depuis la 2044",
    category: "scpi",
    description:
      "Bénéfice foncier net reporté depuis la ligne 420 de la 2044, dont quote-part SCPI " +
      "françaises.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BL",
    label: "Revenus fonciers étrangers compris dans 4BA — crédit d'impôt = IR français",
    category: "scpi",
    description:
      "Part des revenus fonciers de source étrangère ouvrant droit à un crédit d'impôt égal à " +
      "l'impôt français (régime réel). Neutralise l'acompte PAS.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BB",
    label: "Déficit foncier — part reportable sur revenus fonciers (10 ans)",
    category: "real_estate_income",
    description: "Part du déficit foncier non imputable sur le revenu global.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BC",
    label: "Déficit foncier — part imputable sur le revenu global (≤ 10 700 €)",
    category: "real_estate_income",
    description: "Plafond 10 700 € (15 300 € en Périssol). Hors intérêts d'emprunt.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BD",
    label: "Déficits fonciers antérieurs non encore imputés",
    category: "real_estate_income",
    description: "Report depuis la ligne 651 de la 2044, imputable uniquement sur revenus fonciers.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BN",
    label: "Cessation des revenus fonciers après le 31.12.2024",
    category: "real_estate_income",
    description: "Évite la prise en compte de ces revenus dans les acomptes PAS 2025.",
  }),
  brochureBox({
    formId: "2042",
    boxOrLine: "4BZ",
    label: "Souscription d'une 2044 spéciale",
    category: "real_estate_income",
    description: "Régimes Périssol, Besson, Robien, Borloo, monuments historiques.",
  }),

  // ── 2042 — Crédit d'impôt revenus étrangers ────────────────────────────
  brochureBox({
    formId: "2042",
    boxOrLine: "8TK",
    label: "Revenus étrangers ouvrant droit à crédit d'impôt = impôt français",
    category: "foreign_accounts",
    description:
      "Report depuis la 2047. Crédit d'impôt annulant la double imposition (méthode imputation " +
      "intégrale).",
  }),

  // ── 2044 — Régime réel : SCPI françaises et intérêts d'emprunt ─────────
  // (ligne 211 / 250 sont des lignes, pas des cases — pas de boxCode brochure direct,
  //  mais elles sont couvertes par les chunks SCPI/intérêts d'emprunt → forçage manuel.)
  {
    formId: "2044",
    boxOrLine: "Ligne 211",
    label: "Recettes brutes — SCPI / parts de sociétés immobilières (France)",
    category: "scpi",
    description:
      "Quote-part des revenus fonciers français distribués par les SCPI, à reporter depuis le " +
      "relevé fiscal annuel.",
    sourceType: "official_brochure",
    sourceName: BROCHURE_NAME,
    sourceUrl: BROCHURE_URL,
    pageNumber: 154,
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
      "Intérêts d'emprunts contractés pour acquisition, conservation, construction, réparation " +
      "ou amélioration des immeubles donnés en location.",
    sourceType: "official_brochure",
    sourceName: BROCHURE_NAME,
    sourceUrl: BROCHURE_URL,
    pageNumber: 154,
    taxYear: 2025,
    confidence: "high",
    status: "confirmed",
  },
];

export function getBoxesForCategory(category: TaxCategory): BoxCatalogEntry[] {
  return BOX_CATALOG_2025.filter((b) => b.category === category);
}

export function getBoxesForForm(formId: TaxFormId): BoxCatalogEntry[] {
  return BOX_CATALOG_2025.filter((b) => b.formId === formId);
}

export function getBoxByCode(code: string): BoxCatalogEntry | undefined {
  return BOX_CATALOG_2025.find((b) => b.boxOrLine === code);
}
