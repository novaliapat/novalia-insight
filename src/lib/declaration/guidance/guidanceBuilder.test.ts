import { describe, it, expect } from "vitest";
import {
  buildDeclarationGuidance,
  detectSituations,
  mapValidatedAmountsToBoxes,
  type CategoryRagPayload,
} from "./guidanceBuilder";
import type { ExtractedData } from "@/lib/declaration/contracts/extractedDataContract";
import type { FormSource } from "@/lib/declaration/guidance/guidanceSchemas";

const officialSrc: FormSource = {
  title: "Brochure IR 2025",
  isOfficialSource: true,
  provenance: "official_brochure",
  sourceType: "official_brochure",
  pageNumber: 124,
  formId: "2042",
};
const nonOfficialSrc: FormSource = {
  title: "Blog perso",
  isOfficialSource: false,
  provenance: "manual_seed",
};

const officialFor = (cat: string): CategoryRagPayload => ({
  category: cat as never,
  sources: [officialSrc],
  hasOfficial: true,
});

function baseData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    taxpayer: { fullName: "Test" },
    taxYear: 2024,
    detectedCategories: [],
    ifu: [],
    scpi: [],
    lifeInsurance: [],
    warnings: [],
    missingData: [],
    globalConfidence: "medium",
    ...overrides,
  } as ExtractedData;
}

