import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { formatEuro } from "@/lib/declaration/utils/taxFormatting";
import { FileText } from "lucide-react";
import type { ConfidenceLevel } from "@/lib/declaration/schemas/extractedDataSchema";

export interface ExtractedEvidence {
  field: string;
  amount?: number | null;
  confidence: ConfidenceLevel;
  sourceDocument?: string;
  note?: string;
}

/**
 * Affiche la preuve documentaire d'un champ extrait.
 * IMPORTANT : n'invente jamais d'extrait. Si on n'a que le nom du fichier
 * et le champ, on les affiche tels quels — pas de citation textuelle.
 */
export const ExtractedEvidenceCard = ({ evidence }: { evidence: ExtractedEvidence }) => {
  const hasSource = evidence.sourceDocument && evidence.sourceDocument.trim().length > 0;
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">
              {hasSource ? evidence.sourceDocument : "Document source non précisé"}
            </div>
            <div className="font-medium text-sm">{evidence.field}</div>
          </div>
        </div>
        <ConfidenceBadge level={evidence.confidence} />
      </div>
      {(evidence.amount !== undefined && evidence.amount !== null) && (
        <div className="text-base font-display font-semibold">
          {formatEuro(evidence.amount)}
        </div>
      )}
      {evidence.note && (
        <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
          {evidence.note}
        </div>
      )}
    </Card>
  );
};

/**
 * Aplati les ExtractedData en une liste d'evidences pour rendu UI.
 */
export function flattenEvidences(data: {
  ifu: Array<Record<string, unknown>>;
  scpi: Array<Record<string, unknown>>;
  lifeInsurance: Array<Record<string, unknown>>;
}): ExtractedEvidence[] {
  const out: ExtractedEvidence[] = [];
  const fieldLabels: Record<string, string> = {
    dividends: "Dividendes",
    interests: "Intérêts",
    capitalGains: "Plus-values",
    withholdingTax: "Prélèvement à la source / PFU",
    socialContributions: "Prélèvements sociaux",
    frenchIncome: "Revenus France",
    foreignIncome: "Revenus étrangers",
    deductibleInterests: "Intérêts déductibles",
    withdrawals: "Rachats",
    taxableShare: "Part imposable",
  };
  const buckets: Array<{
    name: string;
    arr: Array<Record<string, unknown>>;
    titleKey: string;
  }> = [
    { name: "IFU", arr: data.ifu, titleKey: "institution" },
    { name: "SCPI", arr: data.scpi, titleKey: "scpiName" },
    { name: "Assurance-vie", arr: data.lifeInsurance, titleKey: "contractName" },
  ];
  for (const b of buckets) {
    for (const entry of b.arr) {
      const title = (entry[b.titleKey] as string) ?? b.name;
      for (const [k, v] of Object.entries(entry)) {
        if (
          v &&
          typeof v === "object" &&
          "value" in (v as Record<string, unknown>) &&
          "confidence" in (v as Record<string, unknown>)
        ) {
          const f = v as { value: number; confidence: ConfidenceLevel; sourceDocument?: string; note?: string };
          out.push({
            field: `${title} — ${fieldLabels[k] ?? k}`,
            amount: f.value,
            confidence: f.confidence,
            sourceDocument: f.sourceDocument,
            note: f.note,
          });
        }
      }
    }
  }
  return out;
}
