import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

interface SaveInput {
  userId: string;
  extracted: ExtractedData;
  validated: ExtractedData;
  analysis: FiscalAnalysis;
}

export interface SavedDeclaration {
  id: string;
  declaration: { id: string; title: string; tax_year: number };
  extracted: ExtractedData;
  validated: ExtractedData;
  analysis: FiscalAnalysis;
}

export function usePersistDeclaration() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async ({ userId, extracted, validated, analysis }: SaveInput) => {
    setSaving(true);
    setError(null);
    try {
      const title = `Déclaration ${analysis.taxYear}`;
      const { data: decl, error: e1 } = await supabase
        .from("declarations")
        .insert({
          user_id: userId,
          title,
          tax_year: analysis.taxYear,
          status: "finalized",
        })
        .select()
        .single();
      if (e1 || !decl) throw e1 ?? new Error("Création déclaration échouée");

      const { error: e2 } = await supabase.from("declaration_extracted_data").insert([{
        declaration_id: decl.id,
        extracted_data: extracted as unknown as Record<string, unknown>,
        detected_categories: extracted.detectedCategories,
        confidence_score:
          extracted.globalConfidence === "high" ? 0.9 :
          extracted.globalConfidence === "medium" ? 0.6 : 0.3,
      });
      if (e2) throw e2;

      const { error: e3 } = await supabase.from("declaration_validated_data").insert([{
        declaration_id: decl.id,
        validated_data: validated as unknown as Record<string, unknown>,
      });
      if (e3) throw e3;

      const { error: e4 } = await supabase.from("declaration_fiscal_analysis").insert([{
        declaration_id: decl.id,
        analysis: analysis as unknown as Record<string, unknown>,
      });
      if (e4) throw e4;

      return decl.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur d'enregistrement";
      setError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
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
        extracted: (ex.data?.extracted_data ?? null) as ExtractedData,
        validated: (va.data?.validated_data ?? null) as ExtractedData,
        analysis: (an.data?.analysis ?? null) as FiscalAnalysis,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  return { load, loading, error, data };
}
