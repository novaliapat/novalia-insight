import { ShieldAlert } from "lucide-react";

export const LegalDisclaimer = ({ compact = false }: { compact?: boolean }) => {
  if (compact) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Cet outil fournit une aide à la préparation. Vérifiez les résultats avant toute déclaration officielle.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-soft/50 p-4 flex gap-3">
      <ShieldAlert className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-relaxed text-foreground/90">
        Cet outil fournit une aide à la préparation de votre déclaration fiscale à partir des
        informations transmises. Les résultats doivent être vérifiés avant toute déclaration
        officielle. En cas de doute, rapprochez-vous de votre conseiller fiscal ou de
        l'administration fiscale.
      </p>
    </div>
  );
};
