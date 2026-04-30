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
} from "../contracts/extractedDataContract.ts";
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
  const loans = d.loans ?? [];
  if (scpi.length > 0) set.add("scpi" as TaxCategory);
  if (
    scpi.some((s) =>
      (s.deductibleInterests?.value ?? 0) > 0 ||
      (s.scpiLoanInterests?.value ?? 0) > 0,
    ) || loans.some((l) => (l.annualInterests?.value ?? 0) > 0)
  ) {
    set.add("deductible_expenses" as TaxCategory);
  }
  if (scpi.some((s) =>
    (s.foreignIncome?.value ?? 0) > 0 ||
    (s.foreignTaxCredit?.value ?? 0) > 0 ||
    (s.exemptIncome?.value ?? 0) > 0 ||
    ((s.geographicBreakdown ?? []).length > 0),
  )) {
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
    if (scpi.some((s) =>
      (s.foreignIncome?.value ?? 0) > 0 ||
      (s.foreignTaxCredit?.value ?? 0) > 0 ||
      (s.exemptIncome?.value ?? 0) > 0 ||
      (((s as { incomeByCountry?: unknown[] }).incomeByCountry?.length ?? 0) > 0) ||
      ((s.geographicBreakdown?.length ?? 0) > 0),
    )) {
      situations.push("Revenus de SCPI de source étrangère (convention fiscale à appliquer).");
      hasForeign = true;
    }
    if (scpi.some((s) =>
      (s.deductibleInterests?.value ?? 0) > 0 ||
      (s.scpiLoanInterests?.value ?? 0) > 0 ||
      (((s as { personalLoanInterests?: { value?: number } }).personalLoanInterests?.value ?? 0) > 0),
    )) {
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

// ─────────────────────────────────────────────────────────────────────────
// 3.bis Cascade de ventilation des intérêts d'emprunt personnels
//   Niveau 1 : répartition inter-SCPI (linkedScpis ou prorata égal)
//   Niveau 2 : ventilation par pays via geographicBreakdown
//   Niveau 3 : bucket CI (crédit d'impôt = IR français) vs TE (taux effectif)
// ─────────────────────────────────────────────────────────────────────────
const BUCKET_CI_COUNTRIES = new Set(["FR", "DE", "GB", "UK", "ES", "IT"]);
const BUCKET_TE_COUNTRIES = new Set(["BE", "NL", "IE", "PL", "CA"]);

export interface LoanAllocationBreakdown {
  country: string;
  pct: number;
  amount: number;
  bucket: "CI" | "TE";
}

export interface LoanAllocation {
  scpiName: string;
  totalPersonalInterests: number;
  ciInterests: number;
  teInterests: number;
  breakdown: LoanAllocationBreakdown[];
  missingGeoKey: boolean;
}

export interface LoanAllocationResult {
  perScpi: LoanAllocation[];
  unlinkedLoans: Array<{ bank: string; amount: number }>;
  totalCi: number;
  totalTe: number;
  totalPersonal: number;
}

export function allocatePersonalLoanInterests(
  loans: ExtractedData["loans"] | undefined,
  scpiEntries: ExtractedData["scpi"] | undefined,
): LoanAllocationResult {
  const result: LoanAllocationResult = {
    perScpi: [],
    unlinkedLoans: [],
    totalCi: 0,
    totalTe: 0,
    totalPersonal: 0,
  };
  const scpis = scpiEntries ?? [];
  for (const loan of loans ?? []) {
    const interestsTotal = loan.annualInterests?.value ?? 0;
    if (interestsTotal <= 0) continue;
    result.totalPersonal += interestsTotal;

    let linked = scpis;
    const requested = (loan.linkedScpis ?? []).map((s) => s.toLowerCase());
    if (requested.length > 0) {
      const filtered = scpis.filter((s) =>
        requested.includes(s.scpiName.toLowerCase()),
      );
      if (filtered.length > 0) linked = filtered;
    }
    if (linked.length === 0) {
      result.unlinkedLoans.push({ bank: loan.bank ?? "Banque", amount: interestsTotal });
      continue;
    }

    const perScpi = interestsTotal / linked.length;
    for (const scpi of linked) {
      const geo = scpi.geographicBreakdown ?? [];
      if (geo.length === 0) {
        // Pas de clé géo → tout en CI par prudence
        result.perScpi.push({
          scpiName: scpi.scpiName,
          totalPersonalInterests: perScpi,
          ciInterests: perScpi,
          teInterests: 0,
          breakdown: [],
          missingGeoKey: true,
        });
        result.totalCi += perScpi;
        continue;
      }
      let ciTotal = 0;
      let teTotal = 0;
      const breakdown: LoanAllocationBreakdown[] = [];
      for (const g of geo) {
        const code = g.country.toUpperCase();
        const amount = Math.round((perScpi * g.percentage) / 100);
        const bucket = BUCKET_TE_COUNTRIES.has(code) ? "TE" as const : "CI" as const;
        if (bucket === "CI") ciTotal += amount;
        else teTotal += amount;
        breakdown.push({ country: code, pct: g.percentage, amount, bucket });
      }
      result.perScpi.push({
        scpiName: scpi.scpiName,
        totalPersonalInterests: perScpi,
        ciInterests: ciTotal,
        teInterests: teTotal,
        breakdown,
        missingGeoKey: false,
      });
      result.totalCi += ciTotal;
      result.totalTe += teTotal;
    }
  }
  return result;
}

function formatBucketBreakdown(
  allocs: LoanAllocation[],
  bucket: "CI" | "TE",
): string {
  const parts: string[] = [];
  for (const a of allocs) {
    for (const b of a.breakdown) {
      if (b.bucket !== bucket) continue;
      parts.push(`${b.country} ${b.pct.toFixed(2)}%`);
    }
  }
  return parts.join(" + ");
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
  const loans = d.loans ?? [];
  const scpiFr = sumOpt(...scpi.map((s) => s.frenchIncome?.value));
  const scpiForeign = sumOpt(...scpi.map((s) => s.foreignIncome?.value));
  const scpiNet = sumOpt(...scpi.map((s) => s.netIncome?.value));
  const scpiGross = sumOpt(...scpi.map((s) => s.grossIncome?.value));
  const scpiExpenses = sumOpt(...scpi.map((s) => s.expenses?.value));
  const scpiOwnInterests = sumOpt(...scpi.map((s) => s.scpiLoanInterests?.value));
  const legacyInterests = sumOpt(...scpi.map((s) => s.deductibleInterests?.value));
  const exemptIncomeRaw = sumOpt(...scpi.map((s) => s.exemptIncome?.value));
  const foreignTaxCredit = sumOpt(...scpi.map((s) => s.foreignTaxCredit?.value));

  // Cascade de ventilation des intérêts personnels (Arkéa & co)
  const allocation = allocatePersonalLoanInterests(loans, scpi);
  const personalCi = Math.round(allocation.totalCi);
  const personalTe = Math.round(allocation.totalTe);
  const personalTotal = Math.round(allocation.totalPersonal);
  const fallbackPersonal = personalTotal === 0
    ? Math.round(sumOpt(...loans.map((l) => l.annualInterests?.value)))
    : 0;
  const primaryBank = (loans.find((l) => (l.annualInterests?.value ?? 0) > 0)?.bank) ?? "votre emprunt";
  const primaryScpiName = scpi[0]?.scpiName ?? "votre SCPI";

  // Ligne 113 (= ligne 250 sur 2044) : intérêts SCPI + part CI des emprunts perso
  const totalLine113 = Math.round(
    scpiOwnInterests + personalCi + fallbackPersonal > 0
      ? scpiOwnInterests + personalCi + fallbackPersonal
      : legacyInterests,
  );

  if (scpiFr > 0) {
    amount.set(key("2044", "Ligne 211"), Math.round(scpiFr));
  }

  // Ligne 114 / 420 : recalcul du résultat NET après cascade
  const computedNet = scpiGross > 0
    ? Math.max(0, scpiGross - scpiExpenses - totalLine113)
    : 0;
  const netForLine420 = Math.round(computedNet > 0
    ? computedNet
    : (scpiNet !== 0 ? scpiNet : 0));

  if (netForLine420 !== 0) {
    amount.set(key("2044", "Ligne 420"), netForLine420);
    if (netForLine420 > 0) {
      amount.set(key("2042", "4BA"), netForLine420);
      amount.set(key("2042", "4BL"), netForLine420);
      reviewHints.set(
        key("2042", "4BL"),
        `${netForLine420} € (résultat net 2044 ligne 114) = même montant que 4BA. C'est normal que 4BL soit inférieur à 8TK (${Math.round(foreignTaxCredit)} €) quand vous avez un emprunt.`,
      );
    } else {
      amount.set(key("2042", "4BC"), Math.abs(netForLine420));
    }
  } else if (scpiFr > 0) {
    reviewHints.set(
      key("2042", "4BA"),
      "Reporté automatiquement depuis la ligne 114/420 de la 2044. Vérifiez que le montant correspond.",
    );
  }

  // 8TK : crédit d'impôt étranger BRUT inchangé
  if (foreignTaxCredit > 0) {
    amount.set(key("2042", "8TK"), Math.round(foreignTaxCredit));
  } else if (scpiForeign > 0) {
    reviewHints.set(
      key("2042", "8TK"),
      `Case pré-remplie par l'administration (${Math.round(scpiForeign)} € attendus selon le relevé ${primaryScpiName}). Ne modifiez pas ce montant.`,
    );
    reviewHints.set(
      key("2042", "4BL"),
      `Revenus étrangers détectés (${Math.round(scpiForeign)} €) — vérifiez la convention bilatérale avant de reporter le bénéfice net en 4BL.`,
    );
  }

  // 4EA : revenus exonérés MOINS intérêts personnels bucket TE
  const adjusted4EA = Math.max(0, Math.round(exemptIncomeRaw) - personalTe);
  if (exemptIncomeRaw > 0) {
    amount.set(key("2042", "4EA"), adjusted4EA);
    if (personalTe > 0) {
      const tePct = personalTotal > 0 ? (personalTe / personalTotal * 100) : 0;
      reviewHints.set(
        key("2042", "4EA"),
        `${Math.round(exemptIncomeRaw)} € (relevé ${primaryScpiName}, revenus exonérés bruts) − ${personalTe} € (votre emprunt ${primaryBank}, part pays « taux effectif » ${tePct.toFixed(1)}%) = ${adjusted4EA} €`,
      );
    }
  }

  if (totalLine113 > 0) {
    amount.set(key("2044", "Ligne 250"), totalLine113);
    if (personalCi > 0 || personalTotal > 0) {
      const ciPct = personalTotal > 0 ? (personalCi / personalTotal * 100) : 0;
      reviewHints.set(
        key("2044", "Ligne 250"),
        `${Math.round(scpiOwnInterests)} € (relevé ${primaryScpiName}, ligne 113) + ${personalCi} € (votre emprunt ${primaryBank}, part pays « crédit d'impôt » ${ciPct.toFixed(1)}%) = ${totalLine113} €`,
      );
    } else if (scpiOwnInterests > 0 && fallbackPersonal > 0) {
      reviewHints.set(
        key("2044", "Ligne 250"),
        `${Math.round(scpiOwnInterests)} € (relevé ${primaryScpiName}) + ${fallbackPersonal} € (votre emprunt ${primaryBank}, non ventilable par pays) = ${totalLine113} € — vérifiez le total avant report.`,
      );
    }
  }

  for (const s of scpi) {
    for (const c of s.geographicBreakdown ?? []) {
      reviewHints.set(
        key("2047", `Pays ${c.country}`),
        `Quote-part ${c.country} : ${c.percentage.toFixed(2)} % de votre SCPI ${s.scpiName}. À reporter dans la section 6 de la 2047.`,
      );
    }
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
// Surcharges de libellés/descriptions pour rendre le guide accessible à un
// stagiaire sans expérience fiscale. Override appliqué après le catalogue.
const FRIENDLY_LABELS: Record<string, { label: string; description: string }> = {
  "2044::Ligne 211": {
    label: "Ligne 111/211 — Revenus bruts de votre SCPI",
    description: "Tapez le total des revenus fonciers bruts indiqué sur le relevé fiscal de votre SCPI (page 4, ligne 111 colonne Total).",
  },
  "2044::Ligne 230": {
    label: "Ligne 112/230 — Frais et charges de la SCPI",
    description: "Frais de gestion prélevés par la société de gestion. Reportez le montant de la ligne 112 du relevé fiscal.",
  },
  "2044::Ligne 250": {
    label: "Ligne 113/250 — Intérêts d'emprunt (SCPI + votre crédit perso)",
    description: "Total = intérêts payés par la SCPI + votre part des intérêts personnels pour les pays « crédit d'impôt ».",
  },
  "2044::Ligne 420": {
    label: "Ligne 114/420 — Résultat foncier (calcul automatique)",
    description: "Vérifiez : revenus bruts − frais − intérêts = résultat. Si négatif sur la part étrangère, indiquez 0.",
  },
  "2042::4BA": {
    label: "Case 4BA — Bénéfice foncier net",
    description: "Reporté automatiquement depuis la 2044. Vérifiez que le montant correspond à la ligne 114.",
  },
  "2042::4BL": {
    label: "Case 4BL — Bénéfice foncier étranger (crédit d'impôt)",
    description: "Même montant que 4BA. C'est normal que 4BL soit inférieur à 8TK quand vous avez un emprunt.",
  },
  "2042::4BC": {
    label: "Case 4BC — Déficit foncier",
    description: "À renseigner uniquement si le résultat foncier est négatif.",
  },
  "2042::4EA": {
    label: "Case 4EA — Revenus exonérés (Belgique, Pays-Bas, Irlande...)",
    description: "Revenus non imposés en France mais pris en compte pour calculer votre taux d'imposition (« taux effectif »).",
  },
  "2042::8TK": {
    label: "Case 8TK — Crédit d'impôt étranger (NE PAS MODIFIER)",
    description: "Case pré-remplie par l'administration. Ce montant compense la double imposition. Ne le changez pas.",
  },
  "2042::2TR": {
    label: "Case 2TR — Intérêts de placement (SCPI / IFU)",
    description: "Normalement pré-rempli. Vérifiez que le montant correspond à votre relevé (page 3 du relevé SCPI ou IFU).",
  },
  "2042::2DC": {
    label: "Case 2DC — Dividendes éligibles à l'abattement",
    description: "Pré-rempli depuis votre IFU. Vérifiez que le montant correspond à votre relevé.",
  },
  "2042::2CK": {
    label: "Case 2CK — Crédit d'impôt prélèvement à la source",
    description: "Pré-rempli. Acompte déjà prélevé sur vos intérêts/dividendes. Sera déduit de votre impôt final.",
  },
  "2042::2CG": {
    label: "Case 2CG — CSG déductible sur intérêts",
    description: "Pré-rempli. Sera déductible l'année prochaine si vous optez pour le barème (case 2OP).",
  },
  "2042::2BH": {
    label: "Case 2BH — Revenus déjà soumis aux prélèvements sociaux",
    description: "À cocher si vous optez pour le barème (2OP) et que vos revenus mobiliers ont déjà subi les prélèvements sociaux.",
  },
  "2042::2AB": {
    label: "Case 2AB — Crédit d'impôt retenue étrangère",
    description: "Contrepartie de la retenue à la source sur les revenus mobiliers étrangers (dividendes / intérêts).",
  },
  "2042::2CH": {
    label: "Case 2CH — Produits d'assurance-vie (≥ 8 ans)",
    description: "Part imposable des rachats sur contrats de plus de 8 ans, après abattement.",
  },
};

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

    const friendly = FRIENDLY_LABELS[k];
    proposals.push({
      formId: entry.formId,
      boxOrLine: entry.boxOrLine,
      label: friendly?.label ?? entry.label,
      amount: amount != null ? Math.round(amount) : null,
      category: entry.category,
      explanation: friendly?.description ?? entry.description,
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

  if (scpi.some((s) =>
    (s.foreignIncome?.value ?? 0) > 0 ||
    (s.foreignTaxCredit?.value ?? 0) > 0 ||
    ((s.geographicBreakdown ?? []).length > 0),
  )) {
    items.push({
      id: "scpi-foreign-convention",
      category: "scpi",
      reason: "Revenus SCPI de source étrangère détectés sans confirmation de la convention fiscale applicable.",
      suggestedAction: "Identifier la convention bilatérale (taux effectif vs crédit d'impôt) et choisir entre 4BL et 8TK.",
      relatedFormId: "2047",
    });
  }
  const personalInterestsAny2 = (d.loans ?? []).some((l) => (l.annualInterests?.value ?? 0) > 0);
  if (scpi.some((s) =>
    (s.deductibleInterests?.value ?? 0) > 0 ||
    (s.scpiLoanInterests?.value ?? 0) > 0,
  ) || personalInterestsAny2) {
    items.push({
      id: "scpi-deductible-interests-total",
      category: "deductible_expenses",
      reason: "Intérêts d'emprunt SCPI détectés : vérifier le total (intérêts SCPI + intérêts personnels) et la déductibilité (acquisition, conservation, amélioration).",
      suggestedAction: "Comparer avec les attestations bancaires annuelles avant report en 2044 ligne 250.",
      relatedFormId: "2044",
      relatedBox: "Ligne 250",
    });
  }

  // ── Cascade emprunts personnels : edge cases ──────────────────────
  const allocation = allocatePersonalLoanInterests(d.loans, d.scpi);
  for (const a of allocation.perScpi) {
    if (a.missingGeoKey && a.totalPersonalInterests > 0) {
      items.push({
        id: `scpi-missing-geo-key-${a.scpiName}`,
        category: "scpi",
        reason: `Clé de ventilation géographique manquante pour ${a.scpiName} : intérêts personnels (${Math.round(a.totalPersonalInterests)} €) reportés intégralement en bucket CI par prudence.`,
        suggestedAction: `Contacter la société de gestion pour obtenir la répartition pays par pays de ${a.scpiName}.`,
        relatedFormId: "2044",
        relatedBox: "Ligne 113",
      });
    }
  }
  for (const u of allocation.unlinkedLoans) {
    items.push({
      id: `loan-unlinked-${u.bank}`,
      category: "deductible_expenses",
      reason: `Le lien entre le crédit ${u.bank} (${Math.round(u.amount)} €) et la/les SCPI n'est pas identifié.`,
      suggestedAction: "Vérification manuelle indispensable : confirmer à quelle(s) SCPI ce crédit est rattaché.",
      relatedFormId: "2044",
      relatedBox: "Ligne 113",
    });
  }
  // Plafonnement déficit foncier étranger / 4EA
  const scpiGrossSum = sumOpt(...(d.scpi ?? []).map((s) => s.grossIncome?.value));
  const scpiExpensesSum = sumOpt(...(d.scpi ?? []).map((s) => s.expenses?.value));
  const scpiOwnInt = sumOpt(...(d.scpi ?? []).map((s) => s.scpiLoanInterests?.value));
  const totalLine113Calc = scpiOwnInt + allocation.totalCi;
  const rawNet = scpiGrossSum - scpiExpensesSum - totalLine113Calc;
  if (scpiGrossSum > 0 && rawNet < 0) {
    items.push({
      id: "scpi-foreign-deficit-capped",
      category: "scpi",
      reason: `Déficit foncier étranger plafonné à 0 — ${Math.abs(rawNet)} € d'intérêts personnels excèdent les revenus.`,
      suggestedAction: "Vérifier qu'aucun report de déficit n'est applicable (déficit étranger non imputable sur revenu global).",
      relatedFormId: "2044",
      relatedBox: "Ligne 114",
    });
  }
  const exemptSum = sumOpt(...(d.scpi ?? []).map((s) => s.exemptIncome?.value));
  if (allocation.totalTe > exemptSum && exemptSum > 0) {
    items.push({
      id: "scpi-te-bucket-capped",
      category: "scpi",
      reason: `Intérêts bucket taux effectif (${allocation.totalTe} €) excèdent les revenus exonérés (${exemptSum} €) — ${allocation.totalTe - exemptSum} € perdus, 4EA plafonnée à 0.`,
      suggestedAction: "Aucune action : ces intérêts ne peuvent être déduits du revenu mondial taux effectif.",
      relatedFormId: "2042",
      relatedBox: "4EA",
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
