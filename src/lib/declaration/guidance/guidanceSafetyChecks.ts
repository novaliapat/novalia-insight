// Garde-fous appliqués à un guide déclaratif AVANT persistance.
// Refuse une guidance qui inventerait une case sans source.
import type {
  DeclarationGuidance,
  TaxBoxProposal,
} from "@/lib/declaration/guidance/guidanceSchemas";

export interface SafetyCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  // Propositions corrigées (dégradées en needs_review si problème)
  sanitized: DeclarationGuidance;
}

export function runGuidanceSafetyChecks(g: DeclarationGuidance): SafetyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sanitizedProposals: TaxBoxProposal[] = g.taxBoxProposals.map((p) => {
    // Règle 1 : aucune case "high" sans source officielle.
    const hasOfficial = p.ragSources.some((s) => s.isOfficialSource);
    if (p.confidence === "high" && !hasOfficial) {
      warnings.push(
        `Case ${p.formId}/${p.boxOrLine} dégradée en "low" : pas de source officielle.`,
      );
      return {
        ...p,
        confidence: "low",
        status: "needs_review",
        requiresManualReview: true,
        blockingReason:
          p.blockingReason ?? "Aucune source officielle disponible pour justifier cette case.",
      };
    }
    // Règle 2 : montant > 0 sans source → manual review forcé.
    if (p.amount != null && p.amount > 0 && p.ragSources.length === 0) {
      warnings.push(
        `Case ${p.formId}/${p.boxOrLine} avec montant mais sans source RAG : revue manuelle imposée.`,
      );
      return {
        ...p,
        confidence: "low",
        requiresManualReview: true,
        blockingReason: p.blockingReason ?? "Montant proposé sans source documentaire.",
      };
    }
    // Règle 3 : la catégorie ne doit pas être déclarée sans détection préalable.
    if (!g.taxpayerSummary.detectedCategories.includes(p.category)) {
      errors.push(
        `Case ${p.formId}/${p.boxOrLine} liée à la catégorie "${p.category}" non détectée chez le contribuable.`,
      );
    }
    return p;
  });

  // Règle 4 : si aucune source officielle pour aucune catégorie → confidence globale "low".
  const totalOfficial = g.requiredForms.reduce(
    (acc, f) => acc + f.sources.filter((s) => s.isOfficialSource).length,
    0,
  );
  let confidence = g.confidence;
  if (totalOfficial === 0) {
    confidence = "low";
    warnings.push("Aucune source officielle dans les formulaires requis : confiance globale ramenée à 'low'.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sanitized: {
      ...g,
      taxBoxProposals: sanitizedProposals,
      confidence,
    },
  };
}
