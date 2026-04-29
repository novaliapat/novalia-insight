import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ListChecks } from "lucide-react";
import { GuidanceConfidenceBadge } from "./GuidanceConfidenceBadge";
import { GuidanceSourceBadge } from "./GuidanceSourceBadge";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { TaxBoxProposal } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  proposal: TaxBoxProposal;
}

export const TaxBoxProposalCard = ({ proposal: p }: Props) => {
  const needsAttention = p.requiresManualReview || p.confidence !== "high";

  return (
    <Card
      className={`p-4 space-y-3 ${
        needsAttention ? "border-l-4 border-l-warning bg-warning/[0.03]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-accent" />
          <div>
            <div className="font-display text-sm font-semibold">
              {p.formId} · <span className="text-accent">{p.boxOrLine}</span>
            </div>
            <div className="text-xs text-muted-foreground">{p.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {TaxCategoryLabel[p.category] ?? p.category}
          </Badge>
          <GuidanceConfidenceBadge confidence={p.confidence} />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">Montant</span>
        <span
          className={`font-display text-lg ${
            p.amount == null ? "text-muted-foreground italic" : "text-primary"
          }`}
        >
          {p.amount == null ? "À déterminer / vérifier" : formatEuro(p.amount)}
        </span>
      </div>

      {p.explanation && (
        <p className="text-xs text-foreground/80 leading-relaxed">
          {p.explanation}
        </p>
      )}

      {p.requiresManualReview && p.blockingReason && (
        <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-2.5 text-xs text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>{p.blockingReason}</span>
        </div>
      )}

      {p.ragSources.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Source officielle
          </div>
          {p.ragSources
            .filter((s) => s.isOfficialSource)
            .slice(0, 2)
            .map((s, i) => (
              <GuidanceSourceBadge key={i} source={s} compact />
            ))}
        </div>
      )}
    </Card>
  );
};
