import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileDown,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDeclarationExports,
  type ExportOptions,
  type DeclarationExportRow,
} from "@/hooks/useDeclarationExports";

interface Props {
  declarationId: string;
  hasAnalysis: boolean;
  analysisStatus?: string | null;
  reviewStatus?: string | null;
  hasManualReviewCases?: boolean;
  hasGuidance?: boolean;
  guidanceStatus?: string | null;
}

type ExportUiState =
  | "no_analysis"
  | "no_guidance"
  | "loading"
  | "generating"
  | "ready"
  | "generated"
  | "error";

export const ExportPanel = ({
  declarationId,
  hasAnalysis,
  analysisStatus,
  reviewStatus,
  hasManualReviewCases,
  hasGuidance = false,
  guidanceStatus,
}: Props) => {
  const { toast } = useToast();
  const {
    exports,
    loading,
    generating,
    error,
    generate,
    getSignedUrl,
    remove,
  } = useDeclarationExports(declarationId);

  const [opts, setOpts] = useState<ExportOptions>({
    includeAudit: false,
    includeRagSources: true,
    includeReviewItems: true,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const analysisFailed = analysisStatus === "analysis_failed";
  const reviewPending = reviewStatus === "review_pending";
  const guidanceWithWarnings =
    guidanceStatus === "guidance_completed_with_warnings";
  const showWarning =
    reviewPending || hasManualReviewCases || guidanceWithWarnings;
  const blockGeneration = !hasAnalysis || analysisFailed || !hasGuidance;

  const lastExport = exports[0] ?? null;

  const uiState: ExportUiState = useMemo(() => {
    if (!hasAnalysis || analysisFailed) return "no_analysis";
    if (!hasGuidance) return "no_guidance";
    if (generating) return "generating";
    if (loading) return "loading";
    if (error) return "error";
    if (lastExport) return "generated";
    return "ready";
  }, [
    hasAnalysis,
    analysisFailed,
    hasGuidance,
    generating,
    loading,
    error,
    lastExport,
  ]);

  // Charge automatiquement la preview du dernier export.
  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      if (!lastExport) {
        setPreviewUrl(null);
        setPreviewFor(null);
        return;
      }
      if (lastExport.id === previewFor) return;
      setPreviewLoading(true);
      try {
        const url = await getSignedUrl(lastExport.storage_path);
        if (!cancelled) {
          setPreviewUrl(url);
          setPreviewFor(lastExport.id);
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewFor(lastExport.id);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [lastExport, previewFor, getSignedUrl]);

  const handleGenerate = async () => {
    try {
      const result = await generate(opts);
      toast({
        title: "PDF généré",
        description: result.fileName,
      });
      // Force le refresh de la preview vers le nouveau document.
      setPreviewFor(null);
    } catch (e) {
      toast({
        title: "Échec de la génération",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (storagePath: string) => {
    try {
      const url = await getSignedUrl(storagePath);
      window.open(url, "_blank");
    } catch (e) {
      toast({
        title: "Téléchargement impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (row: DeclarationExportRow) => {
    if (!confirm(`Supprimer définitivement ${row.file_name} ?`)) return;
    try {
      await remove(row);
      if (previewFor === row.id) {
        setPreviewUrl(null);
        setPreviewFor(null);
      }
      toast({ title: "Export supprimé" });
    } catch (e) {
      toast({
        title: "Suppression impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <FileDown className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold text-foreground">
            Exporter le dossier fiscal
          </h2>
        </div>
        <ExportStateBadge state={uiState} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Génère un PDF de synthèse propre, à conserver ou à transmettre.
      </p>

      {blockGeneration && (
        <div className="mb-4 p-3 rounded border border-warning/40 bg-warning/5 text-xs text-foreground flex gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>
            {analysisFailed
              ? "L'analyse fiscale a échoué — relancez-la avant d'exporter."
              : !hasAnalysis
                ? "Aucune analyse fiscale disponible. Lancez d'abord l'analyse."
                : "Le PDF sera disponible après génération du guide déclaratif."}
          </span>
        </div>
      )}

      {!blockGeneration && showWarning && (
        <div className="mb-4 p-3 rounded border border-warning/40 bg-warning/5 text-xs text-foreground flex gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>
            Le PDF sera généré <strong>avec des points à vérifier</strong>
            {reviewPending ? " (revue en attente)" : ""}
            {hasManualReviewCases ? " (cases nécessitant une vérification)" : ""}
            {guidanceWithWarnings ? " (guide déclaratif avec alertes)" : ""}.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded border border-destructive/40 bg-destructive/5 text-xs text-foreground"
        >
          Erreur lors de l'accès aux exports : {error}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <OptionRow
          label="Inclure les sources fiscales (RAG)"
          checked={opts.includeRagSources}
          onChange={(v) => setOpts((o) => ({ ...o, includeRagSources: v }))}
        />
        <OptionRow
          label="Inclure les points de revue"
          checked={opts.includeReviewItems}
          onChange={(v) => setOpts((o) => ({ ...o, includeReviewItems: v }))}
        />
        <OptionRow
          label="Inclure l'audit technique (annexe)"
          checked={opts.includeAudit}
          onChange={(v) => setOpts((o) => ({ ...o, includeAudit: v }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleGenerate}
          disabled={blockGeneration || generating}
          className="w-full sm:w-auto"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération en cours…
            </>
          ) : lastExport ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" /> Regénérer le PDF
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" /> Générer le PDF
            </>
          )}
        </Button>
        {lastExport && (
          <Button
            variant="outline"
            onClick={() => handleDownload(lastExport.storage_path)}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" /> Télécharger le dernier PDF
          </Button>
        )}
      </div>

      {/* Preview */}
      {lastExport && (
        <section className="mt-6 pt-5 border-t" aria-label="Aperçu du PDF">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                Aperçu du dernier PDF
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lastExport.file_name} —{" "}
                {new Date(lastExport.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
              >
                Ouvrir dans un nouvel onglet <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {previewLoading ? (
            <div className="h-64 rounded border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement de
              l'aperçu…
            </div>
          ) : previewUrl ? (
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-[480px] rounded border bg-muted/20"
              aria-label="Aperçu du PDF"
            >
              <div className="p-4 text-xs text-muted-foreground">
                Votre navigateur ne peut pas afficher le PDF directement.
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 ml-1 hover:underline"
                >
                  Ouvrir dans un nouvel onglet
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </object>
          ) : (
            <div className="h-32 rounded border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
              Aperçu indisponible.
            </div>
          )}
        </section>
      )}

      {/* Historique */}
      <div className="mt-6 pt-5 border-t">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Historique des exports
          </h3>
          {exports.length > 0 && (
            <Badge variant="secondary">{exports.length}</Badge>
          )}
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
          </div>
        ) : exports.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Aucun export pour le moment.
          </div>
        ) : (
          <ul className="space-y-2">
            {exports.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 p-3 rounded border bg-muted/30"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground truncate">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{row.file_name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    PDF fiscal •{" "}
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {row.include_rag_sources && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        RAG
                      </Badge>
                    )}
                    {row.include_review_items && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        Revue
                      </Badge>
                    )}
                    {row.include_audit && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        Audit
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(row.storage_path)}
                    aria-label={`Télécharger ${row.file_name}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(row)}
                    aria-label={`Supprimer ${row.file_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

const OptionRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer">
    <span className="text-sm text-foreground">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

const ExportStateBadge = ({ state }: { state: ExportUiState }) => {
  switch (state) {
    case "no_analysis":
      return <Badge variant="outline">Analyse manquante</Badge>;
    case "no_guidance":
      return <Badge variant="outline">Guide manquant</Badge>;
    case "loading":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Chargement
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Génération…
        </Badge>
      );
    case "generated":
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> PDF généré
        </Badge>
      );
    case "error":
      return <Badge variant="destructive">Erreur</Badge>;
    case "ready":
    default:
      return <Badge variant="outline">Prêt</Badge>;
  }
};
