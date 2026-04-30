// Seed RAG officiel — extraits structurés de la Brochure pratique IR 2025
// (Déclaration des revenus 2024). Source officielle DGFiP, format imprimé public.
//
// Chaque entrée est ancrée à un numéro de page certifié et à un ou plusieurs codes
// de cases. Les `content` sont des extraits courts (≤ ~600 caractères) issus de la
// brochure et peuvent légèrement différer de la mise en page originale (espaces /
// césures normalisés). Toujours vérifier avec la brochure officielle complète.
// Mirror Deno — pas d'import @/, types locaux
type TaxCategory = string;
type TaxFormId = string;

export interface BrochureSeedChunk {
  category: TaxCategory;
  taxYear: 2025;
  incomeYear: 2024;
  title: string;
  sourceType: "official_brochure";
  sourceName: "Brochure pratique IR 2025 — Déclaration des revenus 2024";
  sourceUrl: string | null;
  isOfficialSource: true;
  pageNumber: number;
  formId: TaxFormId;
  sectionLabel: string;
  boxCodes: string[];
  content: string;
  excerpt: string;
  keywords: string[];
  provenance: "official_brochure";
  warning: string;
}

const BROCHURE_NAME = "Brochure pratique IR 2025 — Déclaration des revenus 2024" as const;
const BROCHURE_URL = "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/brochure_pratique_ir.pdf";
const STD_WARNING =
  "Extrait structuré depuis la Brochure pratique IR 2025. À vérifier avec la source officielle complète.";

const base = (extra: Partial<BrochureSeedChunk>): BrochureSeedChunk => ({
  taxYear: 2025,
  incomeYear: 2024,
  sourceType: "official_brochure",
  sourceName: BROCHURE_NAME,
  sourceUrl: BROCHURE_URL,
  isOfficialSource: true,
  provenance: "official_brochure",
  warning: STD_WARNING,
  // valeurs par défaut écrasées par `extra`
  category: "other",
  title: "",
  pageNumber: 0,
  formId: "2042",
  sectionLabel: "",
  boxCodes: [],
  content: "",
  excerpt: "",
  keywords: [],
  ...extra,
});

