import { describe, it, expect } from "vitest";
import {
  ExtractedDataSchema,
  TaxCategoryEnum,
  type ExtractedData,
} from "@/lib/declaration/schemas/extractedDataSchema";

/**
 * Tests d'alignement schéma <-> contrat d'extraction.
 *
 * Vérifie pour 3 cas typiques (IFU, SCPI FR+étranger, Assurance-vie) :
 *  - tous les montants sont des `number` (jamais des strings)
 *  - chaque montant porte un `sourceDocument` non vide
 *  - `detectedCategories` n'utilise que des valeurs de TaxCategoryEnum
 *  - aucun champ "case fiscale" / "formulaire" / "form" n'apparaît
 *    dans le payload (la transformation fiscale appartient au module d'analyse).
 */

const FORBIDDEN_FISCAL_KEYS = [
  "case",
  "cases",
  "caseFiscale",
  "casesFiscales",
  "form",
  "forms",
  "formulaire",
  "formulaires",
  "recommendation",
  "recommendations",
  "recommandation",
  "recommandations",
  "taxableBase",
  "baseImposable",
];

function assertNoFiscalLeakage(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach(assertNoFiscalLeakage);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    expect(
      FORBIDDEN_FISCAL_KEYS.includes(k),
      `clé interdite "${k}" trouvée — l'extraction ne doit pas produire d'analyse fiscale`,
    ).toBe(false);
    assertNoFiscalLeakage(v);
  }
}

function assertConfidentNumber(field: unknown, ctx: string): void {
  expect(field, `${ctx}: champ manquant`).toBeDefined();
  const f = field as Record<string, unknown>;
  expect(typeof f.value, `${ctx}: value doit être number`).toBe("number");
  expect(Number.isFinite(f.value), `${ctx}: value doit être fini`).toBe(true);
  expect(["high", "medium", "low"]).toContain(f.confidence);
  expect(typeof f.sourceDocument, `${ctx}: sourceDocument doit être string`).toBe(
    "string",
  );
  expect((f.sourceDocument as string).length).toBeGreaterThan(0);
}

function assertCategoriesValid(cats: unknown): void {
  expect(Array.isArray(cats)).toBe(true);
  for (const c of cats as string[]) {
    expect(TaxCategoryEnum.options).toContain(c);
  }
}

describe("Extraction — cas IFU simple (dividendes + PFU)", () => {
  const mock = {
    taxpayer: { fullName: "Jean Dupont" },
    taxYear: 2024,
    detectedCategories: ["ifu"],
    ifu: [
      {
        institution: "BNP Paribas",
        accountNumber: "FR76xxxx",
        dividends: { value: 1234.56, confidence: "high", sourceDocument: "ifu_2024.pdf" },
        withholdingTax: { value: 370.37, confidence: "high", sourceDocument: "ifu_2024.pdf" },
        socialContributions: { value: 212.35, confidence: "high", sourceDocument: "ifu_2024.pdf" },
      },
    ],
    scpi: [],
    lifeInsurance: [],
    warnings: [],
    missingData: [],
    globalConfidence: "high",
  };

  it("est conforme au schéma Zod", () => {
    const parsed = ExtractedDataSchema.parse(mock);
    expect(parsed.ifu).toHaveLength(1);
  });

  it("a des montants typés number avec sourceDocument", () => {
    const parsed: ExtractedData = ExtractedDataSchema.parse(mock);
    const entry = parsed.ifu[0];
    assertConfidentNumber(entry.dividends, "ifu.dividends");
    assertConfidentNumber(entry.withholdingTax, "ifu.withholdingTax");
    assertConfidentNumber(entry.socialContributions, "ifu.socialContributions");
  });

  it("utilise des catégories valides", () => {
    assertCategoriesValid(mock.detectedCategories);
  });

  it("ne contient aucune case ni formulaire fiscal", () => {
    assertNoFiscalLeakage(mock);
  });

  it("rejette un montant en string", () => {
    const bad = structuredClone(mock);
    // @ts-expect-error test runtime
    bad.ifu[0].dividends.value = "1234,56";
    expect(() => ExtractedDataSchema.parse(bad)).toThrow();
  });
});

