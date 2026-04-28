import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarningCardProps {
  title?: string;
  message: string;
  variant?: "warning" | "info";
}

export const WarningCard = ({ title, message, variant = "warning" }: WarningCardProps) => {
  const Icon = variant === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        variant === "warning"
          ? "border-warning/40 bg-warning/5 text-foreground"
          : "border-primary/20 bg-primary/5 text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0 mt-0.5",
          variant === "warning" ? "text-warning" : "text-primary"
        )}
      />
      <div>
        {title && <div className="font-medium mb-0.5">{title}</div>}
        <div className="text-muted-foreground">{message}</div>
      </div>
    </div>
  );
};
