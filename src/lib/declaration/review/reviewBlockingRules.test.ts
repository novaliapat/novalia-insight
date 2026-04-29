import { describe, it, expect } from "vitest";
import { evaluateReviewBlocking, type ReviewBlockingItem } from "./reviewBlockingRules";

const item = (
  status: ReviewBlockingItem["status"],
  severity: ReviewBlockingItem["severity"],
): ReviewBlockingItem => ({ status, severity });

describe("evaluateReviewBlocking", () => {
  it("no_review_needed + extraction_completed → none", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "no_review_needed",
      extractionStatus: "extraction_completed",
      items: [],
    });
    expect(r.level).toBe("none");
    expect(r.canContinue).toBe(true);
  });

  it("review_completed + extraction_completed → none", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_completed",
      extractionStatus: "extraction_completed",
      items: [item("resolved", "warning"), item("resolved", "info")],
    });
    expect(r.level).toBe("none");
    expect(r.canContinue).toBe(true);
  });

  it("review_partially_ignored sans error → warning", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_partially_ignored",
      extractionStatus: "extraction_completed",
      items: [item("ignored", "warning"), item("resolved", "info")],
    });
    expect(r.level).toBe("warning");
    expect(r.canContinue).toBe(true);
    expect(r.counts.ignored).toBe(1);
  });

  it("review_pending avec pending warning → confirmation_required", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_pending",
      extractionStatus: "extraction_completed",
      items: [item("pending", "warning")],
    });
    expect(r.level).toBe("confirmation_required");
    expect(r.canContinue).toBe(true);
    expect(r.counts.pendingWarning).toBe(1);
  });

  it("review_pending avec pending error → blocked", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_pending",
      extractionStatus: "extraction_completed",
      items: [item("pending", "error"), item("pending", "warning")],
    });
    expect(r.level).toBe("blocked");
    expect(r.canContinue).toBe(false);
    expect(r.counts.pendingError).toBe(1);
  });

  it("extraction_failed → blocked même sans items", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "no_review_needed",
      extractionStatus: "extraction_failed",
      items: [],
    });
    expect(r.level).toBe("blocked");
    expect(r.canContinue).toBe(false);
  });

  it("extraction_needs_review sans aucun item → blocked", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "no_review_needed",
      extractionStatus: "extraction_needs_review",
      items: [],
    });
    expect(r.level).toBe("blocked");
    expect(r.canContinue).toBe(false);
  });

  it("extraction_needs_review avec items traités → pas blocked sur ce critère", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_completed",
      extractionStatus: "extraction_needs_review",
      items: [item("resolved", "warning")],
    });
    // Pas de pending error, items présents → pas blocked sur ce critère
    expect(r.level).not.toBe("blocked");
  });

  it("extraction_completed_with_warnings sans pending → warning", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "no_review_needed",
      extractionStatus: "extraction_completed_with_warnings",
      items: [],
    });
    expect(r.level).toBe("warning");
    expect(r.canContinue).toBe(true);
  });

  it("priorité : pending error l'emporte sur pending warning", () => {
    const r = evaluateReviewBlocking({
      reviewStatus: "review_pending",
      extractionStatus: "extraction_completed",
      items: [
        item("pending", "warning"),
        item("pending", "error"),
        item("ignored", "info"),
      ],
    });
    expect(r.level).toBe("blocked");
  });
});
