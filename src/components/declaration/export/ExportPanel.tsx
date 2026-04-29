import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, Download, Trash2, FileText, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDeclarationExports, type ExportOptions } from "@/hooks/useDeclarationExports";

interface Props {
  declarationId: string;
  hasAnalysis: boolean;
  analysisStatus?: string | null;
  reviewStatus?: string | null;
  hasManualReviewCases?: boolean;
}

export const ExportPanel = ({
  declarationId,
  hasAnalysis,
  analysisStatus,
  reviewStatus,
  hasManualReviewCases,
}: Props) => {
  const { toast } = useToast();
  const { exports, loading, generating, generate, getSignedUrl, remove } =
    useDeclarationExports(declarationId);

  const [opts, setOpts] = useState<ExportOptions>({
    includeAudit: false,
    includeRagSources: true,
    includeReviewItems: true,
  });

  const analysisFailed = analysisStatus === "analysis_failed";
  const reviewPending = reviewStatus === "review_pending";
  const showWarning = reviewPending || hasManualReviewCases;
  const blockGeneration = !hasAnalysis || analysisFailed;

  const handleGenerate = async () => {
    try {
      const result = await generate(opts);
      toast({ title: "PDF généré", description: result.fileName });
      window.open(result.signedUrl, "_blank");
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

  const handleDelete = async (row: typeof exports[number]) => {
    if (!confirm(`Supprimer définitivement ${row.file_name} ?`)) return;
    try {
      await remove(row);
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
      <div className="flex items-center gap-2 mb-1">
        <FileDown className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold text-foreground">
          Exporter le dossier fiscal
        </h2>
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
              : "Aucune analyse fiscale disponible. Lancez d'abord l'analyse."}
          </span>
        </div>
      )}

      {!blockGeneration && showWarning && (
        <div className="mb-4 p-3 rounded border border-warning/40 bg-warning/5 text-xs text-foreground flex gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>
            Ce document sera généré <strong>avec des points à vérifier</strong>
            {reviewPending ? " (revue en attente)" : ""}
            {hasManualReviewCases ? " (cases nécessitant une vérification)" : ""}.
          </span>
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

      <Button onClick={handleGenerate} disabled={blockGeneration || generating} className="w-full sm:w-auto">
        {generating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération en cours…</>
        ) : (
          <><FileDown className="h-4 w-4 mr-2" /> Générer le PDF</>
        )}
      </Button>

      {/* Historique */}
      <div className="mt-6 pt-5 border-t">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-foreground">
            Exports générés
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
                    {new Date(row.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {row.include_rag_sources && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">RAG</Badge>
                    )}
                    {row.include_review_items && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">Revue</Badge>
                    )}
                    {row.include_audit && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">Audit</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(row.storage_path)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(row)}>
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
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer">
    <span className="text-sm text-foreground">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);
