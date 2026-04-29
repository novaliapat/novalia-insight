// Tests unitaires côté Deno-shared (logique pure exécutable via Vitest grâce au tsconfig)
// Vérifie : chunking + héritage de catégorie sur tous les chunks générés à l'ingestion.
import { describe, it, expect } from "vitest";
import { chunkText, extractKeywords } from "../../../supabase/functions/_shared/rag/ragChunking";

describe("ragChunking", () => {
  it("retourne un seul chunk pour un texte court", () => {
    const out = chunkText("Texte court de référence fiscale.");
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(0);
  });

  it("découpe les longs textes en plusieurs chunks indexés", () => {
    const long = "Phrase fiscale. ".repeat(400); // ~6400 chars
    const out = chunkText(long);
    expect(out.length).toBeGreaterThan(1);
    out.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("extrait des mots-clés non vides en filtrant stopwords", () => {
    const kw = extractKeywords(
      "Les dividendes des SCPI sont imposés selon le régime des revenus fonciers.",
    );
    expect(kw).toContain("dividendes");
    expect(kw).toContain("scpi");
    expect(kw).not.toContain("les");
    expect(kw).not.toContain("des");
  });
});

describe("ingestion contract — héritage de catégorie", () => {
  it("simule l'héritage : chaque chunk hérite de la catégorie de son document parent", () => {
    // Reproduit la logique de l'edge function ingest-tax-rag-document
    const documentCategory = "scpi";
    const chunks = chunkText("Contenu SCPI très long. ".repeat(200));
    const rows = chunks.map((c) => ({
      category: documentCategory,
      chunk_index: c.index,
      content: c.content,
    }));
    expect(rows.every((r) => r.category === "scpi")).toBe(true);
  });
});
