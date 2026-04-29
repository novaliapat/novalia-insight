// Embedding déterministe (V1) — 384 dimensions.
// Hashed bag-of-tokens normalisé puis L2-normalized.
// Aucune dépendance externe : entièrement testable et reproductible.
// Le seam est isolé : on pourra remplacer cette fonction par un appel
// à un vrai modèle d'embedding sans toucher au reste de l'architecture.

export const EMBEDDING_DIM = 384;

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function tokenize(text: string): string[] {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && t.length <= 40);
}

// FNV-1a 32-bit hash — déterministe, rapide, suffisant pour bucketing.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embedText(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  if (!text || text.trim().length === 0) return vec;
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Unigrammes + bigrammes pour capter un peu de séquence.
  const grams: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    grams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }

  for (const g of grams) {
    const h = fnv1a(g);
    const idx = h % EMBEDDING_DIM;
    const sign = (h >> 16) & 1 ? 1 : -1;
    vec[idx] += sign;
  }

  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i += 1) vec[i] /= norm;
  return vec;
}

// Tag the function so callers/tests know which embedding family was used.
export const EMBEDDING_MODEL = "novalia-hash-v1";
