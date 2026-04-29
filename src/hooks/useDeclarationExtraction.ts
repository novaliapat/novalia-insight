import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ExtractionResultSchema,
  type ExtractedData,
  type ExtractionMetadata,
} from "@/lib/declaration/schemas/extractedDataSchema";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Hook d'extraction des données fiscales.
 * Appelle `extract-tax-data` qui retourne { data, metadata }.
 */
export function useDeclarationExtraction() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [metadata, setMetadata] = useState<ExtractionMetadata | null>(null);

  const extract = async (
    declarationId: string,
    options?: { dryRun?: boolean },
  ): Promise<ExtractedData | null> => {
    setStatus("loading");
    setError(null);
    try {
      const { data: resp, error: invokeErr } = await supabase.functions.invoke(
        "extract-tax-data",
        { body: { declarationId, dryRun: options?.dryRun ?? false } },
      );
      if (invokeErr) {
        let msg = invokeErr.message;
        try {
          const ctx = (invokeErr as unknown as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      if (resp && typeof resp === "object" && "error" in resp && resp.error) {
        throw new Error(String(resp.error));
      }
      const parsed = ExtractionResultSchema.parse(resp);
      setData(parsed.data);
      setMetadata(parsed.metadata);
      setStatus("success");
      return parsed.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setStatus("error");
      return null;
    }
  };

  const reset = () => {
    setStatus("idle");
    setError(null);
    setData(null);
    setMetadata(null);
  };

  return { status, error, data, metadata, extract, reset };
}
