// Seed RAG manuel — résumés synthétiques officiels DGFiP/BOFiP.
// IMPORTANT : ce contenu n'est PAS la reproduction exhaustive des notices.
// Chaque chunk porte un warning et reste à vérifier avec la source officielle.
//
// Utilisé par l'edge function d'ingestion `seed-tax-rag-manual` (à créer ult.).
// Pour ce lot, on expose uniquement le tableau structuré, prêt à ingérer.

import type { TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";

export interface ManualSeedChunk {
  category: TaxCategory;
  taxYear: 2025;
  title: string;
  sourceType: "manual_seed";
  sourceName: string;
  sourceUrl: string | null;
  isOfficialSource: true;
  content: string;       // résumé synthétique opérationnel
  summary: string;       // 1-2 phrases
  keywords: string[];
  status: "active";
  warning: string;       // toujours rappeler que c'est un résumé
}

const STD_WARNING =
  "Résumé opérationnel synthétique — à vérifier avec la notice officielle DGFiP avant tout dépôt.";

export const MANUAL_RAG_SEED_2025: ManualSeedChunk[] = [
  // ── IFU / revenus de capitaux mobiliers ──
  {
    category: "ifu",
    taxYear: 2025,
    title: "IFU — Reports vers la 2042 (revenus mobiliers)",
    sourceType: "manual_seed",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    isOfficialSource: true,
    summary:
      "L'IFU récapitule les revenus mobiliers à reporter dans la 2042 : intérêts (2TR), " +
      "dividendes éligibles abattement 40 % (2DC), crédit d'impôt PFNL (2CK), prélèvements sociaux (2BH).",
    content:
      "L'Imprimé Fiscal Unique (IFU, formulaire 2561) regroupe les revenus de capitaux mobiliers " +
      "perçus en 2024 : dividendes, intérêts, produits de placement à revenu fixe, plus-values. " +
      "Reports principaux dans la 2042 : 2TR pour les intérêts, 2DC pour les dividendes éligibles à " +
      "l'abattement 40 % en cas d'option globale au barème, 2CK pour le crédit d'impôt correspondant " +
      "au prélèvement forfaitaire non libératoire de 12,8 % déjà acquitté, 2BH pour les revenus déjà " +
      "soumis aux prélèvements sociaux. Par défaut, ces revenus sont imposés au PFU (12,8 % IR + " +
      "17,2 % PS) sauf option pour le barème progressif (case 2OP).",
    keywords: ["IFU", "2561", "2TR", "2DC", "2CK", "2BH", "PFU", "barème", "abattement 40%"],
    status: "active",
    warning: STD_WARNING,
  },
  {
    category: "dividends",
    taxYear: 2025,
    title: "Dividendes — Abattement 40 % et option barème",
    sourceType: "manual_seed",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    isOfficialSource: true,
    summary:
      "Les dividendes d'actions françaises ou européennes sont à reporter en 2DC. " +
      "L'abattement de 40 % ne s'applique qu'en cas d'option globale au barème (case 2OP).",
    content:
      "Les dividendes éligibles à l'abattement de 40 % doivent être reportés en case 2DC de la 2042. " +
      "Cet abattement n'est appliqué QUE si le contribuable opte globalement pour l'imposition au " +
      "barème progressif (case 2OP cochée pour l'ensemble des revenus mobiliers du foyer). En l'absence " +
      "d'option, le PFU 12,8 % s'applique sans abattement. Le crédit d'impôt 2CK et les prélèvements " +
      "déjà acquittés en 2BH restent à reporter dans tous les cas.",
    keywords: ["dividendes", "2DC", "2OP", "abattement 40", "PFU", "barème"],
    status: "active",
    warning: STD_WARNING,
  },
  {
    category: "interests",
    taxYear: 2025,
    title: "Intérêts — Reporter en 2TR depuis l'IFU",
    sourceType: "manual_seed",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    isOfficialSource: true,
    summary:
      "Les intérêts et autres produits de placement à revenu fixe sont à reporter en case 2TR.",
    content:
      "Les intérêts des comptes à terme, livrets fiscalisés, obligations et autres produits à revenu " +
      "fixe figurant sur l'IFU se reportent dans la case 2TR de la 2042. Régime par défaut : PFU 30 %. " +
      "L'option pour le barème progressif (2OP) couvre l'ensemble des revenus mobiliers et ne peut être " +
      "partielle. Le crédit d'impôt issu du PFNL acompte de 12,8 % se reporte en 2CK.",
    keywords: ["intérêts", "2TR", "PFU", "produits revenu fixe"],
    status: "active",
    warning: STD_WARNING,
  },

  // ── SCPI / revenus fonciers français ──
  {
    category: "scpi",
    taxYear: 2025,
    title: "SCPI françaises — Annexe 2044 (revenus fonciers)",
    sourceType: "manual_seed",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    isOfficialSource: true,
    summary:
      "Les revenus fonciers distribués par les SCPI françaises se déclarent au régime réel via la 2044, ligne 211.",
    content:
      "La quote-part de revenus fonciers de source française distribuée par une SCPI doit être reportée " +
      "à la ligne 211 de l'annexe 2044, en utilisant les informations du relevé fiscal annuel SCPI " +
      "(souvent intitulé 'IFU SCPI'). Les charges (ligne 230) et intérêts d'emprunt (ligne 250) " +
      "supportés au titre de l'investissement SCPI sont déductibles dans les conditions de droit commun. " +
      "Le résultat foncier net (ligne 420) se reporte ensuite en case 4BA (bénéfice) ou 4BC (déficit) de la 2042.",
    keywords: ["SCPI", "2044", "ligne 211", "ligne 250", "4BA", "revenus fonciers", "régime réel"],
    status: "active",
    warning: STD_WARNING,
  },
  {
    category: "real_estate_income",
    taxYear: 2025,
    title: "Revenus fonciers — Régime réel ou micro-foncier",
    sourceType: "manual_seed",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    isOfficialSource: true,
    summary:
      "Au-delà de 15 000 € de revenus bruts ou en présence de SCPI/régimes spéciaux, le régime réel " +
      "(2044) est obligatoire ; en-deçà, micro-foncier possible (abattement 30 % directement en 4BE).",
    content:
      "Le micro-foncier (abattement forfaitaire de 30 %, déclaration directe en 4BE de la 2042) n'est " +
      "ouvert que si les revenus fonciers bruts du foyer ne dépassent pas 15 000 € ET en l'absence de " +
      "régimes spéciaux (SCPI fiscale, monuments historiques, déficit foncier, etc.). Sinon, dépôt " +
      "obligatoire de la 2044 au régime réel : recettes brutes (211), charges (230), intérêts d'emprunt " +
      "(250), résultat (420) reporté en 4BA/4BB/4BC sur la 2042.",
    keywords: ["revenus fonciers", "micro-foncier", "régime réel", "2044", "4BE", "4BA"],
    status: "active",
    warning: STD_WARNING,
  },
  {
    category: "deductible_expenses",
    taxYear: 2025,
    title: "Intérêts d'emprunt — Charges déductibles des revenus fonciers",
    sourceType: "manual_seed",
    sourceName: "Notice 2044 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2044/declaration-des-revenus-fonciers",
    isOfficialSource: true,
    summary:
      "Les intérêts d'emprunts contractés pour acquérir/conserver/améliorer un bien locatif sont " +
      "déductibles ligne 250 de la 2044.",
    content:
      "Sont déductibles ligne 250 de l'annexe 2044 : intérêts proprement dits, frais de dossier, " +
      "frais d'inscription hypothécaire, primes d'assurance liées à l'emprunt. Les intérêts doivent " +
      "se rapporter à des emprunts contractés pour l'acquisition, la construction, la conservation, " +
      "la réparation ou l'amélioration des immeubles donnés en location. Conserver justificatifs " +
      "bancaires (échéanciers, attestations annuelles).",
    keywords: ["intérêts d'emprunt", "ligne 250", "2044", "charges déductibles", "déficit foncier"],
    status: "active",
    warning: STD_WARNING,
  },

  // ── Revenus étrangers / SCPI européennes ──
  {
    category: "foreign_accounts",
    taxYear: 2025,
    title: "Revenus étrangers — Annexe 2047 obligatoire",
    sourceType: "manual_seed",
    sourceName: "Notice 2047 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2047/declaration-des-revenus-encaisses-letranger",
    isOfficialSource: true,
    summary:
      "Tout revenu encaissé hors de France doit transiter par la 2047 pour application de la convention fiscale.",
    content:
      "L'annexe 2047 est obligatoire dès lors qu'un revenu est encaissé à l'étranger (loyers, dividendes, " +
      "intérêts, plus-values, salaires). Elle permet d'appliquer la convention fiscale bilatérale : " +
      "soit méthode du taux effectif (revenus exonérés mais retenus pour calcul du taux), soit crédit " +
      "d'impôt (égal à l'impôt français ou à l'impôt étranger selon convention). Reports : case 8TK pour " +
      "les revenus ouvrant droit à crédit d'impôt = impôt français ; cadres dédiés sur la 2042 selon nature.",
    keywords: ["2047", "revenus étrangers", "8TK", "convention fiscale", "crédit d'impôt", "taux effectif"],
    status: "active",
    warning: STD_WARNING,
  },

  // ── Assurance-vie ──
  {
    category: "life_insurance",
    taxYear: 2025,
    title: "Assurance-vie — Rachats et abattement 8 ans",
    sourceType: "manual_seed",
    sourceName: "Notice 2042 — DGFiP",
    sourceUrl: "https://www.impots.gouv.fr/formulaire/2042/declaration-des-revenus",
    isOfficialSource: true,
    summary:
      "Les produits issus de rachats sur contrats de plus de 8 ans bénéficient d'un abattement " +
      "(4 600 € / 9 200 €) puis d'un PFL/PFU réduit (7,5 %) ou du barème.",
    content:
      "Pour un contrat d'assurance-vie de plus de 8 ans, les produits issus de rachats partiels ou " +
      "totaux bénéficient d'un abattement annuel de 4 600 € (célibataire) ou 9 200 € (couple). " +
      "Au-delà : taux de 7,5 % (primes versées avant 27/09/2017 ou ≤ 150 000 €) ou 12,8 % (au-delà). " +
      "Reports en 2042 : case 2CH (produits ouvrant droit à abattement après 8 ans). Pour les contrats " +
      "de moins de 8 ans, PFU 12,8 % par défaut. Toujours s'appuyer sur l'IFU transmis par l'assureur.",
    keywords: ["assurance-vie", "2CH", "abattement", "8 ans", "PFL", "PFU 7.5", "rachat"],
    status: "active",
    warning: STD_WARNING,
  },
];
