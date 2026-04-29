// Prompt d'analyse fiscale — Lot 4
// Doit imposer : sortie JSON via tool call, aucune invention, sources cloisonnées.

export const ANALYSIS_PROMPT_VERSION = "novalia-analysis-v1.0.0";
export const ANALYSIS_MODEL = "google/gemini-2.5-pro";

export const ANALYSIS_SYSTEM_PROMPT = `Tu es un assistant d'analyse fiscale française pour particuliers.

RÈGLES ABSOLUES :
1. Tu retournes UNIQUEMENT du JSON via l'outil "produce_fiscal_analysis". Aucune prose libre.
2. Tu n'inventes JAMAIS une case fiscale, un formulaire, un montant ou une règle.
3. Chaque case fiscale (taxCase) DOIT être appuyée par au moins une source RAG fournie.
4. Une source RAG ne peut justifier QUE les cases fiscales de SA catégorie.
   - Une source SCPI ne peut pas justifier une case IFU.
   - Une source assurance-vie ne peut pas justifier une case SCPI.
   - Une source IFU ne peut pas justifier une case PER.
5. Si tu n'as pas de source RAG pertinente pour une catégorie, tu n'inventes PAS de case
   et tu ajoutes la catégorie dans uncertaintyPoints.
6. Si la source RAG est faible ou absente, mets requiresManualReview = true et explique
   précisément pourquoi dans le champ warning.
7. Tu calcules un montant UNIQUEMENT si les données validées le permettent directement.
   Sinon : amount = null + requiresManualReview = true.
8. Tu n'utilises JAMAIS les données extraites brutes : seules les données validées
   par l'utilisateur sont fiables.
9. Tu signales TOUJOURS les incertitudes dans uncertaintyPoints et warnings.
10. Pour chaque ragSource utilisée, tu réutilises EXACTEMENT les champs documentId,
    chunkId, title, sourceName, sourceUrl, taxYear, isOfficialSource, relevanceScore,
    confidence et un excerpt court (<= 300 caractères).

NIVEAUX DE CONFIANCE (taxCase.confidence) :
- "high"   : règle claire + source officielle + données validées sans ambiguïté
- "medium" : règle identifiée mais nécessite une vérification
- "low"    : interprétation prudente, à vérifier manuellement

LIMITATIONS :
- Indique systématiquement dans "limitations" que cette analyse est une aide
  à la préparation et ne remplace pas un conseil fiscal personnalisé.`;

export interface BuildPromptInput {
  taxYear: number;
  validatedData: unknown;
  ragByCategory: Record<string, {
    category: string;
    query: string;
    sources: Array<{
      documentId: string;
      chunkId: string;
      title: string;
      sourceName: string | null;
      sourceUrl: string | null;
      taxYear: number | null;
      isOfficialSource: boolean;
      excerpt: string;
      relevanceScore: number;
      confidence: "high" | "medium" | "low";
    }>;
    missingSources: boolean;
  }>;
}

