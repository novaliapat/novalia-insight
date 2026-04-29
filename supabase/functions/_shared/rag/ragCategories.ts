// Mirror of src/lib/rag/ragCategories.ts (categories list only).
// SOURCE OF TRUTH for the list of supported RAG categories.
export const RAG_CATEGORIES = [
  "ifu",
  "scpi",
  "life_insurance",
  "real_estate_income",
  "dividends",
  "interests",
  "capital_gains",
  "foreign_accounts",
  "per",
  "tax_credits",
  "deductible_expenses",
  "other",
] as const;

export type RagCategory = typeof RAG_CATEGORIES[number];

export const isRagCategory = (v: unknown): v is RagCategory =>
  typeof v === "string" && (RAG_CATEGORIES as readonly string[]).includes(v);
