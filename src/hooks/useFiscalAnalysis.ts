import { useState } from "react";
import { FiscalAnalysisSchema, type FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import { MOCK_ANALYSIS } from "@/lib/declaration/utils/mockData";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Hook d'analyse fiscale.
 *
 * IMPORTANT — Architecture RAG par catégorie :
 * L'edge function `analyze-tax-declaration` doit, pour chaque catégorie
 * détectée dans `validatedData.detectedCategories`, faire une recherche
 * RAG SÉPARÉE dans la bibliothèque correspondante (IFU / SCPI / AV / ...).
 * Les résultats sont ensuite agrégés mais sans mélanger les sources.
 *
 * V1 : retourne une analyse mockée après un délai.
 */
export function useFiscalAnalysis() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FiscalAnalysis | null>(null);

  const analyze = async (_validatedData: ExtractedData): Promise<FiscalAnalysis | null> => {
    setStatus("loading");
    setError(null);
    try {
      // --- MOCK ---
      await new Promise((r) => setTimeout(r, 2000));
      const parsed = FiscalAnalysisSchema.parse(MOCK_ANALYSIS);

      // --- À brancher en V2 ---
      // const { data, error } = await supabase.functions.invoke("analyze-tax-declaration", {
      //   body: { validatedData },
      // });
      // if (error) throw error;
      // const parsed = FiscalAnalysisSchema.parse(data);

      setAnalysis(parsed);
      setStatus("success");
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setStatus("error");
      return null;
    }
  };

  return { status, error, analysis, analyze };
}
