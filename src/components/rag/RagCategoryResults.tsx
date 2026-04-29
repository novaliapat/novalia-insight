import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { RagSourceResultCard } from "./RagSourceResultCard";
import { getRagLibrary } from "@/lib/rag/ragCategories";
import type { RagSearchResponse } from "@/lib/rag/ragClient";

interface Props {
  response: RagSearchResponse;
}

export const RagCategoryResults = ({ response }: Props) => {
  const lib = getRagLibrary(response.category);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-foreground">{lib.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            Requête : « {response.query} »
          </p>
        </div>
        <Badge variant="secondary" className="text-[11px]">
          {response.sources.length} source{response.sources.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {response.warning && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/5 border border-amber-500/30 rounded-md p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{response.warning}</span>
        </div>
      )}

      {response.sources.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          Aucune source RAG pour cette catégorie.
        </div>
      ) : (
        <div className="space-y-2">
          {response.sources.map((s) => (
            <RagSourceResultCard key={s.chunkId} source={s} />
          ))}
        </div>
      )}
    </Card>
  );
};
