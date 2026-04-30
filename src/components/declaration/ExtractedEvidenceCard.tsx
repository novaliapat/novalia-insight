import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { formatEuro } from "@/lib/declaration/utils/taxFormatting";
import { FileText, FileWarning, Quote, BookOpen, Crop } from "lucide-react";
import type {
  ConfidenceLevel,
  DocumentEvidence,
  EvidenceType,
} from "@/lib/declaration/contracts/extractedDataContract";

export interface ExtractedEvidence {
  field: string;
  amount?: number | null;
  confidence: ConfidenceLevel;
  sourceDocument?: string;
  evidence?: DocumentEvidence;
  note?: string;
}

const EVIDENCE_BADGE: Record<
  EvidenceType,
  { label: string; Icon: typeof FileText; tone: "muted" | "info" | "ok" }
> = {
  document_name_only: { label: "Preuve faible", Icon: FileWarning, tone: "muted" },
  text_excerpt: { label: "Extrait disponible", Icon: Quote, tone: "ok" },
  page_reference: { label: "Page identifiée", Icon: BookOpen, tone: "info" },
  visual_region: { label: "Zone visuelle", Icon: Crop, tone: "info" },
};

function effectiveEvidenceType(ev?: DocumentEvidence): EvidenceType {
  return ev?.evidenceType ?? "document_name_only";
}

/**
 * Affiche la preuve documentaire d'un champ extrait.
 * IMPORTANT : n'invente jamais d'extrait. On affiche uniquement ce qui a
 * été remonté par l'extraction.
 */
export const ExtractedEvidenceCard = ({ evidence }: { evidence: ExtractedEvidence }) => {
  const ev = evidence.evidence;
  const type = effectiveEvidenceType(ev);
  const badge = EVIDENCE_BADGE[type];
  const sourceDoc =
    ev?.sourceDocument ?? evidence.sourceDocument ?? "Document source non précisé";

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">{sourceDoc}</div>
            <div className="font-medium text-sm">{evidence.field}</div>
          </div>
        </div>
        <ConfidenceBadge level={evidence.confidence} />
      </div>

      {evidence.amount !== undefined && evidence.amount !== null && (
        <div className="text-base font-display font-semibold">
          {formatEuro(evidence.amount)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={badge.tone === "muted" ? "outline" : "secondary"}
          className="gap-1 text-[10px] uppercase tracking-wide"
        >
          <badge.Icon className="h-3 w-3" />
          {badge.label}
        </Badge>
        {ev?.pageNumber !== undefined && (
          <Badge variant="outline" className="text-[10px]">
            Page {ev.pageNumber}
          </Badge>
        )}
        {ev?.sectionLabel && (
          <Badge variant="outline" className="text-[10px] max-w-[180px] truncate">
            {ev.sectionLabel}
          </Badge>
        )}
      </div>

      {ev?.extractedText && (
        <blockquote className="text-xs text-muted-foreground border-l-2 border-accent/50 pl-2 italic">
          « {ev.extractedText} »
        </blockquote>
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
    csgDeductible: "CSG déductible (2BH/2CG)",
    // SCPI — annexe 2044
    grossIncome: "Revenus bruts (ligne 111)",
    frenchIncome: "dont France",
    foreignIncome: "dont Étranger",
    expenses: "Frais et charges (ligne 112)",
    scpiLoanInterests: "Intérêts emprunt SCPI (ligne 113)",
    netIncome: "Bénéfice/Déficit (ligne 114)",
    personalLoanInterests: "Intérêts emprunt personnels",
    // SCPI — reports 2042
    exemptIncome: "Revenus exonérés taux effectif (4EA)",
    microFoncierExempt: "Micro-foncier exonéré (4EB)",
    foreignTaxCredit: "Crédit d'impôt = IR français (8TK)",
    // SCPI — IFI
    ifiValuePerShare: "Valeur IFI par part",
    numberOfShares: "Nombre de parts",
    // Deprecated
    deductibleInterests: "Intérêts déductibles (legacy)",
    // Assurance-vie
    frenchIncomeLegacy: "Revenus France",
    foreignIncomeLegacy: "Revenus étrangers",
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
          const f = v as {
            value: number;
            confidence: ConfidenceLevel;
            sourceDocument?: string;
            evidence?: DocumentEvidence;
            note?: string;
          };
          out.push({
            field: `${title} — ${fieldLabels[k] ?? k}`,
            amount: f.value,
            confidence: f.confidence,
            sourceDocument: f.sourceDocument,
            evidence: f.evidence,
            note: f.note,
          });
        }
      }
    }
  }
  return out;
}
