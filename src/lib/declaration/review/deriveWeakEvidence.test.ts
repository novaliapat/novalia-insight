import { describe, it, expect } from "vitest";
import { deriveWeakEvidenceReviewItems } from "./deriveReviewItems";

describe("deriveWeakEvidenceReviewItems", () => {
  it("génère un review item pour chaque champ sans evidence enrichi", () => {
    const items = deriveWeakEvidenceReviewItems({
      ifu: [
        { institution: "Banque X", dividends: { value: 100, confidence: "high", sourceDocument: "x.pdf" } },
      ],
      scpi: [],
      lifeInsurance: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0].sourceType).toBe("weak_evidence");
    expect(items[0].severity).toBe("info");
    expect(items[0].dedupKey).toBe("weak_evidence:ifu:0:dividends");
    expect(items[0].message).toContain("Banque X");
    expect(items[0].message).toContain("x.pdf");
  });

  it("ignore les champs avec evidence text_excerpt / page_reference / visual_region", () => {
    const items = deriveWeakEvidenceReviewItems({
      ifu: [
        {
          institution: "X",
          dividends: {
            value: 100, confidence: "high",
            evidence: { sourceDocument: "x.pdf", confidence: "high", evidenceType: "text_excerpt", extractedText: "ok" },
          },
        },
      ],
      scpi: [],
      lifeInsurance: [],
    });
    expect(items).toHaveLength(0);
  });

  it("inclut les evidenceType=document_name_only", () => {
    const items = deriveWeakEvidenceReviewItems({
      ifu: [],
      scpi: [],
      lifeInsurance: [
        {
          contractName: "AV",
          withdrawals: {
            value: 1000, confidence: "low",
            evidence: { sourceDocument: "av.pdf", confidence: "low", evidenceType: "document_name_only" },
          },
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].dedupKey).toBe("weak_evidence:lifeInsurance:0:withdrawals");
  });
});
