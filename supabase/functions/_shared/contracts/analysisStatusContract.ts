// Mirror Deno
import { z } from "https://esm.sh/zod@3.23.8";

export const AnalysisStatusEnum = z.enum([
  "analysis_not_started",
  "analysis_processing",
  "analysis_completed",
  "analysis_completed_with_warnings",
  "analysis_needs_review",
  "analysis_failed",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;
