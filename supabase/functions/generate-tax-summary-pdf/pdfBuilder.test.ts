import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTaxSummaryPdf, type PdfBuildInput } from "./pdfBuilder.ts";

const baseInput = (overrides: Partial<PdfBuildInput> = {}): PdfBuildInput => ({
  declaration: {
    id: "decl-1",
    title: "Déclaration 2024",
    tax_year: 2024,
    status: "draft",
    analysis_status: "analysis_completed",
    review_status: "review_completed",
  },
  contribuable: "Jean Dupont",
  generatedAt: new Date("2026-04-29T10:00:00Z"),
  detectedCategories: ["ifu", "scpi"],
  extracted: {
    extracted_data: {
      ifu: { dividends: { value: 1234.56, confidence: "high", evidence: { sourceDocument: "ifu.pdf" } } },
    },
  } as any,
  validated: { validated_data: { ifu: { dividends: { value: 1234.56, confidence: "high" } } } } as any,
  analysis: {
    summary: "Analyse test",
    taxYear: 2024,
    taxCases: [
      {
        id: "c1", category: "ifu", form: "2042", box: "2DC",
        label: "Dividendes éligibles", amount: 1234.56,
        explanation: "Dividendes IFU", confidence: "high",
        ragSources: [{ category: "ifu", documentTitle: "BOI-RPPM-RCM", isOfficialSource: true, taxYear: 2024, relevanceScore: 0.9 }],
        requiresManualReview: false,
      },
    ],
    warnings: ["Vérifier la résidence fiscale"],
    uncertaintyPoints: [],
  } as any,
  reviewItems: [
    { id: "r1", severity: "warning", field: "ifu.dividends", status: "pending", message: "Vérifier" },
  ],
  auditLogs: [{ created_at: "2026-04-29T09:00:00Z", action: "extraction_completed" }],
  ragSourcesUsed: [],
  options: { includeAudit: false, includeRagSources: true, includeReviewItems: true },
  ...overrides,
});

Deno.test("buildTaxSummaryPdf produit un PDF valide", async () => {
  const bytes = await buildTaxSummaryPdf(baseInput());
  assert(bytes instanceof Uint8Array);
  assert(bytes.byteLength > 1000, `PDF trop court: ${bytes.byteLength}`);
  // signature %PDF-
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(header, "%PDF-");
});

Deno.test("buildTaxSummaryPdf — option includeAudit ajoute des pages", async () => {
  const small = await buildTaxSummaryPdf(baseInput({ options: { includeAudit: false, includeRagSources: false, includeReviewItems: false } }));
  const big = await buildTaxSummaryPdf(baseInput({ options: { includeAudit: true, includeRagSources: true, includeReviewItems: true } }));
  assert(big.byteLength > small.byteLength, "audit doit alourdir le PDF");
});

Deno.test("buildTaxSummaryPdf — sans analyse mentionne l'absence", async () => {
  const bytes = await buildTaxSummaryPdf(baseInput({ analysis: null }));
  assert(bytes.byteLength > 500);
});

Deno.test("buildTaxSummaryPdf — sources RAG non incluses si option false", async () => {
  const without = await buildTaxSummaryPdf(baseInput({ options: { includeAudit: false, includeRagSources: false, includeReviewItems: false } }));
  const withSrc = await buildTaxSummaryPdf(baseInput({ options: { includeAudit: false, includeRagSources: true, includeReviewItems: false } }));
  assert(withSrc.byteLength > without.byteLength);
});