describe("Extraction — cas SCPI (revenus France + revenus étrangers Allemagne)", () => {
  const mock = {
    taxpayer: { fullName: "Marie Martin" },
    taxYear: 2024,
    detectedCategories: ["scpi"],
    ifu: [],
    scpi: [
      {
        scpiName: "Corum Origin",
        managementCompany: "Corum AM",
        frenchIncome: { value: 1800, confidence: "high", sourceDocument: "scpi_corum.pdf" },
        foreignIncome: {
          value: 800,
          confidence: "high",
          sourceDocument: "scpi_corum.pdf",
          note: "Allemagne",
        },
        socialContributions: { value: 309.6, confidence: "medium", sourceDocument: "scpi_corum.pdf" },
      },
    ],
    lifeInsurance: [],
    warnings: [],
    missingData: ["Intérêts d'emprunt déductibles non communiqués"],
    globalConfidence: "high",
  };

  it("est conforme au schéma Zod", () => {
    expect(() => ExtractedDataSchema.parse(mock)).not.toThrow();
  });

  it("a des montants typés number avec sourceDocument et note pays", () => {
    const parsed = ExtractedDataSchema.parse(mock);
    const entry = parsed.scpi[0];
    assertConfidentNumber(entry.frenchIncome, "scpi.frenchIncome");
    assertConfidentNumber(entry.foreignIncome, "scpi.foreignIncome");
    expect(entry.foreignIncome?.note).toBe("Allemagne");
  });

  it("utilise des catégories valides (life_insurance, pas assurance_vie)", () => {
    assertCategoriesValid(mock.detectedCategories);
    expect(TaxCategoryEnum.options).toContain("life_insurance");
    expect(TaxCategoryEnum.options).not.toContain(
      "assurance_vie" as unknown as (typeof TaxCategoryEnum.options)[number],
    );
  });

  it("ne contient aucune case ni mécanisme fiscal", () => {
    assertNoFiscalLeakage(mock);
  });
});

describe("Extraction — cas Assurance-vie (rachat + part taxable)", () => {
  const mock = {
    taxpayer: { fullName: "Paul Bernard" },
    taxYear: 2024,
    detectedCategories: ["life_insurance"],
    ifu: [],
    scpi: [],
    lifeInsurance: [
      {
        contractName: "Linxea Avenir",
        insurer: "Suravenir",
        contractAge: "more_than_8",
        withdrawals: { value: 12000, confidence: "high", sourceDocument: "av_linxea.pdf" },
        taxableShare: { value: 2400, confidence: "medium", sourceDocument: "av_linxea.pdf" },
        withholdingTax: { value: 0, confidence: "high", sourceDocument: "av_linxea.pdf" },
      },
    ],
    warnings: [],
    missingData: [],
    globalConfidence: "high",
  };

  it("est conforme au schéma Zod", () => {
    expect(() => ExtractedDataSchema.parse(mock)).not.toThrow();
  });

  it("a des montants number, sourceDocument et contractAge enuméré", () => {
    const parsed = ExtractedDataSchema.parse(mock);
    const entry = parsed.lifeInsurance[0];
    assertConfidentNumber(entry.withdrawals, "av.withdrawals");
    assertConfidentNumber(entry.taxableShare, "av.taxableShare");
    assertConfidentNumber(entry.withholdingTax, "av.withholdingTax");
    expect(["less_than_8", "more_than_8"]).toContain(entry.contractAge);
  });

  it("utilise des catégories valides", () => {
    assertCategoriesValid(mock.detectedCategories);
  });

  it("ne contient aucune case ni recommandation fiscale", () => {
    assertNoFiscalLeakage(mock);
  });

  it("rejette une catégorie inconnue (assurance-vie au lieu de life_insurance)", () => {
    const bad = { ...mock, detectedCategories: ["assurance-vie"] };
    expect(() => ExtractedDataSchema.parse(bad)).toThrow();
  });
});
