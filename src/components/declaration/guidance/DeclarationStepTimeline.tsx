import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { formatEuro } from "@/lib/declaration/utils/taxFormatting";
import type { DeclarationStep } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  steps: DeclarationStep[];
}

export const DeclarationStepTimeline = ({ steps }: Props) => {
  if (steps.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Aucune étape proposée pour cette déclaration.
      </Card>
    );
  }
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <ol className="relative border-l-2 border-border/70 pl-5 space-y-4">
      {sorted.map((s) => (
        <li key={s.id} className="relative">
          <span className="absolute -left-[28px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
            {s.order + 1}
          </span>
          <Card
            className={`p-3.5 ${
              s.requiresManualReview ? "border-l-4 border-l-warning" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold flex items-center gap-2">
                  <span>{s.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {s.formId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.description}
                </p>
              </div>
              {s.amount != null && (
                <span className="font-display text-sm text-primary whitespace-nowrap">
                  {formatEuro(s.amount)}
                </span>
              )}
            </div>

            {(s.targetBox || s.targetLine) && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ChevronRight className="h-3 w-3" />
                Cible : {s.targetBox ?? s.targetLine}
              </div>
            )}

            {s.requiresManualReview && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                <AlertTriangle className="h-3 w-3" />
                {s.warning ?? "Vérification manuelle requise"}
              </div>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
};
