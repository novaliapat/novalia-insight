// PDF builder for the Novalia tax summary export.
// Uses pdf-lib (pure JS, runs in Deno).
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

// ===== Brand =====
const COLORS = {
  navy: rgb(0.06, 0.10, 0.20),       // #101933 ish — Novalia bleu nuit
  gold: rgb(0.78, 0.62, 0.27),       // touche dorée
  text: rgb(0.13, 0.16, 0.22),
  muted: rgb(0.45, 0.50, 0.58),
  rule: rgb(0.85, 0.86, 0.90),
  warning: rgb(0.78, 0.40, 0.10),
  success: rgb(0.20, 0.55, 0.30),
  zebra: rgb(0.97, 0.97, 0.99),
};

const PAGE = { width: 595.28, height: 841.89 }; // A4
const M = { left: 50, right: 50, top: 60, bottom: 60 };

export interface PdfBuildInput {
  declaration: { id: string; title: string; tax_year: number; status: string; analysis_status?: string; review_status?: string };
  contribuable?: string | null;
  generatedAt: Date;
  extracted?: Record<string, unknown> | null;
  detectedCategories?: string[];
  validated?: Record<string, unknown> | null;
  analysis?: any | null;
  reviewItems?: any[];
  auditLogs?: any[];
  ragSourcesUsed?: any[];
  options: { includeAudit: boolean; includeRagSources: boolean; includeReviewItems: boolean };
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  cursorY: number;
  pageNumber: number;
  generatedAt: Date;
  taxYear: number;
}

const newPage = (ctx: Ctx) => {
  ctx.page = ctx.doc.addPage([PAGE.width, PAGE.height]);
  ctx.pageNumber += 1;
  ctx.cursorY = PAGE.height - M.top;
  drawFooter(ctx);
};

const ensureSpace = (ctx: Ctx, needed: number) => {
  if (ctx.cursorY - needed < M.bottom + 20) newPage(ctx);
};

