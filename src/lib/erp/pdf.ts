import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, formatMoney, label, sumMoney } from "./format";
import { totalRows, type Report } from "./reports";

const FOREST = rgb(0.07, 0.23, 0.16);
const INK = rgb(0.13, 0.15, 0.13);
const MUTED = rgb(0.42, 0.45, 0.42);
const LINE = rgb(0.85, 0.85, 0.82);

/** Standard PDF fonts only support WinAnsi; replace anything else. */
const clean = (s: string) =>
  s.replace(/−/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E -ÿ–—•€]/g, "?");

function fit(text: string, font: PDFFont, size: number, width: number) {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
  return `${t}…`;
}

function cellText(type: string | undefined, key: string, v: unknown, tz: string) {
  if (v === null || v === undefined || v === "") return "—";
  switch (type) {
    case "money": return formatMoney(v as string, { currency: false });
    case "date": return formatDate(v as string, tz);
    case "datetime": return formatDate(v as Date, tz, true);
    case "status": return label(String(v));
    default: return key.includes("type") ? label(String(v)) : String(v);
  }
}

/**
 * Renders a report as an A4-landscape PDF on the server: title, filters,
 * table with repeated headers, totals, page numbers and a disclaimer footer.
 */
export async function renderReportPdf(opts: {
  report: Report;
  rows: Array<Record<string, unknown>>;
  filterSummary: string[];
  generatedBy: string;
  timeZone: string;
}) {
  const { report, rows, timeZone } = opts;
  const doc = await PDFDocument.create();
  doc.setTitle(`Herdvest Pakistan — ${report.title}`);
  doc.setAuthor("Herdvest Management System");
  doc.setCreationDate(new Date());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 841.89, H = 595.28, M = 36, size = 8, rowH = 15;
  const cols = report.columns;
  const numeric = (t?: string) => t === "money" || t === "number";
  // column widths proportional to content length (bounded)
  const lens = cols.map((c) => Math.min(40, Math.max(c.label.length, ...rows.slice(0, 200).map((r) => cellText(c.type, c.key, r[c.key], timeZone).length))));
  const totalLen = lens.reduce((a, b) => a + b, 0);
  const widths = lens.map((l) => ((W - 2 * M) * l) / totalLen);
  const currencyNote = cols.some((c) => c.type === "money") ? "Amounts in PKR." : "";

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];

  const header = (first: boolean) => {
    if (first) {
      page.drawText("HERDVEST PAKISTAN", { x: M, y, size: 9, font: bold, color: rgb(0.66, 0.53, 0.25) });
      y -= 20;
      page.drawText(clean(report.title), { x: M, y, size: 16, font: bold, color: FOREST });
      y -= 16;
      const meta = [`Generated ${formatDate(new Date(), timeZone, true)} by ${opts.generatedBy}`, ...opts.filterSummary, currencyNote].filter(Boolean).join("   ·   ");
      page.drawText(fit(meta, font, 8, W - 2 * M), { x: M, y, size: 8, font, color: MUTED });
      y -= 18;
    }
    let x = M;
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: rowH, color: FOREST });
    cols.forEach((c, i) => {
      const t = fit(c.label, bold, size, widths[i] - 6);
      const tw = bold.widthOfTextAtSize(t, size);
      page.drawText(t, { x: numeric(c.type) ? x + widths[i] - 3 - tw : x + 3, y, size, font: bold, color: rgb(1, 1, 1) });
      x += widths[i];
    });
    y -= rowH;
  };

  const drawRow = (values: string[], isBold = false) => {
    if (y < M + 30) {
      page = doc.addPage([W, H]);
      pages.push(page);
      y = H - M;
      header(false);
    }
    let x = M;
    values.forEach((v, i) => {
      const f = isBold ? bold : font;
      const t = fit(v, f, size, widths[i] - 6);
      const tw = f.widthOfTextAtSize(t, size);
      page.drawText(t, { x: numeric(cols[i].type) ? x + widths[i] - 3 - tw : x + 3, y, size, font: f, color: INK });
      x += widths[i];
    });
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.4, color: LINE });
    y -= rowH;
  };

  header(true);
  if (rows.length === 0) drawRow(cols.map((_, i) => (i === 0 ? "No records for these filters" : "")));
  for (const r of rows) drawRow(cols.map((c) => cellText(c.type, c.key, r[c.key], timeZone)));
  if (report.totals && rows.length) {
    const { counted, label: totalLabel } = totalRows(report, rows);
    drawRow(cols.map((c, i) => {
      if (i === 0) return totalLabel;
      if (!report.totals!.includes(c.key)) return "";
      return c.type === "money" ? formatMoney(sumMoney(counted.map((r) => r[c.key] as string)), { currency: false }) : String(counted.reduce((a, r) => a + Number(r[c.key] ?? 0), 0));
    }), true);
  }

  const footer = "Confidential. Generated from verified records in the Herdvest Management System. Calculated amounts are not payments; illustrative figures are not forecasts.";
  pages.forEach((p, i) => {
    p.drawText(fit(footer, font, 7, W - 2 * M - 60), { x: M, y: 18, size: 7, font, color: MUTED });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7), y: 18, size: 7, font, color: MUTED });
  });
  return doc.save();
}
