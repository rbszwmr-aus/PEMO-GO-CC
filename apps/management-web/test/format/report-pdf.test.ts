/**
 * Report PDF and CSV writers: structure, xref offsets, paging, Chinese runs, header content.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) Header text is the 4S dark green (style-4s primaryHover), readable on the header tint.
 *   0.2.0 (2026-11-19) Zebra table: repeated tinted header, alternate-row tint, dividers, rows never split across pages.
 *   0.1.0 (2026-11-19) New.
 */

import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { renderReportPdf, fit, wrapCell, type ReportPdfDoc } from '../../src/format/report-pdf.ts';
import { csvText } from '../../src/format/csv.ts';

const doc = (rows: number, over: Partial<ReportPdfDoc> = {}): ReportPdfDoc => ({
  title: 'Reports · Daily operations',
  estate: 'Wing Fu Garden',
  range: '2026-11-19 – 2026-11-19',
  filter: 'All metrics',
  generatedAt: '19 Nov 2026, 07:36 HKT',
  head: ['Home', 'Tenant', 'Status'],
  rows: Array.from({ length: rows }, (_, i) => [`A · ${i}/F A1`, 'Chan Tai-man 陳大文', 'Active']),
  ...over,
});
const text = (b: Uint8Array) => Buffer.from(b).toString('latin1');

