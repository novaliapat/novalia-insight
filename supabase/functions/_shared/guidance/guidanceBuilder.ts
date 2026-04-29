// Constructeur déterministe et pur du DeclarationGuidance.
// AUCUN appel réseau. AUCUNE invention. Toute valeur vient de :
//   - validatedData (source de vérité des montants)
//   - catalogue 2025 (raccordé brochure IR 2025)
//   - sources RAG passées en entrée
//   - règles d'annexes
//
// Utilisé par l'edge function `generate-declaration-guidance` (via mirror Deno)
// et par les tests vitest côté front.
import type {
  DeclarationGuidance,
  RequiredForm,
  TaxBoxProposal,
  ManualReviewItem,
  MissingSource,
  FormSource,
  TaxFormId,
} from "./guidanceSchemas.ts";
import type {
  TaxCategory,
  ExtractedData,
  ConfidenceLevel,
} from "../contracts/extractionContracts.ts";
import { ANNEX_RULES_2025 } from "../forms/2025/annexCatalog.ts";
import { FORMS_CATALOG_2025 } from "../forms/2025/formsCatalog.ts";
import {
  BOX_CATALOG_2025,
  type BoxCatalogEntry,
} from "../forms/2025/boxCatalog.ts";
import { buildDeclarationSteps } from "./declarationStepBuilder.ts";
import { runGuidanceSafetyChecks } from "./guidanceSafetyChecks.ts";

export interface CategoryRagPayload {
  category: TaxCategory;
  sources: FormSource[];
  hasOfficial: boolean;
}

export interface BuildGuidanceInput {
  taxYear: number;
  validatedData: ExtractedData;
  ragByCategory: Record<string, CategoryRagPayload>;
}

// ─────────────────────────────────────────────────────────────────────────
// Fallback catalogue : transforme une entrée du BOX_CATALOG_2025 en FormSource
// "officielle" lorsqu'elle est sourcée brochure (page connue). Permet d'afficher
// les cases utiles même quand la table tax_rag_chunks est vide.
// ─────────────────────────────────────────────────────────────────────────
export function sourceFromBoxEntry(entry: BoxCatalogEntry): FormSource {
  return {
    title: `${entry.formId} ${entry.boxOrLine} — ${entry.label}`,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
    sourceType: entry.sourceType,
    taxYear: entry.taxYear,
    isOfficialSource: entry.sourceType === "official_brochure",
    provenance: entry.sourceType === "official_brochure"
      ? "official_brochure"
      : "manual_seed",
    pageNumber: entry.pageNumber ?? undefined,
    formId: entry.formId,
    sectionLabel: entry.boxOrLine,
    boxCodes: [entry.boxOrLine],
    excerpt: entry.description,
    relevanceScore: 0.9,
  };
}

export function catalogSourcesForCategory(category: TaxCategory): FormSource[] {
  return BOX_CATALOG_2025
    .filter((b) => b.category === category && b.sourceType === "official_brochure" && b.pageNumber)
    .map(sourceFromBoxEntry);
}

