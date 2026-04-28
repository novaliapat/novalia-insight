import { ConfidenceLabel } from "@/lib/declaration/utils/taxFormatting";
import type { ConfidenceLevel } from "@/lib/declaration/schemas/extractedDataSchema";
import { cn } from "@/lib/utils";

const STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning border-warning/40",
  low: "bg-destructive/10 text-destructive border-destructive/30",
};

export const ConfidenceBadge = ({
  level,
  className,
}: {
  level: ConfidenceLevel;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
      STYLES[level],
      className
    )}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    Confiance {ConfidenceLabel[level].toLowerCase()}
  </span>
);
