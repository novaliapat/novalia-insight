import { useMemo } from "react";
import { useDeclarationReviewItems } from "@/hooks/useDeclarationReviewItems";
import {
  evaluateReviewBlocking,
  type ReviewBlockingResult,
} from "@/lib/declaration/review/reviewBlockingRules";
import type { DeclarationReviewStatus } from "@/lib/declaration/review/computeReviewStatus";
import type { ExtractionStatus } from "@/lib/declaration/contracts/statusContract";

interface Args {
  declarationId: string | null | undefined;
  reviewStatus: DeclarationReviewStatus | null | undefined;
  extractionStatus: ExtractionStatus | null | undefined;
}

export interface UseReviewBlockingState {
  loading: boolean;
  result: ReviewBlockingResult;
  reload: () => void;
}

export function useReviewBlockingState({
  declarationId,
  reviewStatus,
  extractionStatus,
}: Args): UseReviewBlockingState {
  const { items, loading, reload } = useDeclarationReviewItems(declarationId);

  const result = useMemo(
    () =>
      evaluateReviewBlocking({
        reviewStatus,
        extractionStatus,
        items: items.map((it) => ({ status: it.status, severity: it.severity })),
      }),
    [items, reviewStatus, extractionStatus],
  );

  return { loading, result, reload: () => reload() };
}
