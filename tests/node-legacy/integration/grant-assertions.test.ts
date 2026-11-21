/**
 * THE AUTHORITY TABLE UNDER ADR-013 — revocation, re-grant, and the
 * (group, role, node) live-cardinality guard.
 *
 * WHAT THIS EXISTS TO PROVE. Before 0118, revoking a grant was not expressible by
 * the runtime at all: shortening `effective_to` is an UPDATE that `pemo_app`
 * cannot issue, and appending a closing row was refused by
 * `scope_grant_no_overlapping_periods`, because the original grant's ASSERTED
 * period still ran to infinity. Both halves were measured at GEN-023, not
 * assumed. This file is the evidence that the capability now exists.
 *
 * THE GUARD IS PROVEN BY RACING REAL CONNECTIONS, as GEN-016 established: two
 * independent module handles are two pools and two connections, so `Promise.all`
 * over them is a genuine race rather than a simulation.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { createGrantCommands, createHistoricalScopeQueries } from '../../modules/access/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { administratorScopeAt } from '../../apps/api/dist/testing/administrator-scope.js';

const GROUP = 'grp_of_one_stf_wfg_manager';
/**
 * THE G-2 ADMINISTRATOR SCOPE. GEN-027 made the gate an in-query filter, so these
 * module-level tests must supply what the composition layer would compute. They
 * pass the node under test, because their subject is the ASSERTION MODEL, not the
 * gate — G-2 has its own proofs in grant-surface.test.ts, including that it
 * refuses.
 *
 * Since ADR-018 the parameter is a `GrantAdministratorScope`, not a node array,
 * so these build one through its ONE constructor rather than casting: a test
 * helper that forged the brand would type-check everything and prove nothing.
 */
const allow = (nodeId: string) => administratorScopeAt(`estate:${nodeId}`);
/** Every node these tests create, so a revoke by instance id resolves. */
const ALL_TEST_NODES = ['revoke', 'conflict', 'race', 'd5', 'twice']
  .map((s) => `estate:est_w1a_${s}`);
/** A revoke names an INSTANCE, so its scope must cover wherever that instance sits. */
const allowAll = () => administratorScopeAt(...ALL_TEST_NODES);
const PRINCIPAL = 'stf_wfg_manager';
const NODE = { kind: 'estate', id: 'est_wing_fu_garden' } as const;

let harness: Harness;
let ownerDb: ReturnType<typeof createModuleDb>;
let appDb: ReturnType<typeof createModuleDb>;
let second: ReturnType<typeof createModuleDb>;

test.before(async () => {
  harness = await startHarness();
  ownerDb = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  appDb = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  second = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
});

test.after(async () => {
  // PREFIX-SCOPED, and the prefix is this file's own. A teardown that cleared
  // `scope_grant` wholesale would delete the seeded world every other suite reads
  // — the GEN-014 defect, which deleted the seeded estate contacts.
  await ownerDb.query(`DELETE FROM scope_grant WHERE grant_id LIKE 'gr\\_w1a\\_%' ESCAPE '\\'`);
  await ownerDb.close();
  await appDb.close();
  await second.close();
  await harness.close();
});

const commands = () => createGrantCommands(appDb);

/** A fresh (group, role, node) key per test, so tests cannot contend with each other. */
const freshNode = (suffix: string) => ({ kind: 'estate' as const, id: `est_w1a_${suffix}` });

// ─────────────────────────────────────────────────────── the capability itself

test('PRECONDITION — the runtime cannot UPDATE scope_grant, so an end must be an append', async () => {
  // The reason the assertion model was needed at all, asserted rather than
  // recited. If this ever becomes true, the whole design rests on a premise that
  // has silently moved.
  const [row] = await appDb.query<{ can_update: boolean }>(
    `SELECT has_table_privilege(current_user, 'access.scope_grant', 'UPDATE') AS can_update`,
  );
  assert.equal(row?.can_update, false, 'pemo_app must not hold UPDATE on the authority table');
});

