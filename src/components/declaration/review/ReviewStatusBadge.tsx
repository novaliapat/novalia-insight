import { Badge } from "@/components/ui/badge";
import { Check, EyeOff, Clock } from "lucide-react";
import type { ReviewItemStatus } from "@/hooks/useDeclarationReviewItems";

const META: Record<ReviewItemStatus, { label: string; icon: typeof Check; className: string }> = {
  pending: { label: "À traiter", icon: Clock, className: "bg-warning/10 text-warning border-warning/30" },
  resolved: { label: "Corrigé", icon: Check, className: "bg-success/10 text-success border-success/30" },
  ignored: { label: "Ignoré", icon: EyeOff, className: "bg-muted text-muted-foreground border-border" },
};

export function ReviewStatusBadge({ status }: { status: ReviewItemStatus }) {
  const m = META[status];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${m.className}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}