describe("buildDeclarationGuidance — IFU", () => {
  it("IFU dividendes → 2042 requis + case 2DC proposée avec montant", () => {
    const data = baseData({
      detectedCategories: ["ifu", "dividends"],
      ifu: [
        {
          institution: "BNP",
          dividends: { value: 1500, confidence: "high" },
        },
      ],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { ifu: officialFor("ifu"), dividends: officialFor("dividends") },
    });
    const forms = out.guidance.requiredForms.map((f) => f.formId);
    expect(forms).toContain("2042");
    const dc = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2042" && p.boxOrLine === "2DC",
    );
    expect(dc).toBeDefined();
    expect(dc!.amount).toBe(1500);
  });

  it("IFU intérêts → case 2TR proposée avec montant", () => {
    const data = baseData({
      detectedCategories: ["ifu", "interests"],
      ifu: [{ institution: "BNP", interests: { value: 800, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { ifu: officialFor("ifu"), interests: officialFor("interests") },
    });
    const tr = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2042" && p.boxOrLine === "2TR",
    );
    expect(tr?.amount).toBe(800);
  });

  it("IFU withholdingTax → case 2CK proposée", () => {
    const data = baseData({
      detectedCategories: ["ifu"],
      ifu: [{ institution: "BNP", withholdingTax: { value: 96, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { ifu: officialFor("ifu") },
    });
    const ck = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2042" && p.boxOrLine === "2CK",
    );
    expect(ck?.amount).toBe(96);
  });

  it("IFU socialContributions → 2BH/2CG en review forcée (impossible de trancher)", () => {
    const data = baseData({
      detectedCategories: ["ifu"],
      ifu: [{ institution: "BNP", socialContributions: { value: 200, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { ifu: officialFor("ifu") },
    });
    const bh = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "2BH");
    const cg = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "2CG");
    expect(bh?.requiresManualReview).toBe(true);
    expect(cg?.requiresManualReview).toBe(true);
    expect(out.guidance.manualReviewItems.some((m) => m.id === "ifu-social-2bh-vs-2cg")).toBe(true);
  });
});

describe("buildDeclarationGuidance — SCPI", () => {
  it("SCPI revenus français → 2044 requis + ligne 211 proposée + 4BA en review", () => {
    const data = baseData({
      detectedCategories: ["scpi"],
      scpi: [{ scpiName: "Corum", frenchIncome: { value: 3000, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { scpi: officialFor("scpi") },
    });
    const forms = out.guidance.requiredForms.map((f) => f.formId);
    expect(forms).toContain("2044");
    const l211 = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2044" && p.boxOrLine === "Ligne 211",
    );
    expect(l211?.amount).toBe(3000);
    const ba = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2042" && p.boxOrLine === "4BA",
    );
    expect(ba?.requiresManualReview).toBe(true);
    expect(ba?.blockingReason).toMatch(/résultat foncier|2044/);
  });

  it("SCPI revenus étrangers → 2047 requis + 4BL/8TK en review", () => {
    const data = baseData({
      detectedCategories: ["scpi", "foreign_accounts"],
      scpi: [{ scpiName: "Corum Eurion", foreignIncome: { value: 1200, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: {
        scpi: officialFor("scpi"),
        foreign_accounts: officialFor("foreign_accounts"),
      },
    });
    const forms = out.guidance.requiredForms.map((f) => f.formId);
    expect(forms).toContain("2047");
    const bl = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "4BL");
    const tk = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "8TK");
    expect(bl?.requiresManualReview).toBe(true);
    expect(tk?.requiresManualReview).toBe(true);
    expect(
      out.guidance.manualReviewItems.some((m) => m.id === "scpi-foreign-convention"),
    ).toBe(true);
  });

  it("SCPI deductibleInterests → 2044 ligne 250 avec montant", () => {
    const data = baseData({
      detectedCategories: ["scpi", "deductible_expenses"],
      scpi: [
        { scpiName: "X", deductibleInterests: { value: 450, confidence: "high" } },
      ],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: {
        scpi: officialFor("scpi"),
        deductible_expenses: officialFor("deductible_expenses"),
      },
    });
    const l250 = out.guidance.taxBoxProposals.find(
      (p) => p.formId === "2044" && p.boxOrLine === "Ligne 250",
    );
    expect(l250?.amount).toBe(450);
  });
});

describe("buildDeclarationGuidance — Assurance-vie", () => {
  it("AV sans ancienneté → 2042 requise + manual review", () => {
    const data = baseData({
      detectedCategories: ["life_insurance"],
      lifeInsurance: [
        {
          contractName: "Linxea Spirit",
          taxableShare: { value: 800, confidence: "high" },
          // contractAge non renseigné
        },
      ],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: { life_insurance: officialFor("life_insurance") },
    });
    expect(out.guidance.requiredForms.map((f) => f.formId)).toContain("2042");
    expect(
      out.guidance.manualReviewItems.some((m) => m.id.startsWith("av-age-")),
    ).toBe(true);
    expect(out.status).toBe("guidance_completed_with_warnings");
  });
});

describe("buildDeclarationGuidance — invariants", () => {
  it("guidanceSafetyChecks dégrade toute proposition sans source officielle", () => {
    const data = baseData({
      detectedCategories: ["scpi"],
      scpi: [{ scpiName: "X", frenchIncome: { value: 1000, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: {
        scpi: { category: "scpi", sources: [nonOfficialSrc], hasOfficial: false },
      },
    });
    // Avec le fallback catalogue, les cases brochure-sourcées peuvent rester "high".
    // L'invariant est juste : aucune case sans source officielle ne doit être "high".
    for (const p of out.guidance.taxBoxProposals) {
      const hasOfficial = p.ragSources.some((s) => s.isOfficialSource);
      if (!hasOfficial) {
        expect(p.confidence).not.toBe("high");
      }
    }
  });

  it("fallback catalogue : sans RAG DB, IFU intérêts → 2TR avec source brochure officielle", () => {
    const data = baseData({
      detectedCategories: [],
      ifu: [{ institution: "BNP", interests: { value: 115.73, confidence: "high" } }],
      scpi: [
        {
          scpiName: "X",
          foreignIncome: { value: 2320.85, confidence: "high" },
          deductibleInterests: { value: 4003.49, confidence: "high" },
        },
      ],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: {}, // RAG DB vide
    });
    const tr = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "2TR");
    expect(tr?.amount).toBe(116); // arrondi entier (CGI art. 193)
    expect(tr?.ragSources.some((s) => s.isOfficialSource)).toBe(true);

    const l250 = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "Ligne 250");
    expect(l250?.amount).toBe(4003); // arrondi entier
    expect(l250?.ragSources.some((s) => s.isOfficialSource)).toBe(true);

    const bl = out.guidance.taxBoxProposals.find((p) => p.boxOrLine === "4BL");
    expect(bl?.requiresManualReview).toBe(true);
  });

  it("annexes (2044/2047) ouvertes avant 2042 dans les steps", () => {
    const data = baseData({
      detectedCategories: ["scpi", "foreign_accounts"],
      scpi: [{ scpiName: "X", foreignIncome: { value: 100, confidence: "high" } }],
    });
    const out = buildDeclarationGuidance({
      taxYear: 2025,
      validatedData: data,
      ragByCategory: {
        scpi: officialFor("scpi"),
        foreign_accounts: officialFor("foreign_accounts"),
      },
    });
    const order = out.guidance.declarationSteps.map((s) => s.formId);
    if (order.includes("2042") && order.includes("2044")) {
      expect(order.indexOf("2044")).toBeLessThan(order.indexOf("2042"));
    }
    if (order.includes("2042") && order.includes("2047")) {
      expect(order.indexOf("2047")).toBeLessThan(order.indexOf("2042"));
    }
  });
});

describe("detectSituations", () => {
  it("détecte IFU + SCPI + foreign", () => {
    const r = detectSituations(
      baseData({
        detectedCategories: ["ifu", "scpi"],
        ifu: [{ institution: "BNP" }],
        scpi: [
          { scpiName: "X", foreignIncome: { value: 500, confidence: "medium" } },
        ],
      }),
    );
    expect(r.situations.some((s) => /IFU/.test(s))).toBe(true);
    expect(r.situations.some((s) => /SCPI/.test(s))).toBe(true);
    expect(r.hasForeignIncome).toBe(true);
    expect(r.hasRealEstateIncome).toBe(true);
  });
});

describe("mapValidatedAmountsToBoxes", () => {
  it("agrège les montants IFU multi-comptes", () => {
    const { amountByBox } = mapValidatedAmountsToBoxes(
      baseData({
        ifu: [
          { institution: "A", dividends: { value: 100, confidence: "high" } },
          { institution: "B", dividends: { value: 250, confidence: "high" } },
        ],
      }),
    );
    expect(amountByBox.get("2042::2DC")).toBe(350);
  });
});
