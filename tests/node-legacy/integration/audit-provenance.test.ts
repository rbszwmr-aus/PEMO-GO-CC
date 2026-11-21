/**
 * W1b — the audit's provisioning shape (ADR-010 A1) and reason_code (ADR-014).
 *
 * THIS FILE'S ORACLE IS INDEPENDENT OF W1c'S. Nothing here touches idempotency,
 * and nothing in the idempotency suite touches attribution: a finding in one must
 * not ride silently on the other.
 *
 * WHAT WAS BROKEN. 0116 made principal_id, group_id and role all NOT NULL, and a
 * provisioning act has none of the three — no principal, no group, and no grant,
 * because the grant is what it creates. So ADR-010 A1's required shape ("honest
 * absence with the source recorded, never a fabricated principal id, never
 * 'system'") was not merely unimplemented; it was UNREPRESENTABLE. The only ways
 * to record a provisioning act were a fabricated principal, which A1 forbids by
 * name, or no audit at all, which ADR-010 D1 forbids.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig, assertReasonCode, ReasonCodeError } from '../../modules/platform/dist/index.js';
import type { ReasonCodeRegistry } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let ownerDb: ReturnType<typeof createModuleDb>;

test.before(async () => {
  harness = await startHarness();
  ownerDb = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
});
test.after(async () => {
  await ownerDb.query(`DELETE FROM audit_event WHERE audit_id LIKE 'aud\\_w1b\\_%' ESCAPE '\\'`);
  await ownerDb.close();
  await harness.close();
});

const insertAudit = (cols: Record<string, unknown>) => {
  const names = Object.keys(cols);
  const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
  return ownerDb.query(
    `INSERT INTO audit_event (${names.join(', ')}) VALUES (${placeholders})`,
    Object.values(cols),
  );
};

const base = (auditId: string) => ({
  audit_id: auditId,
  node_kind: 'estate',
  node_id: 'est_wing_fu_garden',
  action: 'test.act',
  target_kind: 'test',
  target_id: 't1',
  occurred_at: new Date(),
  correlation_id: '11111111-1111-1111-1111-111111111111',
});

// ───────────────────────────────────────────── the biconditional, both directions

test('a PRINCIPAL act with NO authority is refused', async () => {
  // The direction that matters most: a `principal` act is exactly the case where
  // an actor MUST be recorded, and omitting one must be impossible rather than
  // merely discouraged.
  await assert.rejects(
    insertAudit({ ...base('aud_w1b_principal_noauth'), source: 'principal' }),
    /audit_event_authority_only_when_principal/,
  );
});

test('a PROVISIONING act with a FABRICATED principal is refused', async () => {
  // ADR-010 A1 rejects a standing break-glass principal and forbids inventing one
  // per act. The schema now enforces that rather than trusting the write path:
  // there is no way to attach an actor to an act that had none.
  await assert.rejects(
    insertAudit({
      ...base('aud_w1b_prov_fabricated'),
      source: 'provisioning',
      principal_id: 'stf_wfg_manager',
      group_id: 'grp_of_one_stf_wfg_manager',
      role: 'estate_staff',
    }),
    /audit_event_authority_only_when_principal/,
  );
});

test('a PROVISIONING act with honest absence is ACCEPTED', async () => {
  await insertAudit({ ...base('aud_w1b_prov_ok'), source: 'provisioning' });
  const [row] = await ownerDb.query<{ principal_id: string | null; source: string }>(
    `SELECT principal_id, source FROM audit_event WHERE audit_id = 'aud_w1b_prov_ok'`,
  );
  assert.equal(row?.source, 'provisioning');
  assert.equal(row?.principal_id, null, 'a null, which is legible — not a fiction');
});

test('PARTIAL authority is refused in both directions — the hole the obvious spelling leaves', async () => {
  /**
   * The natural constraint would have been
   *   (source = 'principal') = (principal_id IS NOT NULL AND group_id IS NOT NULL AND role IS NOT NULL)
   * which for a non-staff source reads "NOT (all three present)" and therefore
   * PERMITS one or two. That is the half-claimed provenance resident.party's own
   * constraint refuses, and counting non-nulls is what closes it. Both halves are
   * asserted, because a constraint is only as good as the states it excludes.
   */
  await assert.rejects(
    insertAudit({ ...base('aud_w1b_partial_prov'), source: 'provisioning', principal_id: 'stf_wfg_manager' }),
    /audit_event_authority_only_when_principal/,
    'a provisioning act with ONE authority column must not be writable',
  );
  await assert.rejects(
    insertAudit({
      ...base('aud_w1b_partial_principal'), source: 'principal',
      principal_id: 'stf_wfg_manager', group_id: 'grp_of_one_stf_wfg_manager',
    }),
    /audit_event_authority_only_when_principal/,
    'a principal act missing only `role` must not be writable either',
  );
});

