import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

interface FinalizeInput {
  declarationId: string;
  validated: ExtractedData;
  analysis: FiscalAnalysis;
}

export interface SavedDeclaration {
  id: string;
  declaration: { id: string; title: string; tax_year: number; status: string };
  extracted: ExtractedData | null;
  validated: ExtractedData | null;
  analysis: FiscalAnalysis | null;
  extractionStatus: string | null;
}

/**
 * Finalise une déclaration existante (créée en draft à l'étape 1).
 * - upsert validated_data
 * - upsert fiscal_analysis
 * - status -> finalized
 * - audit log
 */
export function useFinalizeDeclaration() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalize = useCallback(async ({ declarationId, validated, analysis }: FinalizeInput) => {
    setSaving(true);
    setError(null);
    try {
      // Upsert validated
      await supabase
        .from("declaration_validated_data")
        .delete()
        .eq("declaration_id", declarationId);
      const { error: e2 } = await supabase.from("declaration_validated_data").insert({
        declaration_id: declarationId,
        validated_data: validated as unknown as never,
      });
      if (e2) throw e2;

      // Upsert analysis
      await supabase
        .from("declaration_fiscal_analysis")
        .delete()
        .eq("declaration_id", declarationId);
      const { error: e3 } = await supabase.from("declaration_fiscal_analysis").insert({
        declaration_id: declarationId,
        analysis: analysis as unknown as never,
      });
      if (e3) throw e3;

      // Status + titre
      const title = `Déclaration ${analysis.taxYear}`;
      const { error: e4 } = await supabase
        .from("declarations")
        .update({ status: "finalized", title, tax_year: analysis.taxYear })
        .eq("id", declarationId);
      if (e4) throw e4;

      await supabase.from("declaration_audit_logs").insert({
        declaration_id: declarationId,
        action: "declaration_finalized",
        metadata: { categories: analysis.analyzedCategories },
      });

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur d'enregistrement";
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { finalize, saving, error };
}

export function useLoadDeclaration() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SavedDeclaration | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [d, ex, va, an] = await Promise.all([
        supabase.from("declarations").select("*").eq("id", id).single(),
        supabase.from("declaration_extracted_data").select("*").eq("declaration_id", id).maybeSingle(),
        supabase.from("declaration_validated_data").select("*").eq("declaration_id", id).maybeSingle(),
        supabase.from("declaration_fiscal_analysis").select("*").eq("declaration_id", id).maybeSingle(),
      ]);
      if (d.error) throw d.error;
      setData({
        id,
        declaration: d.data,
        extracted: (ex.data?.extracted_data ?? null) as ExtractedData | null,
        validated: (va.data?.validated_data ?? null) as ExtractedData | null,
        analysis: (an.data?.analysis ?? null) as FiscalAnalysis | null,
        extractionStatus: (ex.data?.extraction_status ?? null) as string | null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  return { load, loading, error, data };
}
