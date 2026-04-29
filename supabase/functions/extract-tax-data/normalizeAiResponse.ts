// Normalisation DÉFENSIVE de la réponse IA AVANT validation Zod.
//
// Règle d'or : on ne corrige QUE le format technique. On n'invente JAMAIS
// une donnée fiscale (montant, institution, année). Si une normalisation
// est appliquée, on remonte un warning explicite.

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

const CATEGORY_ALIASES: Record<string, string> = {
  "assurance_vie": "life_insurance",
  "assurance-vie": "life_insurance",
  "assurancevie": "life_insurance",
  "av": "life_insurance",
  "AV": "life_insurance",
  "life-insurance": "life_insurance",
  "ifu_": "ifu",
  "IFU": "ifu",
  "SCPI": "scpi",
};

const FIELD_ALIASES: Record<string, string> = {
  // top-level
  "assurance_vie": "lifeInsurance",
  "assurance-vie": "lifeInsurance",
  "AV": "lifeInsurance",
  "life_insurance": "lifeInsurance",
};

export interface NormalizationResult {
  normalized: Record<string, unknown>;
  warnings: string[];
  changed: boolean;
}

export function normalizeAiExtractionResponse(input: unknown): NormalizationResult {
  const warnings: string[] = [];
  let changed = false;

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      normalized: {
        taxpayer: {},
        taxYear: 0,
        detectedCategories: [],
        ifu: [],
        scpi: [],
        lifeInsurance: [],
        warnings: ["[normalisation] réponse IA non-objet"],
        missingData: [],
        globalConfidence: "low",
      },
      warnings: ["réponse IA non-objet, structure de secours utilisée"],
      changed: true,
    };
  }

  const src = { ...(input as Record<string, unknown>) };

  // 1. Renommer alias top-level
  for (const [from, to] of Object.entries(FIELD_ALIASES)) {
    if (from in src && !(to in src)) {
      src[to] = src[from];
      delete src[from];
      warnings.push(`alias "${from}" renommé en "${to}"`);
      changed = true;
    }
  }

  // 2. Champs interdits émis par l'IA (métadonnées qu'elle aurait inventées)
  const forbiddenTopLevel = ["extractionPromptVersion", "extractedAt", "modelUsed", "form", "case", "box"];
  for (const k of forbiddenTopLevel) {
    if (k in src) {
      delete src[k];
      warnings.push(`champ interdit "${k}" supprimé (métadonnée serveur ou champ d'analyse)`);
      changed = true;
    }
  }

  // 3. taxpayer
  if (typeof src.taxpayer !== "object" || src.taxpayer === null || Array.isArray(src.taxpayer)) {
    src.taxpayer = {};
    warnings.push("taxpayer manquant ou invalide → objet vide");
    changed = true;
  } else {
    src.taxpayer = stripNulls(src.taxpayer as Record<string, unknown>);
  }

  // 4. taxYear (number)
  if (typeof src.taxYear === "string") {
    const n = parseInt((src.taxYear as string).trim(), 10);
    if (!Number.isNaN(n)) {
      src.taxYear = n;
      warnings.push(`taxYear converti string→number (${n})`);
      changed = true;
    }
  }
  if (typeof src.taxYear !== "number" || !Number.isFinite(src.taxYear)) {
    src.taxYear = 0;
    warnings.push("taxYear absent ou invalide → 0");
    changed = true;
  }

  // 5. detectedCategories — appliquer alias
  if (!Array.isArray(src.detectedCategories)) {
    src.detectedCategories = [];
    warnings.push("detectedCategories manquant → []");
    changed = true;
  } else {
    src.detectedCategories = (src.detectedCategories as unknown[]).map((c) => {
      if (typeof c !== "string") return c;
      const alias = CATEGORY_ALIASES[c] ?? CATEGORY_ALIASES[c.toLowerCase()];
      if (alias && alias !== c) {
        warnings.push(`catégorie "${c}" renommée en "${alias}"`);
        changed = true;
        return alias;
      }
      return c;
    });
  }

  // 6. Tableaux requis
  for (const key of ["ifu", "scpi", "lifeInsurance"]) {
    if (!Array.isArray(src[key])) {
      src[key] = [];
      warnings.push(`${key} manquant → []`);
      changed = true;
    }
  }

  // 7. Normaliser entrées IFU
  src.ifu = (src.ifu as unknown[]).map((e, i) => normalizeIfuEntry(e, i, warnings, () => { changed = true; }));
  src.scpi = (src.scpi as unknown[]).map((e, i) => normalizeScpiEntry(e, i, warnings, () => { changed = true; }));
  src.lifeInsurance = (src.lifeInsurance as unknown[]).map((e, i) => normalizeLifeEntry(e, i, warnings, () => { changed = true; }));

  // 8. warnings / missingData
  if (!Array.isArray(src.warnings)) {
    src.warnings = [];
    warnings.push("warnings manquant → []");
    changed = true;
  }
  if (!Array.isArray(src.missingData)) {
    src.missingData = [];
    warnings.push("missingData manquant → []");
    changed = true;
  }

  // 9. globalConfidence
  if (typeof src.globalConfidence !== "string" || !VALID_CONFIDENCE.has(src.globalConfidence)) {
    src.globalConfidence = "low";
    warnings.push("globalConfidence absent ou invalide → low");
    changed = true;
  }

  // 10. Si on a normalisé, ajouter un warning visible côté utilisateur
  if (changed) {
    (src.warnings as string[]).push(
      "[normalisation] La réponse IA a été corrigée techniquement avant validation. Vérifiez les données extraites.",
    );
  }

  return { normalized: src, warnings, changed };
}

