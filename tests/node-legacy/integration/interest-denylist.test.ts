/**
 * D5's denylist, scanned over the interest SCHEMA and the demonstration seed.
 *
 * The interest has no endpoint (D10), so there is no response corpus to scan.
 * The scan target is what D5 actually protects: the COLUMN NAMES of resident.party
 * and resident.interest, and the string VALUES the demonstration seed writes. A
 * forbidden term as a column name is D5's "a field named for any of these is a
 * defect"; a forbidden term in a seed value is the same defect one layer down.
 *
 * The denylist was derived by diffing the three existing lists (resident-mobile,
 * management-web, resident-portal), with every kept/dropped/modified/added
 * decision recorded in interest-forbidden-terms.json. The inversion runs opposite
 * to API-027-ST's booking inversion (D1).
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let db: Harness['admin'];
test.before(async () => {
  harness = await startHarness();
  db = harness.admin;
});
test.after(async () => {
  await harness.close();
});

interface Denylist {
  forbiddenPropertyNames: Record<string, { terms: string[] }>;
  allowedExceptions: { term: string }[];
}
const loadDenylist = async (): Promise<Denylist> =>
  JSON.parse(await readFile(path.resolve(import.meta.dirname, 'interest-forbidden-terms.json'), 'utf8')) as Denylist;

const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const forbiddenSet = (d: Denylist): Set<string> => {
  const allowed = new Set(d.allowedExceptions.map((e) => normalise(e.term)));
  const set = new Set<string>();
  for (const group of Object.values(d.forbiddenPropertyNames))
    for (const t of group.terms) if (!allowed.has(normalise(t))) set.add(normalise(t));
  return set;
};

const schemaColumns = async (): Promise<string[]> => {
  const rows = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='resident' AND table_name IN ('party','interest')`,
  );
  return rows.map((r) => r.column_name);
};

test('no interest/party COLUMN NAME matches a forbidden term', async () => {
  const forbidden = forbiddenSet(await loadDenylist());
  const columns = await schemaColumns();
  assert.ok(columns.length >= 20, 'the scan actually saw the columns');

  const hits = columns.filter((c) => forbidden.has(normalise(c)));
  assert.deepEqual(hits, [], `forbidden term as a column name: ${hits.join(', ')}`);
});

test('no demonstration-seed STRING VALUE contains a forbidden term (as a whole word)', async () => {
  const denylist = await loadDenylist();
  const forbidden = forbiddenSet(denylist);

  // Scan the free-ish text the seed writes: display_name, source, and any external
  // reference. (unit_id/party_id/kind are controlled identifiers.)
  const values = await db.query<{ v: string }>(
    `SELECT display_name AS v FROM resident.party WHERE party_id LIKE 'pty\\_demo\\_%' ESCAPE '\\'
     UNION ALL SELECT source FROM resident.party WHERE party_id LIKE 'pty\\_demo\\_%' ESCAPE '\\'
     UNION ALL SELECT source FROM resident.interest WHERE interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\'`,
  );
  for (const { v } of values) {
    const tokens = v.toLowerCase().split(/[^a-z0-9]+/).map(normalise).filter(Boolean);
    const hit = tokens.find((t) => forbidden.has(t));
    assert.equal(hit, undefined, `seed value "${v}" contains forbidden term "${hit}"`);
  }
});

test('the allowed exceptions are exactly the interest fields that would otherwise trip', async () => {
  // 'company' must be a permitted exception — a legal_person party is one. If the
  // list ever drops it, the legal-person case becomes unrepresentable, so assert
  // the exception survives.
  const denylist = await loadDenylist();
  const exceptions = new Set(denylist.allowedExceptions.map((e) => e.term));
  assert.ok(exceptions.has('company'), 'a legal_person party IS a company — the mirror of booking\'s ADD');
  assert.ok(exceptions.has('source') && exceptions.has('reference'), 'provenance fields are exceptions, not matches');
});

test('RED — a forbidden term as a column is caught', async () => {
  // The mutation is the exact defect D5 forbids: an instrument column on the
  // interest. Added, scanned, caught, removed — control before and after.
  const forbidden = forbiddenSet(await loadDenylist());
  assert.ok(forbidden.has('rent'), 'control before: rent is forbidden');

  await db.query(`ALTER TABLE resident.interest ADD COLUMN rent numeric`);
  try {
    const columns = await schemaColumns();
    assert.ok(columns.map(normalise).includes('rent'), 'the mutation added the column');
    const hits = columns.filter((c) => forbidden.has(normalise(c)));
    assert.deepEqual(hits, ['rent'], 'the scan catches the instrument column');
  } finally {
    await db.query(`ALTER TABLE resident.interest DROP COLUMN rent`);
  }
  // control after
  const columnsAfter = await schemaColumns();
  assert.ok(!columnsAfter.map(normalise).includes('rent'), 'control after: column removed');
});
