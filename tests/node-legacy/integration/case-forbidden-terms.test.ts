/**
 * ADR-020 D1 MADE MECHANICAL — the service_case schema holds no work execution.
 *
 * PEMO records THAT a job exists in another system and what that system last
 * said. It does not hold the technician, the parts, the labour, the cost or the
 * crew schedule. That boundary is easy to state and easy to erode: the request
 * for "just the cost, for the report" is reasonable-sounding and arrives early.
 *
 * The denylist is DERIVED by diffing `interest-forbidden-terms.json` (ADR-011 D5,
 * API-027-ST's method), with every decision recorded in that file's
 * `diffDecisions` — including the one whole group dropped and why.
 *
 * THIS SCAN READS TYPES AS WELL AS NAMES, which no earlier denylist did. A column
 * called `adjustment numeric(12,2)` carries money while dodging every name-based
 * term, so a name-only scan would pass it.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';

interface Denylist {
  forbiddenPropertyNames: Record<string, { terms: string[]; appliesToTypesOnly?: boolean }>;
  allowedExceptions: { term: string }[];
  diffDecisions: Record<string, Record<string, string>>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const d: Denylist = JSON.parse(readFileSync(resolve(HERE, 'case-forbidden-terms.json'), 'utf8'));
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const allowed = new Set(d.allowedExceptions.map((e) => normalise(e.term)));
const nameTerms = new Set<string>();
const typeTerms = new Set<string>();
for (const g of Object.values(d.forbiddenPropertyNames)) {
  for (const t of g.terms) {
    const n = normalise(t);
    if (allowed.has(n)) continue;
    (g.appliesToTypesOnly ? typeTerms : nameTerms).add(n);
  }
}

let db: ReturnType<typeof createModuleDb>;
test.before(() => { db = createModuleDb({ schema: 'platform', database: loadConfig().databaseOwner }); });
test.after(async () => { await db.close(); });

const columns = () => db.query<{ table_name: string; column_name: string; data_type: string }>(
  `SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'service_case' ORDER BY 1, 2`);

test('no service_case column NAMES the work PEMO does not model', async () => {
  const cols = await columns();
  assert.ok(cols.length >= 20, 'the scan actually saw the schema');
  const hits = cols.filter((c) => nameTerms.has(normalise(c.column_name)));
  assert.deepEqual(hits.map((h) => `${h.table_name}.${h.column_name}`), [],
    'ADR-020 D1: PEMO consumes the work order, it does not model the work');
});

test('no service_case column carries a MONETARY TYPE, whatever it is called', async () => {
  // The half a name-based scan cannot do. `adjustment numeric(12,2)` is money.
  const cols = await columns();
  const hits = cols.filter((c) => typeTerms.has(normalise(c.data_type)));
  assert.deepEqual(hits.map((h) => `${h.table_name}.${h.column_name}:${h.data_type}`), [],
    'a monetary column can hide behind an innocent name and a numeric type');
});

test('the derivation from the interest denylist is recorded, decision by decision', async () => {
  // The diff is the artifact ADR-011 D5 asks for. A denylist that appeared without
  // a recorded derivation is a list somebody wrote from memory.
  for (const key of ['keptVerbatim', 'dropped', 'invertedIn', 'modified']) {
    assert.ok(d.diffDecisions[key] !== undefined && Object.keys(d.diffDecisions[key]!).length > 0,
      `diffDecisions.${key} must record what happened to that part of the source list`);
  }
  assert.match(d.diffDecisions['dropped']!['instrument']!, /ADR-011/,
    'the one dropped group must say which boundary it belonged to, and why it is not this one\'s');
});
