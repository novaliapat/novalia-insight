import { cn } from "@/lib/utils";
import {
  ExtractionStatusLabel,
  ExtractionStatusTone,
  type ExtractionStatus,
} from "@/lib/declaration/status/extractionStatus";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle, Eye } from "lucide-react";

const TONE_CLASS: Record<ReturnType<typeof toneOf>, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/10 text-primary border-primary/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/40",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
};

function toneOf(s: ExtractionStatus) {
  return ExtractionStatusTone[s];
}

const ICON: Record<ExtractionStatus, typeof Clock> = {
  extraction_not_started: Clock,
  extraction_processing: Loader2,
  extraction_completed: CheckCircle2,
  extraction_completed_with_warnings: AlertTriangle,
  extraction_failed: XCircle,
  extraction_needs_review: Eye,
};

export const ExtractionStatusBadge = ({
  status,
  className,
}: {
  status: ExtractionStatus;
  className?: string;
}) => {
  const Icon = ICON[status];
  const tone = toneOf(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          status === "extraction_processing" && "animate-spin",
        )}
      />
      {ExtractionStatusLabel[status]}
    </span>
  );
};
