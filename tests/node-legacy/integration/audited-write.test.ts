/**
 * The audited write — the three reds GEN-011 exists to turn green.
 *
 * GEN-009 found that the act and its audit landed in DIFFERENT transactions,
 * because every module owns a pool with its own `search_path`. Injecting a
 * failure after both writes left 0 act rows and 1 audit row: an audit asserting
 * an authorised act that never happened. ADR-010 D1 warns about a MISSING
 * record; that is a FALSE one.
 *
 * THE TABLE. `access.audit_event` is migration 0116 and belongs to GEN-009,
 * which is held, so on a clean checkout it does not exist and this file creates
 * one of the same shape to prove the primitive against.
 *
 * IT USES THE REAL TABLE WHENEVER THERE IS ONE, and creates the stand-in only
 * when there is not. An earlier version created unconditionally, and that was a
 * real defect found by a table count that came out one short: the migration
 * runner reads the migrations DIRECTORY, and whether a file is tracked by git is
 * nothing to it — so on a working tree that holds GEN-009's untracked 0116, the
 * table already existed, this file replaced it with its own approximation, and
 * the teardown then dropped a MIGRATED table and left the database one table
 * short for everything that ran afterwards.
 *
 * So: create only what is absent, drop only what was created here. That also
 * makes the drift GEN-009 is asked to re-confirm close itself — the day 0116
 * lands, these tests exercise the real table with no edit.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
// By relative path to the build: tests/** is outside the workspace globs, so a
// bare '@pemo/platform' does not resolve here. See the harness header.
import { auditedWrite, NestedAuditedWriteError, type AuditRecord } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

/**
 * These probes' acts THROW or SUCCEED; none refuses by value, so every outcome
 * reaching the primitive is an act. `committed` became required at GEN-028 so
 * that no call site can forget to say which it is.
 */
const ALWAYS_AN_ACT = { committed: () => true } as const;

let harness: Harness;
let audit: AuditRecord;
/** True only when this file created the audit table, and so may drop it. */
let auditTableIsOurs = false;

/** Mirrors database/migrations/0116 (GEN-009, held). See the caveat above. */
const CREATE_AUDIT_EVENT = `
  CREATE TABLE access.audit_event (
    audit_id       text        PRIMARY KEY,
    principal_id   text        NOT NULL REFERENCES access.staff_principal (principal_id),
    group_id       text        NOT NULL REFERENCES access.user_group (group_id),
    role           text        NOT NULL,
    node_kind      text        NOT NULL,
    node_id        text        NOT NULL,
    action         text        NOT NULL,
    target_kind    text        NOT NULL,
    target_id      text        NOT NULL,
    occurred_at    timestamptz NOT NULL,
    recorded_at    timestamptz NOT NULL DEFAULT now(),
    correlation_id uuid        NOT NULL,
    CONSTRAINT audit_event_recorded_not_before_occurrence CHECK (recorded_at >= occurred_at)
  )`;

const counts = async (): Promise<{ act: number; audit: number }> => {
  const [a] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM home_safety.gen011_act WHERE k <> 'taken'`,
  );
  const [b] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM access.audit_event WHERE target_id = 'tgt_gen011'`,
  );
  return { act: Number(a?.n ?? -1), audit: Number(b?.n ?? -1) };
};

/** The act: one row in the calling module's OWN schema, written UNQUALIFIED. */
const actOn = (k: string) => async (tx: { query(t: string, v?: readonly unknown[]): Promise<unknown[]> }) => {
  await tx.query(`INSERT INTO gen011_act (k) VALUES ($1)`, [k]);
  return k;
};

