import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyView, ariaSortFor, distinctOptions, filtersActive, nextSort,
  type ViewSpec, type ViewState,
} from '../../src/components/table-view.ts';

interface Row { name: string; host: string; purpose: string; time: number | null; pass: string }
const rows: Row[] = [
  { name: 'Chan Tai-man', host: 'Block A 12/F A1', purpose: 'Visit', time: 540, pass: 'VP-1' },
  { name: 'SF Express', host: 'Block B 18/F B4', purpose: 'Delivery', time: 600, pass: '—' },
  { name: 'Lam Siu-kei', host: 'Block A 7/F A2', purpose: 'Visit', time: null, pass: 'VP-2' },
  { name: 'Wong Suk-fan', host: 'Block A 12/F A1', purpose: 'Other', time: 480, pass: '—' },
];
const spec: ViewSpec<Row> = {
  searchText: (r) => `${r.name} ${r.host}`,
  filters: { purpose: (r) => r.purpose, pass: (r) => (r.pass === '—' ? 'none' : 'with') },
  sorts: { name: (r) => r.name, time: (r) => r.time, pass: (r) => (r.pass === '—' ? null : r.pass) },
};
const base: ViewState = { query: '', filters: {}, sort: null };
const plain = { query: '', filters: {} };
const names = (v: Row[]) => v.map((r) => r.name);

test('a header click cycles ascending, descending, off; another column starts ascending', () => {
  let s = nextSort(null, 'name');
  assert.deepEqual(s, { key: 'name', dir: 'asc' });
  s = nextSort(s, 'name');
  assert.deepEqual(s, { key: 'name', dir: 'desc' });
  assert.equal(nextSort(s, 'name'), null);
  assert.deepEqual(nextSort({ key: 'name', dir: 'desc' }, 'time'), { key: 'time', dir: 'asc' });
  assert.equal(ariaSortFor({ key: 'name', dir: 'asc' }, 'name'), 'ascending');
  assert.equal(ariaSortFor({ key: 'name', dir: 'desc' }, 'name'), 'descending');
  assert.equal(ariaSortFor({ key: 'name', dir: 'desc' }, 'time'), 'none');
  assert.equal(ariaSortFor(null, 'name'), 'none');
});

test('sorting: text and numbers both ways, rows with no value always last, off keeps the original order', () => {
  assert.deepEqual(names(applyView(rows, spec, { ...base, sort: { key: 'name', dir: 'asc' } })), ['Chan Tai-man', 'Lam Siu-kei', 'SF Express', 'Wong Suk-fan']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, sort: { key: 'name', dir: 'desc' } })), ['Wong Suk-fan', 'SF Express', 'Lam Siu-kei', 'Chan Tai-man']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, sort: { key: 'time', dir: 'asc' } })), ['Wong Suk-fan', 'Chan Tai-man', 'SF Express', 'Lam Siu-kei']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, sort: { key: 'time', dir: 'desc' } })), ['SF Express', 'Chan Tai-man', 'Wong Suk-fan', 'Lam Siu-kei']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, sort: { key: 'pass', dir: 'desc' } })).slice(0, 2), ['Lam Siu-kei', 'Chan Tai-man']);
  assert.deepEqual(names(applyView(rows, spec, base)), names(rows));
});

test('search looks through visitor and host unit; every word must match', () => {
  assert.deepEqual(names(applyView(rows, spec, { ...base, query: 'block a' })), ['Chan Tai-man', 'Lam Siu-kei', 'Wong Suk-fan']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, query: 'block a 12/f' })), ['Chan Tai-man', 'Wong Suk-fan']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, query: 'SF EXPRESS' })), ['SF Express']);
  assert.deepEqual(applyView(rows, spec, { ...base, query: 'VP-1' }), [], 'the pass code is not searched');
});

test('dropdown filters narrow together with the search; an empty value is off', () => {
  assert.deepEqual(names(applyView(rows, spec, { ...base, filters: { purpose: 'Visit' } })), ['Chan Tai-man', 'Lam Siu-kei']);
  assert.deepEqual(names(applyView(rows, spec, { ...base, filters: { purpose: 'Visit', pass: 'none' } })), []);
  assert.deepEqual(names(applyView(rows, spec, { ...base, query: 'wong', filters: { pass: 'none', purpose: '' } })), ['Wong Suk-fan']);
});

test('Clear filters is for an active search or filter only; sorting alone is not a filter', () => {
  assert.equal(filtersActive(base), false);
  assert.equal(filtersActive({ ...plain }), false); // the sort is not part of what filtersActive reads
  assert.equal(filtersActive({ ...base, query: '  ' }), false);
  assert.equal(filtersActive({ ...base, query: 'x' }), true);
  assert.equal(filtersActive({ ...base, filters: { purpose: '' } }), false);
  assert.equal(filtersActive({ ...base, filters: { purpose: 'Visit' } }), true);
});

test('dropdown options are the distinct values present, sorted, without blanks', () => {
  assert.deepEqual(distinctOptions(rows, (r) => r.purpose).map((o) => o.value), ['Delivery', 'Other', 'Visit']);
  assert.deepEqual(distinctOptions(rows, (r) => r.pass).map((o) => o.value), ['VP-1', 'VP-2']);
});
