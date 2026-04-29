import { describe, it, expect } from "vitest";
import {
  DeclarationGuidanceSchema,
  RequiredFormSchema,
  TaxBoxProposalSchema,
  LegalBasisSourceSchema,
  MissingSourceSchema,
} from "@/lib/declaration/guidance/guidanceSchemas";
import { FORMS_CATALOG_2025, getFormById } from "@/lib/declaration/forms/2025/formsCatalog";
import { BOX_CATALOG_2025, getBoxesForCategory } from "@/lib/declaration/forms/2025/boxCatalog";
import { ANNEX_RULES_2025 } from "@/lib/declaration/forms/2025/annexCatalog";
import { buildTaxBoxProposals } from "@/lib/declaration/guidance/taxBoxMappingRules";
import { buildDeclarationSteps } from "@/lib/declaration/guidance/declarationStepBuilder";
import { runGuidanceSafetyChecks } from "@/lib/declaration/guidance/guidanceSafetyChecks";
import { MANUAL_RAG_SEED_2025 } from "@/lib/rag/seed/manualRagSeed2025";

// ── Schémas ────────────────────────────────────────────────────────────────
describe("guidance schemas", () => {
  it("legalBasisSources peut être vide sans bloquer", () => {
    const f = RequiredFormSchema.parse({
      formId: "2042",
      label: "test",
      reason: "test",
      required: true,
      confidence: "high",
      status: "confirmed",
      // sources & legalBasisSources omis → defaults []
    });
    expect(f.legalBasisSources).toEqual([]);
    expect(f.sources).toEqual([]);
  });

  it("LegalBasisSource schema accepte une structure CGI complète", () => {
    const ls = LegalBasisSourceSchema.parse({
      articleCode: "CGI",
      articleNumber: "150-0 A",
      title: "Plus-values mobilières",
      url: null,
    });
    expect(ls.articleNumber).toBe("150-0 A");
  });

  it("DeclarationGuidance valide avec disclaimer par défaut", () => {
    const g = DeclarationGuidanceSchema.parse({
      taxYear: 2025,
      taxpayerSummary: { taxYear: 2025, detectedCategories: [], hasForeignIncome: false, hasRealEstateIncome: false },
      confidence: "low",
    });
    expect(g.disclaimer).toMatch(/aide à la préparation/);
  });
});

// ── Catalogue ──────────────────────────────────────────────────────────────
describe("forms catalog 2025", () => {
  it("expose 2042/2042C/2044/2047", () => {
    const ids = FORMS_CATALOG_2025.map((f) => f.formId);
    expect(ids).toEqual(expect.arrayContaining(["2042", "2042C", "2044", "2047"]));
  });

  it("getFormById retourne 2044 avec source officielle", () => {
    const f = getFormById("2044");
    expect(f).toBeDefined();
    expect(f?.sourceUrl).toContain("impots.gouv.fr");
    expect(f?.status).toBe("confirmed");
  });

  it("aucune entrée box catalogue sans sourceName", () => {
    for (const b of BOX_CATALOG_2025) {
      expect(b.sourceName, `${b.formId}/${b.boxOrLine}`).toBeTruthy();
    }
  });

  it("annexe 2047 est déclenchée pour SCPI étrangères", () => {
    const rule = ANNEX_RULES_2025.find((r) => r.formId === "2047");
    expect(rule?.requiresForeign).toBe(true);
    expect(rule?.triggerCategories).toContain("scpi");
  });
});

// ── Mapping prudent ────────────────────────────────────────────────────────
describe("buildTaxBoxProposals", () => {
  const officialSrc = {
    title: "Notice 2044",
    isOfficialSource: true,
    provenance: "manual_seed" as const,
  };

  it("SCPI revenus France → propose des cases dans la 2044", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["scpi"],
      ragByCategory: {
        scpi: { category: "scpi", sources: [officialSrc], hasOfficial: true },
      },
    });
    const formIds = new Set(props.map((p) => p.formId));
    expect(formIds.has("2044")).toBe(true);
  });

  it("intérêts d'emprunt → ligne 250 de la 2044", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["deductible_expenses"],
      ragByCategory: {
        deductible_expenses: { category: "deductible_expenses", sources: [officialSrc], hasOfficial: true },
      },
    });
    expect(props.some((p) => p.formId === "2044" && p.boxOrLine === "Ligne 250")).toBe(true);
  });

  it("IFU intérêts/dividendes → cases 2042 (2TR/2DC/2CK)", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["ifu", "interests", "dividends"],
      ragByCategory: {
        ifu: { category: "ifu", sources: [officialSrc], hasOfficial: true },
        interests: { category: "interests", sources: [officialSrc], hasOfficial: true },
        dividends: { category: "dividends", sources: [officialSrc], hasOfficial: true },
      },
    });
    const boxes = props.filter((p) => p.formId === "2042").map((p) => p.boxOrLine);
    expect(boxes).toEqual(expect.arrayContaining(["2TR", "2DC", "2CK"]));
  });

  it("assurance-vie → 2042 case 2CH", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["life_insurance"],
      ragByCategory: {
        life_insurance: { category: "life_insurance", sources: [officialSrc], hasOfficial: true },
      },
    });
    expect(props.some((p) => p.formId === "2042" && p.boxOrLine === "2CH")).toBe(true);
  });

  it("absence de source RAG → confidence low + manual review forcé (taxBoxMappingRules direct)", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["scpi"],
      ragByCategory: {},
    });
    expect(props.length).toBeGreaterThan(0);
    expect(props.every((p) => p.requiresManualReview)).toBe(true);
    expect(props.every((p) => p.confidence === "low")).toBe(true);
    // taxBoxMappingRules est l'ancien helper standalone, sans fallback catalogue.
    expect(props[0].blockingReason).toBeDefined();
  });

  it("source non officielle uniquement → bloque la confiance haute", () => {
    const props = buildTaxBoxProposals({
      detectedCategories: ["scpi"],
      ragByCategory: {
        scpi: {
          category: "scpi",
          sources: [{ title: "Blog perso", isOfficialSource: false, provenance: "manual_seed" }],
          hasOfficial: false,
        },
      },
    });
    expect(props.every((p) => p.confidence === "low")).toBe(true);
    expect(props[0].blockingReason).toMatch(/officielle/);
  });
});

