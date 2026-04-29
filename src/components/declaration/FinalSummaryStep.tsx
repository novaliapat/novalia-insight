import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaxCaseCard } from "./TaxCaseCard";
import { WarningCard } from "./WarningCard";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { DeclarationGuidancePanel } from "./guidance/DeclarationGuidancePanel";
import { formatEuro, TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import { Copy, Download, Loader2, Save, ArrowLeft, FileCheck2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeclarationGuidance } from "@/hooks/useDeclarationGuidance";
import { useDeclarationExports } from "@/hooks/useDeclarationExports";
import type { FiscalAnalysis } from "@/lib/declaration/schemas/fiscalAnalysisSchema";
import type { TaxCategory } from "@/lib/declaration/schemas/extractedDataSchema";
import { toast } from "sonner";

interface Props {
  analysis: FiscalAnalysis;
  onPrev: () => void;
  onSave: () => void;
  saving?: boolean;
  declarationId?: string | null;
  /** Conservé pour compat — n'a plus d'effet sur l'affichage du guide. */
  isPersisted?: boolean;
  /** Libellé personnalisé du bouton de finalisation. */
  saveLabel?: string;
}

export const FinalSummaryStep = ({
  analysis,
  onPrev,
  onSave,
  saving = false,
  declarationId,
  saveLabel = "Finaliser",
}: Props) => {
  const { guidance } = useDeclarationGuidance(declarationId ?? null);
  const { generate, generating, getSignedUrl } = useDeclarationExports(
    declarationId ?? null,
  );

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

  const pdfDisabled = !guidance || !declarationId || generating;
  const pdfTooltip = !declarationId
    ? "Le PDF sera disponible une fois le dossier créé."
    : !guidance
      ? "Générez d'abord le guide déclaratif."
      : "Générer un PDF reprenant la synthèse, le guide et les sources officielles.";

  const handleGeneratePdf = async () => {
    if (!declarationId || !guidance) return;
    try {
      const result = await generate({
        includeAudit: false,
        includeRagSources: true,
        includeReviewItems: true,
      });
      toast.success("PDF généré", { description: result.fileName });
      try {
        const url = await getSignedUrl(result.storagePath);
        window.open(url, "_blank");
      } catch {
        // ignore — l'utilisateur peut toujours le récupérer dans le panneau d'export
      }
    } catch (e) {
      console.error("[FinalSummaryStep] PDF generation failed:", e);
      toast.error("Échec de la génération PDF", {
        description: e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e),
      });
    }
  };

  // Si le guide existe et propose des cases, on évite l'ancien message bloquant
  // sur l'analyse fiscale et on affiche un résumé neutre.
  const showLegacyAnalysisSection =
    analysis.taxCases.length > 0 &&
    !(guidance && guidance.taxBoxProposals.length > 0);

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={pdfDisabled}
                    className="gap-2"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{pdfTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-3.5 w-3.5" /> {saving ? "Enregistrement…" : saveLabel}
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-gradient-subtle border-l-4 border-l-accent">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Résumé de la situation
        </h3>
        <p className="text-foreground/90 leading-relaxed">
          {guidance && guidance.taxBoxProposals.length > 0 && analysis.taxCases.length === 0
            ? "Les documents transmis ont permis d'identifier des revenus à déclarer. Le guide ci-dessous détaille les formulaires, cases et points à vérifier."
            : analysis.summary}
        </p>
      </Card>

      {/* Guide déclaratif — bloc principal, dispo dès qu'on a un declarationId (draft) */}
      {declarationId ? (
        <DeclarationGuidancePanel declarationId={declarationId} />
      ) : (
        <Card className="p-5 bg-muted/30 border-l-4 border-l-accent">
          <h3 className="font-display text-base font-semibold mb-1.5 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-accent" />
            Création du dossier…
          </h3>
          <p className="text-sm text-muted-foreground">
            Préparation de votre dossier déclaratif en cours.
          </p>
        </Card>
      )}

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

      {/* Analyse fiscale préliminaire — affichée seulement si le guide n'a pas pris le relais */}
      {showLegacyAnalysisSection && (
        <section className="space-y-6">
          <div>
            <h3 className="font-display text-xl font-semibold">Analyse fiscale préliminaire</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Analyse préliminaire issue des documents transmis. Le guide ci-dessus reste la référence.
            </p>
          </div>
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
      )}

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
