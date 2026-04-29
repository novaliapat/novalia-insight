// Miroir front — DOIT rester identique à
// supabase/functions/_shared/review/computeReviewStatus.ts
export type ReviewItemStatus = "pending" | "resolved" | "ignored";
export type DeclarationReviewStatus =
  | "no_review_needed"
  | "review_pending"
  | "review_completed"
  | "review_partially_ignored";

export const ReviewStatusLabel: Record<DeclarationReviewStatus, string> = {
  no_review_needed: "Aucune revue nécessaire",
  review_pending: "Revue à traiter",
  review_completed: "Revue terminée",
  review_partially_ignored: "Revue terminée avec points ignorés",
};

export function computeReviewStatusFromItems(
  statuses: ReviewItemStatus[],
): DeclarationReviewStatus {
  if (statuses.length === 0) return "no_review_needed";
  const hasPending = statuses.some((s) => s === "pending");
  if (hasPending) return "review_pending";
  const hasIgnored = statuses.some((s) => s === "ignored");
  const allResolved = statuses.every((s) => s === "resolved");
  if (allResolved) return "review_completed";
  if (hasIgnored) return "review_partially_ignored";
  return "review_completed";
}
