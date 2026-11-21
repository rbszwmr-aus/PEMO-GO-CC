/**
 * resident.party and resident.interest — ADR-011, GEN-029-ST.
 *
 * The schema's whole point is a set of states it must ACCEPT and a set it must
 * REJECT, so it is proven in both directions. A constraint proven only by what it
 * rejects is half tested — joint ownership being ACCEPTED is as load-bearing as a
 * duplicate being rejected, because it is the state the wrong key `(unit, kind)`
 * would have forbidden.
 *
 * Every mutation has its control asserted before AND after, so a contaminating
 * insert is located rather than merely detected somewhere later.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let db: Harness['admin'];

test.before(async () => {
  harness = await startHarness();
  db = harness.admin;
});
test.after(async () => {
  await db.query(`DELETE FROM resident.interest WHERE interest_id LIKE 'pit\\_%' ESCAPE '\\'`);
  await db.query(`DELETE FROM resident.party WHERE party_id LIKE 'pty\\_pit\\_%' ESCAPE '\\'`);
  await harness.close();
});

const UNIT = 'unit_wfg_a_12_a1';
const party = (id: string, kind = 'natural_person', source = 'human_entry', recordedBy: string | null = 'stf_wfg_manager') =>
  db.query(
    `INSERT INTO resident.party (party_id, organization_id, kind, display_name, source, recorded_by, recorded_at)
     VALUES ($1, 'org_wingfu_holdings', $2, $1, $3, $4, now())`,
    [id, kind, source, recordedBy],
  );
const interest = (
  id: string,
  partyId: string,
  kind: 'ownership' | 'tenancy',
  from: string,
  to: string | null,
) =>
  db.query(
    `INSERT INTO resident.interest
       (interest_id, party_id, unit_id, kind, effective_from, effective_to, source, recorded_by, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'human_entry', 'stf_wfg_manager', now())`,
    [id, partyId, UNIT, kind, from, to],
  );

test('the exclusion key ACCEPTS joint ownership — two parties, one unit, overlapping', async () => {
  await party('pty_pit_a');
  await party('pty_pit_b');

  await interest('pit_a', 'pty_pit_a', 'ownership', '2024-01-01T00:00:00+08', null);
  // The load-bearing ACCEPT: the wrong key (unit, kind) would reject this.
  await interest('pit_b', 'pty_pit_b', 'ownership', '2024-01-01T00:00:00+08', null);

  const [{ n }] = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.interest WHERE unit_id = $1 AND kind = 'ownership'`,
    [UNIT],
  );
  assert.equal(Number(n), 2, 'joint ownership (夫妻聯名) must be representable');
});

test('RED — the exclusion key REJECTS a duplicate: same party, unit, kind, overlapping', async () => {
  // Control before: the legitimate joint state from the previous test still holds.
  const before = await db.query(`SELECT 1 FROM resident.interest WHERE interest_id = 'pit_a'`);
  assert.equal(before.length, 1, 'control before: pty_pit_a still owns');

  await assert.rejects(
    () => interest('pit_dup', 'pty_pit_a', 'ownership', '2025-01-01T00:00:00+08', null),
    /exclusion constraint|interest_no_duplicate/,
    'a second overlapping ownership for the same party is a duplicate and must be refused',
  );

  // Control after: the mutation left nothing behind.
  const after = await db.query(`SELECT 1 FROM resident.interest WHERE interest_id = 'pit_dup'`);
  assert.equal(after.length, 0, 'control after: the rejected duplicate was not written');
});

test('the key ACCEPTS ownership AND tenancy on one unit — the landlord/tenant case', async () => {
  await interest('pit_ten', 'pty_pit_b', 'tenancy', '2024-06-01T00:00:00+08', null);
  const kinds = await db.query<{ kind: string }>(
    `SELECT DISTINCT kind FROM resident.interest WHERE unit_id = $1 ORDER BY kind`,
    [UNIT],
  );
  assert.deepEqual(kinds.map((r) => r.kind), ['ownership', 'tenancy'], 'both kinds coexist on one unit');
});

test('the key ACCEPTS the same (party,unit,kind) over NON-overlapping ranges — sold, then bought back', async () => {
  // The fifth case the PID did not name. `(unit, kind)` over-rejects it too.
  await interest('pit_rebuy', 'pty_pit_a', 'ownership', '2020-01-01T00:00:00+08', '2023-01-01T00:00:00+08');
  const [{ n }] = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.interest WHERE party_id = 'pty_pit_a' AND kind = 'ownership'`,
  );
  assert.equal(Number(n), 2, 'a past interest and a current one for the same party are two facts, not a conflict');
});

test('effective dating answers NOW and THEN, and the two DIFFER', async () => {
  const owners = async (asAt: string) =>
    (
      await db.query<{ party_id: string }>(
        `SELECT party_id FROM resident.interest
          WHERE unit_id = $1 AND kind = 'ownership'
            AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)
          ORDER BY party_id`,
        [UNIT, asAt],
      )
    ).map((r) => r.party_id);

  const now = await owners(new Date().toISOString());
  const then = await owners('2021-06-01T00:00:00+08');

  assert.deepEqual(now, ['pty_pit_a', 'pty_pit_b'], 'NOW: the current joint owners');
  assert.deepEqual(then, ['pty_pit_a'], 'THEN: only the historical interest was in force');
  assert.notDeepEqual(now, then, 'a system of record must answer "who held this then" differently from "now"');
});

test('provenance and audit gates — no placeholder principal, ever (F2)', async () => {
  // A bootstrap import has no acting principal; recorded_by is honestly NULL.
  await party('pty_pit_boot', 'legal_person', 'bulk_import', null);
  const [row] = await db.query<{ recorded_by: string | null }>(
    `SELECT recorded_by FROM resident.party WHERE party_id = 'pty_pit_boot'`,
  );
  assert.equal(row?.recorded_by, null, 'a seeded/bootstrap row names no principal — the honest absence');

  // RED: a placeholder principal on a non-human source is refused.
  await assert.rejects(
    () => party('pty_pit_fake', 'legal_person', 'bulk_import', 'stf_seed'),
    /party_actor_only_when_human/,
    'a job in a principal\'s clothes (a fiction) must be structurally impossible',
  );

  // RED: external_reconciliation without a reference is refused (half-claimed provenance).
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO resident.party (party_id, organization_id, kind, display_name, source, recorded_by, recorded_at)
         VALUES ('pty_pit_noref', 'org_wingfu_holdings', 'legal_person', 'X', 'external_reconciliation', NULL, now())`,
      ),
    /party_reconciliation_ref/,
    'a reconciled fact must name its source and reference or it cannot be written',
  );
});

test('resident.interest is documented as AUTHORITATIVE for ownership and tenancy (F1)', async () => {
  // The ruling is recorded where a reader will meet it: the table comment. A
  // ruling that lives only in a report is one nobody applying the schema will see.
  const [row] = await db.query<{ obj_description: string | null }>(
    `SELECT obj_description('resident.interest'::regclass, 'pg_class') AS obj_description`,
  );
  assert.match(row?.obj_description ?? '', /AUTHORITATIVE/i, 'the interest table declares its authority');
  assert.match(row?.obj_description ?? '', /occupancy\.role/i, 'and names the datum it supersedes');
});

test('the cross-module FK sweep stays zero after 0114', async () => {
  // interest.party_id -> party is INTRA-schema and correct. The rule is zero
  // CROSS-schema FKs. unit_id and recorded_by cross module boundaries with no FK.
  const [{ n }] = await db.query<{ n: string }>(
    `SELECT count(*) AS n
       FROM pg_constraint c
       JOIN pg_class ft ON ft.oid = c.conrelid JOIN pg_namespace fn ON fn.oid = ft.relnamespace
       JOIN pg_class tt ON tt.oid = c.confrelid JOIN pg_namespace tn ON tn.oid = tt.relnamespace
      WHERE c.contype = 'f'
        AND fn.nspname IN ('access','property','home_safety','resident','integration','platform','dev_scaffold')
        AND fn.nspname <> tn.nspname`,
  );
  assert.equal(Number(n), 0, 'no cross-schema foreign key exists anywhere');
});
