import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { ManualReviewItem } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  items: ManualReviewItem[];
}

export const ManualReviewGuidancePanel = ({ items }: Props) => {
  if (items.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h4 className="font-display text-sm font-semibold">
          Points à vérifier manuellement
        </h4>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded border border-border/70 bg-muted/30 p-3 text-xs space-y-1.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {TaxCategoryLabel[it.category] ?? it.category}
              </Badge>
              {it.relatedFormId && (
                <Badge variant="outline" className="text-[10px]">
                  Form. {it.relatedFormId}
                  {it.relatedBox ? ` · ${it.relatedBox}` : ""}
                </Badge>
              )}
            </div>
            <div className="font-medium text-foreground">{it.reason}</div>
            <div className="text-muted-foreground leading-relaxed">
              → {it.suggestedAction}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};
