import { AlertTriangle, ShieldAlert, Info, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewBlockingResult } from "@/lib/declaration/review/reviewBlockingRules";

interface Props {
  result: ReviewBlockingResult;
  onGoToReview?: () => void;
  className?: string;
}

export const ReviewBlockingBanner = ({ result, onGoToReview, className }: Props) => {
  if (result.level === "none") return null;

  const styles =
    result.level === "blocked"
      ? {
          container: "border-destructive/40 bg-destructive/5",
          icon: "text-destructive",
          Icon: ShieldAlert,
        }
      : result.level === "confirmation_required"
        ? {
            container: "border-warning/40 bg-warning/5",
            icon: "text-warning",
            Icon: AlertTriangle,
          }
        : {
            container: "border-warning/30 bg-warning/5",
            icon: "text-warning",
            Icon: Info,
          };

  const { Icon } = styles;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex items-start gap-3",
        styles.container,
        className,
      )}
      role={result.level === "blocked" ? "alert" : "status"}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", styles.icon)} />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-foreground">{result.title}</div>
        <p className="text-muted-foreground mt-1">{result.message}</p>
        {result.blockingReasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
            {result.blockingReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      {onGoToReview && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={onGoToReview}
        >
          <ListChecks className="h-4 w-4" />
          Revue rapide
        </Button>
      )}
    </div>
  );
};