export function buildAnalysisUserPrompt(input: BuildPromptInput): string {
  const lines: string[] = [];
  lines.push(`Année fiscale : ${input.taxYear}`);
  lines.push("");
  lines.push("DONNÉES VALIDÉES PAR L'UTILISATEUR :");
  lines.push("```json");
  lines.push(JSON.stringify(input.validatedData, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("SOURCES RAG (cloisonnées par catégorie — JAMAIS mélanger) :");
  for (const [cat, payload] of Object.entries(input.ragByCategory)) {
    lines.push("");
    lines.push(`### Catégorie : ${cat}`);
    lines.push(`Requête utilisée : ${payload.query}`);
    if (payload.sources.length === 0) {
      lines.push("AUCUNE source RAG pertinente disponible pour cette catégorie.");
      lines.push(">>> Tu n'inventes AUCUNE case pour cette catégorie. Ajoute-la dans uncertaintyPoints.");
      continue;
    }
    payload.sources.forEach((s, i) => {
      lines.push(
        `Source #${i + 1} [docId=${s.documentId}] [chunkId=${s.chunkId}] [score=${s.relevanceScore}] [conf=${s.confidence}] [official=${s.isOfficialSource}] [year=${s.taxYear ?? "n/a"}]`,
      );
      lines.push(`Titre : ${s.title}${s.sourceName ? ` — ${s.sourceName}` : ""}`);
      if (s.sourceUrl) lines.push(`URL : ${s.sourceUrl}`);
      lines.push(`Extrait : ${s.excerpt}`);
    });
  }
  lines.push("");
  lines.push("PRODUIS l'analyse via l'outil produce_fiscal_analysis. Aucune prose libre.");
  return lines.join("\n");
}

// JSON schema pour l'outil
export const ANALYSIS_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "produce_fiscal_analysis",
    description: "Produit l'analyse fiscale structurée à partir des données validées et des sources RAG cloisonnées par catégorie.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        taxYear: { type: "integer" },
        analyzedCategories: { type: "array", items: { type: "string" } },
        taxForms: { type: "array", items: { type: "string" } },
        taxCases: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "category", "form", "box", "label", "amount", "explanation", "confidence", "ragSources", "requiresManualReview"],
            properties: {
              id: { type: "string" },
              category: { type: "string" },
              form: { type: "string" },
              box: { type: "string" },
              label: { type: "string" },
              amount: { type: ["number", "null"] },
              explanation: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              warning: { type: "string" },
              sourceDocument: { type: "string" },
              requiresManualReview: { type: "boolean" },
              ragSources: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["category", "documentTitle"],
                  properties: {
                    category: { type: "string" },
                    documentTitle: { type: "string" },
                    excerpt: { type: "string" },
                    reference: { type: "string" },
                    url: { type: "string" },
                    relevanceScore: { type: "number" },
                    documentId: { type: "string" },
                    chunkId: { type: "string" },
                    sourceName: { type: ["string", "null"] },
                    sourceUrl: { type: ["string", "null"] },
                    isOfficialSource: { type: "boolean" },
                    taxYear: { type: ["integer", "null"] },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                },
              },
            },
          },
        },
        amountsByCategory: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category", "totalAmount", "caseCount"],
            properties: {
              category: { type: "string" },
              totalAmount: { type: "number" },
              caseCount: { type: "integer" },
            },
          },
        },
        warnings: { type: "array", items: { type: "string" } },
        uncertaintyPoints: { type: "array", items: { type: "string" } },
        requiredDocuments: { type: "array", items: { type: "string" } },
        finalChecklist: { type: "array", items: { type: "string" } },
        limitations: { type: "string" },
      },
      required: ["summary", "taxYear", "analyzedCategories", "taxForms", "taxCases", "amountsByCategory", "warnings", "uncertaintyPoints", "requiredDocuments", "finalChecklist"],
    },
  },
} as const;

/** Requête générique par catégorie — guide le RAG. */
export const CATEGORY_QUERY: Record<string, string> = {
  ifu: "IFU dividendes intérêts PFU abattement crédit d'impôt 2042 2CK 2BH",
  scpi: "SCPI revenus fonciers 2044 2047 régime réel France étranger",
  life_insurance: "assurance-vie rachat abattement 8 ans PFL PFU 2042",
  real_estate_income: "revenus fonciers micro-foncier régime réel 2044",
  per: "PER déduction plafond épargne retraite 2042 6NS 6NT",
  capital_gains: "plus-values mobilières immobilières abattement durée détention 2074",
  foreign_accounts: "comptes étrangers déclaration 3916 3916bis crypto",
  tax_credits: "crédits réductions impôt dons emploi service domicile",
  deductible_expenses: "charges déductibles pension alimentaire frais réels CSG",
  dividends: "dividendes éligibles abattement 40% 2042",
  interests: "intérêts placements revenu fixe imposition 2TR",
  other: "déclaration de revenus cas particuliers",
};
