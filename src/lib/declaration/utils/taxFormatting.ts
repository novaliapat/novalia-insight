import type { TaxCategory } from "../schemas/extractedDataSchema";

export const formatEuro = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDateFr = (iso: string): string => {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const TaxCategoryLabel: Record<TaxCategory, string> = {
  ifu: "IFU — Imprimé Fiscal Unique",
  scpi: "SCPI",
  life_insurance: "Assurance-vie",
  real_estate_income: "Revenus fonciers",
  dividends: "Dividendes",
  interests: "Intérêts",
  capital_gains: "Plus-values",
  foreign_accounts: "Comptes étrangers",
  per: "PER — Plan Épargne Retraite",
  tax_credits: "Crédits d'impôt",
  deductible_expenses: "Charges déductibles",
  other: "Autres",
};

export const ConfidenceLabel = {
  high: "Élevée",
  medium: "Moyenne",
  low: "Faible",
} as const;
