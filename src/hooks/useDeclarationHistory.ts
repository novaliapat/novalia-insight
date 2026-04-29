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
  /** Nombre de points de revue pending. */
  review_pending_count: number;
  /** Nombre total de points de revue. */
  review_total_count: number;
  /** Au moins un point de revue pending de sévérité 'error'. */
  has_pending_error: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reviewTable = () => (supabase as any).from("declaration_review_items");

export function useDeclarationHistory() {
  const [declarations, setDeclarations] = useState<DeclarationWithExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: decls, error: declErr }, { data: extracts, error: exErr }, reviewRes] =
      await Promise.all([
        supabase
          .from("declarations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("declaration_extracted_data")
          .select("declaration_id, extraction_status, detected_categories"),
        reviewTable().select("declaration_id, status, severity"),
      ]);

    if (declErr || exErr || reviewRes?.error) {
      setError((declErr ?? exErr ?? reviewRes?.error)?.message ?? "Erreur");
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

    type ReviewRow = { declaration_id: string; status: string; severity: string };
    const reviewByDecl = new Map<string, { pending: number; total: number; pendingError: boolean }>();
    for (const r of (reviewRes?.data ?? []) as ReviewRow[]) {
      const cur = reviewByDecl.get(r.declaration_id) ?? { pending: 0, total: 0, pendingError: false };
      cur.total += 1;
      if (r.status === "pending") {
        cur.pending += 1;
        if (r.severity === "error") cur.pendingError = true;
      }
      reviewByDecl.set(r.declaration_id, cur);
    }

    const enriched: DeclarationWithExtraction[] = (decls ?? []).map((d) => {
      const ex = byId.get(d.id);
      const raw = ex?.extraction_status;
      const parsed = raw ? ExtractionStatusEnum.safeParse(raw) : null;
      const reviewStatus = (d as unknown as { review_status?: string | null })?.review_status ?? null;
      const rv = reviewByDecl.get(d.id) ?? { pending: 0, total: 0, pendingError: false };
      return {
        ...(d as Declaration),
        extraction_status: parsed?.success ? parsed.data : null,
        detected_categories: ex?.detected_categories ?? [],
        review_status: reviewStatus,
        review_pending_count: rv.pending,
        review_total_count: rv.total,
        has_pending_error: rv.pendingError,
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
