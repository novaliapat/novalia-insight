import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { WarningCard } from "./WarningCard";
import { useDeclarationExtraction } from "@/hooks/useDeclarationExtraction";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import { ArrowLeft, ArrowRight, Loader2, RotateCw, Sparkles } from "lucide-react";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";

interface Props {
  declarationId: string | null;
  extractedData: ExtractedData | null;
  onExtracted: (data: ExtractedData) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const ExtractionReviewStep = ({
  declarationId,
  extractedData,
  onExtracted,
  onPrev,
  onNext,
}: Props) => {
  const { status, error, data, extract, reset } = useDeclarationExtraction();

  useEffect(() => {
    if (!extractedData && declarationId && status === "idle") {
      void extract(declarationId).then((d) => {
        if (d) onExtracted(d);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declarationId]);

  const display = extractedData ?? data;

  if (status === "loading" || (!display && status !== "error")) {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <div className="font-display text-xl text-foreground">Analyse de vos documents…</div>
        <p className="text-sm text-muted-foreground mt-2">
          L'IA extrait les données présentes dans vos documents. Aucun raisonnement fiscal n'est appliqué à cette étape.
        </p>
      </Card>
    );
  }

  if (status === "error" || !display) {
    return (
      <Card className="p-8 animate-fade-in space-y-4">
        <WarningCard title="Erreur d'extraction" message={error ?? "Une erreur est survenue."} />
        <div className="flex gap-2">
          <Button onClick={onPrev} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button
            onClick={() => {
              if (!declarationId) return;
              reset();
              void extract(declarationId).then((d) => {
                if (d) onExtracted(d);
              });
            }}
            className="gap-2"
          >
            <RotateCw className="h-4 w-4" /> Réessayer
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Données extraites
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Année fiscale {display.taxYear} · {display.detectedCategories.length} catégorie(s) détectée(s)
          </p>
        </div>
        <ConfidenceBadge level={display.globalConfidence} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Catégories détectées
        </h3>
        <div className="flex flex-wrap gap-2">
          {display.detectedCategories.map((cat) => (
            <div
              key={cat}
              className="rounded-full border border-accent/30 bg-accent-soft/40 px-3 py-1 text-xs font-medium"
            >
              {TaxCategoryLabel[cat]}
            </div>
          ))}
        </div>
      </Card>

      {display.ifu.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">IFU — Imprimés Fiscaux Uniques</h3>
          <div className="space-y-3">
            {display.ifu.map((entry, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3 text-sm space-y-2">
                <div className="font-medium">{entry.institution}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {entry.dividends && (
                    <div>
                      <div className="text-muted-foreground">Dividendes</div>
                      <div className="font-medium">{formatEuro(entry.dividends.value)}</div>
                    </div>
                  )}
                  {entry.interests && (
                    <div>
                      <div className="text-muted-foreground">Intérêts</div>
                      <div className="font-medium">{formatEuro(entry.interests.value)}</div>
                    </div>
                  )}
                  {entry.withholdingTax && (
                    <div>
                      <div className="text-muted-foreground">PFU prélevé</div>
                      <div className="font-medium">{formatEuro(entry.withholdingTax.value)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {display.scpi.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">SCPI</h3>
          <div className="space-y-3">
            {display.scpi.map((entry, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3 text-sm space-y-2">
                <div className="font-medium">{entry.scpiName}</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {entry.frenchIncome && (
                    <div>
                      <div className="text-muted-foreground">Revenus France</div>
                      <div className="font-medium">{formatEuro(entry.frenchIncome.value)}</div>
                    </div>
                  )}
                  {entry.foreignIncome && (
                    <div>
                      <div className="text-muted-foreground">Revenus étrangers</div>
                      <div className="font-medium">{formatEuro(entry.foreignIncome.value)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {display.lifeInsurance.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">Assurance-vie</h3>
          <div className="space-y-3">
            {display.lifeInsurance.map((entry, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3 text-sm space-y-2">
                <div className="font-medium">{entry.contractName}</div>
                {entry.taxableShare && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Part imposable : </span>
                    <span className="font-medium">{formatEuro(entry.taxableShare.value)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {display.warnings.length > 0 && (
        <div className="space-y-2">
          {display.warnings.map((w, i) => (
            <WarningCard key={i} message={w} />
          ))}
        </div>
      )}

      {display.missingData.length > 0 && (
        <Card className="p-4 border-warning/40 bg-warning/5">
          <div className="text-sm font-medium mb-2">Données manquantes ou ambiguës</div>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {display.missingData.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Button onClick={onNext} size="lg" className="gap-2">
          Vérifier et valider <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
