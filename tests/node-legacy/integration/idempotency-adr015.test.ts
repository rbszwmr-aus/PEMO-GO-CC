/**
 * W1c — request identity (ADR-015), written by the audited-write primitive.
 *
 * THIS FILE'S ORACLE IS INDEPENDENT OF W1b'S. Every act here is a staff act with
 * full authority except where a provisioning act is the point, and nothing here
 * asserts anything about the attribution constraint.
 *
 * WHAT WAS BROKEN, MEASURED AT GEN-023 RATHER THAN READ OFF THE SOURCE. The
 * shipped `once()` checked for a row, ran the act, then inserted ON CONFLICT DO
 * NOTHING — in a DIFFERENT transaction from the act. Two concurrent callers both
 * found nothing, BOTH RAN THE ACT, and one then lost the insert race and returned
 * the winner's answer. `compute ran 2x`. Its own comment claimed "two
 * simultaneous taps still produce one effect".
 *
 * THE PROBE MUST ACTUALLY OVERLAP. GEN-024 learned this the hard way: a
 * `Promise.all` of two fast calls is not a race, because the first transaction
 * commits before the second one reads, and such a test passes with the mechanism
 * DELETED. The transaction is held open inside the callback here, and that line
 * is load-bearing.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  createModuleDb, loadConfig, idempotentAuditedWrite, IdempotencyConflictError,
} from '../../modules/platform/dist/index.js';
import type { AuditRecord, IdempotencyKey, ModuleDb } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let ownerDb: ReturnType<typeof createModuleDb>;
let a: ModuleDb;
let b: ModuleDb;

test.before(async () => {
  harness = await startHarness();
  ownerDb = createModuleDb({ schema: 'platform', database: loadConfig().databaseOwner });
  // Two independent handles = two pools = two real connections.
  a = createModuleDb({ schema: 'home_safety', database: loadConfig().moduleDatabases.home_safety });
  b = createModuleDb({ schema: 'home_safety', database: loadConfig().moduleDatabases.home_safety });
});

test.after(async () => {
  await ownerDb.query(`DELETE FROM idempotency_record WHERE operation LIKE 'w1c.%'`);
  await ownerDb.query(`DELETE FROM access.audit_event WHERE audit_id LIKE 'aud\\_w1c\\_%' ESCAPE '\\'`);
  await ownerDb.query(`DELETE FROM home_safety.management_update WHERE update_id LIKE 'upd\\_w1c\\_%' ESCAPE '\\'`);
  await ownerDb.close();
  await a.close();
  await b.close();
  await harness.close();
});

/**
 * These acts THROW or SUCCEED; none refuses by value. `committed` became
 * required at GEN-028 so no call site can forget to declare which it is.
 */
const ALWAYS_AN_ACT = { committed: () => true } as const;

const staffAudit = (auditId: string, action: string): AuditRecord => ({
  auditId,
  source: 'principal',
  principalId: 'stf_wfg_manager',
  groupId: 'grp_of_one_stf_wfg_manager',
  role: 'estate_staff',
  nodeKind: 'estate',
  nodeId: 'est_wing_fu_garden',
  action,
  targetKind: 'management_update',
  targetId: 'tgt',
  occurredAt: new Date(),
  correlationId: '22222222-2222-2222-2222-222222222222',
});

/**
 * A real act with a visible effect, so "did it run twice" is answerable in the
 * DATA rather than in a counter.
 *
 * THE ROW ID IS PER-ATTEMPT, AND THAT IS LOAD-BEARING IN THE RACE TESTS. An
 * earlier version had both racers insert the SAME update_id, so the loser was
 * rejected by `management_update`'s own primary key — the act was serialising
 * itself, and the test would have passed with the idempotency mechanism removed.
 * Found by mutation, the same way GEN-024's lock-deleted probe was. With distinct
 * row ids, the ONLY thing that can hold "exactly one act" is the mechanism under
 * test, and the assertion counts rows sharing a prefix.
 */
let effects = 0;
const act = (updateId: string) => async (tx: ModuleDb) => {
  effects += 1;
  await tx.query(
    `INSERT INTO management_update (update_id, event_id, published_at, body_en, body_zh_hant, is_all_clear)
     SELECT $1, event_id, now(), 'w1c probe', 'w1c 探測', false FROM safety_event LIMIT 1`,
    [updateId],
  );
  return updateId;
};

