import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Database, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SeedResult {
  insertedDocuments?: number;
  insertedChunks?: number;
  skippedChunks?: number;
  categories?: string[];
  totalSeedChunks?: number;
}

export const SeedRagButton = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-brochure-rag-seed");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as SeedResult);
      toast.success("Base RAG initialisée", {
        description: `${data.insertedChunks ?? 0} chunks insérés, ${data.skippedChunks ?? 0} ignorés`,
      });
    } catch (e) {
      toast.error("Échec de l'initialisation RAG", {
        description: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4 border-dashed">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-accent" />
        <h3 className="font-display text-lg font-semibold">Base fiscale RAG</h3>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Charge les extraits de la Brochure pratique IR 2025 dans la base de recherche.
        Nécessaire pour que l'analyse et le guide déclaratif fonctionnent correctement.
      </p>

      <Button onClick={handleSeed} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        {loading ? "Ingestion en cours…" : "Initialiser la base fiscale"}
      </Button>

      {result && (
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-success font-medium text-sm">
            <CheckCircle2 className="h-4 w-4" /> Ingestion terminée
          </div>
          <p className="text-xs text-muted-foreground">
            Documents créés : <strong>{result.insertedDocuments ?? 0}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Chunks insérés : <strong>{result.insertedChunks ?? 0}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Chunks ignorés (déjà présents) : <strong>{result.skippedChunks ?? 0}</strong>
          </p>
          {result.categories && result.categories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Catégories : <strong>{result.categories.join(", ")}</strong>
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
