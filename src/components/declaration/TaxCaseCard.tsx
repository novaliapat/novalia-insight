import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { WarningCard } from "./WarningCard";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { TaxCase } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import { BookOpen, FileText } from "lucide-react";

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

      {taxCase.requiresManualReview && (
        <WarningCard
          title="À vérifier manuellement"
          message="Aucune source RAG suffisamment pertinente n'a été trouvée pour cette case. Vérifiez avec votre conseiller."
        />
      )}

      <div className="mt-4 grid gap-2 text-xs">
        {taxCase.sourceDocument && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Source : {taxCase.sourceDocument}</span>
          </div>
        )}
        {taxCase.ragSources.length > 0 && (
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <BookOpen className="h-3.5 w-3.5 text-accent" />
              Sources fiscales — bibliothèque {TaxCategoryLabel[taxCase.category]}
            </div>
            {taxCase.ragSources.map((src, i) => (
              <div key={i} className="pl-5">
                <div className="text-foreground/80">{src.documentTitle}</div>
                {src.reference && (
                  <div className="text-muted-foreground font-mono text-[10px]">{src.reference}</div>
                )}
                {src.excerpt && (
                  <div className="text-muted-foreground italic mt-1">"{src.excerpt}"</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
