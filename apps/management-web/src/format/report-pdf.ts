/**
 * Report PDF: the same hand-written PDF-1.4 approach as finance/invoice-template.ts
 * (no PDF library), extended to many pages, a table, and Chinese text.
 *
 * Latin text is Helvetica (WinAnsi). Chinese runs use the standard non-embedded CJK
 * CID fonts every PDF viewer substitutes (MSung-Light / UniCNS-UCS2-H for 繁體,
 * STSong-Light / UniGB-UCS2-H for 简体), written as UTF-16BE hex strings. Names that
 * mix both scripts ("Chan Tai-man 陳大文") switch font per run.
 *
 * The header carries what was exported: report name, estate, date range, filter and the
 * generated-at time in Hong Kong time, in the page language.
 *
 * Zebra table (summary and drill-down alike): a tinted header row that repeats on every page,
 * alternate body rows tinted very lightly (print-safe 4S light green-grey, never a dark fill),
 * thin row dividers, and whole rows only: a cell that is too long wraps (at most three lines, then
 * an ellipsis) and a row that does not fit in what is left of the page moves to the next page,
 * so a row is never split.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) Table header text is the 4S dark green (the primary-hover token) for contrast on the light header tint.
 *   0.2.0 (2026-11-19) Zebra table: tinted repeating header, light alternate-row tint, thin dividers, wrapped cells, rows never split across pages; long titles wrap.
 *   0.1.0 (2026-11-19) New.
 */

import type { Locale } from '../i18n/locale.ts';

export interface ReportPdfDoc {
  title: string;
  estate: string;
  range: string;
  filter: string;
  /** Already formatted in Hong Kong time, e.g. "19 Nov 2026, 07:36 HKT". */
  generatedAt: string;
  head: string[];
  rows: string[][];
  /** Relative column widths; equal when omitted. */
  widths?: number[];
}

const LABELS: Record<Locale, { report: string; estate: string; period: string; filter: string; generated: string; page: string; of: string; empty: string }> = {
  en: { report: 'Report', estate: 'Estate', period: 'Period', filter: 'Filter', generated: 'Generated', page: 'Page', of: 'of', empty: 'No rows.' },
  'zh-Hant': { report: '報告', estate: '屋苑', period: '期間', filter: '篩選', generated: '產生時間', page: '頁', of: '/', empty: '沒有資料列。' },
  'zh-Hans': { report: '报告', estate: '屋苑', period: '期间', filter: '筛选', generated: '生成时间', page: '页', of: '/', empty: '没有数据行。' },
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const BODY_PT = 9;
/** Leading inside a wrapped cell, and the space above and below the text of a row. */
const LEAD = 11.5;
const ROW_PAD = 3.5;
/** Ascent of the body text: the baseline sits this far below the top of its line. */
const ASCENT = 8;
const HEAD_H = 18;
const MAX_CELL_LINES = 3;
const FOOT = 36;
const TITLE_PT = 15;
const TITLE_LEAD = 18;

/** 4S table colours as PDF rg operands: light green-grey header tint, very light zebra tint, divider; the header text is the 4S dark green (tokens/style-4s.json colour.primaryHover, kept in step by a unit test). */
const C_HEAD = '0.890 0.925 0.906';
const C_ZEBRA = '0.957 0.973 0.965';
const C_RULE = '0.835 0.875 0.855';
const C_HEAD_TEXT = '0.071 0.341 0.286';

const isCjk = (ch: string): boolean => {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f);
};
/** Width in points of one character at `pt`: CJK is a full em, Latin about half. */
const charW = (ch: string, pt: number): number => (isCjk(ch) ? pt : pt * 0.52);

/** Cut a string to fit `maxW` points, with an ellipsis when it was cut. */
export function fit(text: string, maxW: number, pt: number): string {
  let w = 0;
  let out = '';
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] as string;
    const cw = charW(ch, pt);
    if (w + cw > maxW - (i < chars.length - 1 ? pt * 0.6 : 0) && i < chars.length - 1) return `${out.trimEnd()}...`;
    w += cw;
    out += ch;
  }
  return out;
}