export const BROCHURE_IR_2025_SEED: BrochureSeedChunk[] = [
  // ──────────────── 2042 — Revenus de capitaux mobiliers ────────────────
  base({
    category: "dividends",
    title: "2DC — Revenus des actions et parts (dividendes)",
    pageNumber: 124,
    formId: "2042",
    sectionLabel: "Revenus distribués",
    boxCodes: ["2DC"],
    excerpt:
      "Vous devez déclarer ligne 2DC le montant des dividendes d'actions, des produits de parts sociales, " +
      "des produits des parts bénéficiaires ou de fondateur, quel que soit le pourcentage que vous détenez " +
      "dans la société distributrice.",
    content:
      "Section « Revenus distribués » (CGI, art. 108, 158-3 ; BOI-RPPM-RCM-10-20). Ligne 2DC : montant " +
      "des dividendes d'actions, produits de parts sociales, produits de parts bénéficiaires ou de fondateur, " +
      "quel que soit le pourcentage détenu. Il s'agit des revenus distribués par les sociétés passibles de " +
      "l'impôt sur les sociétés. Imposition par défaut au PFU 12,8 %, abattement 40 % uniquement en cas " +
      "d'option globale au barème (case 2OP).",
    keywords: ["2DC", "dividendes", "revenus distribués", "actions", "abattement 40", "PFU"],
  }),

  base({
    category: "interests",
    title: "2TR — Intérêts et autres produits de placement à revenu fixe",
    pageNumber: 126,
    formId: "2042",
    sectionLabel: "Produits de placement à revenu fixe",
    boxCodes: ["2TR"],
    excerpt:
      "Intérêts et autres produits de placement à revenu fixe (ligne 2TR) : intérêts des livrets bancaires " +
      "fiscalisés, produits des comptes de dépôt et comptes à terme, produits de créances, comptes courants " +
      "d'associés, obligations et emprunts d'État, bons du Trésor.",
    content:
      "Section « Produits de placement à revenu fixe » (BOI-RPPM-RCM-10-10). À déclarer ligne 2TR : " +
      "intérêts de livrets bancaires fiscalisés, comptes de dépôt et comptes à terme, créances, " +
      "cautionnements, comptes courants d'associés, obligations et emprunts d'État, bons du Trésor. " +
      "Régime par défaut PFU 12,8 % + 17,2 % de prélèvements sociaux ; option pour le barème via 2OP.",
    keywords: ["2TR", "intérêts", "produits de placement à revenu fixe", "PFU", "obligations", "livrets"],
  }),

  base({
    category: "ifu",
    title: "2CK — Prélèvement forfaitaire non libératoire déjà versé",
    pageNumber: 122,
    formId: "2042",
    sectionLabel: "Prélèvement forfaitaire obligatoire non libératoire",
    boxCodes: ["2CK"],
    excerpt:
      "Le montant du prélèvement forfaitaire non libératoire correspondant aux revenus mobiliers est en " +
      "principe prérempli case 2CK, sinon indiquez-le. Il est déduit de l'impôt dû par votre foyer ; s'il " +
      "excède l'impôt dû, l'excédent est restitué.",
    content:
      "Le prélèvement forfaitaire obligatoire non libératoire de 12,8 % (acompte d'IR) prélevé à la source " +
      "sur dividendes, intérêts et produits d'assurance-vie post-27.9.2017 doit être reporté case 2CK de " +
      "la 2042. Il s'impute sur l'impôt sur le revenu dû ; tout excédent est restitué. Présent sur l'IFU.",
    keywords: ["2CK", "PFNL", "prélèvement forfaitaire non libératoire", "acompte", "crédit d'impôt"],
  }),

  base({
    category: "foreign_accounts",
    title: "2AB — Crédits d'impôt sur valeurs étrangères",
    pageNumber: 133,
    formId: "2042",
    sectionLabel: "Crédits d'impôt",
    boxCodes: ["2AB"],
    excerpt:
      "Les crédits d'impôt à déclarer ligne 2AB sont la contrepartie de la retenue à la source opérée " +
      "sur les revenus de valeurs mobilières étrangères lorsque la convention conclue avec la France " +
      "prévoit l'imputation de l'impôt retenu à l'étranger sur l'impôt français.",
    content:
      "Crédits d'impôt sur valeurs étrangères (CGI, art. 199 ter I a et b). Ligne 2AB : contrepartie de " +
      "la retenue à la source étrangère sur revenus mobiliers de source étrangère, lorsque la convention " +
      "fiscale prévoit l'imputation et que l'établissement payeur est établi en France. Pour les revenus " +
      "encaissés hors de France, voir la 2047.",
    keywords: ["2AB", "crédit d'impôt", "valeurs étrangères", "convention fiscale", "retenue à la source"],
  }),

  base({
    category: "ifu",
    title: "2BH — Revenus déjà soumis aux prélèvements sociaux (CSG déductible)",
    pageNumber: 131,
    formId: "2042",
    sectionLabel: "Revenus déjà soumis aux prélèvements sociaux",
    boxCodes: ["2BH"],
    excerpt:
      "Inscrivez ligne 2BH le montant des revenus perçus en 2024 sur lesquels les prélèvements sociaux " +
      "ont déjà été prélevés et qui ouvrent droit à CSG déductible uniquement en cas d'option pour le barème.",
    content:
      "Ligne 2BH : revenus mobiliers perçus en 2024 sur lesquels les prélèvements sociaux ont déjà été " +
      "acquittés à la source par l'établissement payeur (ou via la 2778). Ouvrent droit à CSG déductible " +
      "uniquement si option globale pour l'imposition au barème progressif (case 2OP). Sans option, " +
      "imposition au PFU sans CSG déductible.",
    keywords: ["2BH", "prélèvements sociaux", "CSG déductible", "barème", "2OP"],
  }),

  base({
    category: "ifu",
    title: "2CG — Revenus déjà soumis aux prélèvements sociaux sans CSG déductible",
    pageNumber: 125,
    formId: "2042",
    sectionLabel: "Revenus déjà soumis aux prélèvements sociaux",
    boxCodes: ["2CG"],
    excerpt:
      "Indiquez ligne 2CG le montant des revenus déclarés ligne 2FU qui ont déjà été soumis aux cotisations " +
      "et contributions sociales au titre des revenus d'activité. Ils n'ouvrent pas droit à CSG déductible.",
    content:
      "Ligne 2CG : revenus mobiliers déclarés ligne 2FU déjà soumis aux cotisations et contributions " +
      "sociales au titre des revenus d'activité. Mécanisme d'évitement de la double imposition aux " +
      "prélèvements sociaux. Ces revenus n'ouvrent pas droit à CSG déductible.",
    keywords: ["2CG", "prélèvements sociaux", "double imposition", "2FU"],
  }),

  base({
    category: "ifu",
    title: "2OP — Option pour l'imposition au barème progressif",
    pageNumber: 123,
    formId: "2042",
    sectionLabel: "Option globale barème",
    boxCodes: ["2OP"],
    excerpt:
      "Le contribuable peut opter pour l'imposition de l'ensemble de ses revenus de capitaux mobiliers et " +
      "gains de cession de valeurs mobilières au barème progressif en cochant la case 2OP de la 2042. " +
      "L'option est globale et porte sur l'ensemble des revenus mobiliers du foyer.",
    content:
      "Case 2OP : option globale et irrévocable pour l'année, qui soumet TOUS les revenus mobiliers et " +
      "gains de cession au barème progressif au lieu du PFU. Si la case 2OP était cochée l'an dernier, " +
      "elle est pré-cochée cette année — décocher pour revenir au PFU. L'abattement 40 % sur dividendes " +
      "et la CSG déductible (2BH) ne s'appliquent qu'en cas d'option 2OP.",
    keywords: ["2OP", "barème", "option globale", "PFU", "abattement 40"],
  }),

  // ──────────────── 2042 — Assurance-vie ────────────────
  base({
    category: "life_insurance",
    title: "2DH — Produits AV ≥ 8 ans, primes avant 27.9.2017 (PFL 7,5 %)",
    pageNumber: 122,
    formId: "2042",
    sectionLabel: "Assurance-vie — prélèvement libératoire",
    boxCodes: ["2DH"],
    excerpt:
      "Ligne 2DH : produits des bons et contrats de capitalisation et d'assurance-vie de source française " +
      "ou européenne d'une durée au moins égale à 8 ans afférents aux versements effectués avant le " +
      "27.9.2017, soumis au prélèvement libératoire de 7,5 %.",
    content:
      "Ligne 2DH : produits AV ≥ 8 ans, versements antérieurs au 27.9.2017, soumis au prélèvement " +
      "libératoire de 7,5 %. Ouvrent droit à l'abattement annuel de 4 600 € (personne seule) ou 9 200 € " +
      "(couple) et à la restitution éventuelle du prélèvement correspondant.",
    keywords: ["2DH", "assurance-vie", "PFL", "7.5", "8 ans", "abattement"],
  }),

  base({
    category: "life_insurance",
    title: "2CH — Produits AV ≥ 8 ans, primes 26.9.1997 → 26.9.2017 sans PFL",
    pageNumber: 128,
    formId: "2042",
    sectionLabel: "Assurance-vie — barème",
    boxCodes: ["2CH"],
    excerpt:
      "Indiquez ligne 2CH le montant des produits acquis ou constatés à compter du 1.1.1998, afférents " +
      "à des primes versées du 26.9.1997 au 26.9.2017 pour lesquels vous n'avez pas opté pour le " +
      "prélèvement libératoire de 7,5 %. Abattement 4 600 € / 9 200 €.",
    content:
      "Ligne 2CH : produits AV (rachats 2024) issus de primes versées entre le 26.9.1997 et le 26.9.2017 " +
      "sans option pour le PFL. Imposition au barème après abattement annuel de 4 600 € (célibataire) ou " +
      "9 200 € (couple). À utiliser pour les contrats > 8 ans dénoués ou rachetés en 2024.",
    keywords: ["2CH", "assurance-vie", "8 ans", "abattement", "barème"],
  }),

  base({
    category: "life_insurance",
    title: "2UU — Produits AV > 8 ans, versements ≥ 27.9.2017 (montant total)",
    pageNumber: 129,
    formId: "2042",
    sectionLabel: "Assurance-vie post-27.9.2017",
    boxCodes: ["2UU", "2VV", "2WW"],
    excerpt:
      "Le montant des produits des contrats de plus de 8 ans afférents aux versements effectués à compter " +
      "du 27.9.2017 est en principe prérempli ligne 2UU. Le montant doit être réparti par le contribuable " +
      "entre 2VV (primes ≤ 150 000 €, 7,5 %) et 2WW (primes > 150 000 €, 12,8 %).",
    content:
      "Ligne 2UU : montant total préremrpli des produits AV > 8 ans afférents aux versements ≥ 27.9.2017, " +
      "ayant supporté le PFNL au taux de 7,5 %. Le contribuable doit ventiler : ligne 2VV pour la part " +
      "correspondant à des primes ≤ 150 000 € (taux 7,5 % ou barème), ligne 2WW pour la part correspondant " +
      "à des primes > 150 000 € (taux 12,8 % ou barème).",
    keywords: ["2UU", "2VV", "2WW", "assurance-vie", "150000", "7.5", "12.8"],
  }),

  base({
    category: "life_insurance",
    title: "2XX — Produits AV < 8 ans, primes avant 27.9.2017, soumis au PFL",
    pageNumber: 122,
    formId: "2042",
    sectionLabel: "Assurance-vie — prélèvement libératoire",
    boxCodes: ["2XX"],
    excerpt:
      "Ligne 2XX : produits des bons et contrats de capitalisation et d'assurance-vie de source française " +
      "ou européenne de moins de 8 ans afférents aux versements effectués avant le 27.9.2017, soumis au " +
      "prélèvement libératoire.",
    content:
      "Ligne 2XX : produits AV < 8 ans issus de primes antérieures au 27.9.2017 et soumis au prélèvement " +
      "libératoire (35 % si < 4 ans, 15 % entre 4 et 8 ans). Indiquez le montant brut perçu en 2024 ; le " +
      "PFL est non restituable mais déjà acquitté à la source.",
    keywords: ["2XX", "assurance-vie", "PFL", "moins de 8 ans"],
  }),

  base({
    category: "life_insurance",
    title: "2YY / 2ZZ — Produits AV avant 27.9.2017 sans PFL (barème)",
    pageNumber: 130,
    formId: "2042",
    sectionLabel: "Assurance-vie — barème",
    boxCodes: ["2YY", "2ZZ"],
    excerpt:
      "Ligne 2YY : produits AV pour lesquels vous n'avez pas opté pour le prélèvement libératoire — imposés " +
      "au barème de l'IR (y compris sans option globale 2OP). Ligne 2ZZ : autres produits soumis au barème " +
      "sur option globale.",
    content:
      "Ligne 2YY : produits AV (notamment contrats < 8 ans) sans option PFL → imposition d'office au barème " +
      "même sans 2OP. Ligne 2ZZ : produits soumis au barème uniquement sur option globale (2OP) du " +
      "contribuable pour l'ensemble des revenus et gains mobiliers.",
    keywords: ["2YY", "2ZZ", "assurance-vie", "barème", "2OP"],
  }),

  // ──────────────── 2042 — Revenus fonciers ────────────────
  base({
    category: "real_estate_income",
    title: "4BE — Régime micro-foncier (≤ 15 000 € bruts)",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Revenus fonciers — micro-foncier",
    boxCodes: ["4BE"],
    excerpt:
      "Si vous relevez du régime micro-foncier (revenus bruts ≤ 15 000 €), vous n'avez pas de déclaration " +
      "de revenus fonciers à souscrire : il vous suffit de porter ligne 4BE de la 2042 le montant des " +
      "revenus bruts perçus en 2024 (charges non comprises).",
    content:
      "Régime micro-foncier (recettes brutes annuelles ≤ 15 000 €, hors régimes spéciaux) : déclaration " +
      "directe en case 4BE, sans annexe 2044. Abattement forfaitaire de 30 % appliqué automatiquement par " +
      "l'administration. Sont exclues : SCPI fiscales (Robien-SCPI, Borloo-SCPI), monuments historiques, " +
      "Périssol, etc., qui imposent le régime réel via la 2044.",
    keywords: ["4BE", "micro-foncier", "15000", "abattement 30", "revenus fonciers"],
  }),

  base({
    category: "real_estate_income",
    title: "4BK / 4BL — Revenus étrangers ouvrant droit à crédit d'impôt = IR français",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Revenus fonciers — source étrangère / PAS",
    boxCodes: ["4BK", "4BL"],
    excerpt:
      "Les revenus fonciers de source étrangère ouvrant droit à un crédit d'impôt égal à l'impôt français, " +
      "compris dans les revenus déclarés ligne 4BE (micro-foncier) ou 4BA (régime réel), doivent " +
      "également être déclarés ligne 4BK (micro) ou 4BL (réel) afin de ne pas être soumis à acompte PAS.",
    content:
      "Cases 4BK (micro-foncier) et 4BL (régime réel) : à renseigner pour les revenus fonciers de source " +
      "étrangère qui ouvrent droit, par convention, à un crédit d'impôt égal à l'impôt français. Cela " +
      "neutralise l'acompte de prélèvement à la source. Les revenus restent déclarés en 4BE ou 4BA, mais " +
      "la part étrangère est isolée en 4BK/4BL.",
    keywords: ["4BK", "4BL", "revenus fonciers étrangers", "crédit d'impôt", "PAS", "acompte"],
  }),

  base({
    category: "scpi",
    title: "4BA — Revenus fonciers (régime réel) — report depuis 2044, dont SCPI",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Revenus fonciers — régime réel",
    boxCodes: ["4BA"],
    excerpt:
      "Vous pouvez porter directement les revenus de vos parts de sociétés ou de fonds sur la déclaration " +
      "de revenus ligne 4BA, en indiquant sur une note annexe les noms et adresses des sociétés avec les " +
      "revenus correspondants et éventuellement le montant de vos intérêts d'emprunt personnels.",
    content:
      "Case 4BA : résultat foncier net (bénéfice) au régime réel, reporté depuis la 2044 (ligne 420). " +
      "Pour les seules parts de SCPI/FPI sans autre revenu foncier, possibilité de déclarer directement " +
      "en 4BA avec note annexe (noms, adresses, revenus, intérêts d'emprunt personnels). Sinon, dépôt " +
      "obligatoire de la 2044.",
    keywords: ["4BA", "revenus fonciers", "régime réel", "SCPI", "2044"],
  }),

  base({
    category: "real_estate_income",
    title: "4BB / 4BC — Déficit foncier reportable et imputable sur revenu global",
    pageNumber: 354,
    formId: "2042",
    sectionLabel: "Déficits fonciers",
    boxCodes: ["4BB", "4BC"],
    excerpt:
      "Si la ligne 630 est négative, remplissez la fiche de répartition du déficit pour déterminer la part " +
      "imputable sur le revenu global (case 4BC) et celle reportable sur les revenus fonciers des années " +
      "suivantes (case 4BB). Plafond annuel de 10 700 € sur le revenu global (15 300 € en Périssol).",
    content:
      "Déficit foncier (ligne 630 négative en 2044) : 4BC pour la part imputable sur le revenu global " +
      "(plafond 10 700 € — 15 300 € en Périssol — hors intérêts d'emprunt qui ne sont jamais imputables " +
      "sur le revenu global) ; 4BB pour la part reportable sur les revenus fonciers des 10 années suivantes.",
    keywords: ["4BB", "4BC", "déficit foncier", "10700", "revenu global"],
  }),

  base({
    category: "real_estate_income",
    title: "4BD — Déficits fonciers antérieurs non imputés",
    pageNumber: 354,
    formId: "2042",
    sectionLabel: "Déficits fonciers antérieurs",
    boxCodes: ["4BD"],
    excerpt:
      "Inscrivez le total des déficits fonciers antérieurs non encore imputés ligne 651 de la 2044, puis " +
      "reportez ce total sur la déclaration 2042 ligne 4BD.",
    content:
      "Case 4BD : report des déficits fonciers antérieurs (jusqu'à 10 ans) non encore absorbés par des " +
      "bénéfices fonciers. Total à reprendre depuis la ligne 651 de la 2044 et imputable uniquement sur " +
      "les revenus fonciers (jamais sur le revenu global).",
    keywords: ["4BD", "déficit foncier antérieur", "report 10 ans"],
  }),

  base({
    category: "real_estate_income",
    title: "4BN — Cessation des revenus fonciers",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Revenus fonciers — PAS",
    boxCodes: ["4BN"],
    excerpt:
      "Si vous ne percevez plus de revenus fonciers après le 31.12.2024, cochez la case 4BN. Ainsi, vos " +
      "revenus fonciers de 2024 ne seront pas retenus pour le calcul des acomptes.",
    content:
      "Case 4BN à cocher en cas de cessation de perception de revenus fonciers après le 31.12.2024 (vente, " +
      "fin de bail, etc.). Évite la prise en compte de ces revenus dans le calcul des acomptes contemporains " +
      "du PAS pour 2025.",
    keywords: ["4BN", "cessation", "PAS", "acompte"],
  }),

  base({
    category: "real_estate_income",
    title: "4BZ — Souscription d'une 2044 spéciale",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Revenus fonciers — formulaire spécial",
    boxCodes: ["4BZ"],
    excerpt:
      "Si vous souscrivez une déclaration 2044 spéciale sur papier, cochez la case 4BZ afin que ce modèle " +
      "d'imprimé vous soit adressé à votre domicile pour la déclaration des revenus de 2025.",
    content:
      "Case 4BZ : à cocher si vous déposez une 2044 spéciale (régimes Périssol, Besson, Robien, Borloo, " +
      "monuments historiques, etc.). Permet l'envoi automatique du formulaire papier l'année suivante. " +
      "À distinguer de la 2044 classique.",
    keywords: ["4BZ", "2044 spéciale", "Périssol", "monuments historiques"],
  }),

  // ──────────────── 2047 — Revenus étrangers + report 8TK ────────────────
  base({
    category: "foreign_accounts",
    title: "2047 — Annexe obligatoire pour revenus de source étrangère",
    pageNumber: 120,
    formId: "2047",
    sectionLabel: "Annexe revenus étrangers",
    boxCodes: [],
    excerpt:
      "Les sommes à déclarer sur la 2042 sont celles qui figurent sur la 2047 que vous souscrivez " +
      "lorsque l'établissement payeur des revenus est établi à l'étranger.",
    content:
      "L'annexe 2047 est obligatoire dès lors qu'un revenu est encaissé à l'étranger ou versé par un " +
      "établissement payeur étranger (loyers, dividendes, intérêts, plus-values, salaires). Elle permet " +
      "d'appliquer la convention fiscale bilatérale (taux effectif ou crédit d'impôt). Les revenus sont " +
      "ensuite reportés dans la 2042 sur les cases dédiées (4BL, 8TK, etc.).",
    keywords: ["2047", "revenus étrangers", "convention fiscale", "annexe", "obligatoire"],
  }),

  base({
    category: "foreign_accounts",
    title: "8TK — Revenus étrangers ouvrant droit à crédit d'impôt = IR français",
    pageNumber: 115,
    formId: "2042",
    sectionLabel: "Crédits d'impôt revenus étrangers",
    boxCodes: ["8TK"],
    excerpt:
      "Ce montant doit être déclaré dans la 2047 et reporté ligne 8TK de la 2042 (revenus ouvrant droit " +
      "à un crédit d'impôt égal à l'impôt français).",
    content:
      "Case 8TK de la 2042 : report depuis la 2047 du montant des revenus de source étrangère ouvrant " +
      "droit, par convention, à un crédit d'impôt égal à l'impôt français. Le crédit annule effectivement " +
      "la double imposition pour ces revenus (méthode de l'imputation intégrale).",
    keywords: ["8TK", "revenus étrangers", "crédit d'impôt", "convention", "double imposition"],
  }),

  // ──────────────── 2044 — synthèse pratique ────────────────
  base({
    category: "scpi",
    title: "2044 — Annexe revenus fonciers (SCPI françaises au réel)",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Régime réel — annexe",
    boxCodes: [],
    excerpt:
      "Si vous ne relevez pas du régime micro-foncier ou si vous optez pour l'imposition selon le régime " +
      "réel, la détermination de vos revenus fonciers doit être effectuée sur la déclaration annexe 2044 " +
      "ou la déclaration 2044 spéciale.",
    content:
      "L'annexe 2044 est obligatoire au régime réel : recettes brutes (ligne 211, dont SCPI françaises), " +
      "charges déductibles (ligne 230), intérêts d'emprunt (ligne 250), résultat foncier (ligne 420). Ce " +
      "résultat est ensuite reporté en 4BA (bénéfice) ou 4BC/4BB (déficit) de la 2042. Une note annexe " +
      "détaille les sociétés (SCPI/FPI) et leurs revenus respectifs.",
    keywords: ["2044", "régime réel", "SCPI", "ligne 211", "ligne 250", "intérêts d'emprunt"],
  }),

  // ──────────────── 2044 — Lignes SCPI détaillées ────────────────
  base({
    category: "scpi",
    title: "2044 Ligne 111 — Recettes brutes SCPI / parts de sociétés immobilières",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Recettes — parts de sociétés immobilières",
    boxCodes: ["Ligne 211"],
    excerpt:
      "Ligne 211 (report sur ligne 111) : quote-part des revenus fonciers français distribués par les " +
      "SCPI, à reporter depuis le relevé fiscal annuel de la société de gestion.",
    content:
      "Annexe 2044, rubrique 110 « Vos parts de sociétés immobilières ou de FPI non passibles de l'IS ». " +
      "Ligne 211 / 111 : recettes brutes (revenus fonciers bruts) quote-part des SCPI françaises et " +
      "étrangères imposables en France. Reporter le montant indiqué par la société de gestion dans le " +
      "relevé fiscal annuel. Si plusieurs SCPI, cumuler les montants. Indiquer le nom de chaque SCPI et " +
      "l'adresse du siège : ex. « SOFIDY EUROPE INVEST — 303 Square des Champs Élysées, 91080 Évry ».",
    keywords: ["2044", "ligne 111", "ligne 211", "recettes brutes", "SCPI", "revenus fonciers"],
  }),

  base({
    category: "scpi",
    title: "2044 Ligne 112 — Frais et charges déductibles SCPI (hors intérêts)",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Charges déductibles SCPI",
    boxCodes: ["Ligne 112"],
    excerpt:
      "Ligne 112 : frais et charges de la SCPI (frais de gestion, travaux, taxe foncière, assurances) " +
      "HORS intérêts d'emprunt, reportés depuis le relevé fiscal de la société de gestion.",
    content:
      "Annexe 2044, ligne 112 (ou détail lignes 221-229) : ensemble des charges déductibles des revenus " +
      "fonciers de la SCPI, HORS intérêts d'emprunt (déclarés séparément en ligne 113/250). Comprend : " +
      "frais de gestion de la société, provisions pour charges, travaux déductibles, taxe foncière, " +
      "primes d'assurance. Montants indiqués sur le relevé fiscal annuel de la société de gestion.",
    keywords: ["2044", "ligne 112", "frais", "charges", "SCPI", "déductibles"],
  }),

  base({
    category: "scpi",
    title: "2044 Ligne 113 — Intérêts d'emprunt SCPI + personnels (cumul)",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Intérêts d'emprunt",
    boxCodes: ["Ligne 113", "Ligne 250"],
    excerpt:
      "Ligne 113 / 250 : intérêts d'emprunts contractés pour l'acquisition des parts de SCPI. " +
      "Cumul des intérêts payés par la SCPI (relevé fiscal) ET des intérêts personnels (attestation bancaire).",
    content:
      "Annexe 2044, ligne 113 / ligne 250 : DEUX composantes à cumuler. (1) Intérêts d'emprunt de la " +
      "SCPI elle-même (indiqués ligne 113 du relevé fiscal — ex. SOFIDY 33,30 €). (2) Intérêts " +
      "d'emprunt personnels de l'associé ayant financé l'acquisition de ses parts à crédit (attestation " +
      "bancaire). La ventilation par pays des intérêts personnels doit suivre la répartition géographique " +
      "de la SCPI (indiquée dans le relevé fiscal). Les intérêts d'emprunt ne peuvent jamais créer un " +
      "déficit imputable sur le revenu global (uniquement sur les revenus fonciers).",
    keywords: ["2044", "ligne 113", "ligne 250", "intérêts d'emprunt", "SCPI", "cumul", "ventilation pays"],
  }),

  base({
    category: "scpi",
    title: "2044 Ligne 114 — Bénéfice ou déficit foncier SCPI",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Résultat foncier",
    boxCodes: ["Ligne 114"],
    excerpt:
      "Ligne 114 : bénéfice (+) ou déficit (−) foncier = ligne 111 − ligne 112 − ligne 113. " +
      "Le déficit sur la part étrangère ne peut pas être négatif : reporter 0 le cas échéant.",
    content:
      "Annexe 2044, ligne 114 : résultat foncier par immeuble / SCPI = recettes brutes (111) − charges " +
      "(112) − intérêts d'emprunt (113). Attention : pour la quote-part de revenus étrangers (Allemagne, " +
      "RU, Espagne, Italie), le résultat ne peut pas être négatif. En cas de résultat négatif sur la part " +
      "étrangère, reporter zéro. Le déficit foncier n'est possible que sur les revenus de source française.",
    keywords: ["2044", "ligne 114", "bénéfice", "déficit", "résultat foncier", "SCPI"],
  }),

  base({
    category: "scpi",
    title: "4EA — Revenus fonciers exonérés soumis au taux effectif (SCPI)",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Taux effectif",
    boxCodes: ["4EA"],
    excerpt:
      "Case 4EA : revenus fonciers de source étrangère exonérés en France par convention fiscale mais " +
      "retenus pour le calcul du taux effectif d'imposition (Belgique, Pays-Bas, Irlande notamment).",
    content:
      "Case 4EA de la 2042 : revenus fonciers étrangers provenant de pays dont la convention fiscale " +
      "prévoit l'exonération en France avec prise en compte pour le taux effectif (méthode de " +
      "l'exemption avec progressivité). Pays concernés pour les SCPI : Belgique, Pays-Bas, Irlande " +
      "principalement. Le montant est indiqué dans le relevé fiscal SCPI. Ces revenus ne sont pas imposés " +
      "en France mais majorent le taux applicable aux autres revenus du foyer.",
    keywords: ["4EA", "taux effectif", "revenus exonérés", "SCPI", "Belgique", "Pays-Bas", "Irlande"],
  }),

  base({
    category: "scpi",
    title: "4EB — Revenus fonciers exonérés micro-foncier taux effectif",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Micro-foncier taux effectif",
    boxCodes: ["4EB"],
    excerpt:
      "Case 4EB : régime micro-foncier uniquement — recettes brutes exonérées à soumettre au taux " +
      "effectif (montant indiqué dans le relevé fiscal SCPI, rubrique micro-foncier).",
    content:
      "Case 4EB de la 2042 : uniquement en régime micro-foncier. Recettes brutes étrangères exonérées " +
      "par convention et retenues pour le calcul du taux effectif. Correspond aux revenus bruts " +
      "étrangers soumis au taux effectif AVANT application de l'abattement micro-foncier de 30 %. " +
      "Si le contribuable est au régime réel (2044), cette case n'est PAS utilisée.",
    keywords: ["4EB", "micro-foncier", "taux effectif", "SCPI", "revenus exonérés"],
  }),

  base({
    category: "scpi",
    title: "SCPI — Ventilation par pays et conventions fiscales applicables",
    pageNumber: 120,
    formId: "2047",
    sectionLabel: "Conventions fiscales SCPI",
    boxCodes: [],
    excerpt:
      "Les revenus fonciers de SCPI investies à l'étranger doivent être ventilés par pays selon la " +
      "convention fiscale applicable : crédit d'impôt (Allemagne, RU, Espagne, Italie) ou taux effectif " +
      "(Belgique, Pays-Bas, Irlande).",
    content:
      "Ventilation par pays pour les SCPI à investissement international. Deux mécanismes : " +
      "(1) Crédit d'impôt = impôt français (cases 4BL + 8TK) : Allemagne, Royaume-Uni, Espagne, Italie " +
      "— les revenus sont imposés en France et le crédit d'impôt annule la double imposition. " +
      "(2) Taux effectif / exonération (case 4EA) : Belgique, Pays-Bas, Irlande — les revenus ne sont " +
      "pas imposés en France mais majorent le taux d'imposition applicable aux autres revenus. " +
      "Le relevé fiscal de la société de gestion indique la répartition géographique.",
    keywords: ["SCPI", "ventilation pays", "convention fiscale", "crédit d'impôt", "taux effectif",
      "Allemagne", "Royaume-Uni", "Espagne", "Italie", "Belgique", "Pays-Bas", "Irlande"],
  }),

  base({
    category: "scpi",
    title: "SCPI — Intérêts d'emprunt personnels : ventilation par pays",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Ventilation intérêts d'emprunt",
    boxCodes: ["Ligne 250"],
    excerpt:
      "Si l'associé a souscrit ses parts via un financement bancaire, les intérêts d'emprunt personnels " +
      "doivent être ventilés par pays selon la répartition géographique de la SCPI.",
    content:
      "Ventilation des intérêts d'emprunt personnels par pays. Le relevé fiscal SCPI indique les " +
      "pourcentages de ventilation (ex. SOFIDY EUROPE INVEST : France 0 %, Allemagne 14,70 %, " +
      "RU 6,42 %, Belgique 4,26 %, Pays-Bas 40,60 %, Irlande 11,21 %, Espagne 22,82 %, Italie 0 %). " +
      "Les intérêts des pays relevant du crédit d'impôt (Allemagne, RU, Espagne, Italie) se cumulent " +
      "avec ceux de la SCPI en ligne 113/250 de l'annexe 2044. Les intérêts des pays relevant du taux " +
      "effectif (Belgique, Pays-Bas, Irlande) se déduisent en case 4EA de la 2042.",
    keywords: ["SCPI", "intérêts d'emprunt", "ventilation pays", "pourcentage", "répartition géographique"],
  }),

  base({
    category: "scpi",
    title: "2047 Section 4 — Revenus fonciers SCPI imposables en France (crédit d'impôt)",
    pageNumber: 120,
    formId: "2047",
    sectionLabel: "Revenus fonciers imposables en France",
    boxCodes: [],
    excerpt:
      "Section 4 de la 2047 : revenus fonciers étrangers imposables en France avec crédit d'impôt " +
      "(Allemagne, RU, Espagne, Italie). Indiquer l'adresse du siège de la SCPI et le montant par pays.",
    content:
      "Annexe 2047, section 4 « Revenus fonciers imposables en France ». Pour les SCPI détenant des " +
      "actifs en Allemagne, Royaume-Uni, Espagne, Italie : déclarer les revenus fonciers étrangers imposables " +
      "en France (correspondant au bénéfice foncier, ligne 114 de la 2044 quote-part étrangère). " +
      "Adresse à indiquer : siège de la SCPI (ex. 303 Square des Champs Élysées, 91080 Évry). " +
      "Ce montant est reporté automatiquement en case 4BL de la 2042.",
    keywords: ["2047", "section 4", "revenus fonciers", "SCPI", "crédit d'impôt", "France"],
  }),

  base({
    category: "scpi",
    title: "2047 Section 6 — Revenus SCPI ouvrant droit à crédit d'impôt = IR français",
    pageNumber: 120,
    formId: "2047",
    sectionLabel: "Crédit d'impôt = IR français",
    boxCodes: ["8TK"],
    excerpt:
      "Section 6 de la 2047 : détail par pays des revenus fonciers ouvrant droit au crédit d'impôt " +
      "égal à l'impôt français. Le total est reporté en case 8TK de la 2042.",
    content:
      "Annexe 2047, section 6 « Revenus imposables ouvrant droit à un crédit d'impôt égal au montant " +
      "de l'impôt français ». Détail par pays : Allemagne, Royaume-Uni, Espagne, Italie — indiquer " +
      "pour chaque pays la nature du revenu (revenu foncier) et le montant avant déduction de l'impôt " +
      "étranger. Le total est reporté en case 8TK de la 2042. Ce crédit d'impôt annule la double " +
      "imposition et s'applique aussi aux prélèvements sociaux (vérifier 17,2 % × 8TK sur l'avis).",
    keywords: ["2047", "section 6", "8TK", "SCPI", "crédit d'impôt", "impôt français"],
  }),

  base({
    category: "scpi",
    title: "SCPI — Plus-values immobilières ligne 3VZ",
    pageNumber: 154,
    formId: "2042",
    sectionLabel: "Plus-values SCPI",
    boxCodes: ["3VZ"],
    excerpt:
      "Les plus-values immobilières réalisées directement ou indirectement par la SCPI sont imposées " +
      "au niveau de la SCPI (19 %) et doivent être reportées en case 3VZ de la 2042.",
    content:
      "Case 3VZ : plus-values nettes de cession d'immeubles ou de biens meubles déjà imposées à 19 %. " +
      "Pour les SCPI, ce montant est indiqué dans le relevé fiscal annuel. Les plus-values sont imposées " +
      "directement au niveau de la SCPI (prélèvement de 19 % + prélèvements sociaux) et ne donnent " +
      "lieu qu'à une déclaration informative en 3VZ. Le montant est ajouté au revenu fiscal de référence " +
      "mais n'est pas soumis à un impôt supplémentaire.",
    keywords: ["3VZ", "plus-values", "SCPI", "19%", "cession d'immeuble"],
  }),

  base({
    category: "scpi",
    title: "SCPI — IFI (Impôt sur la Fortune Immobilière) : valeur déclarative",
    pageNumber: 154,
    formId: "2042-IFI",
    sectionLabel: "IFI SCPI",
    boxCodes: [],
    excerpt:
      "Pour l'IFI, les associés de SCPI déclarent la valeur IFI par part multipliée par le nombre " +
      "de parts détenues au 1er janvier. La valeur IFI par part est indiquée dans le relevé fiscal.",
    content:
      "IFI (Impôt sur la Fortune Immobilière) : les parts de SCPI sont des actifs immobiliers taxables " +
      "à l'IFI. La valeur à déclarer = valeur IFI par part × nombre de parts au 1er janvier N+1. " +
      "La valeur IFI par part est communiquée chaque année par la société de gestion dans le relevé " +
      "fiscal (ex. SOFIDY EUROPE INVEST : 187,08 € × 404 parts = 75 580 €). Cette valeur tient compte " +
      "du ratio immobilier/financier de la SCPI.",
    keywords: ["IFI", "SCPI", "valeur par part", "fortune immobilière"],
  }),

  base({
    category: "deductible_expenses",
    title: "2044 ligne 250 — Intérêts d'emprunt déductibles",
    pageNumber: 154,
    formId: "2044",
    sectionLabel: "Charges déductibles — intérêts d'emprunt",
    boxCodes: [],
    excerpt:
      "Les intérêts d'emprunts contractés pour l'acquisition, la conservation, la construction, la " +
      "réparation ou l'amélioration des immeubles donnés en location sont déductibles ligne 250 de la 2044.",
    content:
      "Ligne 250 de l'annexe 2044 : intérêts d'emprunts liés à l'investissement locatif (acquisition, " +
      "construction, conservation, réparation, amélioration), frais de dossier, frais d'inscription " +
      "hypothécaire, primes d'assurance liées à l'emprunt. Les intérêts d'emprunt ne peuvent jamais " +
      "créer un déficit imputable sur le revenu global.",
    keywords: ["2044", "ligne 250", "intérêts d'emprunt", "charges déductibles"],
  }),
];

// Récupère tous les chunks couvrant un code de case donné
export function brochureChunksForBox(box: string): BrochureSeedChunk[] {
  return BROCHURE_IR_2025_SEED.filter((c) => c.boxCodes.includes(box));
}

export function brochureChunksForCategory(cat: TaxCategory): BrochureSeedChunk[] {
  return BROCHURE_IR_2025_SEED.filter((c) => c.category === cat);
}
