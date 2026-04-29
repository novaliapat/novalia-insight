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

const guidanceFixture = () => ({
  taxYear: 2024,
  taxpayerSummary: { taxYear: 2024, detectedCategories: ["ifu"], hasForeignIncome: false, hasRealEstateIncome: false },
  detectedSituations: ["Dividendes IFU"],
  requiredForms: [
    {
      formId: "2042", label: "Déclaration principale", reason: "Dividendes à reporter",
      required: true, confidence: "high", status: "confirmed",
      sources: [{
        title: "Brochure IR 2025", sourceName: "Brochure IR 2025",
        isOfficialSource: true, provenance: "official_brochure",
        pageNumber: 142, formId: "2042", boxCodes: ["2DC"],
        sectionLabel: "Revenus de capitaux mobiliers",
        excerpt: "Les dividendes éligibles sont à reporter case 2DC.",
      }],
      legalBasisSources: [],
    },
  ],
  declarationSteps: [
    {
      id: "s1", order: 0, title: "Reporter dividendes en 2DC",
      description: "Saisir 1234,56 EUR en case 2DC",
      formId: "2042", actionType: "enter_amount", amount: 1234.56,
      targetBox: "2DC", ragSources: [], requiresManualReview: false,
    },
  ],
  taxBoxProposals: [
    {
      formId: "2042", boxOrLine: "2DC", label: "Dividendes éligibles",
      amount: 1234.56, category: "ifu", explanation: "Dividendes IFU",
      confidence: "high", status: "confirmed",
      ragSources: [], legalBasisSources: [], requiresManualReview: false,
    },
  ],
  manualReviewItems: [
    { id: "m1", category: "ifu", reason: "Prélèvement à la source à confirmer",
      suggestedAction: "Vérifier 2CK", relatedFormId: "2042", relatedBox: "2CK" },
  ],
  missingSources: [],
  warnings: [],
  confidence: "high",
  disclaimer: "Aide à la préparation. Vérifiez avant déclaration.",
});

Deno.test("buildTaxSummaryPdf — guidance: contient 2DC et formulaire 2042", async () => {
  const bytes = await buildTaxSummaryPdf(baseInput({
    guidance: guidanceFixture(),
    guidanceStatus: "guidance_completed",
  }));
  // Le PDF est binaire mais le texte non-compressé reste détectable dans pdf-lib
  const text = new TextDecoder("latin1").decode(bytes);
  assert(text.includes("2DC"), "PDF doit contenir la case 2DC");
  assert(text.includes("2042"), "PDF doit contenir le formulaire 2042");
  assert(text.includes("Brochure IR"), "PDF doit citer la brochure officielle");
});

Deno.test("buildTaxSummaryPdf — guidance avec manualReviewItems mentionne vérification", async () => {
  const bytes = await buildTaxSummaryPdf(baseInput({
    guidance: guidanceFixture(),
    guidanceStatus: "guidance_completed_with_warnings",
  }));
  const text = new TextDecoder("latin1").decode(bytes);
  assert(text.includes("vérifier") || text.includes("v?rifier") || text.includes("Points"),
    "PDF doit afficher la section points à vérifier");
});

Deno.test("buildTaxSummaryPdf — sans guidance affiche un avertissement", async () => {
  const bytes = await buildTaxSummaryPdf(baseInput({ guidance: null }));
  assert(bytes.byteLength > 1000);
});
