import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { ConfidenceLevel } from "@/lib/declaration/contracts/extractedDataContract";

interface Props {
  confidence: ConfidenceLevel;
}

export const GuidanceConfidenceBadge = ({ confidence }: Props) => {
  if (confidence === "high") {
    return (
      <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20 gap-1">
        <ShieldCheck className="h-3 w-3" /> Confiance élevée
      </Badge>
    );
  }
  if (confidence === "medium") {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 gap-1">
        <ShieldAlert className="h-3 w-3" /> À vérifier
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <ShieldQuestion className="h-3 w-3" /> Faible / incertain
    </Badge>
  );
};
