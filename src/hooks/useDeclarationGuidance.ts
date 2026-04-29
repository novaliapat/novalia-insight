import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DeclarationGuidanceSchema,
  type DeclarationGuidance,
} from "@/lib/declaration/guidance/guidanceSchemas";

export type GuidanceStatus =
  | "guidance_completed"
  | "guidance_completed_with_warnings"
  | "guidance_failed"
  | "draft"
  | string;

interface State {
  guidance: DeclarationGuidance | null;
  status: GuidanceStatus | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
}

const initialState: State = {
  guidance: null,
  status: null,
  loading: false,
  generating: false,
  error: null,
};

export function useDeclarationGuidance(declarationId: string | null | undefined) {
  const [state, setState] = useState<State>(initialState);

  const loadGuidance = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { data, error } = await supabase
          .from("declaration_guidance")
          .select("guidance, status")
          .eq("declaration_id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setState((s) => ({ ...s, guidance: null, status: null, loading: false }));
          return;
        }
        const parsed = DeclarationGuidanceSchema.safeParse(data.guidance);
        setState({
          guidance: parsed.success ? parsed.data : null,
          status: (data.status as GuidanceStatus) ?? null,
          loading: false,
          generating: false,
          error: parsed.success
            ? null
            : "Le guide stocké est non conforme — relancez la génération.",
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Erreur de chargement du guide.",
        }));
      }
    },
    [],
  );

  const generateGuidance = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, generating: true, error: null }));
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-declaration-guidance",
          { body: { declarationId: id } },
        );
        if (error) throw error;
        const parsed = DeclarationGuidanceSchema.safeParse(data?.guidance);
        if (!parsed.success) {
          throw new Error(
            data?.error ?? "Réponse de génération invalide.",
          );
        }
        setState({
          guidance: parsed.data,
          status: (data?.status as GuidanceStatus) ?? "guidance_completed",
          loading: false,
          generating: false,
          error: null,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          generating: false,
          error:
            e instanceof Error
              ? e.message
              : "Échec de la génération du guide déclaratif.",
        }));
      }
    },
    [],
  );

  const regenerateGuidance = useCallback(
    async (id: string) => generateGuidance(id),
    [generateGuidance],
  );

  useEffect(() => {
    if (!declarationId) {
      setState(initialState);
      return;
    }
    loadGuidance(declarationId);
  }, [declarationId, loadGuidance]);

  return {
    guidance: state.guidance,
    status: state.status,
    loading: state.loading,
    generating: state.generating,
    error: state.error,
    loadGuidance,
    generateGuidance,
    regenerateGuidance,
  };
}
