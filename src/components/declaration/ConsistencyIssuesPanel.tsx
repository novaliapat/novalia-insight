import { Card } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ConsistencyIssue } from "@/lib/declaration/validation/extractionConsistencyChecks";
import { cn } from "@/lib/utils";

const ICON = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const TONE = {
  info: "text-primary",
  warning: "text-warning",
  error: "text-destructive",
} as const;

export const ConsistencyIssuesPanel = ({ issues }: { issues: ConsistencyIssue[] }) => {
  if (issues.length === 0) return null;
  return (
    <Card className="p-5 border-warning/40 bg-warning/5">
      <h3 className="font-display text-lg font-semibold mb-3">
        Points à vérifier avant validation
      </h3>
      <ul className="space-y-2">
        {issues.map((i, idx) => {
          const Icon = ICON[i.severity];
          return (
            <li key={`${i.code}-${idx}`} className="flex items-start gap-2 text-sm">
              <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", TONE[i.severity])} />
              <div>
                <div>{i.message}</div>
                {i.field && (
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{i.field}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