test('REVOCATION works: a grant is ended by appending version + 1, and the reader answers not-live', async () => {
  const node = freshNode('revoke');
  const grantId = 'gr_w1a_revoke';
  const history = createHistoricalScopeQueries(appDb);

  const conferred = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId, groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id,
      effectiveFrom: new Date('2024-01-01T00:00:00+08:00'),
    }, await allow(node.id)),
  );
  assert.equal(conferred.kind, 'conferred');

  const whileLive = await history.resolveAsAt(PRINCIPAL, new Date());
  assert.ok(whileLive?.grants.some((g) => g.grantId === grantId), 'live before the revocation');

  const revoked = await appDb.transaction(async (tx) =>
    commands().revoke(tx, { grantId, effectiveTo: new Date(Date.now() - 1000) }, await allowAll()),
  );
  assert.equal(revoked.kind, 'revoked');
  assert.equal(revoked.kind === 'revoked' ? revoked.version : 0, 2, 'the revocation is version 2');

  // NOTHING WAS UPDATED. The prior assertion is still there, exactly as written.
  const [chain] = await appDb.query<{ versions: string; open: string }>(
    `SELECT string_agg(version::text, ',' ORDER BY version) AS versions,
            count(*) FILTER (WHERE effective_to IS NULL)::text AS open
       FROM scope_grant WHERE grant_id = $1`,
    [grantId],
  );
  assert.equal(chain?.versions, '1,2', 'both assertions are retained — the history IS the table');
  assert.equal(chain?.open, '1', 'version 1 still asserts an open period, untouched');

  // THE CAPABILITY: the resolver answers not-live.
  const now = await history.resolveAsAt(PRINCIPAL, new Date());
  assert.equal(now?.grants.some((g) => g.grantId === grantId), false, 'revoked: not live now');

  // AND THE HISTORICAL QUESTION STILL ANSWERS. This is what a revocation must not
  // destroy: "what was in force then" is answerable after the fact.
  const then = await history.resolveAsAt(PRINCIPAL, new Date('2025-01-01T00:00:00+08:00'));
  assert.ok(then?.grants.some((g) => g.grantId === grantId), 'it was in force then');
});

test('RED — without the latest-assertion resolution, a revoked grant reads as live', async () => {
  /**
   * PROVEN BY MAKING IT FAIL. The revocation above is only real if the reader
   * resolves MAX(version) FIRST and evaluates dating SECOND. This runs the
   * pre-0118 shape — the raw table with the as-at predicate applied directly —
   * against the same rows, and it returns the superseded assertion as live.
   *
   * That is the exact bug ADR-013 D4 exists to prevent, and on this table it
   * would restore withdrawn authority.
   */
  const naive = await appDb.query<{ grant_id: string }>(
    `SELECT g.grant_id
       FROM scope_grant g
       JOIN group_membership m ON m.group_id = g.group_id
      WHERE m.principal_id = $1
        AND g.grant_id = 'gr_w1a_revoke'
        AND (g.effective_from <= now() AND (g.effective_to IS NULL OR g.effective_to > now()))`,
    [PRINCIPAL],
  );
  assert.ok(naive.length > 0, 'the naive read DOES return the revoked grant — which is why it is not used');

  const resolved = await createHistoricalScopeQueries(appDb).resolveAsAt(PRINCIPAL, new Date());
  assert.equal(
    resolved?.grants.some((g) => g.grantId === 'gr_w1a_revoke'), false,
    'the resolver does not — and the two disagreeing is the whole point',
  );
});

test('RE-GRANT AFTER END works — a new instance for the same (group, role, node)', async () => {
  /**
   * THE CASE THAT KILLED EVERY OTHER SHAPE. Under the exclusion constraint the
   * revoked instance's version 1 still ASSERTED [t0, infinity), so a new grant at
   * [t2, infinity) overlapped it and was refused — which is why an append-only
   * end-record could not work, and why adding `version` to the key could not
   * either (a re-grant's first assertion is also version 1).
   */
  const node = freshNode('revoke'); // deliberately the SAME key as the revoked grant
  const regrantId = 'gr_w1a_regrant';

  const again = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: regrantId, groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id,
      effectiveFrom: new Date(),
    }, await allow(node.id)),
  );
  assert.equal(again.kind, 'conferred', 're-granting the same key after a revocation is accepted');
  assert.equal(again.kind === 'conferred' ? again.version : 0, 1, 'a NEW instance, at version 1');

  const now = await createHistoricalScopeQueries(appDb).resolveAsAt(PRINCIPAL, new Date());
  assert.ok(now?.grants.some((g) => g.grantId === regrantId), 'the re-grant is live');
  assert.equal(now?.grants.some((g) => g.grantId === 'gr_w1a_revoke'), false, 'the revoked one is not');
});

// ───────────────────────────────────────────────────────────── the guard

