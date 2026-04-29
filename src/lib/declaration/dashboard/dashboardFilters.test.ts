import { describe, it, expect } from "vitest";
import {
  applyFilter,
  computeDashboardCounts,
  priorityScore,
  sortByPriority,
} from "./dashboardFilters";
import type { DeclarationWithExtraction } from "@/hooks/useDeclarationHistory";

function make(over: Partial<DeclarationWithExtraction>): DeclarationWithExtraction {
  return {
    id: over.id ?? "id",
    user_id: "u",
    title: "t",
    status: "draft",
    tax_year: 2024,
    created_at: "2026-04-29T10:00:00.000Z",
    updated_at: "2026-04-29T10:00:00.000Z",
    extraction_status: null,
    detected_categories: [],
    review_status: null,
    review_pending_count: 0,
    review_total_count: 0,
    has_pending_error: false,
    ...over,
  } as DeclarationWithExtraction;
}

describe("dashboardFilters", () => {
  const a = make({ id: "a", extraction_status: "extraction_failed" });
  const b = make({ id: "b", extraction_status: "extraction_needs_review" });
  const c = make({
    id: "c",
    extraction_status: "extraction_completed",
    review_status: "review_pending",
    review_pending_count: 2,
    has_pending_error: true,
  });
  const d = make({ id: "d", extraction_status: "extraction_completed_with_warnings" });
  const e = make({
    id: "e",
    extraction_status: "extraction_completed",
    review_status: "review_pending",
    review_pending_count: 1,
  });
  const f = make({
    id: "f",
    extraction_status: "extraction_completed",
    review_status: "review_completed",
  });
  const g = make({ id: "g", extraction_status: "extraction_completed" });

  const all = [a, b, c, d, e, f, g];

  it("applyFilter('to_process') regroupe les bons cas", () => {
    const ids = applyFilter(all, "to_process").map((x) => x.id).sort();
    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("applyFilter('review_completed')", () => {
    expect(applyFilter(all, "review_completed").map((x) => x.id)).toEqual(["f"]);
  });

  it("applyFilter('extraction_failed')", () => {
    expect(applyFilter(all, "extraction_failed").map((x) => x.id)).toEqual(["a"]);
  });

  it("applyFilter('extraction_with_warnings') inclut warnings + needs_review", () => {
    expect(applyFilter(all, "extraction_with_warnings").map((x) => x.id).sort()).toEqual(["b", "d"]);
  });

  it("priorityScore respecte l'ordre attendu", () => {
    expect(priorityScore(a)).toBe(1);
    expect(priorityScore(b)).toBe(2);
    expect(priorityScore(c)).toBe(3);
    expect(priorityScore(d)).toBe(4);
    expect(priorityScore(e)).toBe(5);
    expect(priorityScore(g)).toBe(99);
  });

  it("sortByPriority trie failed → needs_review → pending error → warnings → pending simple", () => {
    const sorted = sortByPriority([e, d, c, b, a]).map((x) => x.id);
    expect(sorted).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("computeDashboardCounts compte correctement", () => {
    const counts = computeDashboardCounts(all);
    expect(counts.total).toBe(7);
    expect(counts.toProcess).toBe(5);
    expect(counts.reviewCompleted).toBe(1);
    expect(counts.extractionFailed).toBe(1);
  });
});
