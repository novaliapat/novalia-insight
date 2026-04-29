import { describe, it, expect } from "vitest";
import {
  BROCHURE_IR_2025_SEED,
  brochureChunksForBox,
  brochureChunksForCategory,
} from "./brochureIr2025Seed";
import { BOX_CATALOG_2025 } from "@/lib/declaration/forms/2025/boxCatalog";

describe("Brochure IR 2025 seed — couverture des cases prioritaires", () => {
  it("2TR est relié aux intérêts / produits de placement à revenu fixe", () => {
    const chunks = brochureChunksForBox("2TR");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].category).toBe("interests");
    expect(chunks[0].formId).toBe("2042");
  });

  it("2DC est relié aux dividendes / revenus des actions et parts", () => {
    const chunks = brochureChunksForBox("2DC");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].category).toBe("dividends");
    expect(chunks[0].excerpt.toLowerCase()).toMatch(/dividende|action/);
  });

  it("2CK est relié au prélèvement forfaitaire non libératoire", () => {
    const chunks = brochureChunksForBox("2CK");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content.toLowerCase()).toMatch(/prélèvement forfaitaire|pfnl|acompte/);
  });

  it("4BA est relié aux revenus fonciers (régime réel)", () => {
    const chunks = brochureChunksForBox("4BA");
    expect(chunks.length).toBeGreaterThan(0);
    expect(["scpi", "real_estate_income"]).toContain(chunks[0].category);
    expect(chunks[0].formId).toBe("2042");
  });

  it("4BL est relié aux revenus fonciers étrangers — crédit d'impôt = IR français", () => {
    const chunks = brochureChunksForBox("4BL");
    expect(chunks.length).toBeGreaterThan(0);
    const txt = (chunks[0].content + " " + chunks[0].excerpt).toLowerCase();
    expect(txt).toMatch(/crédit d'impôt/);
    expect(txt).toMatch(/étrang/);
  });

  it("La 2047 est présente comme annexe pour les revenus de source étrangère", () => {
    const annexe = BROCHURE_IR_2025_SEED.find((c) => c.formId === "2047");
    expect(annexe).toBeDefined();
    expect(annexe!.category).toBe("foreign_accounts");
  });
});

describe("Brochure IR 2025 seed — invariants structurels", () => {
  it("chaque chunk contient pageNumber > 0", () => {
    for (const c of BROCHURE_IR_2025_SEED) {
      expect(c.pageNumber, `chunk ${c.title}`).toBeGreaterThan(0);
    }
  });

  it("chaque chunk contient un formId", () => {
    for (const c of BROCHURE_IR_2025_SEED) {
      expect(c.formId, `chunk ${c.title}`).toBeTruthy();
    }
  });

  it("chaque chunk contient soit boxCodes non vide, soit sectionLabel clair", () => {
    for (const c of BROCHURE_IR_2025_SEED) {
      const hasBoxes = Array.isArray(c.boxCodes) && c.boxCodes.length > 0;
      const hasSection = typeof c.sectionLabel === "string" && c.sectionLabel.trim().length >= 4;
      expect(hasBoxes || hasSection, `chunk ${c.title}`).toBe(true);
    }
  });

  it("toutes les catégories majeures attendues sont couvertes", () => {
    const cats = new Set(BROCHURE_IR_2025_SEED.map((c) => c.category));
    for (const required of [
      "dividends",
      "interests",
      "ifu",
      "life_insurance",
      "real_estate_income",
      "scpi",
      "foreign_accounts",
    ]) {
      expect(cats.has(required as never), `missing category ${required}`).toBe(true);
    }
  });
});

describe("Catalogue 2025 — règle d'or de confiance", () => {
  it("aucune case en high confidence sans pageNumber + sourceType official_brochure", () => {
    for (const entry of BOX_CATALOG_2025) {
      if (entry.confidence === "high") {
        expect(
          entry.sourceType,
          `box ${entry.boxOrLine} marquée high sans sourceType officiel`,
        ).toBe("official_brochure");
        expect(
          entry.pageNumber,
          `box ${entry.boxOrLine} marquée high sans pageNumber`,
        ).toBeTruthy();
        expect(entry.pageNumber!).toBeGreaterThan(0);
      }
    }
  });

  it("aucune case en status confirmed sans source officielle", () => {
    for (const entry of BOX_CATALOG_2025) {
      if (entry.status === "confirmed") {
        expect(entry.sourceType).toBe("official_brochure");
        expect(entry.sourceName).toBeTruthy();
      }
    }
  });

  it("les cases prioritaires sont bien dans le catalogue", () => {
    const codes = new Set(BOX_CATALOG_2025.map((b) => b.boxOrLine));
    for (const code of [
      "2DC", "2TR", "2CK", "2AB", "2BH", "2CG", "2OP",
      "2DH", "2CH", "2UU", "2VV", "2WW", "2XX", "2YY", "2ZZ",
      "4BE", "4BK", "4BA", "4BL", "4BB", "4BC", "4BD", "4BN", "4BZ",
      "8TK",
    ]) {
      expect(codes.has(code), `missing box ${code} in catalog`).toBe(true);
    }
  });
});

describe("Brochure helpers", () => {
  it("brochureChunksForCategory renvoie des chunks de la bonne catégorie", () => {
    const chunks = brochureChunksForCategory("life_insurance");
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.category).toBe("life_insurance");
  });
});