test('an INTEGRATION act carries no authority — a job is not a principal', async () => {
  // ADR-010 D1: attribution is to a principal, "not a session, a service or a
  // job". An inbound integration message is processed by no person.
  await insertAudit({ ...base('aud_w1b_integration'), source: 'integration' });
  await assert.rejects(
    insertAudit({
      ...base('aud_w1b_integration_bad'), source: 'integration',
      principal_id: 'stf_wfg_manager', group_id: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
    }),
    /audit_event_authority_only_when_principal/,
  );
});

test('EXISTING rows survive, and the constraint holds over them', async () => {
  /**
   * The backfill claim is that every row 0116 accepted was a staff act — which
   * the old schema itself guarantees, since all three columns were NOT NULL. This
   * asserts the claim against the live table rather than restating it: any row
   * predating 0119 must read the authority-bearing source WITH its authority intact —
   * `principal` since 0121, which renamed the value without changing the category.
   */
  await insertAudit({
    ...base('aud_w1b_legacy_shape'), source: 'principal',
    principal_id: 'stf_wfg_manager', group_id: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
  });
  const [row] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_event
      WHERE source = 'principal' AND num_nonnulls(principal_id, group_id, role) <> 3`,
  );
  assert.equal(row?.n, '0', 'no principal row may lack authority');
  const [all] = await ownerDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_event WHERE source IS NULL`,
  );
  assert.equal(all?.n, '0', 'every row carries a source');
});

// ────────────────────────────────────────────────── reason_code (ADR-014 D3/D4)

/**
 * A TEST-DECLARED VOCABULARY, deliberately.
 *
 * The mechanism must be provable without any real operation's codes existing —
 * those belong to the PIDs that build those operations (W2 onward). A mechanism
 * proven only against the vocabulary it ships with is proven against itself.
 */
const REGISTRY: ReasonCodeRegistry = {
  'test.revoke': { codes: ['staff_departed', 'role_changed'], required: true },
  'test.optional': { codes: ['corrected'], required: false },
};

test('the validator refuses an UNDECLARED code', async () => {
  assert.throws(
    () => assertReasonCode(REGISTRY, 'test.revoke', 'staff_departd'),
    (e: unknown) => e instanceof ReasonCodeError && /not declared for action/.test((e as Error).message),
    'a typo in a controlled code is exactly what the control exists to catch',
  );
});

test('the validator refuses a code on an act type that declares NO vocabulary', async () => {
  assert.throws(
    () => assertReasonCode(REGISTRY, 'test.undeclared', 'anything'),
    (e: unknown) => e instanceof ReasonCodeError && /declares no reason vocabulary/.test((e as Error).message),
  );
});

test('the validator refuses a MISSING code where the contract requires one (D4)', async () => {
  assert.throws(
    () => assertReasonCode(REGISTRY, 'test.revoke', null),
    (e: unknown) => e instanceof ReasonCodeError && /requires a reason_code/.test((e as Error).message),
  );
});

test('the validator refuses the empty string — neither a code nor an absence', async () => {
  assert.throws(() => assertReasonCode(REGISTRY, 'test.revoke', '   '), ReasonCodeError);
});

test('the validator ACCEPTS a declared code, and an omission where the act permits it', async () => {
  // The negative cases above are worthless if everything throws.
  assertReasonCode(REGISTRY, 'test.revoke', 'staff_departed');
  assertReasonCode(REGISTRY, 'test.optional', null);
  assertReasonCode(REGISTRY, 'test.optional', 'corrected');
  assertReasonCode(REGISTRY, 'test.undeclared', null);
});

test('reason_code reaches the column, and the schema enumerates no vocabulary', async () => {
  await insertAudit({
    ...base('aud_w1b_reason'), source: 'principal',
    principal_id: 'stf_wfg_manager', group_id: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
    reason_code: 'anything_at_all',
  });
  // ADR-014 D3 / ADR-006 D3: the vocabulary is NOT frozen into the schema, so an
  // arbitrary string is storable and the write path is what constrains it. If a
  // CHECK ever appears on this column, one act's new code becomes a migration for
  // every act — and this assertion is what would notice.
  const [row] = await ownerDb.query<{ reason_code: string }>(
    `SELECT reason_code FROM audit_event WHERE audit_id = 'aud_w1b_reason'`,
  );
  assert.equal(row?.reason_code, 'anything_at_all');
});
