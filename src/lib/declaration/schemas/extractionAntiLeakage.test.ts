import { describe, it, expect } from "vitest";

/**
 * Tests anti-fuite : l'extraction NE DOIT JAMAIS produire d'analyse fiscale.
 * Ces tests scannent récursivement un payload (clés + valeurs string)
 * et échouent si on trouve des marqueurs typiques d'analyse :
 *  - clés interdites (case, formulaire, recommandation, taxableBase…)
 *  - références aux formulaires/cases fiscales (2042, 2DC, 2TR, 2CK, 4BA, 2044, 2047)
 *  - phrases du registre conseil ("crédit d'impôt applicable", "à déclarer en case",
 *    "taux effectif", "option barème", "montant imposable calculé", "recommandation")
 *
 * Si une mention brute apparaît dans un document source, l'IA peut la stocker
 * dans une `note` documentaire — mais sans la transformer en instruction fiscale.
 * Ces tests visent les payloads NORMALISÉS, pas les notes citationnelles.
 */

const FORBIDDEN_KEYS = [
  "case",
  "cases",
  "caseFiscale",
  "casesFiscales",
  "form",
  "forms",
  "formulaire",
  "formulaires",
  "recommendation",
  "recommendations",
  "recommandation",
  "recommandations",
  "taxableBase",
  "baseImposable",
  "applicableTaxCredit",
  "creditImpotApplicable",
  "effectiveRate",
  "tauxEffectif",
  "barèmeOption",
  "baremeOption",
];

// Marqueurs textuels (insensibles à la casse, hors notes documentaires)
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b2042\b/i,
  /\b2044\b/i,
  /\b2047\b/i,
  /\b2DC\b/i,
  /\b2TR\b/i,
  /\b2CK\b/i,
  /\b4BA\b/i,
  /case fiscale/i,
  /formulaire fiscal/i,
  /crédit d['’]impôt applicable/i,
  /taux effectif/i,
  /option barème/i,
  /à déclarer en case/i,
  /montant imposable calculé/i,
  /recommandation/i,
];

function scan(node: unknown, path: string, results: string[], opts: { allowNoteText?: boolean } = {}) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    // les clés "note" peuvent contenir une citation brute si autorisé
    if (opts.allowNoteText && path.endsWith(".note")) return;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(node)) {
        results.push(`Texte interdit "${re}" trouvé en ${path} → "${node}"`);
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => scan(v, `${path}[${i}]`, results, opts));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(k)) {
        results.push(`Clé interdite "${k}" en ${path}`);
      }
      scan(v, `${path}.${k}`, results, opts);
    }
  }
}

describe("Anti-fuite — l'extraction ne contient aucune analyse fiscale", () => {
  it("payload IFU propre passe", () => {
    const ok = {
      taxpayer: { fullName: "Jean" },
      taxYear: 2024,
      detectedCategories: ["ifu"],
      ifu: [
        {
          institution: "BNP",
          dividends: { value: 1000, confidence: "high", sourceDocument: "ifu.pdf" },
        },
      ],
      scpi: [],
      lifeInsurance: [],
      warnings: [],
      missingData: [],
      globalConfidence: "high",
    };
    const issues: string[] = [];
    scan(ok, "$", issues);
    expect(issues).toEqual([]);
  });

  it("rejette une clé case/formulaire/recommendation", () => {
    const bad = {
      taxYear: 2024,
      ifu: [{ institution: "BNP", case: "2DC" }],
    };
    const issues: string[] = [];
    scan(bad, "$", issues);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it("rejette toute référence à un formulaire fiscal (2042, 2044, 2047)", () => {
    for (const code of ["2042", "2044", "2047"]) {
      const bad = {
        warnings: [`À reporter dans le formulaire ${code}`],
      };
      const issues: string[] = [];
      scan(bad, "$", issues);
      expect(issues.length, `attendu pour ${code}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejette toute référence à une case (2DC, 2TR, 2CK, 4BA)", () => {
    for (const c of ["2DC", "2TR", "2CK", "4BA"]) {
      const bad = { missingData: [`Vérifier la case ${c}`] };
      const issues: string[] = [];
      scan(bad, "$", issues);
      expect(issues.length, `attendu pour ${c}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejette les phrases d'analyse fiscale", () => {
    const phrases = [
      "Crédit d'impôt applicable de 12%",
      "Taux effectif estimé",
      "Option barème recommandée",
      "À déclarer en case 2DC",
      "Montant imposable calculé : 800 €",
      "Recommandation : opter pour le PFU",
    ];
    for (const p of phrases) {
      const bad = { warnings: [p] };
      const issues: string[] = [];
      scan(bad, "$", issues);
      expect(issues.length, `attendu pour "${p}"`).toBeGreaterThanOrEqual(1);
    }
  });

  it("autorise une citation brute dans une note documentaire", () => {
    const tolerated = {
      ifu: [
        {
          institution: "BNP",
          dividends: {
            value: 100,
            confidence: "high",
            sourceDocument: "ifu.pdf",
            // citation brute du document : tolérée car non transformée en instruction
            note: "Document mentionne case 2DC dans la rubrique source",
          },
        },
      ],
    };
    const issues: string[] = [];
    scan(tolerated, "$", issues, { allowNoteText: true });
    expect(issues).toEqual([]);
  });
});
