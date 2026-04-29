import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FiscalAnalysisSchema, type FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";

type Status = "idle" | "loading" | "success" | "error";

interface AnalyzeOptions {
  declarationId: string;
  dryRun?: boolean;
}

/**
 * Hook d'analyse fiscale réelle (Lot 4).
 * Appelle l'edge function `analyze-tax-declaration` qui fait la recherche RAG
 * SÉPARÉE par catégorie puis génère l'analyse via Lovable AI.
 */
export function useFiscalAnalysis() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FiscalAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [ragByCategory, setRagByCategory] = useState<Record<string, unknown> | null>(null);

  const analyze = async (
    _validatedData: ExtractedData,
    opts: AnalyzeOptions,
  ): Promise<FiscalAnalysis | null> => {
    setStatus("loading");
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "analyze-tax-declaration",
        { body: { declarationId: opts.declarationId, dryRun: opts.dryRun ?? false } },
      );
      if (fnErr) throw fnErr;
      if (!data) throw new Error("Réponse vide de l'analyse fiscale");
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);

      const parsed = FiscalAnalysisSchema.parse((data as { analysis: unknown }).analysis);
      setAnalysis(parsed);
      setAnalysisStatus((data as { analysisStatus?: string }).analysisStatus ?? null);
      setRagByCategory((data as { ragByCategory?: Record<string, unknown> }).ragByCategory ?? null);
      setStatus("success");
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setStatus("error");
      return null;
    }
  };

  return { status, error, analysis, analysisStatus, ragByCategory, analyze };
}
