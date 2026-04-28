import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, ScrollText } from "lucide-react";

export const AppHeader = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-primary shadow-soft">
            <ScrollText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold text-foreground">Novalia</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Déclaration impôts
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            to="/"
            className={`transition-smooth hover:text-foreground ${
              location.pathname === "/" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Tableau de bord
          </Link>
          <Link
            to="/declaration/nouvelle"
            className={`transition-smooth hover:text-foreground ${
              location.pathname.startsWith("/declaration") ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Nouvelle analyse
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
