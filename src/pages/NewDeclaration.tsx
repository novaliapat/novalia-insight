import { Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { NewDeclarationFlow } from "@/components/declaration/NewDeclarationFlow";
import { ChevronRight } from "lucide-react";

const NewDeclaration = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8 max-w-5xl">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-smooth">
            Tableau de bord
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Nouvelle analyse</span>
        </nav>
        <NewDeclarationFlow />
      </main>
    </div>
  );
};

export default NewDeclaration;