/**
 * GEN-027 added `requestFingerprint`: since the act id became DERIVED from
 * (operation, key), it is identical for two different requests sharing a key and
 * can no longer discriminate them. These tests default it to the act id, which
 * keeps every existing case meaning what it meant — including the D5 case, whose
 * two requests still differ.
 */
const key = (
  op: string, k: string, actId: string,
  principalId: string | null = 'stf_wfg_manager',
  fingerprint = actId,
): IdempotencyKey =>
  ({ principalId, operation: op, key: k, actKind: 'management_update', actId,
     requestFingerprint: `rfp_${fingerprint}` });

const recordCount = async (op: string) => {
  const [r] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM idempotency_record WHERE operation = $1`, [op],
  );
  return Number(r?.n ?? 0);
};

// ────────────────────────────────────────────────────────── the ordinary repeat

test('a repeat does NOT run the act, and returns the act identity to re-derive from', async () => {
  effects = 0;
  const k = key('w1c.repeat', 'k1', 'upd_w1c_repeat');
  const first = await idempotentAuditedWrite(a, staffAudit('aud_w1c_r1', 'w1c.repeat'), k, act('upd_w1c_repeat'), ALWAYS_AN_ACT);
  const second = await idempotentAuditedWrite(a, staffAudit('aud_w1c_r2', 'w1c.repeat'), k, act('upd_w1c_repeat'), ALWAYS_AN_ACT);

  assert.equal(first.kind, 'performed');
  assert.equal(second.kind, 'replayed');
  assert.equal(effects, 1, 'the act ran exactly once');
  if (second.kind === 'replayed') {
    assert.equal(second.actKind, 'management_update');
    assert.equal(second.actId, 'upd_w1c_repeat', 'the ACT IDENTITY, which the caller reads to re-derive');
    assert.equal(second.auditId, 'aud_w1c_r1', 'and it points at the ORIGINAL act\'s audit record');
  }

  // NO RESPONSE BLOB (ADR-015 D4). Asserted against the catalog, not the code:
  // the storage shape is what a later PID could quietly reintroduce.
  const [cols] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns
      WHERE table_schema = 'platform' AND table_name = 'idempotency_record'
        AND (column_name = 'outcome' OR data_type = 'jsonb')`,
  );
  assert.equal(cols?.n, '0', 'no response blob is stored; a repeat re-derives');
});

test('the second audit event is NOT written — a replay is not an act', async () => {
  const [r] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM access.audit_event WHERE audit_id = 'aud_w1c_r2'`,
  );
  assert.equal(r?.n, '0', 'a replay records nothing: nothing happened');
});

// ───────────────────────────────────────────────────────────── the real race

/** Hold the transaction open so the two genuinely overlap. */
const HOLD_MS = 150;

const racer = (db: ModuleDb, auditId: string, k: IdempotencyKey, updateId: string) =>
  idempotentAuditedWrite(db, staffAudit(auditId, k.operation), k, async (tx) => {
    const r = await act(updateId)(tx);
    // LOAD-BEARING. Without this the first transaction COMMITS before the second
    // reads, the two never overlap, and this test passes with the unique index
    // and the whole mechanism removed — it would be measuring sequential
    // execution. GEN-024 shipped exactly that mistake in a concurrency probe and
    // caught it only by deleting the mechanism and seeing green.
    await new Promise((done) => setTimeout(done, HOLD_MS));
    return r;
  }, ALWAYS_AN_ACT);

test('CONCURRENT: the act runs ONCE — the shipped mechanism ran it twice', async () => {
  effects = 0;
  const k = key('w1c.race', 'k1', 'upd_w1c_race');
  // DISTINCT row ids: the act must not be able to serialise itself (see `act`).
  const results = await Promise.allSettled([
    racer(a, 'aud_w1c_race_a', k, 'upd_w1c_race_a'),
    racer(b, 'aud_w1c_race_b', k, 'upd_w1c_race_b'),
  ]);

  const performed = results.filter((r) => r.status === 'fulfilled' && r.value.kind === 'performed');
  assert.equal(performed.length, 1, `exactly one act performed, got ${JSON.stringify(results)}`);

  // THE MEASUREMENT THAT MATTERS. GEN-023 recorded `compute ran 2x` for the
  // shipped store. The loser's act is ROLLED BACK with its key, so the effect
  // count in the DATABASE is one even if the callback body executed.
  const [rows] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM home_safety.management_update WHERE update_id LIKE 'upd\\_w1c\\_race%' ESCAPE '\\'`,
  );
  assert.equal(rows?.n, '1', 'one act landed. The shipped mechanism landed two.');
  assert.equal(await recordCount('w1c.race'), 1, 'one key recorded');
});

