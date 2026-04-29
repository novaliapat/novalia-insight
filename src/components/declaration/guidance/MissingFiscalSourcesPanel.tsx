import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookX } from "lucide-react";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { MissingSource } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  items: MissingSource[];
}

export const MissingFiscalSourcesPanel = ({ items }: Props) => {
  if (items.length === 0) return null;
  return (
    <Card className="p-4 border-l-4 border-l-warning bg-warning/[0.04]">
      <div className="flex items-center gap-2 mb-2">
        <BookX className="h-4 w-4 text-warning" />
        <h4 className="font-display text-sm font-semibold">
          Sources fiscales manquantes
        </h4>
      </div>
      <ul className="space-y-3">
        {items.map((m, i) => (
          <li key={i} className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {TaxCategoryLabel[m.category] ?? m.category}
              </Badge>
              {m.blocksHighConfidence && (
                <span className="text-[10px] text-warning">
                  Bloque les propositions à confiance élevée
                </span>
              )}
            </div>
            <p className="text-foreground/80 leading-relaxed">{m.reason}</p>
            {m.suggestedSources.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                Sources suggérées : {m.suggestedSources.join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
};
