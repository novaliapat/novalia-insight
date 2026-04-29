import { Card } from "@/components/ui/card";
import { FileText, AlertTriangle } from "lucide-react";
import { GuidanceConfidenceBadge } from "./GuidanceConfidenceBadge";
import { GuidanceSourceBadge } from "./GuidanceSourceBadge";
import type { RequiredForm } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  forms: RequiredForm[];
}

export const RequiredFormsPanel = ({ forms }: Props) => {
  if (forms.length === 0) {
    return (
      <Card className="p-4 bg-muted/30 text-sm text-muted-foreground">
        Aucun formulaire requis détecté pour cette déclaration.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {forms.map((f) => {
        const officialSources = f.sources.filter((s) => s.isOfficialSource);
        return (
          <Card key={f.formId} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent shrink-0" />
                <div>
                  <div className="font-display text-base font-semibold">
                    Formulaire {f.formId}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.label}</div>
                </div>
              </div>
              <GuidanceConfidenceBadge confidence={f.confidence} />
            </div>

            <p className="text-xs text-foreground/80 leading-relaxed">{f.reason}</p>

            {officialSources.length > 0 ? (
              <div className="space-y-1.5">
                {officialSources.slice(0, 3).map((s, i) => (
                  <GuidanceSourceBadge key={i} source={s} compact />
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-foreground/80">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                Aucune source officielle disponible — confiance dégradée.
              </div>
            )}

            {f.legalBasisSources.length === 0 && (
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                Base légale Légifrance non connectée
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
