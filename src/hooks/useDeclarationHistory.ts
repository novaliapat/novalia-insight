import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Declaration } from "@/lib/declaration/schemas/declarationSchema";

export function useDeclarationHistory() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("declarations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setDeclarations([]);
    } else {
      setDeclarations((data ?? []) as Declaration[]);
    }
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
