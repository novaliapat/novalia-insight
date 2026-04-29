import type { ExtractedData, TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";
import type {
  ConsistencyIssue,
  ConsistencyIssueSeverity,
} from "@/lib/declaration/contracts/auditContract";

export type { ConsistencyIssue, ConsistencyIssueSeverity };

interface ConfidentField {
  value: number;
  confidence: "high" | "medium" | "low";
  sourceDocument?: string;
  note?: string;
}

const NUMERIC_FIELDS: Array<{
  bucket: "ifu" | "scpi" | "lifeInsurance";
  fields: string[];
}> = [
  {
    bucket: "ifu",
    fields: ["dividends", "interests", "capitalGains", "withholdingTax", "socialContributions"],
  },
  {
    bucket: "scpi",
    fields: ["frenchIncome", "foreignIncome", "deductibleInterests", "socialContributions"],
  },
  {
    bucket: "lifeInsurance",
    fields: ["withdrawals", "taxableShare", "withholdingTax"],
  },
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_TAX_YEAR = 2000;
const MAX_TAX_YEAR = CURRENT_YEAR + 1;

/**
 * Contrôles déterministes (non-IA) sur ExtractedData.
 * Détecte les incohérences évidentes à présenter à l'utilisateur
 * avant validation manuelle.
 */
export function runExtractionConsistencyChecks(
  data: ExtractedData,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // 1. Catégorie déclarée mais bucket vide
  const expectations: Array<{ cat: TaxCategory; bucket: keyof ExtractedData; label: string }> = [
    { cat: "ifu", bucket: "ifu", label: "IFU" },
    { cat: "scpi", bucket: "scpi", label: "SCPI" },
    { cat: "life_insurance", bucket: "lifeInsurance", label: "Assurance-vie" },
  ];
  for (const { cat, bucket, label } of expectations) {
    if (data.detectedCategories.includes(cat)) {
      const arr = data[bucket] as unknown[];
      if (!Array.isArray(arr) || arr.length === 0) {
        issues.push({
          code: "category_without_entries",
          severity: "warning",
          field: bucket as string,
          message: `Catégorie "${label}" détectée mais aucune entrée extraite.`,
        });
      }
    }
  }

  // 2. Tax year
  if (!Number.isInteger(data.taxYear)) {
    issues.push({
      code: "missing_tax_year",
      severity: "error",
      field: "taxYear",
      message: "Année fiscale absente ou invalide.",
    });
  } else if (data.taxYear < MIN_TAX_YEAR || data.taxYear > MAX_TAX_YEAR) {
    issues.push({
      code: "tax_year_out_of_range",
      severity: "warning",
      field: "taxYear",
      message: `Année fiscale ${data.taxYear} hors plage attendue (${MIN_TAX_YEAR}–${MAX_TAX_YEAR}).`,
    });
  }

  // 3. Champs numériques : signe, sourceDocument, valeurs nulles à confiance haute
  const seenSourceYears = new Map<string, Set<number>>(); // doc → years extracted from notes (best effort)

  for (const { bucket, fields } of NUMERIC_FIELDS) {
    const arr = data[bucket] as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) continue;
    arr.forEach((entry, idx) => {
      for (const fieldName of fields) {
        const f = entry[fieldName] as ConfidentField | undefined;
        if (!f) continue;
        const path = `${bucket}[${idx}].${fieldName}`;

        if (typeof f.value !== "number" || !Number.isFinite(f.value)) {
          issues.push({
            code: "invalid_amount",
            severity: "error",
            field: path,
            message: `Montant invalide sur ${path}.`,
          });
          continue;
        }
        if (f.value < 0) {
          issues.push({
            code: "negative_amount",
            severity: "warning",
            field: path,
            message: `Montant négatif inattendu sur ${path} (${f.value}).`,
          });
        }
        if (f.value === 0 && f.confidence === "high" && !f.note) {
          issues.push({
            code: "zero_with_high_confidence",
            severity: "info",
            field: path,
            message: `Montant à 0 € avec confiance élevée sans note explicative (${path}).`,
          });
        }
        if (!f.sourceDocument || f.sourceDocument.trim() === "") {
          issues.push({
            code: "missing_source_document",
            severity: "warning",
            field: path,
            message: `Document source manquant pour ${path}.`,
          });
        } else {
          if (!seenSourceYears.has(f.sourceDocument)) {
            seenSourceYears.set(f.sourceDocument, new Set());
          }
          // tentative : extraire une année du nom de fichier
          const m = f.sourceDocument.match(/(20\d{2})/);
          if (m) seenSourceYears.get(f.sourceDocument)!.add(Number(m[1]));
        }
      }
    });
  }

  // 4. Confiance globale "high" mais warnings présents
  if (data.globalConfidence === "high" && data.warnings.length > 0) {
    issues.push({
      code: "high_confidence_with_warnings",
      severity: "info",
      message: "Confiance globale élevée alors que des warnings ont été émis.",
    });
  }

  // 5. Années fiscales incohérentes entre documents (meilleur effort sur noms de fichiers)
  const yearsAcrossDocs = new Set<number>();
  for (const ys of seenSourceYears.values()) {
    for (const y of ys) yearsAcrossDocs.add(y);
  }
  if (yearsAcrossDocs.size > 1) {
    issues.push({
      code: "mixed_document_years",
      severity: "warning",
      message: `Plusieurs années fiscales semblent présentes dans les documents (${[...yearsAcrossDocs].sort().join(", ")}).`,
    });
  }

  // 6. Valeurs contradictoires dans une même catégorie (IFU dividends multiples)
  const dividendsValues = data.ifu
    .map((e) => e.dividends?.value)
    .filter((v): v is number => typeof v === "number");
  if (dividendsValues.length > 1) {
    const unique = new Set(dividendsValues.map((v) => Math.round(v * 100)));
    if (unique.size > 1 && data.ifu.length === 1) {
      issues.push({
        code: "contradictory_values",
        severity: "warning",
        message: "Valeurs de dividendes contradictoires détectées dans un même IFU.",
      });
    }
  }

  return issues;
}

export function countIssuesBySeverity(issues: ConsistencyIssue[]) {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, error: 0 } as Record<ConsistencyIssueSeverity, number>,
  );
}
