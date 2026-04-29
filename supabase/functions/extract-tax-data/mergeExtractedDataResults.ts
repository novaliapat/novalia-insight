// Fusion DÉTERMINISTE de plusieurs résultats d'extraction (1 par fichier).
//
// Règles strictes :
// - JAMAIS de somme automatique de montants (sauf si total explicite : non géré ici).
// - taxYear = majoritaire ; si désaccord → on garde le premier non-nul + warning.
// - taxpayer = fusion prudente (premier non-vide gagne par champ).
// - ifu/scpi/lifeInsurance = concaténation pure.
// - detectedCategories = dédupliquées.
// - warnings/missingData = concaténés + dédupliqués.
// - globalConfidence = MIN(low < medium < high).

import type { ExtractedData } from "../_shared/contracts/extractionContracts.ts";

const CONF_RANK = { low: 0, medium: 1, high: 2 } as const;
type Conf = keyof typeof CONF_RANK;

export function mergeExtractedDataResults(results: ExtractedData[]): ExtractedData {
  if (results.length === 0) {
    return {
      taxpayer: {},
      taxYear: 0,
      detectedCategories: [],
      ifu: [],
      scpi: [],
      lifeInsurance: [],
      warnings: ["[merge] aucun résultat à fusionner"],
      missingData: [],
      globalConfidence: "low",
    };
  }
  if (results.length === 1) return results[0];

  // taxpayer
  const taxpayer: Record<string, unknown> = {};
  for (const r of results) {
    for (const [k, v] of Object.entries(r.taxpayer ?? {})) {
      if (taxpayer[k] === undefined && v !== undefined && v !== null && v !== "") {
        taxpayer[k] = v;
      }
    }
  }

  // taxYear majoritaire
  const yearCounts = new Map<number, number>();
  for (const r of results) {
    if (typeof r.taxYear === "number" && r.taxYear > 0) {
      yearCounts.set(r.taxYear, (yearCounts.get(r.taxYear) ?? 0) + 1);
    }
  }
  let taxYear = 0;
  let topCount = 0;
  for (const [y, c] of yearCounts) {
    if (c > topCount) { taxYear = y; topCount = c; }
  }
  const yearWarning =
    yearCounts.size > 1
      ? [`[merge] taxYear divergent entre fichiers (${[...yearCounts.keys()].join(", ")}) → retenu : ${taxYear}`]
      : [];

  // catégories dédupliquées (préserver l'ordre d'apparition)
  const catSet = new Set<string>();
  for (const r of results) for (const c of r.detectedCategories ?? []) catSet.add(c);

  // ifu/scpi/life concaténés
  const ifu = results.flatMap((r) => r.ifu ?? []);
  const scpi = results.flatMap((r) => r.scpi ?? []);
  const lifeInsurance = results.flatMap((r) => r.lifeInsurance ?? []);

  // warnings / missingData fusionnés + dédupliqués
  const warnSet = new Set<string>();
  for (const r of results) for (const w of r.warnings ?? []) warnSet.add(w);
  for (const w of yearWarning) warnSet.add(w);
  warnSet.add(`[merge] ${results.length} extractions fusionnées (1 par fichier).`);

  const missSet = new Set<string>();
  for (const r of results) for (const m of r.missingData ?? []) missSet.add(m);

  // globalConfidence = min
  let minConf: Conf = "high";
  for (const r of results) {
    const c = (r.globalConfidence ?? "low") as Conf;
    if (CONF_RANK[c] < CONF_RANK[minConf]) minConf = c;
  }

  return {
    taxpayer: taxpayer as ExtractedData["taxpayer"],
    taxYear,
    detectedCategories: [...catSet] as ExtractedData["detectedCategories"],
    ifu: ifu as ExtractedData["ifu"],
    scpi: scpi as ExtractedData["scpi"],
    lifeInsurance: lifeInsurance as ExtractedData["lifeInsurance"],
    warnings: [...warnSet],
    missingData: [...missSet],
    globalConfidence: minConf,
  };
}
