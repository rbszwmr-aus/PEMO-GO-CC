/**
 * The occupancy END write, and the (resident, unit) live-cardinality guard.
 *
 * An end is an APPENDED ASSERTION, never a mutation: version + 1 with
 * effective_to set, the prior assertion retained. This is the write GEN-013
 * deferred once it found that 0022 could not express it.
 *
 * THE GUARD IS PROVEN BY RACING REAL CONNECTIONS. Two independent module handles
 * are two pools and two connections, so `Promise.all` over them is a genuine
 * race — not a simulation. Without the per-key advisory lock both writers insert;
 * with it, one wins. Both directions are asserted, and the create path is
 * included because this is its retro-fix.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const BASE = '/api/management-web/v0';
const MANAGER = 'stf_wfg_manager';
const COUNTER = 'stf_wfg_counter';
const UNIT = 'unit_wfg_a_12_a1';
const OUT_OF_SCOPE_UNIT = 'unit_twc_1_05_a';
const RESIDENT = 'res_wfg_000001';

let harness: Harness;

const staffAuth = (p: string) => ({ authorization: `Bearer ${harness.modules.staffAuth.issue(p)}` });

const create = (principal: string, unitId = UNIT, residentId = RESIDENT) =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/units/${unitId}/occupancies`,
    headers: staffAuth(principal), payload: { residentId, role: 'tenant' },
  });

const end = (principal: string, occupancyId: string, payload: Record<string, unknown> = {}) =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/occupancies/${occupancyId}/end`,
    headers: staffAuth(principal), payload,
  });

const assertions = async (instance: string) =>
  harness.admin.query<{ version: number; status: string; effective_to: Date | null }>(
    `SELECT version, status, effective_to FROM resident.occupancy WHERE occupancy_id = $1 ORDER BY version`,
    [instance]);

const auditActions = async () =>
  (await harness.admin.query<{ action: string; target_id: string }>(
    `SELECT action, target_id FROM access.audit_event
      WHERE action IN ('record_occupancy','end_occupancy') ORDER BY recorded_at`));

const clearWrites = async (): Promise<void> => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE action IN ('record_occupancy','end_occupancy')`);
  await harness.admin.query(`DELETE FROM resident.occupancy WHERE source IN ('management_web','g16-race')`);
};

const newInstance = async (): Promise<string> => {
  const r = await create(MANAGER);
  assert.equal(r.statusCode, 201, r.body);
  return (JSON.parse(r.body) as { occupancy: { occupancyId: string } }).occupancy.occupancyId;
};

test.before(async () => { harness = await startHarness(); await clearWrites(); });
test.after(async () => { await clearWrites(); await harness.close(); });
test.beforeEach(clearWrites);

// ───────────────────────────────────────────────────────────── the END write
test('THE END — appends version 2 with effective_to, and the resolver answers ENDED', async () => {
  const instance = await newInstance();
  assert.equal((await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT)).kind, 'authorized');

  const response = await end(MANAGER, instance);
  assert.equal(response.statusCode, 200, response.body);
  const payload = JSON.parse(response.body) as { occupancy: { version: number } };
  assert.equal(payload.occupancy.version, 2);

  const rows = await assertions(instance);
  assert.equal(rows.length, 2, 'the end did not APPEND — the chain should hold both assertions');
  assert.equal(rows[0]?.version, 1);
  assert.equal(rows[0]?.effective_to, null, 'the PRIOR assertion was mutated');
  assert.equal(rows[1]?.status, 'ended');
  assert.ok(rows[1]?.effective_to, 'the end assertion carries no effective_to');

  assert.notEqual((await harness.modules.authorization.authorizeUnit(RESIDENT, UNIT)).kind, 'authorized');
});

test('the END is audited, against the INSTANCE, with the narrowest grant', async () => {
  const instance = await newInstance();
  await end(MANAGER, instance);
  const audits = await auditActions();
  const ended = audits.filter((a) => a.action === 'end_occupancy');
  assert.equal(ended.length, 1, 'the end was written without its audit');
  assert.equal(ended[0]?.target_id, instance, 'the audit targets an assertion, not the instance');
});

test('THE GATE, RED — grant end-dated as the only change → the end is refused, absent', async () => {
  const instance = await newInstance();
  await harness.admin.query(
    `UPDATE access.scope_grant SET effective_to = now() - interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  try {
    const response = await end(MANAGER, instance);
    assert.equal(response.statusCode, 404, 'the grant was removed and the end still resolved');
    assert.equal((await assertions(instance)).length, 1, 'an assertion was appended out of scope');
  } finally {
    await harness.admin.query(
      `UPDATE access.scope_grant SET effective_to = NULL WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  }
});

test('THE GATE, RED — a principal whose grants reach no unit cannot end', async () => {
  const instance = await newInstance();
  const response = await end(COUNTER, instance);
  assert.equal(response.statusCode, 404, response.body);
  assert.equal((await assertions(instance)).length, 1);
});

// ───────────────────────────────────────────── precondition: only a LIVE one
test('PRECONDITION — ending a non-live occupancy is 409 and appends NOTHING', async () => {
  const instance = await newInstance();
  assert.equal((await end(MANAGER, instance)).statusCode, 200);
  assert.equal((await assertions(instance)).length, 2);

  const again = await end(MANAGER, instance);
  assert.equal(again.statusCode, 409, again.body);
  assert.match(JSON.parse(again.body).type, /occupancy-not-live/);
  assert.equal((await assertions(instance)).length, 2,
    'a failed precondition appended a no-op row into the version chain');
});

test('PRECONDITION — a repeated end is NOT idempotent, and the contract says so', async () => {
  // Retry-idempotency is the request-token half of D6 and is not built. A repeat
  // answers 409, never the original 200 — asserted so that building the token
  // later is a deliberate change and not a silent one.
  const instance = await newInstance();
  await end(MANAGER, instance);
  const repeat = await end(MANAGER, instance);
  assert.notEqual(repeat.statusCode, 200, 'a repeated end returned the winning response');
  assert.equal(repeat.statusCode, 409);
});

// ─────────────────────────────────── the guard, raced over BOTH write paths
/** Two independent handles = two pools = two real connections. */
const racePair = async <T>(act: (db: ReturnType<typeof createModuleDb>) => Promise<T>): Promise<T[]> => {
  const config = loadConfig();
  const a = createModuleDb({ schema: 'resident', database: config.moduleDatabases.resident });
  const b = createModuleDb({ schema: 'resident', database: config.moduleDatabases.resident });
  try {
    return await Promise.all([act(a), act(b)]);
  } finally { await a.close(); await b.close(); }
};

