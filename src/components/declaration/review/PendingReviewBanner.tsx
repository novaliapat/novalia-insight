import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useDeclarationReviewItems } from "@/hooks/useDeclarationReviewItems";

/**
 * Banderole non bloquante affichée si des points de revue restent en `pending`.
 * À afficher au-dessus de la validation pour rendre l'alerte visible sans bloquer.
 */
export function PendingReviewBanner({ declarationId }: { declarationId: string }) {
  const { counts, loading } = useDeclarationReviewItems(declarationId);
  if (loading || counts.pending === 0) return null;

  return (
    <Card className="p-4 mb-4 border-warning/40 bg-warning/5 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-foreground">
          Certains points de revue ne sont pas encore traités.
        </div>
        <p className="text-muted-foreground mt-0.5">
          {counts.pending} point{counts.pending > 1 ? "s" : ""} en attente. Vous pouvez tout de même
          valider, mais nous vous recommandons de les examiner d'abord dans la section
          « Revue rapide ».
        </p>
      </div>
    </Card>
  );
}
