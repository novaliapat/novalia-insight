import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "destructive";
  icon?: ReactNode;
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "text-foreground",
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export const AuditMetricCard = ({ label, value, hint, tone = "neutral", icon }: Props) => {
  return (
    <Card className="p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("font-display text-2xl font-semibold leading-tight", TONE[tone])}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
};
