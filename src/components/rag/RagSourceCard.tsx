import type { RagSource } from "@/lib/rag/ragSchemas";
import { formatRelevance } from "@/lib/rag/ragUtils";
import { ExternalLink } from "lucide-react";

export const RagSourceCard = ({ source }: { source: RagSource }) => (
  <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{source.documentTitle}</div>
        {source.reference && (
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {source.reference}
          </div>
        )}
      </div>
      {source.relevanceScore !== undefined && (
        <div className="text-[10px] uppercase tracking-wide text-accent font-medium flex-shrink-0">
          {formatRelevance(source.relevanceScore)}
        </div>
      )}
    </div>
    {source.excerpt && (
      <p className="text-muted-foreground italic mt-2 leading-relaxed">"{source.excerpt}"</p>
    )}
    {source.url && (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 mt-2 text-accent hover:underline"
      >
        <ExternalLink className="h-3 w-3" /> Voir la source
      </a>
    )}
  </div>
);
