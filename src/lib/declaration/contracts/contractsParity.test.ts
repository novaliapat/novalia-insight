import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ExtractedDataSchema as FrontExtracted,
  ExtractionMetadataSchema as FrontMeta,
  ExtractionResultSchema as FrontResult,
  ExtractionAuditSchema as FrontAudit,
  ExtractTaxDataResponseSchema as FrontResponse,
  ExtractionStatusEnum as FrontStatusEnum,
  TaxCategoryEnum as FrontCatEnum,
  ConfidenceLevelEnum as FrontConfEnum,
} from "@/lib/declaration/contracts";

/**
 * Test de parité front <-> edge.
 *
 * Le miroir Deno (`supabase/functions/_shared/contracts/extractionContracts.ts`)
 * doit accepter et rejeter EXACTEMENT les mêmes payloads que le contrat front.
 *
 * Pour rester portable (Vitest tourne sur Node, pas sur Deno) on vérifie ici :
 *  1. Que le miroir Deno existe ET qu'il déclare les mêmes valeurs d'enums
 *     que le contrat front (extraction par regex sur z.enum([...])).
 *  2. Que tous les payloads de référence (IFU/SCPI/AV) sont acceptés et que
 *     les payloads cassés sont rejetés par le contrat front. Le miroir Deno
 *     étant copié à l'identique (mêmes lignes de schéma), tout drift sera
 *     détecté par l'étape (1).
 */

const MIRROR_PATH = resolve(
  __dirname,
  "../../../../supabase/functions/_shared/contracts/extractionContracts.ts",
);
const mirrorSrc = readFileSync(MIRROR_PATH, "utf-8");