test('a crash between the act and the key leaves NO act — they are one transaction', async () => {
  /**
   * The shipped mechanism's second window: `compute()` and the INSERT were in
   * different transactions, so a crash between them left the act done and the key
   * unwritten, and a retry ran the act again. Here the key insert is inside the
   * act's transaction, so a failure after the act rolls the act back too.
   */
  effects = 0;
  const k = key('w1c.crash', 'k1', 'upd_w1c_crash');
  await assert.rejects(
    idempotentAuditedWrite(a, staffAudit('aud_w1c_crash', 'w1c.crash'), k, async (tx) => {
      await act('upd_w1c_crash')(tx);
      throw new Error('crash after the act, before the key');
    }, ALWAYS_AN_ACT),
    /crash after the act/,
  );

  const [rows] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM home_safety.management_update WHERE update_id = 'upd_w1c_crash'`,
  );
  assert.equal(rows?.n, '0', 'the act did not survive its own transaction');
  assert.equal(await recordCount('w1c.crash'), 0, 'and no key was left behind to block the retry');

  // AND THE RETRY WORKS — the point of rolling both back is that the caller may
  // try again, not that the operation is poisoned.
  const retried = await idempotentAuditedWrite(
    a, staffAudit('aud_w1c_crash2', 'w1c.crash'), k, act('upd_w1c_crash'), ALWAYS_AN_ACT,
  );
  assert.equal(retried.kind, 'performed');
  assert.equal(effects, 2, 'the act body ran twice; exactly one of them survived');
});

// ─────────────────────────────────────────────────────── D5 and the NULL trap

test('the same key offered for a DIFFERENT act is refused (D5)', async () => {
  const k1 = key('w1c.d5', 'shared', 'upd_w1c_d5_a');
  await idempotentAuditedWrite(a, staffAudit('aud_w1c_d5', 'w1c.d5'), k1, act('upd_w1c_d5_a'), ALWAYS_AN_ACT);

  const k2 = key('w1c.d5', 'shared', 'upd_w1c_d5_b');
  await assert.rejects(
    idempotentAuditedWrite(a, staffAudit('aud_w1c_d5b', 'w1c.d5'), k2, act('upd_w1c_d5_b'), ALWAYS_AN_ACT),
    IdempotencyConflictError,
    'never silently answered with the first act\'s result — that would report something that did not happen',
  );
});

test('THE NULL TRAP — two PROVISIONING acts sharing a key: the second is refused', async () => {
  /**
   * A provisioning act has no principal (ADR-010 A1), so principal_id is NULL in
   * the uniqueness tuple — and Postgres treats NULLs as DISTINCT by default. A
   * plain unique index would accept BOTH, and idempotency would silently fail for
   * exactly the acts that create authority. NULLS NOT DISTINCT is what closes it.
   */
  const provAudit = (id: string): AuditRecord => ({
    ...staffAudit(id, 'w1c.provision'),
    source: 'provisioning', principalId: null, groupId: null, role: null,
  });
  const k = key('w1c.provision', 'boot', 'upd_w1c_prov', null);

  const first = await idempotentAuditedWrite(a, provAudit('aud_w1c_prov1'), k, act('upd_w1c_prov'), ALWAYS_AN_ACT);
  assert.equal(first.kind, 'performed');

  const second = await idempotentAuditedWrite(a, provAudit('aud_w1c_prov2'), k, act('upd_w1c_prov'), ALWAYS_AN_ACT);
  assert.equal(second.kind, 'replayed', 'the NULL principal MATCHED — it did not slip past as distinct');
  assert.equal(await recordCount('w1c.provision'), 1, 'one key, not two');
});

test('THE NULL TRAP, CONCURRENTLY — two provisioning acts racing one key: one wins', async () => {
  /**
   * THE CASE THAT ACTUALLY DEPENDS ON THE INDEX, and it was added because a
   * mutation showed the sequential test above did NOT.
   *
   * With the index rebuilt WITHOUT `NULLS NOT DISTINCT`, the sequential
   * provisioning test still passed: the pre-check's `IS NOT DISTINCT FROM`
   * matched the earlier row and returned a replay before the index was ever
   * consulted. So that test cannot tell a correct index from a broken one.
   *
   * Concurrently the pre-check cannot help — both transactions read before
   * either commits — and the index is the only thing left. Under default
   * NULL-distinct semantics BOTH provisioning acts land, which is idempotency
   * silently not holding for exactly the acts that create authority.
   */
  const provAudit = (id: string): AuditRecord => ({
    ...staffAudit(id, 'w1c.provrace'),
    source: 'provisioning', principalId: null, groupId: null, role: null,
  });
  const k = key('w1c.provrace', 'boot', 'upd_w1c_provrace', null);

  const race = (db: ModuleDb, id: string, rowId: string) =>
    idempotentAuditedWrite(db, provAudit(id), k, async (tx) => {
      const r = await act(rowId)(tx);
      await new Promise((done) => setTimeout(done, HOLD_MS)); // load-bearing, as above
      return r;
    }, ALWAYS_AN_ACT);

  // DISTINCT row ids, so only the INDEX can hold this — see `act`.
  const results = await Promise.allSettled([
    race(a, 'aud_w1c_provrace_a', 'upd_w1c_provrace_a'),
    race(b, 'aud_w1c_provrace_b', 'upd_w1c_provrace_b'),
  ]);
  const performed = results.filter((r) => r.status === 'fulfilled' && r.value.kind === 'performed');
  assert.equal(performed.length, 1, `exactly one provisioning act performed, got ${JSON.stringify(results)}`);
  assert.equal(await recordCount('w1c.provrace'), 1, 'one key for two NULL principals — not two');

  const [rows] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM home_safety.management_update WHERE update_id LIKE 'upd\\_w1c\\_provrace%' ESCAPE '\\'`,
  );
  assert.equal(rows?.n, '1', 'and one act landed');
});

