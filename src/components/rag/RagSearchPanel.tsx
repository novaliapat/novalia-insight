import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, RefreshCw } from "lucide-react";
import { searchRagForDetectedCategories } from "@/lib/rag/ragMultiSearch";
import { RagCategoryResults } from "./RagCategoryResults";
import { toast } from "sonner";
import type { RagSearchResponse } from "@/lib/rag/ragClient";
import type { TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";

interface Props {
  declarationId: string;
  taxYear: number | null;
  detectedCategories: TaxCategory[];
}

export const RagSearchPanel = ({ declarationId, taxYear, detectedCategories }: Props) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Partial<Record<TaxCategory, RagSearchResponse>>>({});
  const [hasRun, setHasRun] = useState(false);

  const run = async () => {
    if (detectedCategories.length === 0) return;
    setLoading(true);
    try {
      const res = await searchRagForDetectedCategories({
        declarationId,
        extractedData: { detectedCategories },
        taxYear,
      });
      setResults(res);
      setHasRun(true);
    } catch (e) {
      toast.error((e as Error).message ?? "Erreur lors de la recherche RAG");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHasRun(false);
    setResults({});
  }, [declarationId]);

  const entries = Object.entries(results) as [TaxCategory, RagSearchResponse][];

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-foreground">
              Sources fiscales retrouvées
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recherche RAG par catégorie détectée — bibliothèques strictement cloisonnées.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={hasRun ? "outline" : "default"}
          onClick={run}
          disabled={loading || detectedCategories.length === 0}
          className="gap-1"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {hasRun ? "Relancer" : "Rechercher les sources"}
        </Button>
      </div>

      {detectedCategories.length === 0 && (
        <div className="text-xs text-muted-foreground italic">
          Aucune catégorie fiscale détectée pour cette déclaration.
        </div>
      )}

      {hasRun && entries.length === 0 && !loading && (
        <div className="text-xs text-muted-foreground italic">
          Aucun résultat retourné par le RAG.
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map(([cat, res]) => (
            <RagCategoryResults key={cat} response={res} />
          ))}
        </div>
      )}
    </Card>
  );
};