/** Wrap a cell to `maxW` points: break at spaces for Latin, anywhere for CJK; at most `maxLines`, the last one cut with an ellipsis. */
export function wrapCell(text: string, maxW: number, pt: number, maxLines = MAX_CELL_LINES): string[] {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  const lines: string[] = [];
  let cur: string[] = [];
  let w = 0;
  const widthOf = (a: string[]) => a.reduce((n, ch) => n + charW(ch, pt), 0);
  for (const ch of chars) {
    const cw = charW(ch, pt);
    if (w + cw > maxW && cur.length > 0) {
      if (ch === ' ') {
        lines.push(cur.join(''));
        cur = [];
        w = 0;
        continue;
      }
      const brk = isCjk(ch) ? -1 : cur.lastIndexOf(' ');
      if (brk > 0) {
        lines.push(cur.slice(0, brk).join(''));
        cur = cur.slice(brk + 1);
      } else {
        lines.push(cur.join(''));
        cur = [];
      }
      w = widthOf(cur);
    }
    if (ch === ' ' && cur.length === 0) continue;
    cur.push(ch);
    w += cw;
  }
  if (cur.length > 0) lines.push(cur.join(''));
  if (lines.length === 0) return [''];
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  const rest = lines.slice(maxLines - 1).reduce((a, b) => (a === '' ? b : `${a}${isCjk([...a].pop() ?? '') ? '' : ' '}${b}`), '');
  return [...kept, fit(rest, maxW, pt)];
}

/** WinAnsi-safe literal-string body: printable ASCII as is, the middle dot as an octal escape, a few typographic marks as ASCII, anything else as "?". */
const latinBody = (s: string): string =>
  [...s]
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      if (ch === '\\' || ch === '(' || ch === ')') return `\\${ch}`;
      if (c >= 0x20 && c <= 0x7e) return ch;
      if (c === 0xb7) return '\\267';
      if (c === 0x2212 || c === 0x2013 || c === 0x2014) return '-';
      if (c === 0x2019) return "'";
      return '?';
    })
    .join('');
const hex16 = (s: string): string => [...s].map((ch) => (ch.codePointAt(0) ?? 0x3f).toString(16).padStart(4, '0')).join('').toUpperCase();

/** A text-showing operator sequence for a mixed string, starting at the current text position. */
function show(text: string, pt: number, cjkFont: 'F2' | 'F3'): string {
  const runs: Array<{ cjk: boolean; s: string }> = [];
  for (const ch of text) {
    const c = isCjk(ch);
    const last = runs[runs.length - 1];
    if (last && last.cjk === c) last.s += ch;
    else runs.push({ cjk: c, s: ch });
  }
  return runs
    .map((r) => (r.cjk ? `/${cjkFont} ${pt} Tf <${hex16(r.s)}> Tj` : `/F1 ${pt} Tf (${latinBody(r.s)}) Tj`))
    .join(' ');
}

const pad10 = (n: number): string => String(n).padStart(10, '0');

