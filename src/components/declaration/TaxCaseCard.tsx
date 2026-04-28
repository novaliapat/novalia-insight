import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { WarningCard } from "./WarningCard";
import { RagSourcesPanel } from "@/components/rag/RagSourcesPanel";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { TaxCase } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import { FileText } from "lucide-react";

export const TaxCaseCard = ({ taxCase }: { taxCase: TaxCase }) => {
  return (
    <Card className="p-5 shadow-soft hover:shadow-elegant transition-smooth border-border/60 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-xs">
            {taxCase.form} · {taxCase.box}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {TaxCategoryLabel[taxCase.category]}
          </Badge>
          <ConfidenceBadge level={taxCase.confidence} />
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-semibold text-primary">
            {formatEuro(taxCase.amount)}
          </div>
        </div>
      </div>

      <h4 className="font-medium text-foreground mb-1.5">{taxCase.label}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{taxCase.explanation}</p>

      {taxCase.warning && <WarningCard message={taxCase.warning} />}

      <div className="mt-4 grid gap-2 text-xs">
        {taxCase.sourceDocument && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Source document : {taxCase.sourceDocument}</span>
          </div>
        )}

        <RagSourcesPanel
          category={taxCase.category}
          sources={taxCase.ragSources}
          insufficient={taxCase.requiresManualReview || taxCase.ragSources.length === 0}
        />
      </div>
    </Card>
  );
};
