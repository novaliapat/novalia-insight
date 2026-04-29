import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import type { RagConfidence } from "@/lib/rag/ragScoring";

interface Props {
  confidence: RagConfidence;
}

const META: Record<RagConfidence, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  high: {
    label: "Pertinence haute",
    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  medium: {
    label: "Pertinence moyenne",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    Icon: AlertTriangle,
  },
  low: {
    label: "Pertinence faible",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: AlertCircle,
  },
};

export const RagSearchStatusBadge = ({ confidence }: Props) => {
  const { label, cls, Icon } = META[confidence];
  return (
    <Badge variant="outline" className={`gap-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[11px]">{label}</span>
    </Badge>
  );
};