/** Render the report as A4 pages with a repeated table header and "Page n / N" footers. */
export function renderReportPdf(doc: ReportPdfDoc, locale: Locale): Uint8Array {
  const L = LABELS[locale];
  const cjkFont: 'F2' | 'F3' = locale === 'zh-Hans' ? 'F3' : 'F2';
    const rel = doc.widths ?? doc.head.map(() => 1);
  const totalRel = rel.reduce((a, b) => a + b, 0);
  const usable = PAGE_W - 2 * MARGIN;
  const colW = rel.map((r) => (r / totalRel) * usable);
  const colX = colW.map((_, i) => MARGIN + colW.slice(0, i).reduce((a, b) => a + b, 0));

  // Title: wraps to at most two lines, so a long drill-down name is not cut off or run off the page.
  const titleLines = wrapCell(doc.title, usable, TITLE_PT, 2);
  const metaTop = PAGE_H - 52 - (titleLines.length - 1) * TITLE_LEAD - 22;
  const headTop = metaTop - 4 * 13 - 6;
  const bodyBottom = FOOT;
  // Lay the rows out: a row is atomic, so one that does not fit in the rest of the page starts the next page.
  type Laid = { row: string[]; cells: string[][]; h: number; index: number };
  const laid: Laid[] = doc.rows.map((row, index) => {
    const cells = colW.map((w, c) => wrapCell(row[c] ?? '', w - 8, BODY_PT));
    const lines = Math.max(1, ...cells.map((x) => x.length));
    return { row, cells, h: lines * LEAD + 2 * ROW_PAD, index };
  });
  const pages: Laid[][] = [[]];
  let room = headTop - HEAD_H - bodyBottom;
  for (const r of laid) {
    if (r.h > room && (pages[pages.length - 1] as Laid[]).length > 0) {
      pages.push([]);
      room = headTop - HEAD_H - bodyBottom;
    }
    (pages[pages.length - 1] as Laid[]).push(r);
    room -= r.h;
  }

  const streams: string[] = pages.map((rows, pi) => {
    const ops: string[] = [];
    const text = (x: number, y: number, s: string, pt: number, colour = '0 0 0') => {
      ops.push('BT', `${colour} rg`, `${x.toFixed(1)} ${y.toFixed(1)} Td`, show(s, pt, cjkFont), 'ET');
    };
    // Title and what was exported (every page, so a single page of a long export is still self-describing).
    titleLines.forEach((line, i) => text(MARGIN, PAGE_H - 52 - i * TITLE_LEAD, line, TITLE_PT));
    const meta: Array<[string, string]> = [[L.estate, doc.estate], [L.period, doc.range], [L.filter, doc.filter], [L.generated, doc.generatedAt]];
    meta.forEach(([k, v], i) => {
      text(MARGIN, metaTop - i * 13, `${k}: ${fit(v, usable - 90, BODY_PT)}`, BODY_PT);
    });
    // Header row: tinted, repeated on every page.
    ops.push(`${C_HEAD} rg`, `${MARGIN} ${headTop - HEAD_H} ${usable} ${HEAD_H} re f`);
    doc.head.forEach((h, c) => text((colX[c] as number) + 4, headTop - ROW_PAD - ASCENT - 1, fit(h, (colW[c] as number) - 8, BODY_PT), BODY_PT, C_HEAD_TEXT));
    ops.push('0.6 w', `${C_RULE} RG`, `${MARGIN} ${headTop - HEAD_H} m ${MARGIN + usable} ${headTop - HEAD_H} l S`);
    // Body rows: zebra tint on every second row, a thin divider under each, whole rows only.
    if (doc.rows.length === 0) text(MARGIN + 4, headTop - HEAD_H - ROW_PAD - ASCENT, L.empty, BODY_PT);
    let top = headTop - HEAD_H;
    rows.forEach((r) => {
      if (r.index % 2 === 1) ops.push(`${C_ZEBRA} rg`, `${MARGIN} ${(top - r.h).toFixed(1)} ${usable} ${r.h.toFixed(1)} re f`);
      r.cells.forEach((lines, c) =>
        lines.forEach((line, li) => text((colX[c] as number) + 4, top - ROW_PAD - ASCENT - li * LEAD, line, BODY_PT)),
      );
      ops.push('0.4 w', `${C_RULE} RG`, `${MARGIN} ${(top - r.h).toFixed(1)} m ${MARGIN + usable} ${(top - r.h).toFixed(1)} l S`);
      top -= r.h;
    });
    // Footer
    text(PAGE_W - MARGIN - 70, 22, `${L.page} ${pi + 1} ${L.of} ${pages.length}`, 8);
    return ops.join('\n');
  });

  const enc = new TextEncoder();
  // Object layout: 1 catalog, 2 pages, 3 F1, 4 F2 (Type0), 5 F2 descendant, 6 F2 descriptor, 7 F3 (Type0), 8 F3 descendant, 9 F3 descriptor, then page+content pairs.
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${10 + i * 2} 0 R`).join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const cid = (name: string, order: string, enc2: string, desc: number, descendant: number): [string, string, string] => [
    `<< /Type /Font /Subtype /Type0 /BaseFont /${name}-${enc2} /Encoding /${enc2} /DescendantFonts [${descendant} 0 R] >>`,
    `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (${order}) /Supplement ${order === 'CNS1' ? 4 : 2} >> /FontDescriptor ${desc} 0 R /DW 1000 >>`,
    `<< /Type /FontDescriptor /FontName /${name} /Flags 6 /FontBBox [-160 -249 1015 1071] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>`,
  ];
  [objs[4], objs[5], objs[6]] = cid('MSung-Light', 'CNS1', 'UniCNS-UCS2-H', 6, 5);
  [objs[7], objs[8], objs[9]] = cid('STSong-Light', 'GB1', 'UniGB-UCS2-H', 9, 8);
  pages.forEach((_, i) => {
    const pageNo = 10 + i * 2;
    objs[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${pageNo + 1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 7 0 R >> >> >>`;
    const body = streams[i] as string;
    objs[pageNo + 1] = `<< /Length ${enc.encode(body).length} >>\nstream\n${body}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < objs.length; i += 1) {
    offsets[i] = enc.encode(out).length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefAt = enc.encode(out).length;
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i += 1) xref += `${pad10(offsets[i] as number)} 00000 n \n`;
  out += `${xref}trailer << /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return enc.encode(out);
}
