import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReviewItemStatus = "pending" | "resolved" | "ignored";
export type ReviewItemSourceType = "consistency_issue" | "warning" | "missing_data";
export type ReviewItemSeverity = "info" | "warning" | "error";

export interface ReviewItem {
  id: string;
  declaration_id: string;
  audit_log_id: string | null;
  source_type: ReviewItemSourceType;
  source_code: string | null;
  severity: ReviewItemSeverity;
  field: string | null;
  message: string;
  status: ReviewItemStatus;
  note: string | null;
  dedup_key: string;
  created_at: string;
  updated_at: string;
}

interface State {
  items: ReviewItem[];
  loading: boolean;
  error: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reviewTable = () => (supabase as any).from("declaration_review_items");

type EdgeAction = "resolve" | "ignore" | "reopen" | "update_note";

async function callEdge(reviewItemId: string, action: EdgeAction, note?: string | null) {
  const { data, error } = await supabase.functions.invoke("update-review-item", {
    body: { reviewItemId, action, note },
  });
  if (error) throw new Error(error.message);
  return data as {
    ok: boolean;
    reviewItem: { id: string; declaration_id: string; status: ReviewItemStatus; note: string | null };
    declarationReviewStatus: string;
  };
}

export function useDeclarationReviewItems(declarationId: string | null | undefined) {
  const [state, setState] = useState<State>({ items: [], loading: false, error: null });

  const load = useCallback(async (id: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await reviewTable()
      .select("*")
      .eq("declaration_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      setState({ items: [], loading: false, error: error.message });
      return;
    }
    setState({ items: (data ?? []) as ReviewItem[], loading: false, error: null });
  }, []);

  useEffect(() => {
    if (declarationId) void load(declarationId);
  }, [declarationId, load]);

  const updateStatus = useCallback(
    async (item: ReviewItem, action: "resolve" | "ignore" | "reopen") => {
      const res = await callEdge(item.id, action);
      setState((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.id === item.id ? { ...it, status: res.reviewItem.status } : it,
        ),
      }));
    },
    [],
  );

  const setNote = useCallback(async (item: ReviewItem, note: string | null) => {
    const res = await callEdge(item.id, "update_note", note);
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === item.id ? { ...it, note: res.reviewItem.note } : it)),
    }));
  }, []);

  const counts = useMemo(() => {
    return state.items.reduce(
      (acc, it) => {
        acc[it.status] += 1;
        return acc;
      },
      { pending: 0, resolved: 0, ignored: 0 } as Record<ReviewItemStatus, number>,
    );
  }, [state.items]);

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    counts,
    reload: () => declarationId && load(declarationId),
    markResolved: (item: ReviewItem) => updateStatus(item, "resolve"),
    markIgnored: (item: ReviewItem) => updateStatus(item, "ignore"),
    reopen: (item: ReviewItem) => updateStatus(item, "reopen"),
    setNote,
  };
}
