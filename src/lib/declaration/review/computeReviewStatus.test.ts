import { describe, it, expect } from "vitest";
import { computeReviewStatusFromItems } from "./computeReviewStatus";

describe("computeReviewStatusFromItems", () => {
  it("aucun item → no_review_needed", () => {
    expect(computeReviewStatusFromItems([])).toBe("no_review_needed");
  });
  it("au moins un pending → review_pending", () => {
    expect(computeReviewStatusFromItems(["pending", "resolved"])).toBe("review_pending");
    expect(computeReviewStatusFromItems(["pending", "ignored"])).toBe("review_pending");
  });
  it("tous resolved → review_completed", () => {
    expect(computeReviewStatusFromItems(["resolved", "resolved"])).toBe("review_completed");
  });
  it("aucun pending mais au moins un ignored → review_partially_ignored", () => {
    expect(computeReviewStatusFromItems(["resolved", "ignored"])).toBe("review_partially_ignored");
    expect(computeReviewStatusFromItems(["ignored"])).toBe("review_partially_ignored");
  });
});
