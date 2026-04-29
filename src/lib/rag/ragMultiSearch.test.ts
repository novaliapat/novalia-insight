import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { searchRagForDetectedCategories } from "./ragMultiSearch";

const invokeMock = supabase.functions.invoke as ReturnType<typeof vi.fn>;

const mkResp = (cat: string, sources: any[]) => ({
  data: {
    category: cat,
    query: `q-${cat}`,
    taxYear: 2024,
    sources,
    missingSources: sources.length === 0,
    warning: sources.length === 0 ? "Source insuffisante — point à vérifier" : null,
  },
  error: null,
});

const getCalledCategory = (args: unknown[]): string => {
  // invoke(functionName, { body: {...} })
  const opts = args[1] as { body?: { category?: string } } | undefined;
  return opts?.body?.category ?? "";
};

describe("searchRagForDetectedCategories", () => {
  beforeEach(() => invokeMock.mockReset());

  it("fait UN appel séparé par catégorie détectée", async () => {
    invokeMock.mockImplementation((...args: unknown[]) => {
      const cat = getCalledCategory(args);
      return Promise.resolve(
        mkResp(cat, [
          {
            documentId: "d1",
            chunkId: "c1",
            title: "T",
            sourceName: null,
            sourceUrl: null,
            taxYear: 2024,
            isOfficialSource: true,
            excerpt: "x",
            similarity: 0.8,
            relevanceScore: 0.85,
            confidence: "high",
            warnings: [],
          },
        ]),
      );
    });

    const res = await searchRagForDetectedCategories({
      declarationId: "decl-1",
      taxYear: 2024,
      extractedData: { detectedCategories: ["ifu", "scpi", "life_insurance"] },
    });

    expect(invokeMock).toHaveBeenCalledTimes(3);
    const calledCats = invokeMock.mock.calls.map(getCalledCategory).sort();
    expect(calledCats).toEqual(["ifu", "life_insurance", "scpi"]);
    expect(Object.keys(res).sort()).toEqual(["ifu", "life_insurance", "scpi"]);
  });

  it("ne mélange JAMAIS les sources entre catégories (filtre défensif)", async () => {
    invokeMock.mockImplementation((...args: unknown[]) => {
      const cat = getCalledCategory(args);
      const wrongCat = cat === "scpi" ? "life_insurance" : cat;
      return Promise.resolve(
        mkResp(wrongCat, [
          {
            documentId: "d", chunkId: "c", title: "T",
            sourceName: null, sourceUrl: null, taxYear: 2024,
            isOfficialSource: false, excerpt: "x", similarity: 0.8,
            relevanceScore: 0.7, confidence: "medium", warnings: [],
          },
        ]),
      );
    });

    const res = await searchRagForDetectedCategories({
      extractedData: { detectedCategories: ["scpi"] },
    });
    expect(res.scpi?.sources).toEqual([]);
  });

  it("renvoie objet vide si aucune catégorie détectée", async () => {
    const res = await searchRagForDetectedCategories({
      extractedData: { detectedCategories: [] },
    });
    expect(res).toEqual({});
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("propage missingSources / warning quand aucune source pertinente", async () => {
    invokeMock.mockImplementation((...args: unknown[]) => {
      const cat = getCalledCategory(args);
      return Promise.resolve(mkResp(cat, []));
    });
    const res = await searchRagForDetectedCategories({
      extractedData: { detectedCategories: ["per"] },
    });
    expect(res.per?.missingSources).toBe(true);
    expect(res.per?.warning).toMatch(/insuffisante/i);
  });
});