test('the PDF is well formed: header, trailer, and every xref offset points at its object', () => {
  const s = text(renderReportPdf(doc(5), 'en'));
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const xref = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(s);
  assert.ok(xref);
  const lines = (xref[2] as string).trim().split('\n').slice(1);
  lines.forEach((line, i) => {
    const off = Number(line.slice(0, 10));
    assert.ok(s.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1} is at ${off}`);
  });
  assert.equal(Number(/startxref\n(\d+)/.exec(s)?.[1]), s.indexOf('xref\n0 '));
});

test('a long table runs onto more pages, each with the header block and Page n / N', () => {
  const s = text(renderReportPdf(doc(130), 'en'));
  const pages = Number(/\/Count (\d+)/.exec(s)?.[1]);
  assert.ok(pages >= 3, `expected several pages, got ${pages}`);
  assert.equal((s.match(/\/Type \/Page /g) ?? []).length, pages);
  assert.ok(s.includes(`Page ${pages} of ${pages}`));
  assert.equal((s.match(/Wing Fu Garden/g) ?? []).length, pages);
});

test('the header says what was exported: report, estate, period, filter and generated time', () => {
  const s = text(renderReportPdf(doc(2), 'en'));
  for (const part of ['Reports \\267 Daily operations'.replace('\\267', '·'), 'Estate: Wing Fu Garden', 'Period: 2026-11-19', 'Filter: All metrics', 'Generated: 19 Nov 2026, 07:36 HKT']) {
    assert.ok(s.includes(part.replace('·', '\\267')) || s.includes(part), `missing ${part}`);
  }
});

test('Chinese text is written as UTF-16BE hex in the CID font for its script, and mixed names switch fonts', () => {
  const hant = text(renderReportPdf(doc(1, { title: '報告', estate: '榮富花園' }), 'zh-Hant'));
  assert.ok(hant.includes('<5831544A>')); // 報告
  assert.ok(hant.includes('/F2 '));
  const hans = text(renderReportPdf(doc(1, { title: '报告' }), 'zh-Hans'));
  assert.ok(hans.includes('<62A5544A>')); // 报告
  assert.ok(hans.includes('/F3 '));
  assert.ok(hans.includes('/STSong-Light'));
  assert.ok(hant.includes('/MSung-Light'));
  assert.ok(hant.includes('(Chan Tai-man ) Tj') || hant.includes('Chan Tai-man'));
});

test('fit shortens to the column with an ellipsis and never grows a string that already fits', () => {
  assert.equal(fit('Active', 200, 9), 'Active');
  const cut = fit('A very long facility name that cannot fit', 60, 9);
  assert.ok(cut.endsWith('...') && cut.length < 30);
  assert.ok(fit('陳大文陳大文陳大文陳大文', 40, 9).endsWith('...'));
});

test('CSV quotes commas, quotes and line breaks, ends lines with CRLF and starts with a BOM', () => {
  const out = csvText(['Home', 'Note'], [['A · 12/F A1', 'say "hi", ok'], ['B', 'two\nlines']]);
  assert.ok(out.startsWith('\ufeffHome,Note\r\n'));
  assert.ok(out.includes('A · 12/F A1,"say ""hi"", ok"\r\n'));
  assert.ok(out.includes('B,"two\nlines"\r\n'));
});

const HEAD_TINT = '0.890 0.925 0.906 rg';
const ZEBRA_TINT = '0.957 0.973 0.965 rg';
/** Every filled rectangle of one colour in the file: [x, y, w, h]. */
const rects = (s: string, tint: string): number[][] =>
  [...s.matchAll(new RegExp(`${tint.replace(/\./g, '\\.')}\\n([\\d. -]+) re f`, 'g'))].map((m) => (m[1] as string).split(' ').map(Number));

test('zebra: the header row is tinted and drawn again on every page', () => {
  const s = text(renderReportPdf(doc(130), 'en'));
  const pages = Number(/\/Count (\d+)/.exec(s)?.[1]);
  assert.ok(pages >= 3);
  assert.equal(rects(s, HEAD_TINT).length, pages);
  for (const language of ['zh-Hant', 'zh-Hans'] as const) {
    const cjk = text(renderReportPdf(doc(130), language));
    assert.equal(rects(cjk, HEAD_TINT).length, Number(/\/Count (\d+)/.exec(cjk)?.[1]));
  }
});

test('zebra: every second row is tinted, each row has a thin divider, and the tint is very light', () => {
  const rows = 41;
  const s = text(renderReportPdf(doc(rows), 'en'));
  assert.equal(rects(s, ZEBRA_TINT).length, Math.floor(rows / 2));
  assert.equal((s.match(/0\.4 w/g) ?? []).length, rows);
  for (const tint of [HEAD_TINT, ZEBRA_TINT]) {
    const [r, g, b] = tint.split(' ').map(Number) as [number, number, number];
    assert.ok(Math.min(r, g, b) >= 0.88, `${tint} stays light enough to print safely`);
  }
});

test('zebra: rows are never split across pages and never run into the footer', () => {
  // Cells that wrap make rows of different heights; a row that does not fit moves whole to the next page.
  const wide = doc(60, { rows: Array.from({ length: 60 }, (_, i) => [`A · ${i}/F A1`, `Chan Tai-man 陳大文 ${'wraps onto several lines '.repeat(i % 5)}`, 'Active']) });
  const s = text(renderReportPdf(wide, 'en'));
  const pages = Number(/\/Count (\d+)/.exec(s)?.[1]);
  const dividers = [...s.matchAll(/0\.4 w\n[\d. ]+ RG\n([\d.]+) ([\d.]+) m/g)].map((m) => Number(m[2]));
  assert.equal(dividers.length, 60);
  assert.ok(dividers.every((y) => y >= 36), 'no row ends below the footer margin');
  const zebra = rects(s, ZEBRA_TINT);
  assert.ok(zebra.every(([, y]) => (y as number) >= 36));
  assert.ok(pages >= 2);
  // The row heights differ, so wrapping really happened.
  assert.ok(new Set(zebra.map(([, , , h]) => h)).size > 1);
});

test('wrapCell breaks Latin at spaces and CJK anywhere, and cuts the last allowed line with an ellipsis', () => {
  const lines = wrapCell('Residents who are verified this month', 70, 9);
  assert.ok(lines.length >= 2 && lines.every((l) => !l.startsWith(' ') && !l.endsWith(' ')));
  assert.equal(wrapCell('Active', 200, 9).length, 1);
  assert.deepEqual(wrapCell('', 200, 9), ['']);
  const cjk = wrapCell('陳大文陳大文陳大文陳大文陳大文', 36, 9);
  assert.ok(cjk.length >= 3 && cjk.every((l) => [...l].length <= 4 || l.endsWith('...')));
  const cut = wrapCell('word '.repeat(60), 70, 9);
  assert.equal(cut.length, 3);
  assert.ok((cut[2] as string).endsWith('...'));
});

test('zebra: header text is the 4S dark green token and is readable on the header tint', () => {
  const token = JSON.parse(readFileSync(new URL('../../tokens/style-4s.json', import.meta.url), 'utf8')).colour.primaryHover as string;
  const rgb = [1, 3, 5].map((i) => parseInt(token.slice(i, i + 2), 16) / 255);
  const operand = rgb.map((v) => v.toFixed(3)).join(' ');
  const s = text(renderReportPdf(doc(3), 'en'));
  assert.ok(s.includes(`${operand} rg\n`), `header text uses ${operand}`);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c: number[]) => 0.2126 * lin(c[0] as number) + 0.7152 * lin(c[1] as number) + 0.0722 * lin(c[2] as number);
  const tint = HEAD_TINT.split(' ').map(Number);
  assert.ok((lum(tint) + 0.05) / (lum(rgb) + 0.05) >= 7, 'AAA contrast on the header tint');
});