export function mergeRagWithCatalogFallback(
  ragByCategory: Record<string, CategoryRagPayload>,
  detectedCategories: TaxCategory[],
): Record<string, CategoryRagPayload> {
  const merged: Record<string, CategoryRagPayload> = { ...ragByCategory };
  for (const cat of detectedCategories) {
    const existing = merged[cat];
    const catalogSources = catalogSourcesForCategory(cat);
    if (catalogSources.length === 0) {
      if (!existing) merged[cat] = { category: cat, sources: [], hasOfficial: false };
      continue;
    }
    const baseSources = existing?.sources ?? [];
    const seen = new Set(
      baseSources.map(
        (s) => `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}`,
      ),
    );
    const fallbackToAdd: FormSource[] = [];
    for (const s of catalogSources) {
      const key = `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        fallbackToAdd.push(s);
      }
    }
    merged[cat] = {
      category: cat,
      sources: [...baseSources, ...fallbackToAdd],
      hasOfficial: (existing?.hasOfficial ?? false) || fallbackToAdd.some((s) => s.isOfficialSource),
    };
  }
  return merged;
}

export interface BuildGuidanceOutput {
  guidance: DeclarationGuidance;
  status: "guidance_completed" | "guidance_completed_with_warnings" | "guidance_failed";
  warnings: string[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// 0. Catégories effectives — union de detectedCategories et catégories
//    inférées depuis les champs réellement présents dans validated_data.
// ─────────────────────────────────────────────────────────────────────────
export function deriveEffectiveCategories(d: ExtractedData): TaxCategory[] {
  const set = new Set<TaxCategory>(
    ((d.detectedCategories ?? []) as TaxCategory[]),
  );

  const ifu = d.ifu ?? [];
  if (ifu.length > 0) set.add("ifu" as TaxCategory);
  if (ifu.some((i) => (i.dividends?.value ?? 0) > 0)) set.add("dividends" as TaxCategory);
  if (ifu.some((i) => (i.interests?.value ?? 0) > 0)) set.add("interests" as TaxCategory);

  const scpi = d.scpi ?? [];
  if (scpi.length > 0) set.add("scpi" as TaxCategory);
  if (scpi.some((s) => (s.deductibleInterests?.value ?? 0) > 0)) {
    set.add("deductible_expenses" as TaxCategory);
  }
  if (scpi.some((s) => (s.foreignIncome?.value ?? 0) > 0)) {
    set.add("foreign_accounts" as TaxCategory);
  }

  if ((d.lifeInsurance ?? []).length > 0) set.add("life_insurance" as TaxCategory);
  if (d.realEstateIncome) set.add("real_estate_income" as TaxCategory);
  if (d.foreignAccounts) set.add("foreign_accounts" as TaxCategory);
  if (d.deductibleExpenses) set.add("deductible_expenses" as TaxCategory);

  return [...set];
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Détection des situations à partir des données validées
// ─────────────────────────────────────────────────────────────────────────
export function detectSituations(d: ExtractedData): {
  situations: string[];
  hasForeignIncome: boolean;
  hasRealEstateIncome: boolean;
} {
  const situations: string[] = [];
  let hasForeign = false;
  let hasRealEstate = false;

  if ((d.ifu ?? []).length > 0) {
    situations.push("Revenus de capitaux mobiliers issus d'un IFU.");
  }
  const scpi = d.scpi ?? [];
  if (scpi.length > 0) {
    situations.push("Revenus fonciers issus de SCPI.");
    hasRealEstate = true;
    if (scpi.some((s) => (s.foreignIncome?.value ?? 0) > 0)) {
      situations.push("Revenus de SCPI de source étrangère (convention fiscale à appliquer).");
      hasForeign = true;
    }
    if (scpi.some((s) => (s.deductibleInterests?.value ?? 0) > 0)) {
      situations.push("Intérêts d'emprunt liés aux investissements SCPI/fonciers.");
    }
  }
  if (d.realEstateIncome) {
    hasRealEstate = true;
    situations.push("Revenus fonciers (hors SCPI).");
  }
  if (d.foreignAccounts) {
    hasForeign = true;
    situations.push("Comptes ou revenus de source étrangère.");
  }
  if ((d.lifeInsurance ?? []).length > 0) {
    situations.push("Produits d'assurance-vie (rachats déclarables).");
  }
  if (d.deductibleExpenses) {
    situations.push("Charges déductibles à reporter.");
  }
  return {
    situations,
    hasForeignIncome: hasForeign,
    hasRealEstateIncome: hasRealEstate,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Formulaires requis (annexes + principal)
// ─────────────────────────────────────────────────────────────────────────
function buildRequiredForms(args: {
  detectedCategories: TaxCategory[];
  hasForeignIncome: boolean;
  ragByCategory: Record<string, CategoryRagPayload>;
}): RequiredForm[] {
  const detected = new Set(args.detectedCategories);
  const required = new Map<TaxFormId, RequiredForm>();

  for (const rule of ANNEX_RULES_2025) {
    const triggered = rule.triggerCategories.some((c) => detected.has(c));
    if (!triggered) continue;
    if (rule.requiresForeign && !args.hasForeignIncome) continue;

    const formMeta = FORMS_CATALOG_2025.find((f) => f.formId === rule.formId);
    if (!formMeta) continue;

    // Aggrège les sources RAG officielles des catégories déclencheuses
    const sources: FormSource[] = [];
    const seen = new Set<string>();
    for (const cat of rule.triggerCategories) {
      if (!detected.has(cat)) continue;
      const payload = args.ragByCategory[cat];
      if (!payload) continue;
      for (const s of payload.sources) {
        const key = `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(s);
      }
    }

    const hasOfficial = sources.some((s) => s.isOfficialSource);
    const confidence: ConfidenceLevel = hasOfficial ? formMeta.confidence : "low";
    const status = hasOfficial ? formMeta.status : "needs_review";

    const existing = required.get(rule.formId);
    if (existing) {
      // merge raisons + sources
      existing.reason = existing.reason + " " + rule.reason;
      for (const s of sources) {
        const key = `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}`;
        if (!existing.sources.some((x) => `${x.title}|${x.pageNumber ?? ""}|${(x.boxCodes ?? []).join(",")}` === key)) {
          existing.sources.push(s);
        }
      }
      continue;
    }
    required.set(rule.formId, {
      formId: rule.formId,
      label: formMeta.label,
      reason: rule.reason,
      required: true,
      confidence,
      status,
      sources,
      legalBasisSources: [],
    });
  }

  return [...required.values()];
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Mapping des montants validés → cases catalogues
// ─────────────────────────────────────────────────────────────────────────
type AmountMap = Map<string, number>;

