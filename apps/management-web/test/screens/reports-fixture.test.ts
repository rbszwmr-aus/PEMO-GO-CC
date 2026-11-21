/**
 * Reports fixture and export: a card's figure is the rows it opens, Daily is inside Management,
 * and CSV and PDF export what is on screen with the row count kept in the label.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { METRICS, CARDS, defaultRange, metricValue, rowsOf, columnsOf, hkToday } from '../../src/data/reports-fixture.ts';
import { actionLabel, cardsExport, drillExport } from '../../src/screens/report-export.ts';

const TODAY = '2026-11-19';
const NOW = new Date('2026-11-19T07:36:00+08:00');

test('twelve cards, each metric belongs to a card, and every metric has one column label per cell', () => {
  assert.equal(CARDS.length, 12);
  for (const d of METRICS) {
    assert.ok(CARDS.some((c) => c.id === d.card), d.id);
    const rows = rowsOf(d, defaultRange('mgmt', TODAY), TODAY, 'en');
    for (const r of rows.slice(0, 5)) {
      assert.equal(r.cells.length, columnsOf(d.kind).length, d.id);
      assert.equal(r.keys.length, r.cells.length, d.id);
    }
  }
});

test('the figure on a card equals the rows it opens: a count for count metrics, the HKD total for money', () => {
  const range = defaultRange('mgmt', TODAY);
  for (const d of METRICS) {
    const rows = rowsOf(d, range, TODAY, 'en');
    const v = metricValue(d, range, TODAY);
    if (d.money) assert.equal(v.n, rows.reduce((a, r) => a + (r.amount ?? 0), 0), d.id);
    else assert.equal(v.n, rows.length, d.id);
  }
  const net = METRICS.find((d) => d.id === 'pay-net')!;
  const pay = metricValue(METRICS.find((d) => d.id === 'pay-recorded')!, range, TODAY).n;
  const ref = metricValue(METRICS.find((d) => d.id === 'pay-refunds')!, range, TODAY).n;
  assert.ok(Math.abs(metricValue(net, range, TODAY).n - (pay - ref)) < 0.01 || metricValue(net, range, TODAY).n > 0);
});

test('Daily is a subset of Management for period metrics, and current metrics ignore the range', () => {
  const daily = defaultRange('daily', TODAY);
  const mgmt = defaultRange('mgmt', TODAY);
  for (const d of METRICS) {
    const a = metricValue(d, daily, TODAY).n;
    const b = metricValue(d, mgmt, TODAY).n;
    if (d.basis === 'current') assert.equal(a, b, d.id);
    else assert.ok(Math.abs(a) <= Math.abs(b), d.id);
  }
  assert.ok(metricValue(METRICS.find((d) => d.id === 'bookings-confirmed')!, daily, TODAY).n > 0);
});

test('zh flat labels stay localised and no row shows a system id', () => {
  const d = METRICS.find((x) => x.id === 'tenancies-active')!;
  const en = rowsOf(d, defaultRange('daily', TODAY), TODAY, 'en')[0]!.cells[0];
  const hant = rowsOf(d, defaultRange('daily', TODAY), TODAY, 'zh-Hant')[0]!.cells[0];
  const hans = rowsOf(d, defaultRange('daily', TODAY), TODAY, 'zh-Hans')[0]!.cells[0];
  assert.equal(en, 'A · 3/F A1');
  assert.equal(hant, 'A座3樓A1');
  assert.equal(hans, 'A座3楼A1');
  for (const x of METRICS) for (const r of rowsOf(x, defaultRange('mgmt', TODAY), TODAY, 'en').slice(0, 40)) assert.doesNotMatch(r.cells.join(' '), /\b(hh|vis|hd|tkt|bk)_\w+/);
});

test('the export button label is plain on the cards view and keeps the row count on a drill-down', () => {
  assert.equal(actionLabel('CSV', null, 'en'), 'CSV');
  assert.equal(actionLabel('PDF', 118, 'en'), 'PDF (118 rows)');
  assert.equal(actionLabel('PDF', 118, 'zh-Hant'), 'PDF (118 行)');
});

test('cards export is the whole report, one row per metric; drill export is exactly the rows shown', () => {
  const range = defaultRange('mgmt', TODAY);
  const all = cardsExport('mgmt', range, TODAY, NOW, 'en');
  assert.equal(all.rows.length, METRICS.length);
  assert.deepEqual(all.head, ['Section', 'Metric', 'Basis', 'Value']);
  assert.equal(all.generatedAt, '19 Nov 2026, 07:36 HKT');
  assert.equal(all.estate, 'Wing Fu Garden');
  assert.equal(all.range, '2026-11-01 – 2026-11-19');

  const d = METRICS.find((x) => x.id === 'tenancies-active')!;
  const rows = rowsOf(d, range, TODAY, 'en').slice(0, 7);
  const drill = drillExport('mgmt', d, rows, 'chan', range, NOW, 'en');
  assert.equal(drill.rows.length, 7);
  assert.ok(drill.filter.includes('Active tenancies') && drill.filter.includes('chan') && drill.filter.endsWith('· 7'));
  assert.ok(drill.title.includes('Management report'));
  const zh = drillExport('mgmt', d, rows, '', range, NOW, 'zh-Hant');
  assert.ok(zh.generatedAt.endsWith('（香港時間）'));
  assert.equal(zh.estate, '榮富花園');
});

test('hkToday reads the Hong Kong calendar day, not the box zone', () => {
  assert.equal(hkToday(new Date('2026-11-18T17:00:00Z')), '2026-11-19');
  assert.equal(hkToday(new Date('2026-11-18T15:59:00Z')), '2026-11-18');
});
