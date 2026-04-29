// Génère des review items pour les warnings issus de la normalisation
// défensive (champs obligatoires manquants → valeur par défaut + warning).
//
// On reconnaît les warnings « champ manquant » émis par normalizeAiResponse
// et on les promeut en items de revue pour que l'utilisateur les voie
// dans la file d'attente "À traiter".

import type { DerivedReviewItem } from "../_shared/review/deriveReviewItems.ts";

interface Pattern {
  re: RegExp;
  field: string;
  message: string;
}

const PATTERNS: Pattern[] = [
  {
    re: /ifu\[(\d+)\]: institution manquante/i,
    field: "ifu.institution",
    message: "Champ obligatoire manquant normalisé sur un IFU : institution",
  },
  {
    re: /scpi\[(\d+)\]: scpiName manquant/i,
    field: "scpi.scpiName",
    message: "Champ obligatoire manquant normalisé sur une SCPI : nom de la SCPI",
  },
  {
    re: /lifeInsurance\[(\d+)\]: contractName manquant/i,
    field: "lifeInsurance.contractName",
    message: "Champ obligatoire manquant normalisé sur une assurance-vie : nom du contrat",
  },
];

export function deriveNormalizationReviewItems(
  normalizationWarnings: string[],
): DerivedReviewItem[] {
  const out: DerivedReviewItem[] = [];
  const seen = new Set<string>();
  for (const w of normalizationWarnings) {
    for (const p of PATTERNS) {
      const m = w.match(p.re);
      if (!m) continue;
      const idx = m[1] ?? "0";
      const dedupKey = `normalization:${p.field}:${idx}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      out.push({
        sourceType: "normalization_warning",
        sourceCode: null,
        severity: "warning",
        field: p.field,
        message: p.message,
        dedupKey,
      });
    }
  }
  return out;
}