function key(formId: TaxFormId, box: string): string {
  return `${formId}::${box}`;
}

function sumOpt(...nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((acc, n) => acc + (typeof n === "number" ? n : 0), 0);
}

/**
 * Mapping conservateur :
 *   IFU.dividends         → 2042/2DC
 *   IFU.interests         → 2042/2TR
 *   IFU.withholdingTax    → 2042/2CK
 *   IFU.socialContributions → laissé en review (2BH ou 2CG selon source)
 *   SCPI.frenchIncome     → 2044/Ligne 211 (et somme reportée à titre indicatif en 2042/4BA)
 *   SCPI.foreignIncome    → 2047 (annexe) + 2042/4BL ou 8TK selon convention (review forcé)
 *   SCPI.deductibleInterests → 2044/Ligne 250
 *   LifeInsurance.taxableShare → 2042/2CH si > 8 ans connu, sinon review
 *   LifeInsurance.withholdingTax → 2042/2CK (acompte mobilier mutualisé)
 */
export function mapValidatedAmountsToBoxes(d: ExtractedData): {
  amountByBox: AmountMap;
  reviewHints: Map<string, string>; // box -> raison de review
} {
  const amount: AmountMap = new Map();
  const reviewHints: Map<string, string> = new Map();

  // ── IFU ────────────────────────────────────────────────────────────
  const ifuDividends = sumOpt(...(d.ifu ?? []).map((i) => i.dividends?.value));
  const ifuInterests = sumOpt(...(d.ifu ?? []).map((i) => i.interests?.value));
  const ifuWithholding = sumOpt(...(d.ifu ?? []).map((i) => i.withholdingTax?.value));
  const ifuSocial = sumOpt(...(d.ifu ?? []).map((i) => i.socialContributions?.value));

  if (ifuDividends > 0) amount.set(key("2042", "2DC"), ifuDividends);
  if (ifuInterests > 0) amount.set(key("2042", "2TR"), ifuInterests);
  if (ifuWithholding > 0) amount.set(key("2042", "2CK"), ifuWithholding);
  if (ifuSocial > 0) {
    // 2BH (CSG déductible si 2OP) vs 2CG (sans CSG déductible) — impossible à trancher sans détail
    reviewHints.set(
      key("2042", "2BH"),
      `Prélèvements sociaux IFU détectés (${ifuSocial.toFixed(2)} €) : ventiler entre 2BH (option 2OP, CSG déductible) et 2CG selon la nature exacte.`,
    );
    reviewHints.set(
      key("2042", "2CG"),
      `Prélèvements sociaux IFU détectés (${ifuSocial.toFixed(2)} €) : à ventiler avec 2BH selon la nature exacte.`,
    );
  }

  // ── SCPI ───────────────────────────────────────────────────────────
  const scpi = d.scpi ?? [];
  const scpiFr = sumOpt(...scpi.map((s) => s.frenchIncome?.value));
  const scpiForeign = sumOpt(...scpi.map((s) => s.foreignIncome?.value));
  const scpiInterests = sumOpt(...scpi.map((s) => s.deductibleInterests?.value));

  if (scpiFr > 0) {
    amount.set(key("2044", "Ligne 211"), scpiFr);
    // 4BA = report depuis 2044 (résultat foncier net), pas une simple recopie des recettes brutes
    reviewHints.set(
      key("2042", "4BA"),
      "Report depuis la ligne 420 de la 2044 (résultat foncier net après charges et intérêts d'emprunt). Ne pas y reporter directement les recettes brutes SCPI.",
    );
  }
  if (scpiForeign > 0) {
    reviewHints.set(
      key("2042", "4BL"),
      `Revenus fonciers étrangers SCPI (${scpiForeign.toFixed(2)} €) : à reporter en 4BL si convention prévoit crédit d'impôt = IR français. Vérifier la convention applicable.`,
    );
    reviewHints.set(
      key("2042", "8TK"),
      `Revenus étrangers (${scpiForeign.toFixed(2)} €) ouvrant droit à crédit d'impôt = IR français : à reporter en 8TK selon la convention. Vérifier impérativement la convention bilatérale.`,
    );
  }
  if (scpiInterests > 0) {
    amount.set(key("2044", "Ligne 250"), scpiInterests);
  }

  // ── Assurance-vie ──────────────────────────────────────────────────
  const av = d.lifeInsurance ?? [];
  const avTaxableMore8 = sumOpt(
    ...av.filter((a) => a.contractAge === "more_than_8").map((a) => a.taxableShare?.value),
  );
  const avTaxableUnknown = sumOpt(
    ...av.filter((a) => !a.contractAge).map((a) => a.taxableShare?.value),
  );
  const avWithholding = sumOpt(...av.map((a) => a.withholdingTax?.value));

  if (avTaxableMore8 > 0) {
    amount.set(key("2042", "2CH"), avTaxableMore8);
  }
  if (avTaxableUnknown > 0) {
    reviewHints.set(
      key("2042", "2CH"),
      `Produits d'assurance-vie (${avTaxableUnknown.toFixed(2)} €) sans ancienneté connue : impossible de trancher entre 2CH (≥ 8 ans), 2UU/2VV/2WW (post-27.9.2017) ou 2XX (< 8 ans). Vérifier la date d'ouverture et les versements.`,
    );
  }
  if (avWithholding > 0) {
    // L'acompte AV peut s'imputer en 2CK (mutualisé avec autres revenus mobiliers)
    const existing = amount.get(key("2042", "2CK")) ?? 0;
    amount.set(key("2042", "2CK"), existing + avWithholding);
  }

  return { amountByBox: amount, reviewHints };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Construction des propositions (catalogue + montants + sources)
// ─────────────────────────────────────────────────────────────────────────
function buildProposalsFromMapping(args: {
  detectedCategories: TaxCategory[];
  amountByBox: AmountMap;
  reviewHints: Map<string, string>;
  ragByCategory: Record<string, CategoryRagPayload>;
}): TaxBoxProposal[] {
  const detected = new Set(args.detectedCategories);
  const proposals: TaxBoxProposal[] = [];
  const seen = new Set<string>();

  for (const entry of BOX_CATALOG_2025) {
    if (!detected.has(entry.category)) continue;
    const k = key(entry.formId, entry.boxOrLine);
    if (seen.has(k)) continue;
    seen.add(k);

    const amount = args.amountByBox.get(k) ?? null;
    const reviewHint = args.reviewHints.get(k);
    const rag = args.ragByCategory[entry.category];
    const ragSources = rag?.sources ?? [];
    const hasOfficial = rag?.hasOfficial ?? false;

    let confidence: ConfidenceLevel;
    let status = entry.status;
    let requiresManualReview: boolean;
    let blockingReason: string | undefined;

    if (!hasOfficial) {
      confidence = "low";
      status = "needs_review";
      requiresManualReview = true;
      blockingReason = "Source DGFiP non retrouvée automatiquement. La case reste proposée à titre indicatif et doit être vérifiée.";
    } else if (reviewHint) {
      confidence = "medium";
      status = "needs_review";
      requiresManualReview = true;
      blockingReason = reviewHint;
    } else if (entry.confidence === "high" && entry.status === "confirmed") {
      confidence = "high";
      status = "confirmed";
      requiresManualReview = false;
    } else {
      confidence = entry.confidence;
      status = entry.status;
      requiresManualReview = entry.status !== "confirmed";
    }

    proposals.push({
      formId: entry.formId,
      boxOrLine: entry.boxOrLine,
      label: entry.label,
      amount,
      category: entry.category,
      explanation: entry.description,
      confidence,
      status,
      ragSources,
      legalBasisSources: [],
      requiresManualReview,
      blockingReason,
    });
  }
  return proposals;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Items de revue manuelle
// ─────────────────────────────────────────────────────────────────────────
function buildManualReviewItems(d: ExtractedData): ManualReviewItem[] {
  const items: ManualReviewItem[] = [];
  const scpi = d.scpi ?? [];

  if (scpi.some((s) => (s.foreignIncome?.value ?? 0) > 0)) {
    items.push({
      id: "scpi-foreign-convention",
      category: "scpi",
      reason: "Revenus SCPI de source étrangère détectés sans confirmation de la convention fiscale applicable.",
      suggestedAction: "Identifier la convention bilatérale (taux effectif vs crédit d'impôt) et choisir entre 4BL et 8TK.",
      relatedFormId: "2047",
    });
  }
  if (scpi.some((s) => (s.deductibleInterests?.value ?? 0) > 0)) {
    items.push({
      id: "scpi-deductible-interests-total",
      category: "deductible_expenses",
      reason: "Intérêts d'emprunt SCPI détectés : vérifier le total et la déductibilité (acquisition, conservation, amélioration).",
      suggestedAction: "Comparer avec les attestations bancaires annuelles avant report en 2044 ligne 250.",
      relatedFormId: "2044",
      relatedBox: "Ligne 250",
    });
  }

  const ifuSocial = sumOpt(...(d.ifu ?? []).map((i) => i.socialContributions?.value));
  if (ifuSocial > 0) {
    items.push({
      id: "ifu-social-2bh-vs-2cg",
      category: "ifu",
      reason: "Prélèvements sociaux IFU détectés : impossible de trancher 2BH (avec CSG déductible) vs 2CG (sans CSG déductible) sans option globale 2OP confirmée.",
      suggestedAction: "Vérifier l'option 2OP du foyer et la nature exacte des revenus mobiliers concernés.",
      relatedFormId: "2042",
    });
  }

  for (const a of d.lifeInsurance ?? []) {
    if (!a.contractAge) {
      items.push({
        id: `av-age-${a.contractName}`,
        category: "life_insurance",
        reason: `Contrat d'assurance-vie "${a.contractName}" sans ancienneté connue : impossible de choisir la case fiscale correcte (2CH / 2UU / 2XX...).`,
        suggestedAction: "Récupérer la date d'ouverture du contrat et le détail des versements (avant/après 27.9.2017).",
        relatedFormId: "2042",
      });
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Sources manquantes (par catégorie détectée)
// ─────────────────────────────────────────────────────────────────────────
function buildMissingSources(args: {
  detectedCategories: TaxCategory[];
  ragByCategory: Record<string, CategoryRagPayload>;
}): MissingSource[] {
  const missing: MissingSource[] = [];
  for (const cat of args.detectedCategories) {
    const payload = args.ragByCategory[cat];
    if (!payload || payload.sources.length === 0) {
      missing.push({
        category: cat,
        reason: "Documentation fiscale non disponible pour cette catégorie. Source officielle à confirmer.",
        suggestedSources: ["Brochure pratique IR 2025", "Notices DGFiP", "BOFiP"],
        blocksHighConfidence: true,
      });
    } else if (!payload.hasOfficial) {
      missing.push({
        category: cat,
        reason: "Source DGFiP / brochure non disponible pour cette catégorie. Vérification manuelle requise.",
        suggestedSources: ["Brochure pratique IR 2025", "Notices DGFiP", "BOFiP"],
        blocksHighConfidence: true,
      });
    }
  }
  return missing;
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Builder principal
// ─────────────────────────────────────────────────────────────────────────
export function buildDeclarationGuidance(input: BuildGuidanceInput): BuildGuidanceOutput {
  const d = input.validatedData;
  const detected = deriveEffectiveCategories(d);

  // Fallback catalogue brochure : injecte les sources brochure officielles
  // pour ne jamais laisser une case sans source identifiable.
  const effectiveRagByCategory = mergeRagWithCatalogFallback(
    input.ragByCategory,
    detected,
  );

  const { situations, hasForeignIncome, hasRealEstateIncome } = detectSituations(d);

  const requiredForms = buildRequiredForms({
    detectedCategories: detected,
    hasForeignIncome,
    ragByCategory: effectiveRagByCategory,
  });

  const { amountByBox, reviewHints } = mapValidatedAmountsToBoxes(d);

  const proposals = buildProposalsFromMapping({
    detectedCategories: detected,
    amountByBox,
    reviewHints,
    ragByCategory: effectiveRagByCategory,
  });

  const steps = buildDeclarationSteps({
    requiredForms,
    proposals,
  });

  const manualReviewItems = buildManualReviewItems(d);
  const missingSources = buildMissingSources({
    detectedCategories: detected,
    ragByCategory: effectiveRagByCategory,
  });

  // Confiance globale grossière
  let globalConfidence: ConfidenceLevel = "high";
  if (proposals.some((p) => p.confidence === "low")) globalConfidence = "low";
  else if (proposals.some((p) => p.confidence === "medium")) globalConfidence = "medium";
  if (missingSources.length > 0) globalConfidence = "low";

  const guidance: DeclarationGuidance = {
    taxYear: input.taxYear,
    taxpayerSummary: {
      taxYear: input.taxYear,
      detectedCategories: detected,
      hasForeignIncome,
      hasRealEstateIncome,
    },
    detectedSituations: situations,
    requiredForms,
    declarationSteps: steps,
    taxBoxProposals: proposals,
    manualReviewItems,
    missingSources,
    warnings: [],
    confidence: globalConfidence,
    disclaimer:
      "Ce guide est une aide à la préparation. Les cases proposées doivent être vérifiées " +
      "avant toute déclaration officielle. En cas de doute, rapprochez-vous de l'administration " +
      "fiscale ou de votre conseil habituel.",
  };

  // Garde-fous
  const safety = runGuidanceSafetyChecks(guidance);
  const sanitized = safety.sanitized;
  sanitized.warnings = [...sanitized.warnings, ...safety.warnings];

  let status: BuildGuidanceOutput["status"];
  if (!safety.ok) {
    status = "guidance_failed";
  } else if (
    sanitized.manualReviewItems.length > 0 ||
    sanitized.missingSources.length > 0 ||
    sanitized.warnings.length > 0
  ) {
    status = "guidance_completed_with_warnings";
  } else {
    status = "guidance_completed";
  }

  return {
    guidance: sanitized,
    status,
    warnings: safety.warnings,
    errors: safety.errors,
  };
}
