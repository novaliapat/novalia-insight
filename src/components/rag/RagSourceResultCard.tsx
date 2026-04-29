import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ShieldCheck, Calendar } from "lucide-react";
import { RagSearchStatusBadge } from "./RagSearchStatusBadge";
import type { RagSourceResult } from "@/lib/rag/ragClient";

interface Props {
  source: RagSourceResult;
}

export const RagSourceResultCard = ({ source }: Props) => {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{source.title}</div>
          {source.sourceName && (
            <div className="text-xs text-muted-foreground truncate">{source.sourceName}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RagSearchStatusBadge confidence={source.confidence} />
          {source.isOfficialSource && (
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
              <ShieldCheck className="h-3 w-3" />
              Officielle
            </Badge>
          )}
          {source.taxYear !== null && (
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3" />
              {source.taxYear}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
        {source.excerpt}
      </p>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="text-[11px] text-muted-foreground">
          Score : <span className="font-medium text-foreground">{Math.round(source.relevanceScore * 100)}%</span>
          {" · "}
          similarité {Math.round(source.similarity * 100)}%
        </div>
        {source.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {source.warnings.length > 0 && (
        <ul className="text-[11px] text-amber-700 space-y-0.5 pt-1 border-t border-border/40">
          {source.warnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </Card>
  );
};
