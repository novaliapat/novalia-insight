import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExtractionStatusBadge } from "@/components/declaration/ExtractionStatusBadge";
import { AuditMetricCard } from "./AuditMetricCard";
import { ConsistencyIssueCard } from "./ConsistencyIssueCard";
import { TaxCategoryLabel } from "@/lib/declaration/utils/taxFormatting";
import { useExtractionAudit } from "@/hooks/useExtractionAudit";
import {
  ChevronDown,
  Code2,
  Copy,
  Check,
  ClipboardList,
  FileText,
  Calendar,
  Cpu,
  AlertTriangle,
  HelpCircle,
  ListChecks,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  declarationId: string;
  /** Démarrage replié par défaut, à part en cas de needs_review (ouvert). */
  defaultOpen?: boolean;
}

export const ExtractionAuditPanel = ({ declarationId, defaultOpen }: Props) => {
  const { audit, loading, error, loggedAt } = useExtractionAudit(declarationId);
  const autoOpen = defaultOpen ?? audit?.status === "extraction_needs_review";
  const [open, setOpen] = useState<boolean>(!!autoOpen);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    if (!audit) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(audit, null, 2));
      setCopied(true);
      toast.success("JSON d'audit copié");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-muted/30 transition-smooth"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ClipboardList className="h-5 w-5 text-accent shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Audit d'extraction
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trace technique de la dernière extraction lancée sur cette déclaration.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {audit && <ExtractionStatusBadge status={audit.status} />}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border p-5 space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement de l'audit…
              </div>
            )}

            {!loading && error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            {!loading && !audit && !error && (
              <div className="text-sm text-muted-foreground">
                Aucun audit backend disponible pour cette analyse.
              </div>
            )}

            {audit && (
              <>
                {/* Bloc d'identité */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <AuditMetricCard
                    label="Date d'extraction"
                    value={new Date(audit.extractedAt).toLocaleString("fr-FR")}
                    hint={
                      loggedAt
                        ? `Audit enregistré le ${new Date(loggedAt).toLocaleString("fr-FR")}`
                        : undefined
                    }
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <AuditMetricCard
                    label="Modèle utilisé"
                    value={audit.modelUsed ?? "—"}
                    hint={`Prompt ${audit.extractionPromptVersion}${
                      audit.dryRun ? " · dry-run" : ""
                    }`}
                    icon={<Cpu className="h-3.5 w-3.5" />}
                  />
                </div>

                {/* Métriques */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Métriques
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <AuditMetricCard
                      label="Fichiers analysés"
                      value={audit.numberOfFiles}
                      icon={<FileText className="h-3.5 w-3.5" />}
                    />
                    <AuditMetricCard
                      label="Champs extraits"
                      value={audit.numberOfExtractedFields}
                      icon={<ListChecks className="h-3.5 w-3.5" />}
                    />
                    <AuditMetricCard
                      label="Confiance globale"
                      value={
                        audit.globalConfidence === "high"
                          ? "Élevée"
                          : audit.globalConfidence === "medium"
                          ? "Moyenne"
                          : "Faible"
                      }
                      tone={
                        audit.globalConfidence === "high"
                          ? "success"
                          : audit.globalConfidence === "medium"
                          ? "info"
                          : "warning"
                      }
                    />
                    <AuditMetricCard
                      label="Warnings"
                      value={audit.numberOfWarnings}
                      tone={audit.numberOfWarnings > 0 ? "warning" : "neutral"}
                      icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    />
                    <AuditMetricCard
                      label="Données manquantes"
                      value={audit.numberOfMissingData}
                      tone={audit.numberOfMissingData > 0 ? "warning" : "neutral"}
                      icon={<HelpCircle className="h-3.5 w-3.5" />}
                    />
                    <AuditMetricCard
                      label="Incohérences"
                      value={audit.numberOfConsistencyIssues}
                      tone={audit.numberOfConsistencyIssues > 0 ? "warning" : "neutral"}
                      icon={<ShieldAlert className="h-3.5 w-3.5" />}
                    />
                  </div>
                </div>

                {/* Catégories */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Catégories détectées ({audit.detectedCategories.length})
                  </div>
                  {audit.detectedCategories.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {audit.detectedCategories.map((c) => (
                        <Badge key={c} variant="secondary">
                          {TaxCategoryLabel[c as keyof typeof TaxCategoryLabel] ?? c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Incohérences */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Points de contrôle détectés
                  </div>
                  {audit.consistencyIssues.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Aucun point de contrôle automatique soulevé.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {audit.consistencyIssues.map((i, idx) => (
                        <ConsistencyIssueCard key={`${i.code}-${idx}`} issue={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Warnings */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Warnings ({audit.warnings.length})
                  </div>
                  {audit.warnings.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucun warning.</div>
                  ) : (
                    <ul className="space-y-1.5 text-sm list-disc pl-5 text-foreground">
                      {audit.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* MissingData */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                    Données manquantes ({audit.missingData.length})
                  </div>
                  {audit.missingData.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune donnée manquante signalée.</div>
                  ) : (
                    <ul className="space-y-1.5 text-sm list-disc pl-5 text-foreground">
                      {audit.missingData.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* JSON technique */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setJsonOpen((v) => !v)}
                    >
                      <Code2 className="h-4 w-4" />
                      {jsonOpen ? "Masquer le JSON complet" : "Afficher le JSON complet"}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2" onClick={copyJson}>
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copier le JSON
                    </Button>
                  </div>
                  {jsonOpen && (
                    <pre className="text-[11px] leading-relaxed overflow-auto max-h-96 rounded-md border border-border bg-muted/40 p-3 font-mono">
                      {JSON.stringify(audit, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
