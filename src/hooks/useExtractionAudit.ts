import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ExtractionAuditSchema,
  type ExtractionAudit,
} from "@/lib/declaration/contracts/auditContract";

interface State {
  audit: ExtractionAudit | null;
  loading: boolean;
  error: string | null;
  loggedAt: string | null;
}

/**
 * Charge le DERNIER audit officiel (`extraction_audit_generated`) persisté
 * pour une déclaration. Source unique = table `declaration_audit_logs`.
 * Aucun recalcul côté front.
 */
export function useExtractionAudit(declarationId: string | null | undefined) {
  const [state, setState] = useState<State>({
    audit: null,
    loading: false,
    error: null,
    loggedAt: null,
  });

  const load = useCallback(async (id: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("declaration_audit_logs")
      .select("metadata, created_at")
      .eq("declaration_id", id)
      .eq("action", "extraction_audit_generated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setState({ audit: null, loading: false, error: error.message, loggedAt: null });
      return;
    }
    if (!data) {
      setState({ audit: null, loading: false, error: null, loggedAt: null });
      return;
    }

    const parsed = ExtractionAuditSchema.safeParse(data.metadata);
    setState({
      audit: parsed.success ? parsed.data : null,
      loading: false,
      error: parsed.success ? null : "Audit présent mais non conforme au contrat.",
      loggedAt: data.created_at,
    });
  }, []);

  useEffect(() => {
    if (declarationId) void load(declarationId);
  }, [declarationId, load]);

  return { ...state, reload: () => declarationId && load(declarationId) };
}