test.before(async () => {
  harness = await startHarness();

  // Only if the migrations did not already supply it. Never DROP-then-CREATE:
  // that silently replaces a migrated table with an approximation of it.
  const [existing] = await harness.admin.query<{ reg: string | null }>(
    `SELECT to_regclass('access.audit_event')::text AS reg`,
  );
  auditTableIsOurs = existing?.reg == null;
  if (auditTableIsOurs) await harness.admin.query(CREATE_AUDIT_EVENT);

  // Derived from the seeded world, not hard-coded: a fixture rename must fail
  // this loudly rather than quietly test nothing.
  const [p] = await harness.admin.query<{ principal_id: string }>(
    `SELECT principal_id FROM access.staff_principal ORDER BY 1 LIMIT 1`,
  );
  const [g] = await harness.admin.query<{ group_id: string }>(
    `SELECT group_id FROM access.user_group ORDER BY 1 LIMIT 1`,
  );
  const [s] = await harness.admin.query<{ role: string; node_kind: string; node_id: string }>(
    `SELECT role, node_kind, node_id FROM access.scope_grant ORDER BY 1 LIMIT 1`,
  );
  // ONLY the base seeds are relied on. access principals and groups are created
  // by database/seeds/40-*.sql, which startHarness's reseed() does apply.
  assert.ok(p && g && s, 'the base seeds no longer supply a principal, group and grant');

  // THE ACT TABLE. Owned by this file, in a MODULE schema, written unqualified
  // through the module's handle — which is the half of the mechanism the audit's
  // qualified write is the other half of.
  //
  // It is not a business table on purpose. An earlier version acted on
  // home_safety.acknowledgement and derived a real event, and that made the
  // suite depend on the __default scenario overlays: `pnpm seed` applies them,
  // startHarness's reseed() does NOT. The tests passed only on a database
  // someone had seeded out of band, and failed 7/7 the moment they met a
  // freshly bootstrapped one — which is precisely what CI is. Atomicity is not
  // a property of which table the act touches.
  //
  // The DEFERRED constraint is load-bearing: it gives the one injection point
  // the primitive's API deliberately withholds, a failure that lands AT COMMIT,
  // after both writes. Without it the hazard window is untestable.
  await harness.admin.query('DROP TABLE IF EXISTS home_safety.gen011_act');
  await harness.admin.query(
    `CREATE TABLE home_safety.gen011_act (
       k text NOT NULL,
       CONSTRAINT gen011_act_unique UNIQUE (k) DEFERRABLE INITIALLY DEFERRED
     )`,
  );
  await harness.admin.query(`GRANT SELECT, INSERT ON home_safety.gen011_act TO pemo_app`);
  await harness.admin.query(`INSERT INTO home_safety.gen011_act (k) VALUES ('taken')`);
  audit = {
    // A person acting as themselves. `source` is required rather than defaulted
    // (GEN-025), so an act with no actor cannot inherit an attribution by omission.
    source: 'principal',
    principalId: p.principal_id,
    groupId: g.group_id,
    role: s.role,
    nodeKind: s.node_kind,
    nodeId: s.node_id,
    action: 'gen011_act',
    targetKind: 'test_row',
    targetId: 'tgt_gen011',
    occurredAt: new Date(),
    correlationId: '00000000-0000-4000-8000-0000000000aa',
  };
});

test.after(async () => {
  await harness.admin.query('DROP TABLE IF EXISTS home_safety.gen011_act');
  if (auditTableIsOurs) {
    // Only what this file created. Dropping a MIGRATED table is how the
    // database ends up one table short for whatever runs next.
    await harness.admin.query('DROP TABLE IF EXISTS access.audit_event');
  } else {
    // The table is 0116's, so it stays — but the ROWS this file wrote must not.
    //
    // THIS IS NOT TIDINESS. audit_event.group_id references access.user_group,
    // and startHarness's reseed() re-applies the seeds, which replace the group
    // rows. One audit row left behind therefore makes EVERY LATER RUN of ANY
    // integration test fail in reseed with a foreign key violation — found
    // exactly that way, as a whole file failing 8/8 in its setup rather than in
    // its assertions.
    await harness.admin.query(`DELETE FROM access.audit_event WHERE target_id = 'tgt_gen011'`);
  }
  await harness.close();
});