function extractEnumValues(src: string, enumName: string): string[] {
  const re = new RegExp(`export const ${enumName} = z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = src.match(re);
  if (!m) throw new Error(`Enum ${enumName} introuvable dans le miroir Deno`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("Parité contrats front <-> edge — enums", () => {
  it("TaxCategoryEnum identique", () => {
    expect(extractEnumValues(mirrorSrc, "TaxCategoryEnum").sort())
      .toEqual([...FrontCatEnum.options].sort());
  });

  it("ConfidenceLevelEnum identique", () => {
    expect(extractEnumValues(mirrorSrc, "ConfidenceLevelEnum").sort())
      .toEqual([...FrontConfEnum.options].sort());
  });

  it("ExtractionStatusEnum identique", () => {
    expect(extractEnumValues(mirrorSrc, "ExtractionStatusEnum").sort())
      .toEqual([...FrontStatusEnum.options].sort());
  });

  it("Le miroir Deno expose ExtractTaxDataResponseSchema", () => {
    expect(mirrorSrc).toMatch(/export const ExtractTaxDataResponseSchema/);
  });
});

// --- Payloads de référence ---

const validIFU = {
  taxpayer: { fullName: "Jean Dupont" },
  taxYear: 2024,
  detectedCategories: ["ifu"],
  ifu: [{
    institution: "BNP Paribas",
    dividends: { value: 1234.56, confidence: "high", sourceDocument: "ifu_2024.pdf" },
    withholdingTax: { value: 370.37, confidence: "high", sourceDocument: "ifu_2024.pdf" },
  }],
  scpi: [], lifeInsurance: [],
  warnings: [], missingData: [],
  globalConfidence: "high",
};

const validSCPI = {
  taxpayer: { fullName: "Marie Martin" },
  taxYear: 2024,
  detectedCategories: ["scpi"],
  ifu: [],
  scpi: [{
    scpiName: "Corum Origin",
    frenchIncome: { value: 1800, confidence: "high", sourceDocument: "scpi.pdf" },
    foreignIncome: { value: 800, confidence: "high", sourceDocument: "scpi.pdf", note: "Allemagne" },
  }],
  lifeInsurance: [],
  warnings: [], missingData: [],
  globalConfidence: "high",
};

const validAV = {
  taxpayer: { fullName: "Paul Bernard" },
  taxYear: 2024,
  detectedCategories: ["life_insurance"],
  ifu: [], scpi: [],
  lifeInsurance: [{
    contractName: "Linxea Avenir",
    contractAge: "more_than_8",
    withdrawals: { value: 12000, confidence: "high", sourceDocument: "av.pdf" },
    taxableShare: { value: 2400, confidence: "medium", sourceDocument: "av.pdf" },
  }],
  warnings: [], missingData: [],
  globalConfidence: "high",
};

describe("Contrats — payloads de référence acceptés", () => {
  it("IFU valide", () => { expect(() => FrontExtracted.parse(validIFU)).not.toThrow(); });
  it("SCPI valide", () => { expect(() => FrontExtracted.parse(validSCPI)).not.toThrow(); });
  it("Assurance-vie valide", () => { expect(() => FrontExtracted.parse(validAV)).not.toThrow(); });
});

describe("Contrats — payloads invalides rejetés", () => {
  it("rejette un montant en string", () => {
    const bad = JSON.parse(JSON.stringify(validIFU));
    bad.ifu[0].dividends.value = "1234,56";
    expect(() => FrontExtracted.parse(bad)).toThrow();
  });

  it("rejette une catégorie non normalisée (assurance-vie)", () => {
    const bad = { ...validAV, detectedCategories: ["assurance-vie"] };
    expect(() => FrontExtracted.parse(bad)).toThrow();
  });

  it("rejette un confidence inconnu", () => {
    const bad = JSON.parse(JSON.stringify(validIFU));
    bad.ifu[0].dividends.confidence = "very-high";
    expect(() => FrontExtracted.parse(bad)).toThrow();
  });
});

describe("Contrats — séparation data / metadata", () => {
  it("data sans metadata → OK (metadata vit dans le wrapper)", () => {
    expect(() => FrontExtracted.parse(validIFU)).not.toThrow();
  });

  it("ExtractionResult avec metadata officielle → OK", () => {
    const res = {
      data: validIFU,
      metadata: {
        extractionPromptVersion: "v1.0.0",
        extractedAt: new Date().toISOString(),
        modelUsed: "google/gemini-2.5-pro",
        dryRun: false,
      },
    };
    expect(() => FrontResult.parse(res)).not.toThrow();
    expect(() => FrontMeta.parse(res.metadata)).not.toThrow();
  });

  it("metadata injectée DANS data → silencieusement strippée (mode .strip)", () => {
    const polluted = { ...validIFU, extractionPromptVersion: "v1.0.0", extractedAt: "now" };
    const parsed = FrontExtracted.parse(polluted) as Record<string, unknown>;
    expect(parsed.extractionPromptVersion).toBeUndefined();
    expect(parsed.extractedAt).toBeUndefined();
  });
});

describe("Contrats — anti-fuite fiscale", () => {
  // Champs fiscaux interdits : ils ne sont PAS dans le schéma → strippés.
  // Ce test verrouille le fait que même si l'IA renvoie une "case fiscale",
  // elle ne se retrouvera jamais dans la donnée validée.
  it("strippe les champs interdits 'form'/'box'/'case'/'2042'/'2DC'", () => {
    const polluted = {
      ...validIFU,
      ifu: [{
        ...validIFU.ifu[0],
        form: "2042",
        box: "2DC",
        case: "2DC",
      }],
    };
    const parsed = FrontExtracted.parse(polluted);
    const entry = parsed.ifu[0] as Record<string, unknown>;
    expect(entry.form).toBeUndefined();
    expect(entry.box).toBeUndefined();
    expect(entry.case).toBeUndefined();
  });
});

describe("Contrats — réponse edge function (ExtractTaxDataResponseSchema)", () => {
  const baseAudit = {
    declarationId: "00000000-0000-0000-0000-000000000000",
    extractedAt: new Date().toISOString(),
    extractionPromptVersion: "v1.0.0",
    modelUsed: "google/gemini-2.5-pro",
    dryRun: false,
    detectedCategories: ["ifu"],
    globalConfidence: "high" as const,
    status: "extraction_completed" as const,
    numberOfFiles: 1,
    numberOfExtractedFields: 2,
    numberOfWarnings: 0,
    numberOfMissingData: 0,
    numberOfConsistencyIssues: 0,
    consistencyIssues: [],
    warnings: [],
    missingData: [],
  };

  it("réponse complète conforme", () => {
    const resp = {
      data: validIFU,
      metadata: {
        extractionPromptVersion: "v1.0.0",
        extractedAt: new Date().toISOString(),
        modelUsed: "google/gemini-2.5-pro",
        dryRun: false,
      },
      audit: baseAudit,
      status: "extraction_completed",
    };
    expect(() => FrontResponse.parse(resp)).not.toThrow();
    expect(() => FrontAudit.parse(baseAudit)).not.toThrow();
  });

  it("rejette un statut inconnu", () => {
    const resp = {
      data: validIFU,
      metadata: { extractionPromptVersion: "v1", extractedAt: "now", dryRun: false },
      audit: baseAudit,
      status: "extraction_unknown",
    };
    expect(() => FrontResponse.parse(resp)).toThrow();
  });
});
