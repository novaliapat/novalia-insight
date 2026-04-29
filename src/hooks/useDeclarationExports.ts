import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExportOptions {
  includeAudit: boolean;
  includeRagSources: boolean;
  includeReviewItems: boolean;
}

export interface DeclarationExportRow {
  id: string;
  declaration_id: string;
  user_id: string;
  export_type: string;
  storage_path: string;
  file_name: string;
  include_audit: boolean;
  include_rag_sources: boolean;
  include_review_items: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface GenerateResult {
  exportId: string;
  fileName: string;
  storagePath: string;
  signedUrl: string;
  sizeBytes: number;
}

export const useDeclarationExports = (declarationId: string | null) => {
  const [exports, setExports] = useState<DeclarationExportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!declarationId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("declaration_exports")
      .select("*")
      .eq("declaration_id", declarationId)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setExports((data ?? []) as DeclarationExportRow[]);
    setLoading(false);
  }, [declarationId]);

  useEffect(() => { reload(); }, [reload]);

  const generate = useCallback(async (opts: ExportOptions): Promise<GenerateResult> => {
    if (!declarationId) throw new Error("Aucune déclaration sélectionnée");
    setGenerating(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tax-summary-pdf", {
        body: { declarationId, ...opts },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      await reload();
      return data as GenerateResult;
    } finally {
      setGenerating(false);
    }
  }, [declarationId, reload]);

  const getSignedUrl = useCallback(async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("tax-summary-pdfs")
      .createSignedUrl(storagePath, 60 * 10);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Lien indisponible");
    return data.signedUrl;
  }, []);

  const remove = useCallback(async (row: DeclarationExportRow) => {
    const { error: storageErr } = await supabase.storage
      .from("tax-summary-pdfs").remove([row.storage_path]);
    if (storageErr) throw new Error(storageErr.message);
    const { error: dbErr } = await supabase
      .from("declaration_exports").delete().eq("id", row.id);
    if (dbErr) throw new Error(dbErr.message);
    await reload();
  }, [reload]);

  return { exports, loading, generating, error, reload, generate, getSignedUrl, remove };
};
