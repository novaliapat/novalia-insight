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

// La table `declaration_review_items` n'est pas encore dans `Database` typé.
// On utilise un cast localisé pour préserver la sécurité de type ailleurs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reviewTable = () => (supabase as any).from("declaration_review_items");

async function logAudit(declarationId: string, action: string, metadata: Record<string, unknown>) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  await supabase.from("declaration_audit_logs").insert({
    declaration_id: declarationId,
    user_id: userId,
    action,
    metadata,
  });
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
    async (item: ReviewItem, status: ReviewItemStatus) => {
      const { error } = await reviewTable()
        .update({ status })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      await logAudit(item.declaration_id, status === "resolved" ? "review_item_resolved" : "review_item_ignored", {
        review_item_id: item.id,
        source_type: item.source_type,
        source_code: item.source_code,
        field: item.field,
      });
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === item.id ? { ...it, status } : it)),
      }));
    },
    [],
  );

  const setNote = useCallback(async (item: ReviewItem, note: string | null) => {
    const { error } = await reviewTable()
      .update({ note })
      .eq("id", item.id);
    if (error) throw new Error(error.message);
    await logAudit(item.declaration_id, "review_item_note_updated", {
      review_item_id: item.id,
      has_note: Boolean(note && note.trim().length > 0),
    });
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === item.id ? { ...it, note } : it)),
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
    markResolved: (item: ReviewItem) => updateStatus(item, "resolved"),
    markIgnored: (item: ReviewItem) => updateStatus(item, "ignored"),
    reopen: (item: ReviewItem) => updateStatus(item, "pending"),
    setNote,
  };
}
