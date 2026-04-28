import { useParams, Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const DeclarationDetail = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8 max-w-5xl">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-smooth">Tableau de bord</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Détail</span>
        </nav>

        <Card className="p-10 text-center">
          <h2 className="font-display text-2xl font-semibold mb-2">Détail de l'analyse</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Identifiant : <span className="font-mono">{id}</span>
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Cette page affichera la synthèse complète de l'analyse enregistrée. Disponible
            après le branchement de la persistance dans le prochain lot.
          </p>
          <Link to="/">
            <Button variant="outline">Retour au tableau de bord</Button>
          </Link>
        </Card>
      </main>
    </div>
  );
};

export default DeclarationDetail;
