import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DraftState {
  declarationId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Crée une déclaration brouillon dès l'entrée dans le flow.
 * - status: "draft"
 * - tax_year: année par défaut (année précédente)
 * Idempotent : ne crée qu'une seule fois par montage.
 */
export function useDeclarationDraft() {
  const { user } = useAuth();
  const [state, setState] = useState<DraftState>({
    declarationId: null,
    loading: false,
    error: null,
  });
  const createdRef = useRef(false);

  const createDraft = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (createdRef.current) return state.declarationId;
    createdRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const taxYear = new Date().getFullYear() - 1;
      const { data, error } = await supabase
        .from("declarations")
        .insert({
          user_id: user.id,
          title: "Nouvelle déclaration",
          status: "draft",
          tax_year: taxYear,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Création échouée");
      setState({ declarationId: data.id, loading: false, error: null });
      return data.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de création";
      createdRef.current = false;
      setState({ declarationId: null, loading: false, error: msg });
      return null;
    }
  }, [user, state.declarationId]);

  // Auto-create dès qu'on a un user
  useEffect(() => {
    if (user && !state.declarationId && !createdRef.current) {
      void createDraft();
    }
  }, [user, state.declarationId, createDraft]);

  return { ...state, createDraft };
}
