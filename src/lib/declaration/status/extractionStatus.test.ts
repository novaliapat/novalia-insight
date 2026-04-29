import { describe, it, expect } from "vitest";
import { deriveExtractionStatus } from "@/lib/declaration/status/extractionStatus";
import { buildExtractionAuditFallback } from "@/lib/declaration/audit/extractionAudit";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import type { ExtractionMetadata } from "@/lib/declaration/schemas/extractedDataSchema";

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

const baseMeta = (): ExtractionMetadata => ({
  extractionPromptVersion: "v1.0.0",
  extractedAt: new Date().toISOString(),
  modelUsed: "google/gemini-2.5-pro",
  dryRun: false,
});

describe("deriveExtractionStatus — règle officielle", () => {
  it("extraction_failed si erreur technique", () => {
    expect(
      deriveExtractionStatus({ hasError: true, isProcessing: false, data: baseData(), issues: [] }),
    ).toBe("extraction_failed");
  });

  it("extraction_needs_review si globalConfidence = low", () => {
    const d = baseData();
    d.globalConfidence = "low";
    expect(
      deriveExtractionStatus({ hasError: false, isProcessing: false, data: d, issues: [] }),
    ).toBe("extraction_needs_review");
  });

  it("extraction_completed_with_warnings si warnings", () => {
    const d = baseData();
    d.warnings = ["doute"];
    expect(
      deriveExtractionStatus({ hasError: false, isProcessing: false, data: d, issues: [] }),
    ).toBe("extraction_completed_with_warnings");
  });

  it("extraction_completed_with_warnings si missingData", () => {
    const d = baseData();
    d.missingData = ["champ X"];
    expect(
      deriveExtractionStatus({ hasError: false, isProcessing: false, data: d, issues: [] }),
    ).toBe("extraction_completed_with_warnings");
  });

  it("extraction_completed_with_warnings si consistencyIssues", () => {
    expect(
      deriveExtractionStatus({
        hasError: false,
        isProcessing: false,
        data: baseData(),
        issues: [{ code: "x", severity: "warning", message: "y" }],
      }),
    ).toBe("extraction_completed_with_warnings");
  });

  it("extraction_completed sinon", () => {
    expect(
      deriveExtractionStatus({ hasError: false, isProcessing: false, data: baseData(), issues: [] }),
    ).toBe("extraction_completed");
  });
});

describe("ExtractionAudit (fallback front, mêmes règles que backend)", () => {
  it("respecte numberOfFiles fourni (jamais 0 implicite)", () => {
    const audit = buildExtractionAuditFallback({
      declarationId: "00000000-0000-0000-0000-000000000001",
      data: baseData(),
      metadata: baseMeta(),
      numberOfFiles: 3,
      consistencyIssues: [],
      status: "extraction_completed",
    });
    expect(audit.numberOfFiles).toBe(3);
    expect(audit.status).toBe("extraction_completed");
  });

  it("compte numberOfExtractedFields (champs ConfidentField uniquement)", () => {
    const d = baseData();
    d.ifu = [
      {
        institution: "BNP",
        dividends: { value: 100, confidence: "high", sourceDocument: "f.pdf" },
        withholdingTax: { value: 30, confidence: "high", sourceDocument: "f.pdf" },
      },
    ];
    const audit = buildExtractionAuditFallback({
      declarationId: "00000000-0000-0000-0000-000000000001",
      data: d,
      metadata: baseMeta(),
      numberOfFiles: 1,
      consistencyIssues: [],
      status: "extraction_completed",
    });
    expect(audit.numberOfExtractedFields).toBe(2);
  });

  it("propage warnings / missingData / consistencyIssues counts", () => {
    const d = baseData();
    d.warnings = ["a", "b"];
    d.missingData = ["x"];
    const audit = buildExtractionAuditFallback({
      declarationId: "00000000-0000-0000-0000-000000000001",
      data: d,
      metadata: baseMeta(),
      numberOfFiles: 2,
      consistencyIssues: [
        { code: "c", severity: "warning", message: "m" },
        { code: "c2", severity: "info", message: "m2" },
      ],
      status: "extraction_completed_with_warnings",
    });
    expect(audit.numberOfWarnings).toBe(2);
    expect(audit.numberOfMissingData).toBe(1);
    expect(audit.numberOfConsistencyIssues).toBe(2);
    expect(audit.status).toBe("extraction_completed_with_warnings");
  });
});
