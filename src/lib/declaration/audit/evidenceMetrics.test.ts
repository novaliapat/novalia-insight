import { describe, it, expect } from "vitest";
import { countEvidenceMetrics } from "./evidenceMetrics";

describe("countEvidenceMetrics", () => {
  it("renvoie 0 partout sur des buckets vides", () => {
    expect(countEvidenceMetrics({ ifu: [], scpi: [], lifeInsurance: [] })).toEqual({
      numberOfEvidenceItems: 0,
      numberOfWeakEvidence: 0,
      numberOfTextExcerpts: 0,
      numberOfPageReferences: 0,
      numberOfVisualRegions: 0,
    });
  });

  it("compte sans evidence comme weak (rétrocompat)", () => {
    const m = countEvidenceMetrics({
      ifu: [{ institution: "X", dividends: { value: 100, confidence: "high", sourceDocument: "x.pdf" } }],
      scpi: [],
      lifeInsurance: [],
    });
    expect(m.numberOfEvidenceItems).toBe(1);
    expect(m.numberOfWeakEvidence).toBe(1);
  });

  it("compte les différents evidenceType", () => {
    const m = countEvidenceMetrics({
      ifu: [
        {
          institution: "X",
          dividends: {
            value: 100, confidence: "high", sourceDocument: "x.pdf",
            evidence: { sourceDocument: "x.pdf", confidence: "high", evidenceType: "text_excerpt", extractedText: "Dividendes 100" },
          },
          interests: {
            value: 50, confidence: "medium", sourceDocument: "x.pdf",
            evidence: { sourceDocument: "x.pdf", confidence: "medium", evidenceType: "page_reference", pageNumber: 3 },
          },
        },
      ],
      scpi: [
        {
          scpiName: "S",
          frenchIncome: {
            value: 200, confidence: "high",
            evidence: { sourceDocument: "s.pdf", confidence: "high", evidenceType: "visual_region", boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
          },
        },
      ],
      lifeInsurance: [
        {
          contractName: "AV",
          withdrawals: {
            value: 1000, confidence: "low", sourceDocument: "av.pdf",
            evidence: { sourceDocument: "av.pdf", confidence: "low", evidenceType: "document_name_only" },
          },
        },
      ],
    });
    expect(m).toEqual({
      numberOfEvidenceItems: 4,
      numberOfWeakEvidence: 1,
      numberOfTextExcerpts: 1,
      numberOfPageReferences: 1,
      numberOfVisualRegions: 1,
    });
  });
});