const drawFooter = (ctx: Ctx) => {
  const y = M.bottom - 25;
  ctx.page.drawLine({
    start: { x: M.left, y: y + 14 },
    end: { x: PAGE.width - M.right, y: y + 14 },
    thickness: 0.5,
    color: COLORS.rule,
  });
  ctx.page.drawText("Novalia Patrimoine — Synthèse fiscale", {
    x: M.left, y, size: 8, font: ctx.font, color: COLORS.muted,
  });
  const dateStr = `Générée le ${ctx.generatedAt.toLocaleDateString("fr-FR")} à ${ctx.generatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  ctx.page.drawText(dateStr, {
    x: PAGE.width / 2 - 80, y, size: 8, font: ctx.font, color: COLORS.muted,
  });
  ctx.page.drawText(`Page ${ctx.pageNumber}`, {
    x: PAGE.width - M.right - 35, y, size: 8, font: ctx.font, color: COLORS.muted,
  });
};

// Re-draw footer with correct page number after we know it
// (we draw incrementally; cleanest is to draw footer when adding the page)

// Helvetica supports WinAnsi/Latin-1. Map common unicode glyphs to safe equivalents,
// then strip anything still outside the supported range.
const UNICODE_MAP: Array<[RegExp, string]> = [
  [/[\u2022\u25CF\u25E6\u2043]/g, "-"],     // bullets •●◦‣ → -
  [/[\u2013\u2014]/g, "-"],                  // – — → -
  [/[\u2018\u2019\u201A\u2032]/g, "'"],     // single quotes
  [/[\u201C\u201D\u201E\u2033]/g, '"'],     // double quotes
  [/\u2026/g, "..."],                        // …
  [/[\u00A0\u2007\u2009\u202F\u200A\u200B]/g, " "], // various spaces (incl. NNBSP from Intl)
  [/\u26A0\uFE0F?/g, "/!\\"],                // ⚠ → /!\
  [/[\u2705\u2713\u2714]/g, "v"],           // ✓ ✔ ✅
  [/[\u274C\u2717\u2718]/g, "x"],           // ✗ ✘ ❌
  [/\u20AC/g, "EUR"],                        // € (kept already, but safe)
];
const sanitize = (s: unknown): string => {
  if (s === null || s === undefined) return "";
  let out = String(s);
  for (const [re, rep] of UNICODE_MAP) out = out.replace(re, rep);
  // Keep printable ASCII + Latin-1 supplement + Latin Extended-A
  return out.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u017F]/g, "?");
};

const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const out: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
    if (paragraphs.length > 1 && para === "") out.push("");
  }
  return out;
};

const drawText = (
  ctx: Ctx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; lineGap?: number; indent?: number } = {},
) => {
  const font = opts.font ?? ctx.font;
  const size = opts.size ?? 10;
  const color = opts.color ?? COLORS.text;
  const indent = opts.indent ?? 0;
  const lineGap = opts.lineGap ?? 3;
  const maxWidth = PAGE.width - M.left - M.right - indent;
  const lines = wrap(sanitize(text), font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, size + lineGap);
    ctx.page.drawText(line, { x: M.left + indent, y: ctx.cursorY - size, size, font, color });
    ctx.cursorY -= size + lineGap;
  }
};

const sectionTitle = (ctx: Ctx, title: string) => {
  ensureSpace(ctx, 40);
  ctx.cursorY -= 6;
  ctx.page.drawText(sanitize(title), {
    x: M.left, y: ctx.cursorY - 14, size: 14, font: ctx.bold, color: COLORS.navy,
  });
  ctx.cursorY -= 18;
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.cursorY }, end: { x: M.left + 40, y: ctx.cursorY },
    thickness: 1.2, color: COLORS.gold,
  });
  ctx.cursorY -= 10;
};

const subTitle = (ctx: Ctx, title: string) => {
  ensureSpace(ctx, 22);
  ctx.cursorY -= 4;
  ctx.page.drawText(sanitize(title), {
    x: M.left, y: ctx.cursorY - 11, size: 11, font: ctx.bold, color: COLORS.navy,
  });
  ctx.cursorY -= 16;
};

// Simple table renderer
const drawTable = (
  ctx: Ctx,
  headers: string[],
  rows: string[][],
  colWidths: number[],
) => {
  const rowH = 16;
  const padX = 4;

  const drawHeader = () => {
    ensureSpace(ctx, rowH + 4);
    let x = M.left;
    ctx.page.drawRectangle({
      x: M.left, y: ctx.cursorY - rowH, width: colWidths.reduce((a, b) => a + b, 0),
      height: rowH, color: COLORS.navy,
    });
    headers.forEach((h, i) => {
      ctx.page.drawText(sanitize(h), {
        x: x + padX, y: ctx.cursorY - rowH + 5, size: 8.5, font: ctx.bold, color: rgb(1, 1, 1),
      });
      x += colWidths[i];
    });
    ctx.cursorY -= rowH;
  };

  drawHeader();
  rows.forEach((row, idx) => {
    // compute row height (wrap each cell)
    const cellLines: string[][] = row.map((cell, i) =>
      wrap(sanitize(cell ?? ""), ctx.font, 8.5, colWidths[i] - 2 * padX),
    );
    const linesCount = Math.max(...cellLines.map((l) => l.length || 1));
    const rH = Math.max(rowH, linesCount * 11 + 6);
    if (ctx.cursorY - rH < M.bottom + 20) {
      newPage(ctx);
      drawHeader();
    }
    if (idx % 2 === 0) {
      ctx.page.drawRectangle({
        x: M.left, y: ctx.cursorY - rH, width: colWidths.reduce((a, b) => a + b, 0),
        height: rH, color: COLORS.zebra,
      });
    }
    let x = M.left;
    cellLines.forEach((lines, i) => {
      lines.forEach((line, li) => {
        ctx.page.drawText(line, {
          x: x + padX, y: ctx.cursorY - 10 - li * 11, size: 8.5, font: ctx.font, color: COLORS.text,
        });
      });
      x += colWidths[i];
    });
    // bottom rule
    ctx.page.drawLine({
      start: { x: M.left, y: ctx.cursorY - rH },
      end: { x: M.left + colWidths.reduce((a, b) => a + b, 0), y: ctx.cursorY - rH },
      thickness: 0.3, color: COLORS.rule,
    });
    ctx.cursorY -= rH;
  });
  ctx.cursorY -= 8;
};

const formatAmount = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
};

const CATEGORY_LABELS: Record<string, string> = {
  ifu: "IFU",
  scpi: "SCPI",
  life_insurance: "Assurance-vie",
  real_estate_income: "Revenus fonciers",
  dividends: "Dividendes",
  interests: "Intérêts",
  capital_gains: "Plus-values",
  foreign_accounts: "Comptes étrangers",
  per: "PER",
  tax_credits: "Crédits d'impôt",
  deductible_expenses: "Charges déductibles",
  other: "Autres",
};
const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

// ============ MAIN ============
export async function buildTaxSummaryPdf(input: PdfBuildInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Synthèse fiscale ${input.declaration.tax_year}`);
  doc.setAuthor("Novalia Patrimoine");
  doc.setCreator("Novalia — Lovable Cloud");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const ctx: Ctx = {
    doc, page: doc.addPage([PAGE.width, PAGE.height]),
    font, bold, italic,
    cursorY: PAGE.height - M.top,
    pageNumber: 1,
    generatedAt: input.generatedAt,
    taxYear: input.declaration.tax_year,
  };
  drawFooter(ctx);

  // ===== PAGE 1 — Cover =====
  ctx.cursorY = PAGE.height - 160;
  ctx.page.drawText("NOVALIA", {
    x: M.left, y: ctx.cursorY, size: 28, font: ctx.bold, color: COLORS.navy,
  });
  ctx.page.drawText("PATRIMOINE", {
    x: M.left, y: ctx.cursorY - 28, size: 14, font: ctx.font, color: COLORS.gold,
  });
  ctx.cursorY -= 80;
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.cursorY }, end: { x: M.left + 80, y: ctx.cursorY },
    thickness: 1.5, color: COLORS.gold,
  });
  ctx.cursorY -= 40;
  ctx.page.drawText("Synthèse de préparation fiscale", {
    x: M.left, y: ctx.cursorY, size: 22, font: ctx.bold, color: COLORS.navy,
  });
  ctx.cursorY -= 40;
  ctx.page.drawText(`Année fiscale ${input.declaration.tax_year}`, {
    x: M.left, y: ctx.cursorY, size: 14, font: ctx.font, color: COLORS.text,
  });
  ctx.cursorY -= 24;
  if (input.contribuable) {
    ctx.page.drawText(`Contribuable : ${sanitize(input.contribuable)}`, {
      x: M.left, y: ctx.cursorY, size: 11, font: ctx.font, color: COLORS.text,
    });
    ctx.cursorY -= 18;
  }
  ctx.page.drawText(`Date de génération : ${input.generatedAt.toLocaleDateString("fr-FR")}`, {
    x: M.left, y: ctx.cursorY, size: 11, font: ctx.font, color: COLORS.muted,
  });

  // Disclaimer (bottom of cover)
  ctx.cursorY = M.bottom + 120;
  ctx.page.drawRectangle({
    x: M.left, y: ctx.cursorY - 70, width: PAGE.width - M.left - M.right,
    height: 80, color: rgb(0.97, 0.95, 0.88), borderColor: COLORS.gold, borderWidth: 0.5,
  });
  const disclaimer = "Ce document est une aide à la préparation de la déclaration fiscale. Les informations et cases proposées doivent être vérifiées avant toute déclaration officielle. En cas de doute, rapprochez-vous de l'administration fiscale ou de votre conseil habituel.";
  const dLines = wrap(disclaimer, ctx.italic, 9, PAGE.width - M.left - M.right - 20);
  let dy = ctx.cursorY - 14;
  for (const line of dLines) {
    ctx.page.drawText(line, { x: M.left + 10, y: dy, size: 9, font: ctx.italic, color: COLORS.text });
    dy -= 12;
  }

  // ===== PAGE 2 — Résumé exécutif =====
  newPage(ctx);
  sectionTitle(ctx, "Résumé exécutif");

  if (input.analysis?.summary) {
    drawText(ctx, sanitize(input.analysis.summary), { size: 10, lineGap: 4 });
    ctx.cursorY -= 8;
  } else {
    drawText(ctx, "Aucune analyse fiscale enregistrée pour cette déclaration.", { size: 10, color: COLORS.muted });
  }

  const cats = (input.detectedCategories ?? []).map(catLabel).join(", ") || "—";
  const taxCases = input.analysis?.taxCases ?? [];
  const manualReviewCount = taxCases.filter((c: any) => c?.requiresManualReview).length;
  const pendingReview = (input.reviewItems ?? []).filter((r: any) => r.status === "pending").length;

  subTitle(ctx, "Indicateurs");
  drawTable(ctx, ["Indicateur", "Valeur"], [
    ["Catégories analysées", cats],
    ["Cases fiscales proposées", String(taxCases.length)],
    ["Cases à vérifier manuellement", String(manualReviewCount)],
    ["Points de revue en attente", String(pendingReview)],
    ["Statut extraction", input.declaration.status === "draft" ? "—" : sanitize(input.declaration.status)],
    ["Statut revue", sanitize(input.declaration.review_status ?? "—")],
    ["Statut analyse", sanitize(input.declaration.analysis_status ?? "—")],
  ], [220, PAGE.width - M.left - M.right - 220]);

  // ===== PAGE 3 — Données validées =====
  newPage(ctx);
  sectionTitle(ctx, "Données validées par catégorie");

  const validatedRoot = (input.validated?.validated_data ?? input.validated ?? {}) as Record<string, any>;
  const extractedRoot = (input.extracted?.extracted_data ?? input.extracted ?? {}) as Record<string, any>;
  const dataRoot = Object.keys(validatedRoot).length ? validatedRoot : extractedRoot;
  const usingValidated = Object.keys(validatedRoot).length > 0;

  if (!usingValidated) {
    drawText(ctx, "⚠ Données non encore validées par l'utilisateur — affichage des données extraites.", {
      size: 9, color: COLORS.warning, italic: true as any,
    });
    ctx.cursorY -= 4;
  }

  const flattenFields = (obj: any, prefix = ""): Array<{ label: string; amount: any; confidence?: string; source?: string }> => {
    const out: any[] = [];
    if (!obj || typeof obj !== "object") return out;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as any)) {
        const cn = v as any;
        out.push({
          label: prefix ? `${prefix} › ${k}` : k,
          amount: cn.value,
          confidence: cn.confidence,
          source: cn.evidence?.sourceDocument ?? cn.sourceDocument,
        });
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => out.push(...flattenFields(item, `${prefix ? prefix + " › " : ""}${k}[${i}]`)));
      } else if (v && typeof v === "object") {
        out.push(...flattenFields(v, prefix ? `${prefix} › ${k}` : k));
      }
    }
    return out;
  };

  const detected = input.detectedCategories ?? [];
  if (!detected.length) {
    drawText(ctx, "Aucune catégorie détectée.", { color: COLORS.muted });
  } else {
    for (const cat of detected) {
      const catData = (dataRoot as any)[cat];
      subTitle(ctx, catLabel(cat));
      const rows = flattenFields(catData);
      if (!rows.length) {
        drawText(ctx, "Aucune donnée extraite pour cette catégorie.", { color: COLORS.muted, size: 9 });
        continue;
      }
      drawTable(ctx,
        ["Libellé", "Montant", "Confiance", "Source"],
        rows.map((r) => [r.label, formatAmount(r.amount), r.confidence ?? "—", r.source ?? "—"]),
        [220, 90, 70, PAGE.width - M.left - M.right - 380],
      );
    }
  }

  // ===== PAGE 4 — Cases fiscales proposées =====
  newPage(ctx);
  sectionTitle(ctx, "Cases fiscales proposées");

  if (!taxCases.length) {
    drawText(ctx, "Aucune case fiscale proposée.", { color: COLORS.muted });
  } else {
    drawTable(ctx,
      ["Catégorie", "Form.", "Case", "Libellé", "Montant", "Conf.", "À vérifier"],
      taxCases.map((c: any) => [
        catLabel(c.category ?? "—"),
        c.form ?? "—",
        c.box ?? "—",
        c.label ?? "—",
        formatAmount(c.amount),
        c.confidence ?? "—",
        c.requiresManualReview ? "Oui" : "Non",
      ]),
      [80, 40, 40, 150, 70, 40, 75],
    );

    // Explanations sub-section
    subTitle(ctx, "Explications");
    for (const c of taxCases) {
      ensureSpace(ctx, 30);
      drawText(ctx, `• ${catLabel(c.category)} — ${c.form} ${c.box} — ${c.label}`, {
        font: ctx.bold, size: 9.5,
      });
      if (c.explanation) drawText(ctx, sanitize(c.explanation), { size: 9, indent: 12, color: COLORS.muted });
      if (c.warning) drawText(ctx, `⚠ ${sanitize(c.warning)}`, { size: 9, indent: 12, color: COLORS.warning });
      ctx.cursorY -= 2;
    }
  }

  // ===== PAGE 5 — Points de vigilance =====
  newPage(ctx);
  sectionTitle(ctx, "Points de vigilance");

  const warnings: string[] = input.analysis?.warnings ?? [];
  const uncertainties: string[] = input.analysis?.uncertaintyPoints ?? [];
  const manualCases = taxCases.filter((c: any) => c?.requiresManualReview);
  const reviewItems = input.options.includeReviewItems ? (input.reviewItems ?? []) : [];

  if (warnings.length) {
    subTitle(ctx, "Avertissements de l'analyse");
    warnings.forEach((w) => drawText(ctx, `• ${w}`, { size: 9.5, indent: 6 }));
  }
  if (uncertainties.length) {
    subTitle(ctx, "Points d'incertitude");
    uncertainties.forEach((w) => drawText(ctx, `• ${w}`, { size: 9.5, indent: 6 }));
  }
  if (manualCases.length) {
    subTitle(ctx, "Cases nécessitant une vérification manuelle");
    drawTable(ctx,
      ["Catégorie", "Case", "Libellé", "Raison"],
      manualCases.map((c: any) => [catLabel(c.category), `${c.form} ${c.box}`, c.label, c.warning ?? "Sources insuffisantes"]),
      [90, 70, 180, PAGE.width - M.left - M.right - 340],
    );
  }
  if (reviewItems.length) {
    subTitle(ctx, "Points de revue (extraction)");
    drawTable(ctx,
      ["Sévérité", "Champ", "Statut", "Message"],
      reviewItems.map((r: any) => [r.severity ?? "info", r.field ?? "—", r.status ?? "pending", r.message ?? ""]),
      [60, 100, 70, PAGE.width - M.left - M.right - 230],
    );
  }
  if (!warnings.length && !uncertainties.length && !manualCases.length && !reviewItems.length) {
    drawText(ctx, "Aucun point de vigilance à signaler.", { color: COLORS.success });
  }

  // ===== PAGE 6 — Sources fiscales utilisées =====
  if (input.options.includeRagSources) {
    newPage(ctx);
    sectionTitle(ctx, "Sources fiscales utilisées");

    // Group RAG sources from analysis.taxCases by category
    const byCat: Record<string, any[]> = {};
    for (const c of taxCases) {
      for (const s of (c.ragSources ?? [])) {
        const key = s.category ?? c.category ?? "other";
        if (!byCat[key]) byCat[key] = [];
        byCat[key].push(s);
      }
    }
    // Also include declarations-level sources (tax_rag_sources_used) if present
    if (input.ragSourcesUsed?.length) {
      for (const s of input.ragSourcesUsed) {
        const key = s.category ?? "other";
        if (!byCat[key]) byCat[key] = [];
        byCat[key].push({
          documentTitle: s.title ?? s.document_id,
          sourceName: s.source_name,
          sourceUrl: s.source_url,
          isOfficialSource: s.is_official_source,
          taxYear: s.tax_year,
          relevanceScore: s.relevance_score,
          excerpt: s.excerpt,
        });
      }
    }

    const cats2 = Object.keys(byCat);
    if (!cats2.length) {
      drawText(ctx, "Aucune source RAG enregistrée pour cette analyse.", { color: COLORS.muted });
    } else {
      for (const cat of cats2) {
        subTitle(ctx, catLabel(cat));
        // dedupe
        const seen = new Set<string>();
        const unique = byCat[cat].filter((s) => {
          const key = `${s.documentId ?? ""}|${s.documentTitle ?? ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        for (const s of unique) {
          ensureSpace(ctx, 40);
          drawText(ctx, `• ${sanitize(s.documentTitle ?? "Source sans titre")}`, { font: ctx.bold, size: 10 });
          const meta: string[] = [];
          if (s.isOfficialSource) meta.push("Source officielle");
          if (s.taxYear) meta.push(`Année ${s.taxYear}`);
          if (typeof s.relevanceScore === "number") meta.push(`Pertinence ${(s.relevanceScore * 100).toFixed(0)}%`);
          if (meta.length) drawText(ctx, meta.join(" • "), { size: 8.5, indent: 12, color: COLORS.muted });
          if (s.excerpt) drawText(ctx, `"${sanitize(s.excerpt)}"`, { size: 9, indent: 12, color: COLORS.text });
          if (s.sourceUrl ?? s.url) drawText(ctx, sanitize(s.sourceUrl ?? s.url), { size: 8.5, indent: 12, color: COLORS.gold });
          ctx.cursorY -= 4;
        }
      }
    }
  }

  // ===== Annexe — Audit technique =====
  if (input.options.includeAudit) {
    newPage(ctx);
    sectionTitle(ctx, "Annexe — Audit technique");

    subTitle(ctx, "Audit d'extraction");
    const ext = input.extracted ?? {};
    const audit = (ext as any).metadata ?? {};
    drawText(ctx, JSON.stringify(audit, null, 2).slice(0, 2000), { size: 8, font: ctx.font, color: COLORS.muted });

    subTitle(ctx, "Audit d'analyse fiscale");
    drawText(ctx, `Modèle utilisé : ${sanitize((input as any).analysisMeta?.model_used ?? "—")}`, { size: 9 });
    drawText(ctx, `Version prompt : ${sanitize((input as any).analysisMeta?.prompt_version ?? "—")}`, { size: 9 });

    if (input.auditLogs?.length) {
      subTitle(ctx, "Journal d'audit (50 derniers)");
      drawTable(ctx,
        ["Date", "Action"],
        input.auditLogs.slice(0, 50).map((l: any) => [
          new Date(l.created_at).toLocaleString("fr-FR"),
          l.action ?? "—",
        ]),
        [140, PAGE.width - M.left - M.right - 140],
      );
    }
  }

  return await doc.save();
}
