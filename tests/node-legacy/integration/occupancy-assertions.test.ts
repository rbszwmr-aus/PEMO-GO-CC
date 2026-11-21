/**
 * Occupancy as an append-only assertion series (ADR-013), and the GEN-013 red
 * turned green FOR THE RIGHT REASON.
 *
 * GEN-013 proved that appending an "ended" row beside a live one ended nothing:
 * `isActiveAt` evaluated every row independently and `authorizeUnit` admitted any
 * that looked active, so the resident stayed authorized. That was not a bug in
 * the guard — it was the absence of an instance/version model to resolve.
 *
 * These tests write assertions DIRECTLY, as the owner, because Slice A builds no
 * end-write endpoint. What is under test is the READ side: that a superseded
 * assertion is never read as current.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { latestAssertionSql } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

/** Seeded: res_wfg_000908 holds a live household_member occupancy of this unit. */
const RESIDENT = 'res_wfg_000908';
const UNIT = 'unit_wfg_a_12_a1';
const INSTANCE = 'occ_908_a12a1';

/**
 * DERIVED, NEVER CONSTRUCTED.
 *
 * An earlier version built this as `'occa_' + INSTANCE`, which is what 0117's
 * BACKFILL produces — and it is wrong on a clean install. `bootstrap.sh` runs
 * `migrate` BEFORE `seed`, so on a fresh database the table is empty when 0117
 * runs, the backfill touches nothing, and the seed then inserts through the
 * column DEFAULT: a random `occa_<uuid>`. The constructed id only existed on a
 * database that had been seeded before the migration was applied.
 *
 * Two worlds, one of them mine — the same class as depending on a database
 * somebody had seeded out of band. It was caught by running the push gate from a
 * clean database, and not before.
 */
let firstAssertionId: string;

let harness: Harness;

const clearAppended = async (): Promise<void> => {
  await harness.admin.query(`DELETE FROM resident.occupancy WHERE assertion_id LIKE 'occa\\_gen015\\_%' ESCAPE '\\'`);
};

