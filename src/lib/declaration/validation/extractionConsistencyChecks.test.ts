import { describe, it, expect } from "vitest";
import {
  runExtractionConsistencyChecks,
} from "@/lib/declaration/validation/extractionConsistencyChecks";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";

const baseData = (): ExtractedData => ({
  taxpayer: { fullName: "Test" },
  taxYear: 2024,
  detectedCategories: [],
  ifu: [],
  scpi: [],
  lifeInsurance: [],
  warnings: [],
  missingData: [],
  globalConfidence: "high",
});

describe("Consistency checks", () => {
  it("flag catégorie déclarée sans entrée", () => {
    const d = baseData();
    d.detectedCategories = ["ifu"];
    const issues = runExtractionConsistencyChecks(d);
    expect(issues.some((i) => i.code === "category_without_entries")).toBe(true);
  });

  it("flag montant négatif et sourceDocument manquant", () => {
    const d = baseData();
    d.detectedCategories = ["ifu"];
    d.ifu = [
      {
        institution: "BNP",
        dividends: { value: -10, confidence: "high" },
      },
    ];
    const issues = runExtractionConsistencyChecks(d);
    expect(issues.some((i) => i.code === "negative_amount")).toBe(true);
    expect(issues.some((i) => i.code === "missing_source_document")).toBe(true);
  });

  it("flag confiance haute avec warnings", () => {
    const d = baseData();
    d.warnings = ["doute sur la valeur"];
    const issues = runExtractionConsistencyChecks(d);
    expect(issues.some((i) => i.code === "high_confidence_with_warnings")).toBe(true);
  });

  it("flag années mélangées dans noms de fichiers", () => {
    const d = baseData();
    d.detectedCategories = ["ifu"];
    d.ifu = [
      {
        institution: "BNP",
        dividends: { value: 100, confidence: "high", sourceDocument: "ifu_2023.pdf" },
        interests: { value: 50, confidence: "high", sourceDocument: "ifu_2024.pdf" },
      },
    ];
    const issues = runExtractionConsistencyChecks(d);
    expect(issues.some((i) => i.code === "mixed_document_years")).toBe(true);
  });

  it("flag 0 € avec confiance haute sans note", () => {
    const d = baseData();
    d.detectedCategories = ["ifu"];
    d.ifu = [
      {
        institution: "BNP",
        dividends: { value: 0, confidence: "high", sourceDocument: "ifu.pdf" },
      },
    ];
    const issues = runExtractionConsistencyChecks(d);
    expect(issues.some((i) => i.code === "zero_with_high_confidence")).toBe(true);
  });
});
