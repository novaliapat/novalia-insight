import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaxCaseCard } from "./TaxCaseCard";
import { WarningCard } from "./WarningCard";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import { Copy, Download, Save, ArrowLeft, FileCheck2 } from "lucide-react";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import { toast } from "sonner";

interface Props {
  analysis: FiscalAnalysis;
  onPrev: () => void;
  onSave: () => void;
  saving?: boolean;
}

export const FinalSummaryStep = ({ analysis, onPrev, onSave, saving = false }: Props) => {
  const handleCopy = async () => {
    const text = [
      `Synthèse fiscale ${analysis.taxYear}`,
      "",
      analysis.summary,
      "",
      "Cases fiscales proposées :",
      ...analysis.taxCases.map(
        (c) => `- [${c.form} · ${c.box}] ${c.label} : ${formatEuro(c.amount)}`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Synthèse copiée");
  };

  // Regrouper par catégorie SANS mélanger les sources
  const casesByCategory = analysis.taxCases.reduce<Record<string, typeof analysis.taxCases>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-3xl font-semibold text-foreground flex items-center gap-2">
            <FileCheck2 className="h-7 w-7 text-accent" /> Synthèse fiscale
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">Année fiscale {analysis.taxYear}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copier
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Export PDF — à venir")} className="gap-2">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-3.5 w-3.5" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-gradient-subtle border-l-4 border-l-accent">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Résumé de la situation
        </h3>
        <p className="text-foreground/90 leading-relaxed">{analysis.summary}</p>
      </Card>

      {/* Vue par catégorie */}
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold mb-4">Revenus et montants identifiés</h3>
        <div className="space-y-2">
          {analysis.amountsByCategory.map((c) => (
            <div
              key={c.category}
              className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0"
            >
              <div>
                <div className="font-medium text-sm">{TaxCategoryLabel[c.category]}</div>
                <div className="text-xs text-muted-foreground">{c.caseCount} case(s) fiscale(s)</div>
              </div>
              <div className="font-display text-lg text-primary">{formatEuro(c.totalAmount)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cases fiscales regroupées par catégorie */}
      <section className="space-y-6">
        <h3 className="font-display text-xl font-semibold">Cases fiscales proposées</h3>
        {Object.entries(casesByCategory).map(([cat, cases]) => (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <span className="h-px flex-1 bg-border" />
              <span>{TaxCategoryLabel[cat as TaxCategory]}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3">
              {cases.map((tc) => (
                <TaxCaseCard key={tc.id} taxCase={tc} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {analysis.warnings.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">Points de vigilance</h3>
          <div className="space-y-2">
            {analysis.warnings.map((w, i) => (
              <WarningCard key={i} message={w} />
            ))}
          </div>
        </Card>
      )}

      {analysis.requiredDocuments.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">Justificatifs à conserver</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {analysis.requiredDocuments.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Card>
      )}

      {analysis.finalChecklist.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-3">Check-list finale</h3>
          <ul className="text-sm text-foreground/90 space-y-2">
            {analysis.finalChecklist.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">✓</span> {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {analysis.limitations && (
        <Card className="p-5 bg-muted/40">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Limites de l'analyse
          </h3>
          <p className="text-sm text-muted-foreground italic">{analysis.limitations}</p>
        </Card>
      )}

      <LegalDisclaimer />

      <div className="flex justify-start">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>
    </div>
  );
};
