import { Card } from "@/components/ui/card";
import { FileWarning, Quote, BookOpen, Crop, FileSearch } from "lucide-react";
import { countEvidenceMetrics } from "@/lib/declaration/audit/evidenceMetrics";

interface Props {
  data: {
    ifu: Array<Record<string, unknown>>;
    scpi: Array<Record<string, unknown>>;
    lifeInsurance: Array<Record<string, unknown>>;
  };
  /** Seuil au-delà duquel on suggère une vérification manuelle. */
  weakRatioThreshold?: number;
}

const tiles = [
  { key: "numberOfWeakEvidence" as const, label: "Preuves faibles", Icon: FileWarning, tone: "warn" },
  { key: "numberOfTextExcerpts" as const, label: "Extraits texte", Icon: Quote, tone: "ok" },
  { key: "numberOfPageReferences" as const, label: "Pages identifiées", Icon: BookOpen, tone: "ok" },
  { key: "numberOfVisualRegions" as const, label: "Zones visuelles", Icon: Crop, tone: "ok" },
];

export const EvidenceQualityPanel = ({ data, weakRatioThreshold = 0.5 }: Props) => {
  const m = countEvidenceMetrics(data);
  if (m.numberOfEvidenceItems === 0) return null;

  const weakRatio = m.numberOfWeakEvidence / m.numberOfEvidenceItems;
  const showWarning = weakRatio >= weakRatioThreshold;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileSearch className="h-4 w-4 text-accent" />
        <h3 className="font-display text-base font-semibold">
          Qualité des preuves documentaires
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-display font-semibold">
            {m.numberOfEvidenceItems}
          </div>
        </div>
        {tiles.map(({ key, label, Icon, tone }) => (
          <div
            key={key}
            className={`rounded-lg border p-3 ${
              tone === "warn" && m[key] > 0
                ? "border-warning/40 bg-warning/5"
                : "border-border"
            }`}
          >
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              {label}
            </div>
            <div className="text-xl font-display font-semibold">{m[key]}</div>
          </div>
        ))}
      </div>

      {showWarning && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-foreground">
          Certaines données sont rattachées uniquement au nom du fichier. Une
          vérification manuelle est recommandée.
        </div>
      )}
    </Card>
  );
};
