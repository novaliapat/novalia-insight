import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";
import { useLoadDeclaration } from "@/hooks/useDeclarationPersistence";
import { FinalSummaryStep } from "@/components/declaration/FinalSummaryStep";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";

const DeclarationDetail = () => {
  const { id } = useParams();
  const { load, loading, error, data } = useLoadDeclaration();

  useEffect(() => {
    if (id) load(id);
  }, [id, load]);

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

        {!loading && (error || !data?.analysis) && (
          <Card className="p-10 text-center">
            <h2 className="font-display text-2xl font-semibold mb-2">Analyse introuvable</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {error ?? "Cette déclaration n'a pas d'analyse enregistrée."}
            </p>
            <Link to="/">
              <Button variant="outline">Retour au tableau de bord</Button>
            </Link>
          </Card>
        )}

        {!loading && data?.analysis && (
          <>
            <FinalSummaryStep
              analysis={data.analysis}
              onPrev={() => history.back()}
              onSave={() => {}}
            />
            <div className="mt-8">
              <LegalDisclaimer />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default DeclarationDetail;