test('the guard refuses a second LIVE grant for one (group, role, node)', async () => {
  const node = freshNode('conflict');
  const first = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: 'gr_w1a_conflict_a', groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date(),
    }, await allow(node.id)),
  );
  assert.equal(first.kind, 'conferred');

  const second_ = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: 'gr_w1a_conflict_b', groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date(),
    }, await allow(node.id)),
  );
  assert.equal(second_.kind, 'conflict', 'refused — and NOT by a constraint, which no longer exists');

  const [n] = await appDb.query<{ count: string }>(
    `SELECT count(*)::text FROM scope_grant WHERE grant_id = 'gr_w1a_conflict_b'`,
  );
  assert.equal(n?.count, '0', 'the refused act wrote nothing');
});

test('CONCURRENT creates for one key: exactly one wins', async () => {
  /**
   * A GENUINE RACE — two pools, two connections. Without the advisory lock both
   * transactions read "no live grant" and both insert, because nothing else
   * serialises them: 0118 dropped the constraint that used to catch this, so the
   * lock is the only thing standing here.
   */
  const node = freshNode('race');
  const attempt = (db: ReturnType<typeof createModuleDb>, id: string) =>
    db.transaction(async (tx) => {
      const r = await createGrantCommands(db).confer(tx, {
        grantId: id, groupId: GROUP, role: 'estate_staff',
        nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date(),
      }, await allow(node.id));
      // WIDEN THE WINDOW, and this line is load-bearing — GEN-016 established it
      // and GEN-024 re-learned it the hard way. Without it the first transaction
      // COMMITS before the second one reads, so the two never overlap and the
      // test passes with the advisory lock deleted: it measures sequential
      // execution, not the guard. Holding the transaction open forces the real
      // interleaving the guard exists to survive.
      await new Promise((done) => setTimeout(done, 150));
      return r;
    });

  const results = await Promise.all([
    attempt(appDb, 'gr_w1a_race_a'),
    attempt(second, 'gr_w1a_race_b'),
  ]);
  const conferred = results.filter((r) => r.kind === 'conferred');
  const refused = results.filter((r) => r.kind === 'conflict');
  assert.equal(conferred.length, 1, `exactly one create wins, got ${JSON.stringify(results)}`);
  assert.equal(refused.length, 1, 'the loser is refused, not crashed');

  const [n] = await appDb.query<{ count: string }>(
    `SELECT count(*)::text FROM scope_grant WHERE node_id = $1`, [node.id],
  );
  assert.equal(n?.count, '1', 'one row landed, not two');
});

test('MULTIPLICITY BY DESIGN survives the guard: two groups, same role, same node', async () => {
  /**
   * ADR-012 D5. The guard's key is (group, role, node) and never mentions a
   * principal, so this must remain accepted. A guard that over-reached into
   * (principal, node) would forbid the design and would red on the shipped seed.
   */
  const node = freshNode('d5');
  const other = 'grp_of_one_stf_wfg_block_a';

  const a = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: 'gr_w1a_d5_a', groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date(),
    }, await allow(node.id)),
  );
  const b = await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: 'gr_w1a_d5_b', groupId: other, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date(),
    }, await allow(node.id)),
  );
  assert.equal(a.kind, 'conferred');
  assert.equal(b.kind, 'conferred', 'a DIFFERENT group at the same node is legal and must stay legal');
});

test('revoking a grant twice is refused, and appends nothing the second time', async () => {
  const node = freshNode('twice');
  await appDb.transaction(async (tx) =>
    commands().confer(tx, {
      grantId: 'gr_w1a_twice', groupId: GROUP, role: 'estate_staff',
      nodeKind: node.kind, nodeId: node.id, effectiveFrom: new Date('2024-01-01T00:00:00+08:00'),
    }, await allow(node.id)),
  );
  const once = await appDb.transaction(async (tx) =>
    commands().revoke(tx, { grantId: 'gr_w1a_twice', effectiveTo: new Date(Date.now() - 1000) }, await allowAll()),
  );
  assert.equal(once.kind, 'revoked');

  const twice = await appDb.transaction(async (tx) =>
    commands().revoke(tx, { grantId: 'gr_w1a_twice', effectiveTo: new Date(Date.now() - 500) }, await allowAll()),
  );
  assert.equal(twice.kind, 'not-live', 'an already-revoked grant cannot be revoked again');

  const [n] = await appDb.query<{ count: string }>(
    `SELECT count(*)::text FROM scope_grant WHERE grant_id = 'gr_w1a_twice'`,
  );
  assert.equal(n?.count, '2', 'a failed precondition leaves no no-op row in the version chain');
});

test('revoking an unknown instance is refused by name', async () => {
  const missing = await appDb.transaction(async (tx) =>
    commands().revoke(tx, { grantId: 'gr_w1a_does_not_exist', effectiveTo: new Date() }, await allowAll()),
  );
  assert.equal(missing.kind, 'no-such-grant');
});
