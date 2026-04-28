/**
 * Sources RAG mockées pour le développement.
 * Organisées par catégorie — JAMAIS mélangées entre catégories.
 */
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import type { RagSource } from "./ragSchemas";

type MockLibrary = Record<TaxCategory, RagSource[]>;

export const MOCK_RAG_SOURCES: MockLibrary = {
  ifu: [
    {
      category: "ifu",
      documentTitle: "BOFIP — Dividendes & PFU",
      reference: "BOI-RPPM-RCM-20-10-20-50",
      excerpt: "Les dividendes ouvrent droit à un abattement de 40% en cas d'option pour le barème.",
      relevanceScore: 0.92,
    },
    {
      category: "ifu",
      documentTitle: "Notice 2042",
      reference: "Notice 2042 §2CK",
      excerpt: "Le crédit d'impôt 2CK correspond au PFU déjà prélevé à la source.",
      relevanceScore: 0.88,
    },
  ],
  scpi: [
    {
      category: "scpi",
      documentTitle: "BOFIP — Revenus fonciers SCPI",
      reference: "BOI-RFPI-CHAMP-30",
      excerpt: "Les revenus fonciers de SCPI françaises se déclarent au régime réel sur la 2044.",
      relevanceScore: 0.9,
    },
    {
      category: "scpi",
      documentTitle: "Convention fiscale France-Allemagne",
      reference: "Art. 3 — Revenus immobiliers",
      relevanceScore: 0.74,
    },
  ],
  life_insurance: [
    {
      category: "life_insurance",
      documentTitle: "BOFIP — Assurance-vie > 8 ans",
      reference: "BOI-RPPM-RCM-20-10-20-30",
      excerpt: "Abattement annuel de 4 600 € (9 200 € pour un couple) sur les produits.",
      relevanceScore: 0.86,
    },
  ],
  real_estate_income: [],
  dividends: [],
  interests: [],
  capital_gains: [],
  foreign_accounts: [],
  per: [],
  tax_credits: [],
  deductible_expenses: [],
  other: [],
};
