// Priorité documentaire des sources RAG.
// 1. official_fetch vérifié  → poids 1.0
// 2. official_brochure       → poids 0.9
// 3. manual_seed synthétique → poids 0.7
// 4. autres / privées        → poids 0.4
import type { SourceProvenance } from "@/lib/declaration/guidance/guidanceSchemas";

export type ExtendedProvenance = SourceProvenance | "official_brochure" | "official_fetch";

export const PROVENANCE_WEIGHT: Record<string, number> = {
  verified: 1.0,
  official_fetch: 1.0,
  official_brochure: 0.9,
  manual_seed: 0.7,
  deprecated: 0.1,
};

export function provenanceWeight(p: string | undefined | null): number {
  if (!p) return 0.4;
  return PROVENANCE_WEIGHT[p] ?? 0.4;
}

/** Compare deux sources : true si `a` est strictement plus prioritaire que `b`. */
export function isHigherPriority(aProv: string, bProv: string): boolean {
  return provenanceWeight(aProv) > provenanceWeight(bProv);
}
