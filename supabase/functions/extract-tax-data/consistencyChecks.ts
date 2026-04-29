// Checks de cohérence déterministes — version Deno (edge function).
// Miroir fidèle de src/lib/declaration/validation/extractionConsistencyChecks.ts
// Conservé séparément car les edge functions ne peuvent pas importer depuis src/.

export type ConsistencyIssueSeverity = "info" | "warning" | "error";

export interface ConsistencyIssue {
  code: string;
  severity: ConsistencyIssueSeverity;
  message: string;
  field?: string;
}

interface ConfidentField {
  value: number;
  confidence: "high" | "medium" | "low";
  sourceDocument?: string;
  note?: string;
}

interface ExtractedShape {
  taxYear: number;
  detectedCategories: string[];
  ifu: Array<Record<string, unknown>>;
  scpi: Array<Record<string, unknown>>;
  lifeInsurance: Array<Record<string, unknown>>;
  warnings: string[];
  missingData: string[];
  globalConfidence: "high" | "medium" | "low";
}

const NUMERIC_FIELDS: Array<{ bucket: "ifu" | "scpi" | "lifeInsurance"; fields: string[] }> = [
  { bucket: "ifu", fields: ["dividends", "interests", "capitalGains", "withholdingTax", "socialContributions"] },
  { bucket: "scpi", fields: ["frenchIncome", "foreignIncome", "deductibleInterests", "socialContributions"] },
  { bucket: "lifeInsurance", fields: ["withdrawals", "taxableShare", "withholdingTax"] },
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_TAX_YEAR = 2000;
const MAX_TAX_YEAR = CURRENT_YEAR + 1;

export function runExtractionConsistencyChecks(data: ExtractedShape): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  const expectations = [
    { cat: "ifu", bucket: "ifu", label: "IFU" },
    { cat: "scpi", bucket: "scpi", label: "SCPI" },
    { cat: "life_insurance", bucket: "lifeInsurance", label: "Assurance-vie" },
  ] as const;
  for (const { cat, bucket, label } of expectations) {
    if (data.detectedCategories.includes(cat)) {
      const arr = data[bucket] as unknown[];
      if (!Array.isArray(arr) || arr.length === 0) {
        issues.push({
          code: "category_without_entries",
          severity: "warning",
          field: bucket,
          message: `Catégorie "${label}" détectée mais aucune entrée extraite.`,
        });
      }
    }
  }

  if (!Number.isInteger(data.taxYear)) {
    issues.push({ code: "missing_tax_year", severity: "error", field: "taxYear", message: "Année fiscale absente ou invalide." });
  } else if (data.taxYear < MIN_TAX_YEAR || data.taxYear > MAX_TAX_YEAR) {
    issues.push({
      code: "tax_year_out_of_range",
      severity: "warning",
      field: "taxYear",
      message: `Année fiscale ${data.taxYear} hors plage attendue (${MIN_TAX_YEAR}–${MAX_TAX_YEAR}).`,
    });
  }

  const seenSourceYears = new Map<string, Set<number>>();

  for (const { bucket, fields } of NUMERIC_FIELDS) {
    const arr = data[bucket];
    if (!Array.isArray(arr)) continue;
    arr.forEach((entry, idx) => {
      for (const fieldName of fields) {
        const f = entry[fieldName] as ConfidentField | undefined;
        if (!f) continue;
        const path = `${bucket}[${idx}].${fieldName}`;
        if (typeof f.value !== "number" || !Number.isFinite(f.value)) {
          issues.push({ code: "invalid_amount", severity: "error", field: path, message: `Montant invalide sur ${path}.` });
          continue;
        }
        if (f.value < 0) {
          issues.push({ code: "negative_amount", severity: "warning", field: path, message: `Montant négatif inattendu sur ${path} (${f.value}).` });
        }
        if (f.value === 0 && f.confidence === "high" && !f.note) {
          issues.push({ code: "zero_with_high_confidence", severity: "info", field: path, message: `Montant à 0 € avec confiance élevée sans note explicative (${path}).` });
        }
        if (!f.sourceDocument || f.sourceDocument.trim() === "") {
          issues.push({ code: "missing_source_document", severity: "warning", field: path, message: `Document source manquant pour ${path}.` });
        } else {
          if (!seenSourceYears.has(f.sourceDocument)) seenSourceYears.set(f.sourceDocument, new Set());
          const m = f.sourceDocument.match(/(20\d{2})/);
          if (m) seenSourceYears.get(f.sourceDocument)!.add(Number(m[1]));
        }
      }
    });
  }

  if (data.globalConfidence === "high" && data.warnings.length > 0) {
    issues.push({ code: "high_confidence_with_warnings", severity: "info", message: "Confiance globale élevée alors que des warnings ont été émis." });
  }

  const yearsAcrossDocs = new Set<number>();
  for (const ys of seenSourceYears.values()) for (const y of ys) yearsAcrossDocs.add(y);
  if (yearsAcrossDocs.size > 1) {
    issues.push({
      code: "mixed_document_years",
      severity: "warning",
      message: `Plusieurs années fiscales semblent présentes dans les documents (${[...yearsAcrossDocs].sort().join(", ")}).`,
    });
  }

  const dividendsValues = (data.ifu as Array<{ dividends?: ConfidentField }>)
    .map((e) => e.dividends?.value)
    .filter((v): v is number => typeof v === "number");
  if (dividendsValues.length > 1 && data.ifu.length === 1) {
    const unique = new Set(dividendsValues.map((v) => Math.round(v * 100)));
    if (unique.size > 1) {
      issues.push({ code: "contradictory_values", severity: "warning", message: "Valeurs de dividendes contradictoires détectées dans un même IFU." });
    }
  }

  return issues;
}
