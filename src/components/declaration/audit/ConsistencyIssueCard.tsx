import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ConsistencyIssue } from "@/lib/declaration/contracts/auditContract";

const ICON = { info: Info, warning: AlertTriangle, error: AlertCircle } as const;

const TONE = {
  info: "border-primary/30 bg-primary/5 text-primary",
  warning: "border-warning/40 bg-warning/5 text-warning",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
} as const;

const LABEL = { info: "Info", warning: "Attention", error: "Erreur" } as const;

export const ConsistencyIssueCard = ({ issue }: { issue: ConsistencyIssue }) => {
  const Icon = ICON[issue.severity];
  return (
    <div className={cn("rounded-lg border p-3 flex items-start gap-3", TONE[issue.severity])}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider font-semibold">
            {LABEL[issue.severity]}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">{issue.code}</span>
        </div>
        <div className="text-sm text-foreground mt-1">{issue.message}</div>
        {issue.field && (
          <div className="text-xs text-muted-foreground font-mono mt-1">
            Champ&nbsp;: {issue.field}
          </div>
        )}
      </div>
    </div>
  );
};
