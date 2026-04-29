// Recherche RAG multi-catégories : UNE recherche par catégorie détectée.
// Garantit que les bibliothèques restent strictement cloisonnées.
import type { TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";
import type { ExtractedData } from "@/lib/declaration/contracts/extractedDataContract";
import { searchRagCategory, type RagSearchResponse } from "./ragClient";

export interface RagMultiSearchInput {
  declarationId?: string | null;
  extractedData: Pick<ExtractedData, "detectedCategories">;
  taxYear?: number | null;
  /** override optionnel pour fabriquer la query par catégorie */
  buildQuery?: (cat: TaxCategory) => string;
}

export type RagMultiSearchResult = Record<TaxCategory, RagSearchResponse>;

const DEFAULT_QUERIES: Partial<Record<TaxCategory, string>> = {
  ifu: "IFU dividendes intérêts PFU abattement crédit d'impôt",
  scpi: "SCPI revenus fonciers déclaration 2044 2047",
  life_insurance: "assurance-vie rachat abattement 8 ans PFL PFU",
  per: "PER déduction plafond épargne retraite",
  capital_gains: "plus-values mobilières immobilières abattement durée détention",
  foreign_accounts: "comptes étrangers déclaration 3916 3916bis",
  real_estate_income: "revenus fonciers micro-foncier régime réel 2044",
  tax_credits: "crédits réductions impôt dons emploi service",
  deductible_expenses: "charges déductibles pension alimentaire frais réels",
  dividends: "dividendes éligibles abattement 40%",
  interests: "intérêts placements revenu fixe imposition",
  other: "déclaration de revenus cas particuliers",
};

const buildDefaultQuery = (cat: TaxCategory): string =>
  DEFAULT_QUERIES[cat] ?? `règles fiscales ${cat}`;

export async function searchRagForDetectedCategories(
  input: RagMultiSearchInput,
): Promise<Partial<RagMultiSearchResult>> {
  const cats = Array.from(new Set(input.extractedData.detectedCategories ?? []));
  if (cats.length === 0) return {};

  const buildQuery = input.buildQuery ?? buildDefaultQuery;

  const entries = await Promise.all(
    cats.map(async (cat) => {
      const res = await searchRagCategory({
        declarationId: input.declarationId ?? null,
        category: cat,
        query: buildQuery(cat),
        taxYear: input.taxYear ?? null,
      });
      // Garde-fou côté front : on filtre tout résultat dont la catégorie
      // ne correspondrait pas à la catégorie demandée (défense en profondeur).
      const safeSources = res.sources.filter((s) => res.category === cat);
      return [cat, { ...res, sources: safeSources }] as const;
    }),
  );

  const out: Partial<RagMultiSearchResult> = {};
  for (const [cat, res] of entries) out[cat] = res;
  return out;
}
