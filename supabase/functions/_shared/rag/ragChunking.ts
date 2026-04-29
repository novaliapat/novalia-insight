// Chunking déterministe pour ingestion RAG.
// Cible : ~1000 caractères par chunk, overlap 150, coupure sur fin de phrase si possible.

const TARGET = 1000;
const MAX = 1400;
const OVERLAP = 150;

export interface RagChunk {
  index: number;
  content: string;
}

export function chunkText(input: string): RagChunk[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (text.length === 0) return [];
  if (text.length <= MAX) return [{ index: 0, content: text }];

  const chunks: RagChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + TARGET);
    if (end < text.length) {
      // Cherche fin de phrase ou retour à la ligne dans une fenêtre raisonnable
      const window = text.slice(end, Math.min(text.length, end + 200));
      const m = window.match(/[.!?\n]\s/);
      if (m && m.index !== undefined) {
        end = end + m.index + 1;
      }
      end = Math.min(end, start + MAX);
    }

    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({ index: idx, content: slice });
      idx += 1;
    }

    if (end >= text.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }

  return chunks;
}

export function extractKeywords(text: string, max = 20): string[] {
  const stop = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "que",
    "qui", "dans", "pour", "sur", "par", "est", "sont", "aux", "avec",
    "the", "and", "for", "with", "this", "that",
  ]);
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-zà-ÿ0-9]/g, "");
    if (w.length < 4 || stop.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}
