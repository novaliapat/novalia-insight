// Règles de mapping prudentes — données validées + sources RAG → propositions de cases.
// AUCUNE proposition "high confidence" sans source officielle suffisante.
//
// Ce module est volontairement simple : il regarde les catégories détectées et,
// pour chacune, propose les cases du catalogue qui s'y rapportent. Le scoring
// final dépend de la disponibilité d'une source RAG officielle.
import type {
  TaxBoxProposal,
  FormSource,
  CatalogStatus,
} from "@/lib/declaration/guidance/guidanceSchemas";
import type { TaxCategory, ConfidenceLevel } from "@/lib/declaration/contracts/extractedDataContract";
import { BOX_CATALOG_2025, type BoxCatalogEntry } from "@/lib/declaration/forms/2025/boxCatalog";

export interface CategoryRagPayload {
  category: TaxCategory;
  sources: FormSource[];   // sources RAG retrouvées pour la catégorie
  hasOfficial: boolean;    // au moins 1 source officielle
}

export interface BuildProposalsInput {
  detectedCategories: TaxCategory[];
  ragByCategory: Record<string, CategoryRagPayload>;
  // montants par catégorie issus des données VALIDÉES (jamais extraites)
  validatedAmountsByCategory?: Partial<Record<TaxCategory, number | null>>;
}

/**
 * Détermine la confiance et le statut d'une proposition selon :
 * - le statut catalogue de la case
 * - la disponibilité d'une source RAG officielle pour la catégorie
 */
function deriveConfidence(
  entry: BoxCatalogEntry,
  rag: CategoryRagPayload | undefined,
): { confidence: ConfidenceLevel; status: CatalogStatus; requiresManualReview: boolean; blockingReason?: string } {
  if (!rag || rag.sources.length === 0) {
    return {
      confidence: "low",
      status: "needs_review",
      requiresManualReview: true,
      blockingReason: `Aucune source RAG disponible pour la catégorie "${entry.category}".`,
    };
  }
  if (!rag.hasOfficial) {
    return {
      confidence: "low",
      status: "needs_review",
      requiresManualReview: true,
      blockingReason:
        `Aucune source officielle (DGFiP/BOFiP) pour "${entry.category}" — seules des sources non officielles ont été trouvées.`,
    };
  }
  // Source officielle présente → on respecte le statut catalogue
  if (entry.status === "confirmed" && entry.confidence === "high") {
    return { confidence: "high", status: "confirmed", requiresManualReview: false };
  }
  return {
    confidence: entry.confidence === "high" ? "medium" : entry.confidence,
    status: entry.status,
    requiresManualReview: entry.status !== "confirmed",
  };
}

export function buildTaxBoxProposals(input: BuildProposalsInput): TaxBoxProposal[] {
  const proposals: TaxBoxProposal[] = [];
  const seen = new Set<string>();

  for (const cat of input.detectedCategories) {
    const entries = BOX_CATALOG_2025.filter((b) => b.category === cat);
    const rag = input.ragByCategory[cat];
    for (const entry of entries) {
      const key = `${entry.formId}::${entry.boxOrLine}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const conf = deriveConfidence(entry, rag);
      const amount = input.validatedAmountsByCategory?.[cat] ?? null;

      proposals.push({
        formId: entry.formId,
        boxOrLine: entry.boxOrLine,
        label: entry.label,
        amount,
        category: entry.category,
        explanation: entry.description,
        confidence: conf.confidence,
        status: conf.status,
        ragSources: rag?.sources ?? [],
        legalBasisSources: [],   // Lot 1 : Légifrance non branché
        requiresManualReview: conf.requiresManualReview,
        blockingReason: conf.blockingReason,
      });
    }
  }
  return proposals;
}
