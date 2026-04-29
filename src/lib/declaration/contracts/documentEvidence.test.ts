import { describe, it, expect } from "vitest";
import {
  DocumentEvidenceSchema,
  ConfidentNumberSchema,
} from "./extractedDataContract";

describe("DocumentEvidence schema", () => {
  it("accepte une ancienne extraction (sourceDocument seul, sans evidence)", () => {
    const r = ConfidentNumberSchema.safeParse({
      value: 1234,
      confidence: "high",
      sourceDocument: "ifu_2024.pdf",
    });
    expect(r.success).toBe(true);
  });

  it("accepte un evidence document_name_only sans page ni extrait", () => {
    const r = DocumentEvidenceSchema.safeParse({
      sourceDocument: "ifu.pdf",
      confidence: "medium",
      evidenceType: "document_name_only",
    });
    expect(r.success).toBe(true);
  });

  it("accepte un evidence text_excerpt avec extractedText", () => {
    const r = DocumentEvidenceSchema.safeParse({
      sourceDocument: "ifu.pdf",
      confidence: "high",
      evidenceType: "text_excerpt",
      extractedText: "Dividendes : 1 200 €",
    });
    expect(r.success).toBe(true);
  });

  it("rejette un text_excerpt sans extractedText", () => {
    const r = DocumentEvidenceSchema.safeParse({
      sourceDocument: "ifu.pdf",
      confidence: "high",
      evidenceType: "text_excerpt",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un page_reference sans pageNumber", () => {
    const r = DocumentEvidenceSchema.safeParse({
      sourceDocument: "ifu.pdf",
      confidence: "high",
      evidenceType: "page_reference",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un visual_region sans boundingBox", () => {
    const r = DocumentEvidenceSchema.safeParse({
      sourceDocument: "ifu.pdf",
      confidence: "high",
      evidenceType: "visual_region",
    });
    expect(r.success).toBe(false);
  });

  it("accepte ConfidentNumber avec evidence complet", () => {
    const r = ConfidentNumberSchema.safeParse({
      value: 800,
      confidence: "high",
      sourceDocument: "scpi.pdf",
      evidence: {
        sourceDocument: "scpi.pdf",
        confidence: "high",
        evidenceType: "page_reference",
        pageNumber: 2,
        sectionLabel: "Revenus France",
      },
    });
    expect(r.success).toBe(true);
  });
});
