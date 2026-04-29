import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Declaration } from "@/lib/declaration/schemas/declarationSchema";
import {
  ExtractionStatusEnum,
  type ExtractionStatus,
} from "@/lib/declaration/contracts/statusContract";

export interface DeclarationWithExtraction extends Declaration {
  /** Statut détaillé de l'extraction si l'étape a été lancée. */
  extraction_status: ExtractionStatus | null;
  detected_categories: string[];
  review_status: string | null;
}

export function useDeclarationHistory() {
  const [declarations, setDeclarations] = useState<DeclarationWithExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: decls, error: declErr }, { data: extracts, error: exErr }] =
      await Promise.all([
        supabase
          .from("declarations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("declaration_extracted_data")
          .select("declaration_id, extraction_status, detected_categories"),
      ]);

    if (declErr || exErr) {
      setError((declErr ?? exErr)?.message ?? "Erreur");
      setDeclarations([]);
      setLoading(false);
      return;
    }

    const byId = new Map<string, { extraction_status: string | null; detected_categories: string[] }>();
    for (const e of extracts ?? []) {
      byId.set(e.declaration_id, {
        extraction_status: e.extraction_status ?? null,
        detected_categories: (e.detected_categories ?? []) as string[],
      });
    }

    const enriched: DeclarationWithExtraction[] = (decls ?? []).map((d) => {
      const ex = byId.get(d.id);
      const raw = ex?.extraction_status;
      const parsed = raw ? ExtractionStatusEnum.safeParse(raw) : null;
      const reviewStatus = (d as unknown as { review_status?: string | null })?.review_status ?? null;
      return {
        ...(d as Declaration),
        extraction_status: parsed?.success ? parsed.data : null,
        detected_categories: ex?.detected_categories ?? [],
        review_status: reviewStatus,
      };
    });
    setDeclarations(enriched);
    setLoading(false);
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("declarations").delete().eq("id", id);
    if (!error) setDeclarations((prev) => prev.filter((d) => d.id !== id));
    return error;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { declarations, loading, error, refresh, remove };
}