test.beforeEach(async () => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE target_id = 'tgt_gen011'`);
  await harness.admin.query(`DELETE FROM home_safety.gen011_act WHERE k <> 'taken'`);
});

// ─── red 1 + 2a: commit BOTH ────────────────────────────────────────────────
test('on success the act and the audit are BOTH committed', async () => {
  const before = await counts();
  assert.deepEqual(before, { act: 0, audit: 0 }, 'the fixture did not start clean');

  const returned = await auditedWrite(harness.modules.homeSafetyDb, audit, actOn('ok'), ALWAYS_AN_ACT);
  assert.equal(returned, 'ok', "the act's return value is not passed through");

  assert.deepEqual(await counts(), { act: 1, audit: 1 });
});

// ─── red 1 + 2b: roll back BOTH, the act failing ────────────────────────────
test('when the ACT fails after writing, neither the act nor the audit survives', async () => {
  await assert.rejects(
    auditedWrite(harness.modules.homeSafetyDb, audit, async (tx) => {
      await actOn('actfail')(tx);
      // GEN-009's injection point: the write has happened, then it goes wrong.
      throw new Error('deliberate failure AFTER the act wrote');
    }, ALWAYS_AN_ACT),
    /deliberate failure AFTER the act wrote/,
  );
  assert.deepEqual(await counts(), { act: 0, audit: 0 });
});

// ─── the inverse of GEN-009's finding: a failed AUDIT takes the act with it ──
test('when the AUDIT fails, the act rolls back too — no act without its record', async () => {
  // D1 makes the record the CONDITION of the write, so a write that cannot be
  // recorded is a write that must not happen. An unknown principal is the
  // realistic way for the audit to fail: the register does not know the actor.
  const orphaned: AuditRecord = { ...audit, principalId: 'stf_not_in_the_register' };

  await assert.rejects(
    auditedWrite(harness.modules.homeSafetyDb, orphaned, actOn('auditfail'), ALWAYS_AN_ACT),
    /violates foreign key constraint/,
  );
  const after = await counts();
  assert.deepEqual(after, { act: 0, audit: 0 });
  // Named explicitly: this is the state GEN-009 produced, inverted. There it was
  // 0 act / 1 audit; here neither, and never one without the other.
  assert.notEqual(after.act, 1, 'an act survived without its audit');
});

// ─── THE hazard window: a failure after BOTH writes, through the primitive ───
test('a failure at COMMIT, after BOTH writes, rolls back the audit as well as the act', async () => {
  // THIS IS THE TEST THE OTHERS WERE MISSING. Every assertion above still passed
  // when the audit was moved back onto its own connection — the defect GEN-009
  // found — because none of them injected a failure BETWEEN the audit insert and
  // the act's commit, which is the entire hazard window. A deferred unique
  // constraint closes that: the offending row is accepted at statement time and
  // the violation is raised at COMMIT, after the audit has been written.
  //
  // Same transaction: COMMIT fails, both are lost, 0 act / 0 audit.
  // Separate connections: the audit has already committed. 0 act / 1 audit — the
  // false audit, exactly as GEN-009 produced it.
  const auditRows = async (): Promise<number> => {
    const [r] = await harness.admin.query<{ n: string }>(
      `SELECT count(*) AS n FROM access.audit_event WHERE audit_id = 'aud_gen011_deferred'`,
    );
    return Number(r?.n ?? -1);
  };
  const actRows = async (): Promise<number> => {
    const [r] = await harness.admin.query<{ n: string }>(
      `SELECT count(*) AS n FROM home_safety.gen011_act WHERE k = 'taken'`,
    );
    return Number(r?.n ?? -1);
  };
  assert.equal(await actRows(), 1, 'the fixture row is missing');
  assert.equal(await auditRows(), 0);

  await assert.rejects(
    auditedWrite(
      harness.modules.homeSafetyDb,
      { ...audit, auditId: 'aud_gen011_deferred' },
      async (tx) => {
        // Accepted now; the constraint is checked at COMMIT.
        await tx.query(`INSERT INTO gen011_act (k) VALUES ('taken')`);
      },
      ALWAYS_AN_ACT,
    ),
    /gen011_act_unique|duplicate key/,
  );

  assert.equal(await actRows(), 1, 'the act survived a failed commit');
  assert.equal(
    await auditRows(),
    0,
    'THE FALSE AUDIT: an audit row survived a transaction whose act did not. ' +
      'This is the 0-act/1-audit state GEN-009 found, and it means the audit is ' +
      'no longer written in the act\'s transaction.',
  );
});

// ─── red 3 (mechanism): failure AFTER BOTH writes ───────────────────────────
test('a failure after BOTH writes rolls both back — the 0-act/1-audit state is unreachable', async () => {
  // The primitive offers no hook after the audit insert, deliberately, so this
  // reproduces GEN-009's exact injection point one level down: both writes on
  // ONE connection in ONE transaction, then the failure. Under GEN-009's two
  // pools this left 0 act rows and 1 audit row. It cannot here.
  await assert.rejects(
    harness.modules.homeSafetyDb.transaction(async (tx) => {
      await actOn('after-both')(tx);
      await tx.query(
        `SELECT access.append_audit_event(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          'aud_gen011_after_both', audit.source, audit.principalId, audit.groupId, audit.role,
          audit.nodeKind, audit.nodeId, audit.action, audit.targetKind, audit.targetId,
          audit.occurredAt, audit.correlationId, null,
        ],
      );
      throw new Error('deliberate failure AFTER both writes');
    }),
    /deliberate failure AFTER both writes/,
  );
  assert.deepEqual(await counts(), { act: 0, audit: 0 });
});

// ─── nesting throws, loudly ─────────────────────────────────────────────────
test('called inside an existing transaction the primitive THROWS rather than joining', async () => {
  await assert.rejects(
    harness.modules.homeSafetyDb.transaction(async (tx) => {
      await auditedWrite(tx, audit, actOn('nested'), ALWAYS_AN_ACT);
    }),
    NestedAuditedWriteError,
    'the primitive silently joined a transaction it does not own',
  );
  assert.deepEqual(await counts(), { act: 0, audit: 0 });

  // And the refusal is by the handle's own state, not by luck: a pool-backed
  // handle reports false, a transaction-scoped one reports true.
  assert.equal(harness.modules.homeSafetyDb.inTransaction, false);
  await harness.modules.homeSafetyDb.transaction(async (tx) => {
    assert.equal(tx.inTransaction, true);
  });
});

// ─── the audit runs as the RUNTIME role, not the owner ──────────────────────
test('pemo_app can INSERT the audit but cannot amend or delete it', async () => {
  await auditedWrite(harness.modules.homeSafetyDb, audit, actOn('perm'), ALWAYS_AN_ACT);

  // ADR-010 D1's fourth property, inherited from GEN-010 rather than built here.
  // assert.rejects would also pass if the statement failed for an unrelated
  // reason, so the cause is matched.
  await assert.rejects(
    harness.modules.homeSafetyDb.query(`UPDATE access.audit_event SET action = 'tampered'`),
    /permission denied/,
  );
  await assert.rejects(
    harness.modules.homeSafetyDb.query(`DELETE FROM access.audit_event`),
    /permission denied/,
  );
  assert.equal((await counts()).audit, 1);
});
