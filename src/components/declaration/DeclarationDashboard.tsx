import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeclarationHistory } from "@/hooks/useDeclarationHistory";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { DeclarationStatusLabel } from "@/lib/declaration/schemas/declarationSchema";
import { formatDateFr } from "@/lib/declaration/utils/taxFormatting";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import {
  ExtractionStatusLabel,
  type ExtractionStatus,
} from "@/lib/declaration/status/extractionStatus";
import { DeclarationReviewStatusBadge } from "./review/DeclarationReviewStatusBadge";
import { Plus, FileText, Loader2, Eye, Filter } from "lucide-react";

type StatusFilter = "all" | ExtractionStatus | "no_extraction";

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "no_extraction", label: "Pas d'extraction" },
  { value: "extraction_processing", label: ExtractionStatusLabel.extraction_processing },
  { value: "extraction_completed", label: ExtractionStatusLabel.extraction_completed },
  {
    value: "extraction_completed_with_warnings",
    label: ExtractionStatusLabel.extraction_completed_with_warnings,
  },
  { value: "extraction_needs_review", label: ExtractionStatusLabel.extraction_needs_review },
  { value: "extraction_failed", label: ExtractionStatusLabel.extraction_failed },
];

export const DeclarationDashboard = () => {
  const { declarations, loading } = useDeclarationHistory();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const needsReview = useMemo(
    () => declarations.filter((d) => d.extraction_status === "extraction_needs_review"),
    [declarations],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return declarations;
    if (filter === "no_extraction") return declarations.filter((d) => !d.extraction_status);
    return declarations.filter((d) => d.extraction_status === filter);
  }, [declarations, filter]);

  return (
    <div className="space-y-10">
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

      {needsReview.length > 0 && (
        <section className="rounded-2xl border border-warning/40 bg-warning/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-warning" />
            <h2 className="font-display text-lg font-semibold text-foreground">
              Revue manuelle requise
            </h2>
            <Badge variant="secondary" className="ml-1">{needsReview.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Ces analyses contiennent des données à vérifier avant validation (confiance faible
            ou incohérences détectées).
          </p>
          <div className="grid gap-2">
            {needsReview.map((d) => (
              <Link to={`/declaration/${d.id}`} key={d.id}>
                <Card className="p-4 hover:shadow-elegant transition-smooth flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Année {d.tax_year} · {formatDateFr(d.created_at)}
                    </div>
                  </div>
                  <ExtractionStatusBadge status="extraction_needs_review" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-display text-xl font-semibold">Mes analyses</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[240px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Card className="p-5 hover:shadow-elegant transition-smooth flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Année fiscale {d.tax_year} · créée le {formatDateFr(d.created_at)}
                    </div>
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
