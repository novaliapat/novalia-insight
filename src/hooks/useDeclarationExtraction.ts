import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ExtractionResultSchema,
  type ExtractedData,
  type ExtractionMetadata,
} from "@/lib/declaration/schemas/extractedDataSchema";
import { z } from "zod";
import type { ExtractionAudit } from "@/lib/declaration/audit/extractionAudit";
import type { ExtractionStatus } from "@/lib/declaration/status/extractionStatus";

type Status = "idle" | "loading" | "success" | "error";

const ExtractionStatusSchema = z.enum([
  "extraction_not_started",
  "extraction_processing",
  "extraction_completed",
  "extraction_completed_with_warnings",
  "extraction_failed",
  "extraction_needs_review",
]);

// Audit/status optionnels pour rester rétrocompatible avec d'anciennes réponses.
const ExtendedResultSchema = ExtractionResultSchema.extend({
  audit: z.unknown().optional(),
  status: ExtractionStatusSchema.optional(),
});

/**
 * Hook d'extraction. La source de vérité (audit + status) vient désormais
 * de l'edge function. Le front les expose tels quels.
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
      const parsed = ExtendedResultSchema.parse(resp);
      setData(parsed.data);
      setMetadata(parsed.metadata);
      setAudit((parsed.audit as ExtractionAudit | undefined) ?? null);
      setExtractionStatus(parsed.status ?? null);
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
