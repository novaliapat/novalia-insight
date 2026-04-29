import { describe, it, expect } from "vitest";
import { deriveReviewItemsFromAudit } from "./deriveReviewItems";

describe("deriveReviewItemsFromAudit", () => {
  it("produit un item par incohérence + warning + donnée manquante", () => {
    const items = deriveReviewItemsFromAudit({
      consistencyIssues: [
        { code: "MISMATCH_TAX_YEAR", severity: "error", message: "Année différente", field: "taxYear" },
      ],
      warnings: ["Document peu lisible"],
      missingData: ["TMI manquant"],
    });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.sourceType).sort()).toEqual([
      "consistency_issue",
      "missing_data",
      "warning",
    ]);
  });

  it("dédoublonne les items ayant la même clé", () => {
    const items = deriveReviewItemsFromAudit({
      consistencyIssues: [],
      warnings: ["Identique", "Identique"],
      missingData: [],
    });
    expect(items).toHaveLength(1);
  });

  it("génère une dedupKey stable pour les incohérences", () => {
    const a = deriveReviewItemsFromAudit({
      consistencyIssues: [
        { code: "C1", severity: "warning", message: "msg", field: "ifu.0.amount" },
      ],
      warnings: [],
      missingData: [],
    });
    const b = deriveReviewItemsFromAudit({
      consistencyIssues: [
        { code: "C1", severity: "warning", message: "msg différent", field: "ifu.0.amount" },
      ],
      warnings: [],
      missingData: [],
    });
    expect(a[0].dedupKey).toBe(b[0].dedupKey);
  });

  it("retourne un tableau vide si aucun signal", () => {
    expect(
      deriveReviewItemsFromAudit({ consistencyIssues: [], warnings: [], missingData: [] })
    ).toEqual([]);
  });
});
