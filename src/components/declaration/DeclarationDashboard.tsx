import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeclarationHistory } from "@/hooks/useDeclarationHistory";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { DeclarationStatusLabel } from "@/lib/declaration/schemas/declarationSchema";
import { formatDateFr } from "@/lib/declaration/utils/taxFormatting";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { DeclarationReviewStatusBadge } from "./review/DeclarationReviewStatusBadge";
import {
  applyFilter,
  computeDashboardCounts,
  DashboardFilterLabel,
  sortByPriority,
  type DashboardFilter,
} from "@/lib/declaration/dashboard/dashboardFilters";
import {
  Plus,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  XCircle,
} from "lucide-react";

const FILTER_ORDER: DashboardFilter[] = [
  "all",
  "to_process",
  "review_completed",
  "extraction_with_warnings",
  "extraction_failed",
];

export const DeclarationDashboard = () => {
  const { declarations, loading } = useDeclarationHistory();
  const [filter, setFilter] = useState<DashboardFilter>("all");

  const counts = useMemo(() => computeDashboardCounts(declarations), [declarations]);

  const filtered = useMemo(() => {
    const base = applyFilter(declarations, filter);
    return filter === "to_process" ? sortByPriority(base) : base;
  }, [declarations, filter]);

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="rounded-2xl border border-border bg-gradient-subtle overflow-hidden shadow-elegant">
        <div className="p-8 md:p-12 grid md:grid-cols-[1fr,auto] gap-6 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
              Novalia Patrimoine
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              Assistant de déclaration fiscale
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Importez vos documents fiscaux, vérifiez les données extraites, puis obtenez une
              synthèse claire des cases à remplir, avec leurs sources et points de vigilance.
            </p>
          </div>
          <Link to="/declaration/nouvelle">
            <Button size="lg" className="gap-2 shadow-elegant">
              <Plus className="h-4 w-4" /> Créer une nouvelle analyse
            </Button>
          </Link>
        </div>
      </section>

      {/* COMPTEURS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={ListChecks}
          label="Analyses totales"
          value={counts.total}
          tone="muted"
          onClick={() => setFilter("all")}
          active={filter === "all"}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="À traiter"
          value={counts.toProcess}
          tone="warning"
          onClick={() => setFilter("to_process")}
          active={filter === "to_process"}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Revue terminée"
          value={counts.reviewCompleted}
          tone="success"
          onClick={() => setFilter("review_completed")}
          active={filter === "review_completed"}
        />
        <SummaryCard
          icon={XCircle}
          label="Extraction échouée"
          value={counts.extractionFailed}
          tone="destructive"
          onClick={() => setFilter("extraction_failed")}
          active={filter === "extraction_failed"}
        />
      </section>

      {/* LISTE */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-display text-xl font-semibold">
            {filter === "all" ? "Mes analyses" : DashboardFilterLabel[filter]}
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-smooth ${
                  filter === f
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {DashboardFilterLabel[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <FileText className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {declarations.length === 0
                ? "Aucune analyse pour le moment."
                : "Aucune analyse ne correspond à ce filtre."}
            </p>
            {declarations.length === 0 && (
              <p className="text-xs text-muted-foreground/80 mt-1">
                Créez votre première analyse pour commencer.
              </p>
            )}
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((d) => (
              <Link to={`/declaration/${d.id}`} key={d.id}>
                <Card className="p-5 hover:shadow-elegant transition-smooth flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Année fiscale {d.tax_year} · créée le {formatDateFr(d.created_at)}
                    </div>
                    {d.review_pending_count > 0 && (
                      <div className="text-xs text-warning mt-1.5">
                        {d.review_pending_count} point{d.review_pending_count > 1 ? "s" : ""} de revue en attente
                        {d.has_pending_error && " · alerte critique"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {d.extraction_status && (
                      <ExtractionStatusBadge status={d.extraction_status} />
                    )}
                    <DeclarationReviewStatusBadge status={d.review_status} hideWhenNone />
                    <Badge variant="secondary">{DeclarationStatusLabel[d.status]}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <LegalDisclaimer />
    </div>
  );
};

// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: typeof ListChecks;
  label: string;
  value: number;
  tone: "muted" | "warning" | "success" | "destructive";
  onClick: () => void;
  active: boolean;
}

const TONES: Record<SummaryCardProps["tone"], string> = {
  muted: "text-muted-foreground",
  warning: "text-warning",
  success: "text-success",
  destructive: "text-destructive",
};

function SummaryCard({ icon: Icon, label, value, tone, onClick, active }: SummaryCardProps) {
  return (
    <button onClick={onClick} className="text-left">
      <Card
        className={`p-4 transition-smooth hover:shadow-elegant ${
          active ? "border-foreground/40 shadow-elegant" : ""
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`h-4 w-4 ${TONES[tone]}`} />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
        <div className="font-display text-2xl font-semibold text-foreground">{value}</div>
      </Card>
    </button>
  );
}
