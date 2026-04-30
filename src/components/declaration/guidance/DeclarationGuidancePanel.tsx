import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpenCheck,
  Compass,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useDeclarationGuidance } from "@/hooks/useDeclarationGuidance";
import { GuidanceConfidenceBadge } from "./GuidanceConfidenceBadge";
import { GuidanceSourceBadge } from "./GuidanceSourceBadge";
import { RequiredFormsPanel } from "./RequiredFormsPanel";
import { TaxBoxProposalCard } from "./TaxBoxProposalCard";
import { DeclarationStepTimeline } from "./DeclarationStepTimeline";
import { MissingFiscalSourcesPanel } from "./MissingFiscalSourcesPanel";
import { ManualReviewGuidancePanel } from "./ManualReviewGuidancePanel";
import type {
  DeclarationGuidance,
  FormSource,
} from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  declarationId: string | null | undefined;
  /** Si fourni (mode in-memory), évite l'appel à l'edge function. */
  initialGuidance?: DeclarationGuidance | null;
}

export const DeclarationGuidancePanel = ({
  declarationId,
  initialGuidance,
}: Props) => {
  const hook = useDeclarationGuidance(declarationId ?? null);

  // Fallback in-memory si pas encore enregistré
  const guidance = hook.guidance ?? initialGuidance ?? null;
  const status = hook.status ?? (initialGuidance ? "guidance_completed" : null);

  const usedSources = useMemo(() => {
    if (!guidance) return [] as FormSource[];
    const map = new Map<string, FormSource>();
    const push = (s: FormSource) => {
      if (!s.isOfficialSource) return;
      const key = `${s.title}|${s.pageNumber ?? ""}|${(s.boxCodes ?? []).join(",")}`;
      if (!map.has(key)) map.set(key, s);
    };
    guidance.requiredForms.forEach((f) => f.sources.forEach(push));
    guidance.taxBoxProposals.forEach((p) => p.ragSources.forEach(push));
    return [...map.values()].slice(0, 8);
  }, [guidance]);

  // ── Mode déconnecté ──────────────────────────────────────────────
  if (!declarationId && !initialGuidance) {
    return (
      <Card className="p-5 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Compass className="h-4 w-4 text-accent" />
          <h3 className="font-display text-base font-semibold">
            Comment déclarer ces revenus ?
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Enregistrez l'analyse pour générer le guide déclaratif.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-xl font-semibold flex items-center gap-2">
            <Compass className="h-5 w-5 text-accent" />
            Comment déclarer ces revenus ?
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Guide pas-à-pas généré à partir des données validées et des sources
            officielles ingérées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} />}
          {declarationId && (
            <>
              {!guidance ? (
                <Button
                  size="sm"
                  onClick={() => hook.generateGuidance(declarationId)}
                  disabled={hook.generating}
                  className="gap-2"
                >
                  {hook.generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Générer le guide
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => hook.regenerateGuidance(declarationId)}
                  disabled={hook.generating}
                  className="gap-2"
                >
                  {hook.generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Régénérer
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {hook.error && (
        <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {hook.error}
        </div>
      )}

      {hook.loading && !guidance && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du guide…
        </div>
      )}

      {!guidance && !hook.loading && !hook.error && declarationId && (
        <p className="text-sm text-muted-foreground">
          Aucun guide généré pour cette déclaration. Cliquez sur{" "}
          <strong>Générer le guide</strong> pour produire le parcours déclaratif.
        </p>
      )}

      {guidance && (
        <>
          {/* Résumé */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryTile label="Formulaires" value={guidance.requiredForms.length} />
            <SummaryTile label="Cases proposées" value={guidance.taxBoxProposals.length} />
            <SummaryTile label="À vérifier" value={guidance.manualReviewItems.length} />
            <div className="rounded border bg-muted/30 p-3 text-xs flex flex-col items-start gap-1">
              <span className="text-muted-foreground">Confiance globale</span>
              <GuidanceConfidenceBadge confidence={guidance.confidence} />
            </div>
          </div>

          {/* Situations détectées */}
          {guidance.detectedSituations.length > 0 && (
            <div className="rounded border bg-muted/20 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Situations détectées
              </div>
              <ul className="text-xs text-foreground/85 list-disc pl-5 space-y-0.5">
                {guidance.detectedSituations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 1. Formulaires requis */}
          <Section title="Formulaires et annexes à ouvrir">
            <RequiredFormsPanel forms={guidance.requiredForms} />
          </Section>

          {/* 2. Timeline */}
          <Section title="Parcours pas-à-pas">
            <DeclarationStepTimeline steps={guidance.declarationSteps} />
          </Section>

          {/* 3. Cases proposées */}
          <Section
            title="Cases et lignes proposées"
            badge={guidance.taxBoxProposals.length}
          >
            {guidance.taxBoxProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune case proposée — données insuffisantes ou sources manquantes.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {guidance.taxBoxProposals.map((p, i) => (
                  <TaxBoxProposalCard key={`${p.formId}-${p.boxOrLine}-${i}`} proposal={p} />
                ))}
              </div>
            )}
          </Section>

          {/* 4. Revue manuelle */}
          <ManualReviewGuidancePanel items={guidance.manualReviewItems} />

          {/* 5. Sources manquantes */}
          <MissingFiscalSourcesPanel items={guidance.missingSources} />

          {/* 6. Sources utilisées */}
          {usedSources.length > 0 && (
            <Section title="Sources officielles utilisées">
              <div className="grid gap-2 md:grid-cols-2">
                {usedSources.map((s, i) => (
                  <GuidanceSourceBadge key={i} source={s} />
                ))}
              </div>
            </Section>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded border border-accent/30 bg-accent/5 p-3 text-[11px] text-foreground/80">
            <BookOpenCheck className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            {guidance.disclaimer}
          </div>
        </>
      )}
    </Card>
  );
};

const Section = ({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
}) => (
  <section className="space-y-2.5">
    <div className="flex items-center gap-2">
      <h4 className="font-display text-base font-semibold">{title}</h4>
      {badge != null && badge > 0 && <Badge variant="secondary">{badge}</Badge>}
      <span className="h-px flex-1 bg-border" />
    </div>
    {children}
  </section>
);

const SummaryTile = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded border bg-muted/30 p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="font-display text-2xl text-primary mt-0.5">{value}</div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "guidance_completed") {
    return (
      <Badge className="bg-success/15 text-success border-success/30">
        Guide complet
      </Badge>
    );
  }
  if (status === "guidance_completed_with_warnings") {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30">
        Guide avec points à vérifier
      </Badge>
    );
  }
  if (status === "guidance_failed") {
    return (
      <Badge variant="destructive">Échec de génération</Badge>
    );
  }
  return <Badge variant="outline">Brouillon</Badge>;
};
