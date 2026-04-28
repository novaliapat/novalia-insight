/**
 * Catégories RAG — chaque catégorie fiscale a sa propre bibliothèque.
 * La recherche RAG est TOUJOURS faite par catégorie séparée.
 */
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";

export interface RagLibraryDescriptor {
  category: TaxCategory;
  label: string;
  /** Slug technique de la table/index pgvector V2 */
  slug: string;
  description: string;
}

export const RAG_LIBRARIES: Record<TaxCategory, RagLibraryDescriptor> = {
  ifu: {
    category: "ifu",
    label: "IFU — Imprimé Fiscal Unique",
    slug: "rag_library_ifu",
    description: "BOFIP, notices 2042, doctrine sur dividendes / intérêts / PFU.",
  },
  scpi: {
    category: "scpi",
    label: "SCPI",
    slug: "rag_library_scpi",
    description: "Régime des revenus fonciers SCPI, France et étranger, 2044 / 2047.",
  },
  life_insurance: {
    category: "life_insurance",
    label: "Assurance-vie",
    slug: "rag_library_life_insurance",
    description: "Fiscalité des rachats, abattements > 8 ans, PFL/PFU.",
  },
  real_estate_income: {
    category: "real_estate_income",
    label: "Revenus fonciers",
    slug: "rag_library_real_estate",
    description: "Régime micro-foncier vs réel, 2044.",
  },
  dividends: {
    category: "dividends",
    label: "Dividendes",
    slug: "rag_library_dividends",
    description: "Dividendes éligibles à l'abattement 40%.",
  },
  interests: {
    category: "interests",
    label: "Intérêts",
    slug: "rag_library_interests",
    description: "Intérêts de placements à revenu fixe.",
  },
  capital_gains: {
    category: "capital_gains",
    label: "Plus-values",
    slug: "rag_library_capital_gains",
    description: "Plus-values mobilières et immobilières.",
  },
  foreign_accounts: {
    category: "foreign_accounts",
    label: "Comptes étrangers",
    slug: "rag_library_foreign_accounts",
    description: "Déclaration des comptes détenus à l'étranger (3916).",
  },
  per: {
    category: "per",
    label: "PER",
    slug: "rag_library_per",
    description: "Plan Épargne Retraite — déductions et plafonds.",
  },
  tax_credits: {
    category: "tax_credits",
    label: "Crédits d'impôt",
    slug: "rag_library_tax_credits",
    description: "Crédits et réductions d'impôt usuels.",
  },
  deductible_expenses: {
    category: "deductible_expenses",
    label: "Charges déductibles",
    slug: "rag_library_deductible_expenses",
    description: "Pensions alimentaires, frais réels, etc.",
  },
  other: {
    category: "other",
    label: "Autres",
    slug: "rag_library_other",
    description: "Cas particuliers non classés.",
  },
};

export const getRagLibrary = (cat: TaxCategory): RagLibraryDescriptor =>
  RAG_LIBRARIES[cat];