// ── Steps ──────────────────────────────────────────────────────────────────
describe("buildDeclarationSteps", () => {
  it("ouvre les annexes (2044, 2047) avant la principale (2042)", () => {
    const steps = buildDeclarationSteps({
      requiredForms: [
        { formId: "2042", label: "Principale", reason: "r", required: true, confidence: "high", status: "confirmed", sources: [], legalBasisSources: [] },
        { formId: "2044", label: "Fonciers", reason: "r", required: true, confidence: "high", status: "confirmed", sources: [], legalBasisSources: [] },
        { formId: "2047", label: "Étranger", reason: "r", required: true, confidence: "high", status: "confirmed", sources: [], legalBasisSources: [] },
      ],
      proposals: [],
    });
    const order = steps.map((s) => s.formId);
    expect(order.indexOf("2044")).toBeLessThan(order.indexOf("2042"));
    expect(order.indexOf("2047")).toBeLessThan(order.indexOf("2042"));
  });
});

// ── Safety checks ──────────────────────────────────────────────────────────
describe("runGuidanceSafetyChecks", () => {
  it("dégrade une case 'high' sans source officielle", () => {
    const res = runGuidanceSafetyChecks({
      taxYear: 2025,
      taxpayerSummary: { taxYear: 2025, detectedCategories: ["scpi"], hasForeignIncome: false, hasRealEstateIncome: true },
      detectedSituations: [],
      requiredForms: [],
      declarationSteps: [],
      taxBoxProposals: [
        TaxBoxProposalSchema.parse({
          formId: "2044", boxOrLine: "211", label: "x", amount: 1000, category: "scpi",
          explanation: "y", confidence: "high", status: "confirmed",
          ragSources: [{ title: "Source non officielle", isOfficialSource: false, provenance: "manual_seed" }],
        }),
      ],
      manualReviewItems: [],
      missingSources: [],
      warnings: [],
      confidence: "high",
      disclaimer: "x",
    });
    expect(res.sanitized.taxBoxProposals[0].confidence).toBe("low");
    expect(res.sanitized.taxBoxProposals[0].requiresManualReview).toBe(true);
  });

  it("missingSources schema parse correctement", () => {
    const m = MissingSourceSchema.parse({
      category: "interests",
      reason: "Aucune notice ingérée",
    });
    expect(m.blocksHighConfidence).toBe(true);
  });
});

// ── Seed RAG manuel ────────────────────────────────────────────────────────
describe("MANUAL_RAG_SEED_2025", () => {
  it("contient les catégories essentielles", () => {
    const cats = new Set(MANUAL_RAG_SEED_2025.map((c) => c.category));
    expect(cats).toEqual(expect.objectContaining({}));
    for (const expected of ["ifu", "scpi", "real_estate_income", "deductible_expenses", "foreign_accounts", "life_insurance"]) {
      expect(cats.has(expected as never)).toBe(true);
    }
  });

  it("chaque chunk porte un warning et une source officielle", () => {
    for (const c of MANUAL_RAG_SEED_2025) {
      expect(c.warning.length).toBeGreaterThan(10);
      expect(c.isOfficialSource).toBe(true);
      expect(c.sourceName.length).toBeGreaterThan(0);
      expect(c.taxYear).toBe(2025);
    }
  });
});

// ── Catégories couvertes ──────────────────────────────────────────────────
describe("box catalog coverage", () => {
  it("scpi → au moins une case", () => {
    expect(getBoxesForCategory("scpi").length).toBeGreaterThan(0);
  });
  it("life_insurance → 2CH présente", () => {
    const e = getBoxesForCategory("life_insurance");
    expect(e.some((b) => b.boxOrLine === "2CH")).toBe(true);
  });
});
