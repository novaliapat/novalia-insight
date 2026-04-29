import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ExtractTaxDataResponseSchema,
  type ExtractedData,
  type ExtractionMetadata,
  type ExtractionAudit,
  type ExtractionStatus,
} from "@/lib/declaration/contracts";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Hook d'extraction. La source de vérité (audit + status) vient de l'edge
 * function et est validée par `ExtractTaxDataResponseSchema` (contrat unique
 * partagé front/edge via _shared/contracts/).
 */
export function useDeclarationExtraction() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [metadata, setMetadata] = useState<ExtractionMetadata | null>(null);
  const [audit, setAudit] = useState<ExtractionAudit | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus | null>(null);

  const extract = async (
    declarationId: string,
    options?: { dryRun?: boolean; debug?: boolean },
  ): Promise<ExtractedData | null> => {
    setStatus("loading");
    setError(null);
    try {
      const { data: resp, error: invokeErr } = await supabase.functions.invoke(
        "extract-tax-data",
        {
          body: {
            declarationId,
            dryRun: options?.dryRun ?? false,
            debug: options?.debug ?? false,
          },
        },
      );
      if (invokeErr) {
        let msg = invokeErr.message;
        try {
          const ctx = (invokeErr as unknown as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) {
              msg = body.error;
              if (body.details) {
                console.error("[useDeclarationExtraction] details:", body.details);
                if (typeof body.details === "object" && body.details !== null) {
                  const d = body.details as Record<string, unknown>;
                  if (d.zodErrors) msg += ` — ${JSON.stringify(d.zodErrors)}`;
                }
              }
            }
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      if (resp && typeof resp === "object" && "error" in resp && resp.error) {
        throw new Error(String(resp.error));
      }
      const parsed = ExtractTaxDataResponseSchema.parse(resp);
      setData(parsed.data);
      setMetadata(parsed.metadata);
      setAudit(parsed.audit);
      setExtractionStatus(parsed.status);
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
    setAudit(null);
    setExtractionStatus(null);
  };

  return { status, error, data, metadata, audit, extractionStatus, extract, reset };
}
