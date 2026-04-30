import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight, Calculator, Lock, CheckCircle2 } from "lucide-react";
import { formatEuro } from "@/lib/declaration/utils/taxFormatting";
import type {
  DeclarationStep,
  PrefillStatus,
} from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  steps: DeclarationStep[];
}

const PREFILL_LABELS: Record<PrefillStatus, { label: string; className: string }> = {
  to_enter: { label: "À saisir", className: "bg-primary/10 text-primary border-primary/30" },
  prefilled: { label: "Pré-rempli — vérifier", className: "bg-accent/15 text-accent border-accent/30" },
  auto_report: { label: "Report automatique", className: "bg-success/15 text-success border-success/30" },
  do_not_modify: { label: "Ne pas modifier", className: "bg-warning/15 text-warning border-warning/30" },
};

export const DeclarationStepTimeline = ({ steps }: Props) => {
  if (steps.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Aucune étape proposée pour cette section.
      </Card>
    );
  }
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <ol className="relative border-l-2 border-border/70 pl-5 space-y-4">
      {sorted.map((s, idx) => {
        const prefill = s.prefillStatus ? PREFILL_LABELS[s.prefillStatus] : null;
        return (
          <li key={s.id} className="relative">
            <span className="absolute -left-[28px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
              {idx + 1}
            </span>
            <Card
              className={`p-3.5 ${
                s.requiresManualReview ? "border-l-4 border-l-warning" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold flex items-center gap-2 flex-wrap">
                    <span>{s.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.formId}
                    </Badge>
                    {prefill && (
                      <Badge variant="outline" className={`text-[10px] ${prefill.className}`}>
                        {prefill.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                    {s.description}
                  </p>
                </div>
                {s.amount != null && (
                  <span className="font-display text-base text-primary whitespace-nowrap font-semibold">
                    {formatEuro(Math.round(s.amount))}
                  </span>
                )}
              </div>

              {s.calculationNote && (
                <div className="mt-2.5 flex items-start gap-2 rounded border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-foreground/85">
                  <Calculator className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span className="font-mono leading-relaxed">{s.calculationNote}</span>
                </div>
              )}

              {(s.targetBox || s.targetLine) && !s.calculationNote && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  Cible : {s.targetBox ?? s.targetLine}
                </div>
              )}

              {s.warning && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {s.warning}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ol>
  );
};

