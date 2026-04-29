import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ReviewBlockingResult } from "@/lib/declaration/review/reviewBlockingRules";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationId: string;
  result: ReviewBlockingResult;
  context?: "before_analysis" | "before_finalization";
  onConfirmed: () => void;
  onGoToReview?: () => void;
}

export const ReviewOverrideDialog = ({
  open,
  onOpenChange,
  declarationId,
  result,
  context,
  onConfirmed,
  onGoToReview,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("confirm-review-override", {
        body: { declarationId, context },
      });
      if (error) throw new Error(error.message);
      onOpenChange(false);
      onConfirmed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la confirmation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result.title}</DialogTitle>
          <DialogDescription>{result.message}</DialogDescription>
        </DialogHeader>

        {result.blockingReasons.length > 0 && (
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            {result.blockingReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Votre confirmation sera enregistrée dans le journal d'audit de la déclaration.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          {onGoToReview && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onGoToReview();
              }}
              disabled={submitting}
            >
              Retourner à la revue rapide
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Continuer malgré les points en attente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
