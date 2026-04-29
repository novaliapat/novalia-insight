import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeExtractedDataResults } from "./mergeExtractedDataResults.ts";
import { deriveNormalizationReviewItems } from "./deriveNormalizationReviewItems.ts";
import {
  classifyHttpStatus,
  classifyThrownError,
  isRetryableErrorCode,
} from "./callAiExtraction.ts";
import type { ExtractedData } from "../_shared/contracts/extractionContracts.ts";

const baseResult = (over: Partial<ExtractedData>): ExtractedData => ({
  taxpayer: {},
  taxYear: 2024,
  detectedCategories: [],
  ifu: [],
  scpi: [],
  lifeInsurance: [],
  warnings: [],
  missingData: [],
  globalConfidence: "high",
  ...over,
});

Deno.test("mergeExtractedDataResults conserve catégories, warnings et entrées", () => {
  const r1 = baseResult({
    detectedCategories: ["ifu"],
    ifu: [{ institution: "BNP" } as ExtractedData["ifu"][number]],
    warnings: ["w1"],
    globalConfidence: "high",
  });
  const r2 = baseResult({
    detectedCategories: ["scpi", "ifu"],
    scpi: [{ scpiName: "Corum" } as ExtractedData["scpi"][number]],
    warnings: ["w2"],
    globalConfidence: "medium",
  });
  const merged = mergeExtractedDataResults([r1, r2]);
  assertEquals(merged.detectedCategories.sort(), ["ifu", "scpi"]);
  assertEquals(merged.ifu.length, 1);
  assertEquals(merged.scpi.length, 1);
  assertEquals(merged.globalConfidence, "medium");
  assertEquals(merged.warnings.includes("w1"), true);
  assertEquals(merged.warnings.includes("w2"), true);
});

Deno.test("mergeExtractedDataResults signale taxYear divergent", () => {
  const r1 = baseResult({ taxYear: 2024 });
  const r2 = baseResult({ taxYear: 2023 });
  const merged = mergeExtractedDataResults([r1, r2]);
  // Pas de majorité → on garde le premier rencontré (2024) et on warn.
  const hasYearWarn = merged.warnings.some((w) => w.includes("taxYear divergent"));
  assertEquals(hasYearWarn, true);
});

Deno.test("deriveNormalizationReviewItems: IFU institution manquante → review item", () => {
  const items = deriveNormalizationReviewItems([
    "ifu[0]: institution manquante → \"Institution non renseignée\"",
  ]);
  assertEquals(items.length, 1);
  assertEquals(items[0].sourceType, "normalization_warning");
  assertEquals(items[0].severity, "warning");
  assertEquals(items[0].field, "ifu.institution");
});

Deno.test("deriveNormalizationReviewItems: SCPI scpiName manquant → review item", () => {
  const items = deriveNormalizationReviewItems([
    "scpi[2]: scpiName manquant → \"SCPI non renseignée\"",
  ]);
  assertEquals(items.length, 1);
  assertEquals(items[0].field, "scpi.scpiName");
});

Deno.test("deriveNormalizationReviewItems: AV contractName manquant → review item", () => {
  const items = deriveNormalizationReviewItems([
    "lifeInsurance[1]: contractName manquant → \"Contrat non renseigné\"",
  ]);
  assertEquals(items.length, 1);
  assertEquals(items[0].field, "lifeInsurance.contractName");
});

Deno.test("deriveNormalizationReviewItems: dédoublonne par index", () => {
  const items = deriveNormalizationReviewItems([
    "ifu[0]: institution manquante → ...",
    "ifu[0]: institution manquante → ...",
  ]);
  assertEquals(items.length, 1);
});

Deno.test("classifyHttpStatus / classifyThrownError / isRetryableErrorCode", () => {
  assertEquals(classifyHttpStatus(429), "RATE_LIMITED");
  assertEquals(classifyHttpStatus(402), "PAYMENT_REQUIRED");
  assertEquals(classifyHttpStatus(502), "PROVIDER_UNAVAILABLE");
  assertEquals(classifyHttpStatus(503), "PROVIDER_UNAVAILABLE");
  assertEquals(classifyHttpStatus(500), "HTTP_ERROR");
  assertEquals(classifyThrownError(new Error("Network connection lost")), "NETWORK");
  assertEquals(classifyThrownError(new Error("request timed out")), "TIMEOUT");
  assertEquals(isRetryableErrorCode("NO_TOOL_CALL"), true);
  assertEquals(isRetryableErrorCode("PROVIDER_UNAVAILABLE"), true);
  assertEquals(isRetryableErrorCode("ZOD_INVALID" as never), false);
  assertEquals(isRetryableErrorCode("RATE_LIMITED"), false);
});
