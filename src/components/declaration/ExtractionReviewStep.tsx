import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { WarningCard } from "./WarningCard";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { ConsistencyIssuesPanel } from "./ConsistencyIssuesPanel";
import {
  ExtractedEvidenceCard,
  flattenEvidences,
} from "./ExtractedEvidenceCard";
import { EvidenceQualityPanel } from "./EvidenceQualityPanel";
import { AuditJsonViewer } from "./AuditJsonViewer";
import { useDeclarationExtraction } from "@/hooks/useDeclarationExtraction";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import { runExtractionConsistencyChecks } from "@/lib/declaration/validation/extractionConsistencyChecks";
import { buildExtractionAuditFallback } from "@/lib/declaration/audit/extractionAudit";
import {
  deriveExtractionStatus,
  summarizeMetadata,
} from "@/lib/declaration/status/extractionStatus";
import { ArrowLeft, ArrowRight, Loader2, RotateCw, Sparkles, FileSearch } from "lucide-react";
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
  const {
    status,
    error,
    errorCode,
    retryable,
    data,
    metadata,
    audit: backendAudit,
    extractionStatus: backendStatus,
    extract,
    reset,
  } = useDeclarationExtraction();

  useEffect(() => {
    if (!extractedData && declarationId && status === "idle") {
      void extract(declarationId).then((d) => {
        if (d) onExtracted(d);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declarationId]);

  const display = extractedData ?? data;

  // Issues affichées : on utilise celles de l'audit backend si dispo,
  // sinon on recalcule (rétrocompat / cas où on revient sur l'étape).
  const issues = useMemo(() => {
    if (backendAudit?.consistencyIssues) return backendAudit.consistencyIssues;
    return display ? runExtractionConsistencyChecks(display) : [];
  }, [backendAudit, display]);

  // Statut affiché : source de vérité = backend.
  const detailedStatus = useMemo(() => {
    if (status === "loading") return "extraction_processing" as const;
    if (status === "error") return "extraction_failed" as const;
    if (backendStatus) return backendStatus;
    if (!display) return "extraction_not_started" as const;
    return deriveExtractionStatus({
      hasError: false,
      isProcessing: false,
      data: display,
      issues,
    });
  }, [status, backendStatus, display, issues]);

  // Audit affiché : backend en priorité, fallback côté front sinon.
  const audit = useMemo(() => {
    if (backendAudit) return backendAudit;
    if (!display || !metadata || !declarationId) return null;
    return buildExtractionAuditFallback({
      declarationId,
      data: display,
      metadata,
      numberOfFiles: 0,
      consistencyIssues: issues,
      status: detailedStatus,
    });
  }, [backendAudit, display, metadata, declarationId, issues, detailedStatus]);

  const handleRetry = () => {
    if (!declarationId) return;
    reset();
    void extract(declarationId).then((d) => {
      if (d) onExtracted(d);
    });
  };

  if (status === "loading" || (!display && status !== "error")) {
    return (
      <Card className="p-12 text-center animate-fade-in space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <ExtractionStatusBadge status="extraction_processing" />
        <div className="font-display text-xl text-foreground">Analyse de vos documents…</div>
        <p className="text-sm text-muted-foreground">
          L'IA extrait les données présentes dans vos documents. Aucun raisonnement fiscal n'est appliqué à cette étape.
        </p>
      </Card>
    );
  }

  if (status === "error" || !display) {
    const isRetryable =
      retryable ||
      errorCode === "NO_TOOL_CALL" ||
      errorCode === "PROVIDER_UNAVAILABLE" ||
      errorCode === "NETWORK" ||
      errorCode === "TIMEOUT";
    return (
      <Card className="p-8 animate-fade-in space-y-4">
        <ExtractionStatusBadge status="extraction_failed" />
        <WarningCard
          title="Erreur d'extraction"
          message={error ?? "Une erreur est survenue."}
        />
        {errorCode && (
          <p className="text-xs text-muted-foreground">
            Code technique : <span className="font-mono">{errorCode}</span>
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={onPrev} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <Button onClick={handleRetry} className="gap-2">
            <RotateCw className="h-4 w-4" />
            {isRetryable ? "Relancer l'extraction" : "Réessayer"}
          </Button>
        </div>
      </Card>
    );
  }

  const evidences = flattenEvidences({
    ifu: display.ifu as unknown as Array<Record<string, unknown>>,
    scpi: display.scpi as unknown as Array<Record<string, unknown>>,
    lifeInsurance: display.lifeInsurance as unknown as Array<Record<string, unknown>>,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Données extraites
          </h2>
          <p className="text-muted-foreground text-sm">
            Année fiscale {display.taxYear} · {display.detectedCategories.length} catégorie(s) détectée(s)
            {audit ? ` · ${audit.numberOfFiles} fichier(s)` : ""}
          </p>
          {metadata && (
            <p className="text-xs text-muted-foreground font-mono">{summarizeMetadata(metadata)}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <ExtractionStatusBadge status={detailedStatus} />
          <ConfidenceBadge level={display.globalConfidence} />
        </div>
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

      <ConsistencyIssuesPanel issues={issues} />

      <EvidenceQualityPanel
        data={{
          ifu: display.ifu as unknown as Array<Record<string, unknown>>,
          scpi: display.scpi as unknown as Array<Record<string, unknown>>,
          lifeInsurance: display.lifeInsurance as unknown as Array<Record<string, unknown>>,
        }}
      />

      {evidences.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-accent" /> Sources documentaires
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {evidences.map((ev, i) => (
              <ExtractedEvidenceCard key={i} evidence={ev} />
            ))}
          </div>
        </section>
      )}

      {(display.scpi ?? []).some((s) => (s.incomeByCountry?.length ?? 0) > 0) && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Revenus SCPI par pays
          </h3>
          {(display.scpi ?? []).map((entry, idx) =>
            (entry.incomeByCountry?.length ?? 0) > 0 ? (
              <div key={idx} className="text-sm space-y-1">
                <div className="font-medium">{entry.scpiName}</div>
                <div className="space-y-1 pl-3">
                  {entry.incomeByCountry!.map((c, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {c.country}
                        {c.taxTreatment ? ` · ${c.taxTreatment}` : ""}
                      </span>
                      <span className="font-mono">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(c.income.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </Card>
      )}

      {display.warnings.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg font-semibold">Warnings</h3>
          {display.warnings.map((w, i) => (
            <WarningCard key={i} message={w} />
          ))}
        </section>
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

      <AuditJsonViewer audit={audit} />

      <div className="flex justify-between flex-wrap gap-2">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRetry} className="gap-2">
            <RotateCw className="h-4 w-4" /> Relancer l'extraction
          </Button>
          <Button onClick={onNext} size="lg" className="gap-2">
            Vérifier et valider <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
