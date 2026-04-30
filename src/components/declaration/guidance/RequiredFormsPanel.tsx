import { Card } from "@/components/ui/card";
import { FileText, AlertTriangle } from "lucide-react";
import { GuidanceConfidenceBadge } from "./GuidanceConfidenceBadge";
import { GuidanceSourceBadge } from "./GuidanceSourceBadge";
import type { RequiredForm, TaxFormId } from "@/lib/declaration/guidance/guidanceSchemas";

interface Props {
  forms: RequiredForm[];
}

// Libellés et sous-titres orientés utilisateur (ne pas exposer "RAG", etc.)
const FORM_DISPLAY: Record<TaxFormId, { title: string; subtitle: string }> = {
  "2042": {
    title: "Déclaration principale 2042",
    subtitle:
      "Cases de report final : 2TR, 2DC, 2CK, 4BA, 4BL, 8TK et autres revenus du foyer.",
  },
  "2042C": {
    title: "Déclaration complémentaire 2042-C",
    subtitle: "À ouvrir uniquement pour des revenus complémentaires spécifiques.",
  },
  "2042-RICI": {
    title: "Déclaration 2042-RICI — Réductions et crédits d'impôt",
    subtitle: "À ouvrir si vous bénéficiez de réductions ou crédits d'impôt.",
  },
  "2044": {
    title: "Annexe 2044 — Revenus fonciers",
    subtitle: "À ouvrir si vous déclarez les revenus SCPI ou locatifs au régime réel.",
  },
  "2047": {
    title: "Annexe 2047 — Revenus de source étrangère",
    subtitle: "À ouvrir si vos SCPI ou comptes distribuent des revenus étrangers.",
  },
  preparation: {
    title: "Étapes préalables",
    subtitle: "Rubriques à cocher au début du parcours sur impots.gouv.fr.",
  },
  recap: {
    title: "Récapitulatif et vérifications",
    subtitle: "Tableau de synthèse de toutes les cases et checklist finale.",
  },
  other: {
    title: "Formulaire complémentaire",
    subtitle: "À ouvrir selon la situation détectée.",
  },
};

export const RequiredFormsPanel = ({ forms }: Props) => {
  if (forms.length === 0) {
    return (
      <Card className="p-4 bg-muted/30 text-sm text-muted-foreground">
        Aucun formulaire requis détecté pour cette déclaration.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {forms.map((f) => {
        const officialSources = f.sources.filter((s) => s.isOfficialSource);
        const display = FORM_DISPLAY[f.formId] ?? FORM_DISPLAY.other;
        return (
          <Card key={f.formId} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent shrink-0" />
                <div>
                  <div className="font-display text-base font-semibold">
                    {display.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {display.subtitle}
                  </div>
                </div>
              </div>
              <GuidanceConfidenceBadge confidence={f.confidence} />
            </div>

            <p className="text-xs text-foreground/80 leading-relaxed">{f.reason}</p>

            {officialSources.length > 0 ? (
              <div className="space-y-1.5">
                {officialSources.slice(0, 3).map((s, i) => (
                  <GuidanceSourceBadge key={i} source={s} compact />
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-foreground/80">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                Source DGFiP non retrouvée automatiquement — à vérifier dans la
                notice officielle du formulaire.
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