const raceCreate = (tag: string) => async (db: ReturnType<typeof createModuleDb>) =>
  db.transaction(async (tx) => {
    const r = await harness.modules.occupancies.record(
      tx,
      {
        occupancyId: `occ_g16_${tag}`, residentId: RESIDENT, householdId: null, unitId: UNIT,
        unitClass: 'residential', role: 'tenant', source: 'management_web',
        effectiveFrom: new Date(),
      },
      [UNIT],
    );
    await new Promise((r2) => setTimeout(r2, 150));   // widen the window
    return r.kind;
  });

test('THE GUARD — two concurrent CREATES for one (resident, unit): one wins', async () => {
  const kinds = await racePair(raceCreate('x'));
  const recorded = kinds.filter((k) => k === 'recorded');
  assert.equal(recorded.length, 1, `both creates landed: ${kinds.join(', ')}`);
  assert.ok(kinds.includes('conflict'), `the loser was not a conflict: ${kinds.join(', ')}`);

  const live = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.occupancy
      WHERE resident_id = $1 AND unit_id = $2 AND source = 'management_web' AND effective_to IS NULL`,
    [RESIDENT, UNIT]);
  assert.equal(Number(live[0]?.n), 1, 'more than one live occupancy for one (resident, unit)');
});

test('THE GUARD — two concurrent ENDS of one instance: one wins, the other is refused', async () => {
  const instance = await newInstance();
  const kinds = await racePair(async (db) =>
    db.transaction(async (tx) => {
      const r = await harness.modules.occupancies.end(
        tx, { occupancyId: instance, assertionId: `occa_g16_${Math.random()}`, effectiveTo: new Date() }, [UNIT]);
      await new Promise((r2) => setTimeout(r2, 150));
      return r.kind;
    }));
  assert.equal(kinds.filter((k) => k === 'ended').length, 1, `both ends landed: ${kinds.join(', ')}`);
  const rows = await assertions(instance);
  assert.equal(rows.length, 2, `the instance holds ${rows.length} assertions, expected 2`);
  assert.equal(rows[1]?.version, 2, 'the version chain is not contiguous');
});

test('READ COMMITTED is asserted, and the assertion is load-bearing', async () => {
  // The guard serialises only because each statement takes a fresh snapshot.
  // Under a snapshot-stable level the blocked writer would not see the winner and
  // would append anyway — so the code refuses rather than guarding nothing.
  const config = loadConfig();
  const db = createModuleDb({ schema: 'resident', database: config.database });
  try {
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        return harness.modules.occupancies.record(
          tx,
          {
            occupancyId: 'occ_g16_iso', residentId: RESIDENT, householdId: null, unitId: UNIT,
            unitClass: 'residential', role: 'tenant', source: 'management_web', effectiveFrom: new Date(),
          },
          [UNIT],
        );
      }),
      /requires READ COMMITTED/,
      'the guard ran under an isolation level it cannot serialise on');
  } finally { await db.close(); }
});
