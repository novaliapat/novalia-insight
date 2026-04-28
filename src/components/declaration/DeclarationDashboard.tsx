import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeclarationHistory } from "@/hooks/useDeclarationHistory";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { DeclarationStatusLabel } from "@/lib/declaration/schemas/declarationSchema";
import { formatDateFr } from "@/lib/declaration/utils/taxFormatting";
import { Plus, FileText, Loader2 } from "lucide-react";

export const DeclarationDashboard = () => {
  const { declarations, loading } = useDeclarationHistory();

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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Mes analyses</h2>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </Card>
        ) : declarations.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <FileText className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aucune analyse pour le moment.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Créez votre première analyse pour commencer.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {declarations.map((d) => (
              <Link to={`/declaration/${d.id}`} key={d.id}>
                <Card className="p-5 hover:shadow-elegant transition-smooth flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Année fiscale {d.tax_year} · créée le {formatDateFr(d.created_at)}
                    </div>
                  </div>
                  <Badge variant="secondary">{DeclarationStatusLabel[d.status]}</Badge>
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
