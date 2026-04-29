import { Badge } from "@/components/ui/badge";
import {
  ReviewStatusLabel,
  type DeclarationReviewStatus,
} from "@/lib/declaration/review/computeReviewStatus";
import { CheckCircle2, Clock, EyeOff, Minus } from "lucide-react";

const META: Record<
  DeclarationReviewStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  no_review_needed: {
    icon: Minus,
    className: "bg-muted text-muted-foreground border-border",
  },
  review_pending: {
    icon: Clock,
    className: "bg-warning/10 text-warning border-warning/30",
  },
  review_completed: {
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/30",
  },
  review_partially_ignored: {
    icon: EyeOff,
    className: "bg-accent/10 text-accent border-accent/30",
  },
};

const ALLOWED: ReadonlyArray<DeclarationReviewStatus> = [
  "no_review_needed",
  "review_pending",
  "review_completed",
  "review_partially_ignored",
];

export function DeclarationReviewStatusBadge({
  status,
  hideWhenNone = false,
}: {
  status: string | null | undefined;
  hideWhenNone?: boolean;
}) {
  if (!status) return null;
  if (!ALLOWED.includes(status as DeclarationReviewStatus)) return null;
  const typed = status as DeclarationReviewStatus;
  if (hideWhenNone && typed === "no_review_needed") return null;
  const m = META[typed];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${m.className}`}>
      <Icon className="h-3 w-3" />
      {ReviewStatusLabel[typed]}
    </Badge>
  );
}