test('RED — the index really is NULLS NOT DISTINCT, and a default one would not be', async () => {
  /**
   * PROVEN BY MAKING IT FAIL. The replay above could also be explained by the
   * pre-check `IS NOT DISTINCT FROM` alone, which would leave the INDEX still
   * wrong and the race still open. This tests the index directly.
   */
  const [idx] = await ownerDb.query<{ def: string }>(
    `SELECT indexdef AS def FROM pg_indexes
      WHERE schemaname = 'platform' AND indexname = 'idempotency_record_key'`,
  );
  assert.match(idx?.def ?? '', /NULLS NOT DISTINCT/);

  // And the behaviour, not just the declaration: a raw duplicate insert with a
  // NULL principal must be rejected by the INDEX.
  await assert.rejects(
    ownerDb.query(
      `INSERT INTO idempotency_record
         (principal_id, operation, idempotency_key, act_kind, act_id, audit_id, request_fingerprint)
       VALUES (NULL, 'w1c.provision', 'boot', 'management_update', 'upd_w1c_prov', 'aud_w1c_prov1',
               'rfp_upd_w1c_prov')`,
    ),
    /idempotency_record_key/,
    'under default NULL-distinct semantics this insert would SUCCEED',
  );
});

test('keys are retained: the runtime cannot delete one (D6)', async () => {
  const [row] = await ownerDb.query<{ can_delete: boolean }>(
    `SELECT has_table_privilege('pemo_app', 'platform.idempotency_record', 'DELETE') AS can_delete`,
  );
  assert.equal(row?.can_delete, false, 'pruning is an owner maintenance act, never a runtime delete');
});

test('the broken mechanism is GONE, not merely unused', async () => {
  // A wired-but-broken mechanism is a landmine: the first caller to reach for it
  // inherits both defects believing they were solved.
  const [old] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns
      WHERE table_schema = 'platform' AND table_name = 'idempotency_record' AND column_name = 'scope'`,
  );
  assert.equal(old?.n, '0', "0004's (scope, key) shape is gone");
});
