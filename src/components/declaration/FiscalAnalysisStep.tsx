import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFiscalAnalysis } from "@/hooks/useFiscalAnalysis";
import { ArrowLeft, ArrowRight, Loader2, BookOpen } from "lucide-react";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";

interface Props {
  validatedData: ExtractedData;
  analysis: FiscalAnalysis | null;
  onAnalyzed: (analysis: FiscalAnalysis) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const FiscalAnalysisStep = ({ validatedData, analysis, onAnalyzed, onPrev, onNext }: Props) => {
  const { status, analyze } = useFiscalAnalysis();

  useEffect(() => {
    if (!analysis) {
      analyze(validatedData).then((a) => {
        if (a) onAnalyzed(a);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!analysis || status === "loading") {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <div className="font-display text-xl text-foreground">Analyse fiscale en cours…</div>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Pour chaque catégorie détectée, une recherche dans la bibliothèque correspondante est effectuée.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
          {validatedData.detectedCategories.map((cat) => (
            <div
              key={cat}
              className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft/40 px-3 py-1 text-xs"
            >
              <BookOpen className="h-3 w-3 text-accent" />
              {TaxCategoryLabel[cat]}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Analyse fiscale prête</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{analysis.summary}</p>
      </div>

      <Card className="p-5 bg-gradient-subtle">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Récapitulatif
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Formulaires" value={analysis.taxForms.length} />
          <Stat label="Cases proposées" value={analysis.taxCases.length} />
          <Stat label="Catégories" value={analysis.analyzedCategories.length} />
          <Stat label="À vérifier" value={analysis.taxCases.filter((c) => c.requiresManualReview).length} />
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Button onClick={onNext} size="lg" className="gap-2">
          Voir la synthèse <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="font-display text-2xl text-primary">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);
