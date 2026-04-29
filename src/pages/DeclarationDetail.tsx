import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Loader2, Eye } from "lucide-react";
import { useLoadDeclaration } from "@/hooks/useDeclarationPersistence";
import { FinalSummaryStep } from "@/components/declaration/FinalSummaryStep";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { ExtractionStatusBadge } from "@/components/declaration/ExtractionStatusBadge";
import { DeclarationReviewStatusBadge } from "@/components/declaration/review/DeclarationReviewStatusBadge";
import { ExtractionAuditPanel } from "@/components/declaration/audit/ExtractionAuditPanel";
import { QuickReviewPanel } from "@/components/declaration/review/QuickReviewPanel";
import { PendingReviewBanner } from "@/components/declaration/review/PendingReviewBanner";
import { ReviewBlockingBanner } from "@/components/declaration/review/ReviewBlockingBanner";
import { ReviewOverrideDialog } from "@/components/declaration/review/ReviewOverrideDialog";
import { RagSearchPanel } from "@/components/rag/RagSearchPanel";
import { ExportPanel } from "@/components/declaration/export/ExportPanel";
import { useReviewBlockingState } from "@/hooks/useReviewBlockingState";
import { DeclarationStatusLabel } from "@/lib/declaration/schemas/declarationSchema";
import { ExtractionStatusEnum } from "@/lib/declaration/contracts/statusContract";
import type { DeclarationReviewStatus } from "@/lib/declaration/review/computeReviewStatus";

const DeclarationDetail = () => {
  const { id } = useParams();
  const { load, loading, error, data } = useLoadDeclaration();
  const [overrideOpen, setOverrideOpen] = useState(false);

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

  const parsedExtractionStatus = data?.extractionStatus
    ? ExtractionStatusEnum.safeParse(data.extractionStatus)
    : null;
  const extractionStatus = parsedExtractionStatus?.success ? parsedExtractionStatus.data : null;
  const needsReview = extractionStatus === "extraction_needs_review";

  const blocking = useReviewBlockingState({
    declarationId: id ?? null,
    reviewStatus: (data?.reviewStatus as DeclarationReviewStatus) ?? null,
    extractionStatus,
  });

  const goToReview = () => {
    const el = document.getElementById("quick-review");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8 max-w-5xl">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-smooth">Tableau de bord</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Détail</span>
        </nav>

        {loading && (
          <Card className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </Card>
        )}

        {!loading && data && (
          <Card className="p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-foreground truncate">
                {data.declaration.title}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Année fiscale {data.declaration.tax_year}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {extractionStatus && <ExtractionStatusBadge status={extractionStatus} />}
              <DeclarationReviewStatusBadge status={data.reviewStatus} />
              <Badge variant="secondary">
                {DeclarationStatusLabel[data.declaration.status as keyof typeof DeclarationStatusLabel] ?? data.declaration.status}
              </Badge>
            </div>
          </Card>
        )}

        {!loading && needsReview && (
          <Card className="p-5 mb-6 border-warning/40 bg-warning/5">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-foreground mb-0.5">Revue manuelle requise</div>
                <p className="text-muted-foreground">
                  L'extraction de cette déclaration a une confiance faible ou contient des
                  incohérences. Reprenez-la pour vérifier les données avant validation.
                </p>
              </div>
            </div>
          </Card>
        )}

        {!loading && id && data && (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
                  État de validation
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  L'extraction et la revue sont tracées dans le journal d'audit.
                </p>
              </div>
              {blocking.result.level === "confirmation_required" && (
                <Button size="sm" onClick={() => setOverrideOpen(true)}>
                  Confirmer et continuer
                </Button>
              )}
            </div>
            {blocking.result.level === "none" ? (
              <div className="text-sm text-muted-foreground">
                Aucun point de revue en attente. Vous pouvez finaliser sereinement.
              </div>
            ) : (
              <ReviewBlockingBanner result={blocking.result} onGoToReview={goToReview} />
            )}
          </Card>
        )}

        {!loading && id && (
          <div className="mb-6 space-y-4">
            <ExtractionAuditPanel declarationId={id} />
            <QuickReviewPanel declarationId={id} />
            {data && (
              <RagSearchPanel
                declarationId={id}
                taxYear={data.declaration.tax_year ?? null}
                detectedCategories={data.extracted?.detectedCategories ?? []}
              />
            )}
          </div>
        )}

        {!loading && (error || !data?.analysis) && (
          <Card className="p-10 text-center">
            <h2 className="font-display text-2xl font-semibold mb-2">Analyse introuvable</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {error ?? "Cette déclaration n'a pas encore d'analyse fiscale enregistrée."}
            </p>
            <Link to="/">
              <Button variant="outline">Retour au tableau de bord</Button>
            </Link>
          </Card>
        )}

        {!loading && data?.analysis && (
          <>
            {id && <PendingReviewBanner declarationId={id} />}
            <FinalSummaryStep
              analysis={data.analysis}
              onPrev={() => history.back()}
              onSave={() => {}}
            />
            {id && data && (
              <div className="mt-6">
                <ExportPanel
                  declarationId={id}
                  hasAnalysis={!!data.analysis}
                  analysisStatus={(data.declaration as any).analysis_status}
                  reviewStatus={data.reviewStatus}
                  hasManualReviewCases={
                    (data.analysis?.taxCases ?? []).some((c: any) => c?.requiresManualReview)
                  }
                />
              </div>
            )}
            <div className="mt-8">
              <LegalDisclaimer />
            </div>
          </>
        )}
      </main>

      {id && (
        <ReviewOverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          declarationId={id}
          result={blocking.result}
          context="before_finalization"
          onConfirmed={() => {
            blocking.reload();
          }}
          onGoToReview={goToReview}
        />
      )}
    </div>
  );
};

export default DeclarationDetail;
