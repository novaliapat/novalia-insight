import { useState } from "react";
import { ExtractedDataSchema, type ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import { MOCK_EXTRACTED } from "@/lib/declaration/utils/mockData";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Hook d'extraction des données fiscales.
 * V1 : retourne des données mockées après un délai.
 * V2 : appellera l'edge function `extract-tax-data`.
 */
export function useDeclarationExtraction() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedData | null>(null);

  const extract = async (_files: File[]): Promise<ExtractedData | null> => {
    setStatus("loading");
    setError(null);
    try {
      // --- MOCK ---
      await new Promise((r) => setTimeout(r, 1500));
      const parsed = ExtractedDataSchema.parse(MOCK_EXTRACTED);

      // --- À brancher en V2 ---
      // const { data, error } = await supabase.functions.invoke("extract-tax-data", {
      //   body: { fileIds: [...] },
      // });
      // if (error) throw error;
      // const parsed = ExtractedDataSchema.parse(data);

      setData(parsed);
      setStatus("success");
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setStatus("error");
      return null;
    }
  };

  return { status, error, data, extract };
}
