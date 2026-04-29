import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Globe } from "lucide-react";
import type { FormSource } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  source: FormSource;
  compact?: boolean;
}

export const GuidanceSourceBadge = ({ source, compact = false }: Props) => {
  const isOfficial = source.isOfficialSource;
  const Icon =
    source.provenance === "official_brochure"
      ? BookOpen
      : source.provenance === "official_fetch"
        ? Globe
        : FileText;

  const label = [
    source.title,
    source.pageNumber ? `p.${source.pageNumber}` : null,
    source.formId ? `Form. ${source.formId}` : null,
    source.boxCodes && source.boxCodes.length > 0
      ? `cases ${source.boxCodes.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <Badge
        variant="outline"
        className={
          isOfficial
            ? "border-accent/40 bg-accent/5 text-foreground gap-1 text-[11px]"
            : "border-muted text-muted-foreground gap-1 text-[11px]"
        }
      >
        <Icon className="h-3 w-3" /> {label}
      </Badge>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded border p-2.5 text-xs ${
        isOfficial
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium text-foreground">{label}</div>
        {source.sectionLabel && (
          <div className="text-[11px] text-muted-foreground">
            Section : {source.sectionLabel}
          </div>
        )}
        {source.excerpt && (
          <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
            « {source.excerpt} »
          </p>
        )}
      </div>
    </div>
  );
};
