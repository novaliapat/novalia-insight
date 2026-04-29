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

export type ExtractionErrorCode =
  | "NO_TOOL_CALL"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "UNPARSABLE"
  | "HTTP_ERROR"
  | "ZOD_INVALID"
  | "EMPTY_FILES";

function userFriendlyMessage(code: ExtractionErrorCode | null, fallback: string): string {
  switch (code) {
    case "NO_TOOL_CALL":
    case "PROVIDER_UNAVAILABLE":
    case "NETWORK":
    case "TIMEOUT":
      return "Le modèle n’a pas retourné de résultat structuré. Vous pouvez relancer l’extraction.";
    case "RATE_LIMITED":
      return "Trop de demandes en peu de temps. Patientez quelques secondes puis relancez.";
    case "PAYMENT_REQUIRED":
      return "Crédits IA épuisés. Ajoutez des crédits dans votre espace Lovable.";
    case "ZOD_INVALID":
      return "La réponse du modèle n’a pas pu être validée. Vous pouvez relancer l’extraction.";
    default:
      return fallback;
  }
}

/**
 * Hook d'extraction. La source de vérité (audit + status) vient de l'edge
 * function et est validée par `ExtractTaxDataResponseSchema` (contrat unique
 * partagé front/edge via _shared/contracts/).
 */
export function useDeclarationExtraction() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ExtractionErrorCode | null>(null);
  const [retryable, setRetryable] = useState<boolean>(false);
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
    setErrorCode(null);
    setRetryable(false);
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
        let code: ExtractionErrorCode | null = null;
        let isRetryable = false;
        try {
          const ctx = (invokeErr as unknown as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
            if (typeof body?.code === "string") code = body.code as ExtractionErrorCode;
            if (typeof body?.retryable === "boolean") isRetryable = body.retryable;
            if (body?.details) {
              console.error("[useDeclarationExtraction] details:", body.details);
            }
          }
        } catch {
          // ignore
        }
        const friendly = userFriendlyMessage(code, msg);
        setErrorCode(code);
        setRetryable(isRetryable);
        throw new Error(friendly);
      }
      if (resp && typeof resp === "object" && "error" in resp && resp.error) {
        const r = resp as { error: string; code?: string; retryable?: boolean };
        const code = (r.code as ExtractionErrorCode | undefined) ?? null;
        setErrorCode(code);
        setRetryable(Boolean(r.retryable));
        throw new Error(userFriendlyMessage(code, String(r.error)));
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
    setErrorCode(null);
    setRetryable(false);
    setData(null);
    setMetadata(null);
    setAudit(null);
    setExtractionStatus(null);
  };

  return {
    status,
    error,
    errorCode,
    retryable,
    data,
    metadata,
    audit,
    extractionStatus,
    extract,
    reset,
  };
}