/** A further assertion about an EXISTING instance — what an end/correct act does. */
const appendAssertion = async (
  suffix: string, version: number, status: string, effectiveTo: string | null,
): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO resident.occupancy
       (assertion_id, version, occupancy_id, resident_id, household_id, unit_id, unit_class,
        role, status, source, effective_from, effective_to)
     SELECT $1, $2, occupancy_id, resident_id, household_id, unit_id, unit_class,
            role, $3, 'gen015-test', effective_from, $4::timestamptz
       FROM resident.occupancy WHERE assertion_id = $5`,
    [`occa_gen015_${suffix}`, version, status, effectiveTo, firstAssertionId]);
};

test.before(async () => {
  harness = await startHarness();
  await clearAppended();
  const [row] = await harness.admin.query<{ assertion_id: string }>(
    `SELECT assertion_id FROM resident.occupancy WHERE occupancy_id = $1 AND version = 1`,
    [INSTANCE]);
  assert.ok(row, `the premise is gone: no first assertion for ${INSTANCE}`);
  firstAssertionId = row.assertion_id;
});
test.after(async () => { await clearAppended(); await harness.close(); });
test.beforeEach(clearAppended);

// ───────────────────────────────────────────── the GEN-013 red, now green
test('THE GEN-013 RED — an appended ENDED assertion actually ends the occupancy', async () => {
  const before = await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT);
  assert.equal(before.kind, 'authorized', 'the premise is gone: the seeded occupancy is not live');

  // version 2 supersedes version 1: same instance, ended, valid interval closed.
  await appendAssertion('ended', 2, 'ended', new Date(Date.now() - 60_000).toISOString());

  const after = await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT);
  assert.notEqual(after.kind, 'authorized',
    'THE GEN-013 DEFECT: an appended ended assertion left the occupancy authorized');
  assert.equal(after.kind, 'expired', `expected expired, got ${after.kind}`);
});

test('AND FOR THE RIGHT REASON — supersession, not row-independent evaluation', async () => {
  // The distinguishing case. Version 2 is ended; version 3 RE-OPENS the instance
  // with an open interval. Under row-independent evaluation the ended row would
  // still be visible and could still refuse. Under supersession only version 3
  // exists as current, so the answer is authorized again.
  await appendAssertion('ended', 2, 'ended', new Date(Date.now() - 60_000).toISOString());
  assert.notEqual((await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT)).kind, 'authorized');

  await appendAssertion('reopened', 3, 'active', null);
  const after = await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT);
  assert.equal(after.kind, 'authorized',
    'a superseded ENDED assertion is still being read — the resolver is not taking MAX(version)');
});

test('a superseded assertion is NEVER returned to a reader', async () => {
  await appendAssertion('ended', 2, 'ended', new Date(Date.now() - 60_000).toISOString());
  const all = await harness.modules.authorization.listAllRelationships(RESIDENT);
  const forInstance = all.filter((r) => r.occupancyId === INSTANCE);
  assert.equal(forInstance.length, 1, `the reader returned ${forInstance.length} rows for one instance`);
  assert.equal(forInstance[0]?.status, 'ended', 'the reader returned the SUPERSEDED assertion');

  // And the instance count is unchanged: appending never multiplies instances.
  const instances = new Set(all.map((r) => r.occupancyId));
  assert.equal(instances.size, all.length, 'a reader returned two rows for one instance');
});

test('LIVENESS IS COMPUTED, NOT READ FROM status', async () => {
  // status='active' with a closed interval must be EXPIRED. This is the shipped
  // expired-caregiver fixture's shape, asserted directly: the dating decides.
  await appendAssertion('lapsed', 2, 'active', new Date(Date.now() - 60_000).toISOString());
  const after = await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT);
  assert.notEqual(after.kind, 'authorized', 'a closed interval was overridden by status=active');

  // ...and the converse: status='ended' with an OPEN interval is live, because
  // status is data about how a tenure concluded, not a liveness source.
  await clearAppended();
  await appendAssertion('open-but-ended', 2, 'ended', null);
  const open = await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT);
  assert.equal(open.kind, 'authorized', 'status was consulted for liveness');
});

// ─────────────────────────────────────────────── the shared resolver itself
test('the resolver is REUSABLE — nothing about it is occupancy-shaped', async () => {
  const sql = latestAssertionSql({
    table: 'safety_event', instanceKey: 'event_id', columns: ['event_id', 'severity'],
  });
  assert.match(sql, /DISTINCT ON \(event_id\)/);
  assert.match(sql, /ORDER BY event_id, version DESC/);
  assert.match(sql, /FROM safety_event/);
  // `version` is projected even when the caller forgets it — the ordering column
  // must survive the projection or DISTINCT ON has nothing to resolve on.
  assert.match(sql, /event_id, severity, version/);
});

test('the resolver REFUSES a qualified name — a module may not reach another schema', async () => {
  for (const bad of ['access.audit_event', 'occupancy; DROP TABLE x', 'Occupancy']) {
    assert.throws(
      () => latestAssertionSql({ table: bad, instanceKey: 'id', columns: ['id'] }),
      /not a plain unqualified identifier/, bad);
  }
  assert.throws(
    () => latestAssertionSql({ table: 'occupancy', instanceKey: 'a.b', columns: ['id'] }),
    /not a plain unqualified identifier/);
});

test('as-of: an assertion recorded LATER is invisible to a query asked earlier', async () => {
  const before = new Date();
  await appendAssertion('ended', 2, 'ended', new Date(Date.now() - 60_000).toISOString());
  // Run on the RESIDENT module's own handle, not the admin one: the resolver
  // emits unqualified SQL by design, so it only resolves under the module's own
  // search_path. That is the boundary working — platform builds the shape, the
  // module owning the table supplies the reach.
  const rows = await harness.modules.residentDb.query<{ version: number; status: string }>(
    `WITH current_assertion AS (
       ${latestAssertionSql({
         table: 'occupancy', instanceKey: 'occupancy_id',
         columns: ['occupancy_id', 'status'], filter: 'occupancy_id = $1', asOfParam: '$2',
       })}
     ) SELECT * FROM current_assertion`,
    [INSTANCE, before]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.version, 1, 'an assertion recorded after the as-of instant was visible');
  assert.equal(rows[0]?.status, 'active');
});