// ---------------- helpers ----------------

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

/** Convertit "1 234,56 €" → 1234.56. Retourne null si non parseable. */
export function parseAmountString(s: string): number | null {
  // retire espaces (incl. insécables), €, et autres devises
  let cleaned = s.replace(/[\s\u00A0\u202F]/g, "").replace(/[€$£]/g, "");
  // si format "1.234,56" (FR) → "1234.56"
  if (/,\d{1,2}$/.test(cleaned) && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeConfidentNumber(
  field: unknown,
  path: string,
  warnings: string[],
  markChanged: () => void,
): unknown {
  if (field === null || field === undefined) return undefined;
  if (typeof field === "number") {
    // l'IA a renvoyé un nombre nu au lieu d'un objet → on le wrappe
    warnings.push(`${path}: number nu wrappé en {value, confidence:"low"}`);
    markChanged();
    return { value: field, confidence: "low" };
  }
  if (typeof field !== "object" || Array.isArray(field)) return field;
  const f = { ...(field as Record<string, unknown>) };

  // value: string → number
  if (typeof f.value === "string") {
    const n = parseAmountString(f.value);
    if (n !== null) {
      f.value = n;
      warnings.push(`${path}.value converti string→number (${n})`);
      markChanged();
    }
  }
  // confidence par défaut
  if (typeof f.confidence !== "string" || !VALID_CONFIDENCE.has(f.confidence)) {
    f.confidence = "low";
    warnings.push(`${path}.confidence absent/invalide → low`);
    markChanged();
  }
  // null → omis
  for (const k of Object.keys(f)) if (f[k] === null) { delete f[k]; markChanged(); }
  return f;
}

const IFU_AMOUNT_FIELDS = ["dividends", "interests", "capitalGains", "withholdingTax", "socialContributions"];
const SCPI_AMOUNT_FIELDS = ["frenchIncome", "foreignIncome", "deductibleInterests", "socialContributions"];
const LIFE_AMOUNT_FIELDS = ["withdrawals", "taxableShare", "withholdingTax"];

function normalizeIfuEntry(e: unknown, idx: number, warnings: string[], mark: () => void): unknown {
  if (!e || typeof e !== "object") {
    warnings.push(`ifu[${idx}] non-objet → entrée ignorable`);
    mark();
    return { institution: "Inconnu" };
  }
  const x = { ...(e as Record<string, unknown>) };
  // institution requis
  if (typeof x.institution !== "string" || x.institution.trim() === "") {
    // tenter alias
    for (const k of ["bank", "etablissement", "établissement", "name", "issuer"]) {
      if (typeof x[k] === "string" && (x[k] as string).trim() !== "") {
        x.institution = x[k];
        warnings.push(`ifu[${idx}]: institution déduite de "${k}"`);
        mark();
        break;
      }
    }
    if (typeof x.institution !== "string" || x.institution.trim() === "") {
      x.institution = "Institution non renseignée";
      warnings.push(`ifu[${idx}]: institution manquante → "Institution non renseignée"`);
      mark();
    }
  }
  for (const f of IFU_AMOUNT_FIELDS) {
    if (f in x) {
      const v = normalizeConfidentNumber(x[f], `ifu[${idx}].${f}`, warnings, mark);
      if (v === undefined) delete x[f]; else x[f] = v;
    }
  }
  for (const k of Object.keys(x)) if (x[k] === null) { delete x[k]; mark(); }
  return x;
}

function normalizeScpiEntry(e: unknown, idx: number, warnings: string[], mark: () => void): unknown {
  if (!e || typeof e !== "object") {
    warnings.push(`scpi[${idx}] non-objet → entrée ignorable`);
    mark();
    return { scpiName: "Inconnu" };
  }
  const x = { ...(e as Record<string, unknown>) };
  if (typeof x.scpiName !== "string" || x.scpiName.trim() === "") {
    for (const k of ["name", "scpi", "label"]) {
      if (typeof x[k] === "string" && (x[k] as string).trim() !== "") {
        x.scpiName = x[k];
        warnings.push(`scpi[${idx}]: scpiName déduit de "${k}"`);
        mark();
        break;
      }
    }
    if (typeof x.scpiName !== "string" || x.scpiName.trim() === "") {
      x.scpiName = "SCPI non renseignée";
      warnings.push(`scpi[${idx}]: scpiName manquant → "SCPI non renseignée"`);
      mark();
    }
  }
  for (const f of SCPI_AMOUNT_FIELDS) {
    if (f in x) {
      const v = normalizeConfidentNumber(x[f], `scpi[${idx}].${f}`, warnings, mark);
      if (v === undefined) delete x[f]; else x[f] = v;
    }
  }
  for (const k of Object.keys(x)) if (x[k] === null) { delete x[k]; mark(); }
  return x;
}

function normalizeLifeEntry(e: unknown, idx: number, warnings: string[], mark: () => void): unknown {
  if (!e || typeof e !== "object") {
    warnings.push(`lifeInsurance[${idx}] non-objet → entrée ignorable`);
    mark();
    return { contractName: "Inconnu" };
  }
  const x = { ...(e as Record<string, unknown>) };
  if (typeof x.contractName !== "string" || x.contractName.trim() === "") {
    for (const k of ["name", "contract", "label"]) {
      if (typeof x[k] === "string" && (x[k] as string).trim() !== "") {
        x.contractName = x[k];
        warnings.push(`lifeInsurance[${idx}]: contractName déduit de "${k}"`);
        mark();
        break;
      }
    }
    if (typeof x.contractName !== "string" || x.contractName.trim() === "") {
      x.contractName = "Contrat non renseigné";
      warnings.push(`lifeInsurance[${idx}]: contractName manquant → "Contrat non renseigné"`);
      mark();
    }
  }
  for (const f of LIFE_AMOUNT_FIELDS) {
    if (f in x) {
      const v = normalizeConfidentNumber(x[f], `lifeInsurance[${idx}].${f}`, warnings, mark);
      if (v === undefined) delete x[f]; else x[f] = v;
    }
  }
  for (const k of Object.keys(x)) if (x[k] === null) { delete x[k]; mark(); }
  return x;
}

/** Snapshot tronqué pour debug — sans contenu documentaire sensible. */
export function shapeOf(value: unknown, depth = 0): unknown {
  if (depth > 4) return "…";
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((v) => shapeOf(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shapeOf(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    return value.length > 120 ? value.slice(0, 120) + "…" : value;
  }
  return value;
}
