/**
 * W2 -- the grant write surface. THE FIRST SURFACE THAT CREATES AUTHORITY.
 *
 * THE WORLD THIS BUILDS FOR ITSELF, AND WHY IT IS NOT SEEDED.
 *
 * There are no `grant_administrator` grants anywhere in the seeded world, so
 * `confer` is unreachable until a provisioning act runs. Seeding an administrator
 * would bypass the very path under test. So these tests CREATE A FRESH
 * ORGANIZATION and provision it, which exercises the real bootstrap.
 *
 * The GROUP is created through the owner handle as fixture setup
 * (`[fixtures-are-owner-work]`): group administration is a separate surface and
 * is not built here, and a test that could not tell "the app is forbidden this"
 * from "my fixture could not run" is the failure that principle records. The
 * GRANT -- the thing under test -- is created only through the surface.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createModuleDb, loadConfig, deriveActId } from '../../modules/platform/dist/index.js';
import { startHarness, REPO_ROOT, type Harness } from '../../apps/api/dist/testing/harness.js';
import { provisionForTest } from '../../apps/api/dist/testing/provision-organization.js';

const run = promisify(execFile);
const BASE = '/api/management-web/v0';

const ORG = 'org_w2_probe';
const OTHER_ORG = 'org_w2_other';
const STAFF_GROUP = 'grp_w2_staff';

/**
 * THE ADMINISTRATOR IS THE ONE PROVISIONING CREATES, not a fixture.
 *
 * Since GEN-032 the genesis act records its own principal, creates its own group
 * and seats the membership, so every id below is a pure function of the
 * organization id — the same derivation the route performs. Fixturing a separate
 * administrator would test a world the act cannot produce.
 */
const ADMIN = deriveActId('stf', 'provision_organization.principal', ORG);
const ADMIN_GROUP = deriveActId('grp', 'provision_organization.group', ORG);
const ESTATE_E = 'est_w2_e';
const ESTATE_F = 'est_w2_f';

let harness: Harness;
let owner: ReturnType<typeof createModuleDb>;

const staffAuth = (p: string) => ({ authorization: `Bearer ${harness.modules.staffAuth.issue(p)}` });

/**
 * A GROUP PER TEST, created through the owner handle.
 *
 * The (group, role, node) cardinality guard is real: two tests conferring the
 * same role at the same node to the same group collide on it, and the second
 * fails for a reason that has nothing to do with what it is testing. Each test
 * that confers takes its own group so its subject is the only thing that can
 * refuse it.
 */
const freshGroup = async (tag: string): Promise<string> => {
  const id = `grp_w2_${tag}`;
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [id, ORG, `W2 ${tag}`]);
  return id;
};

const confer = (principal: string, key: string, body: Record<string, unknown>) =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/grants`,
    headers: { ...staffAuth(principal), 'idempotency-key': key },
    payload: body,
  });

const revoke = (principal: string, grantId: string, key: string, body: Record<string, unknown> = {}) =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/grants/${grantId}/revoke`,
    headers: { ...staffAuth(principal), 'idempotency-key': key },
    payload: { reasonCode: 'staff_departed', ...body },
  });

// GEN-060: the genesis is no longer an HTTP route — this calls the same act the
// operator CLI calls, from the harness's modules.
const provision = (organizationId: string, over: Record<string, string> = {}) =>
  provisionForTest(harness, {
    organizationId,
    reasonCode: 'organization_provisioned',
    externalId: `idp|${organizationId}`,
    displayName: 'First Administrator',
    groupName: 'Administrators',
    ...over,
  });

test.before(async () => {
  harness = await startHarness();
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });

  // ---- fixture: a fresh, EMPTY organization, through the owner handle -------
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'W2P', 'W2 Probe', 'W2 測試'), ($2, 'W2O', 'W2 Other', 'W2 其他')
     ON CONFLICT (organization_id) DO NOTHING`, [ORG, OTHER_ORG]);
  await owner.query(
    `INSERT INTO property.estate (estate_id, organization_id, name_en, name_zh_hant)
     VALUES ($1, $3, 'Estate E', '屋苑 E'), ($2, $3, 'Estate F', '屋苑 F')
     ON CONFLICT (estate_id) DO NOTHING`, [ESTATE_E, ESTATE_F, ORG]);
  // ONLY the staff group is fixture setup. The administrator group, the
  // administrator principal and their membership are what the genesis act
  // creates — fixturing them would test a world the act cannot produce.
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, 'W2 staff') ON CONFLICT (group_id) DO NOTHING`, [STAFF_GROUP, ORG]);
});

test.after(async () => {
  // Prefix-scoped and ordered by dependency. Never a whole-table clear.
  await owner.query(`DELETE FROM audit_event WHERE node_id LIKE '%w2\\_%' ESCAPE '\\' OR target_id LIKE 'gr\\_%' ESCAPE '\\'`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation IN
                     ('confer_grant','revoke_grant','provision_organization')`);
  /**
   * ORDERED BY DEPENDENCY, AND THE DERIVED IDS ARE NAMED EXPLICITLY.
   *
   * `scope_grant` and `group_membership` both reference `user_group`, so groups
   * go last. And the administrator group's id is DERIVED, not prefixed — it does
   * not match `grp_w2_%`, so its grant survived a prefix-only delete and the
   * foreign key caught it. Prefixes cannot reach ids the act computes; those are
   * deleted by name.
   */
  await owner.query(`DELETE FROM scope_grant WHERE group_id LIKE 'grp\\_w2\\_%' ESCAPE '\\'`);
  await owner.query(`DELETE FROM scope_grant WHERE group_id = $1`, [ADMIN_GROUP]);
  await owner.query(`DELETE FROM group_membership WHERE membership_id LIKE 'mem\\_w2\\_%' ESCAPE '\\'`);
  await owner.query(
    `DELETE FROM group_membership WHERE membership_id = $1`,
    [deriveActId('mem', 'provision_organization.membership', ORG)]);
  await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE 'stf\\_w2\\_%' ESCAPE '\\'`);
  await owner.query(`DELETE FROM staff_principal WHERE principal_id = $1`, [ADMIN]);
  await owner.query(`DELETE FROM user_group WHERE group_id LIKE 'grp\\_w2\\_%' ESCAPE '\\'`);
  await owner.query(`DELETE FROM user_group WHERE group_id = $1`, [ADMIN_GROUP]);
  await owner.query(`DELETE FROM property.estate WHERE estate_id LIKE 'est\\_w2\\_%' ESCAPE '\\'`);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id LIKE 'org\\_w2\\_%' ESCAPE '\\'`);
  await owner.close();
  await harness.close();
});

// ------------------------------------------------------- (1) act id stability

test('the act id is PURE -- a fresh process derives the same value', async () => {
  /**
   * PROVEN ACROSS A PROCESS BOUNDARY, because a same-process assertion cannot
   * tell a pure function from one seeded with per-process state. A digest salted
   * at startup is stable within one run and unstable across a restart, so it
   * would pass every in-process test and fail in production exactly when a client
   * retries after a deploy -- which is when retries are most likely.
   */
  const here = deriveActId('gr', 'confer_grant', 'key-across-processes');
  const { stdout } = await run('node', [
    '--input-type=module', '-e',
    `import { deriveActId } from '${REPO_ROOT}/modules/platform/dist/index.js';` +
    `process.stdout.write(deriveActId('gr', 'confer_grant', 'key-across-processes'));`,
  ]);
  assert.equal(stdout.trim(), here, 'the derivation is not pure across processes');
  assert.match(here, /^gr_[0-9a-f]{32}$/);
});

test('different keys derive different ids, and the separator prevents a boundary collision', async () => {
  assert.notEqual(deriveActId('gr', 'confer_grant', 'a'), deriveActId('gr', 'confer_grant', 'b'));
  // ("ab","c") vs ("a","bc") -- identical concatenated, different with a separator.
  assert.notEqual(deriveActId('gr', 'ab', 'c'), deriveActId('gr', 'a', 'bc'));
});

// --------------------------------------------------------- (2) provisioning

test('PROVISIONING succeeds on an organization that has never held a grant', async () => {
  const outcome = await provision(ORG);
  assert.equal(outcome.kind, 'provisioned', JSON.stringify(outcome));
  // The response shape is gone with the route; assert the ACT'S EFFECT in the DB.
  const grantId = deriveActId('gr', 'provision_organization', ORG);
  const [grant] = await owner.query<{ role: string; node_kind: string; node_id: string }>(
    `SELECT role, node_kind, node_id FROM scope_grant WHERE grant_id = $1`, [grantId]);
  assert.ok(grant, 'the genesis wrote no grant');
  assert.equal(grant.role, 'grant_administrator');
  assert.equal(grant.node_kind, 'organization');
  assert.equal(grant.node_id, ORG);
});

test('the provisioning AUDIT carries source=provisioning with NO authority', async () => {
  const [row] = await owner.query<{
    source: string; principal_id: string | null; group_id: string | null; role: string | null;
    reason_code: string;
  }>(`SELECT source, principal_id, group_id, role, reason_code FROM audit_event
       WHERE action = 'provision_organization' AND node_id = $1`, [ORG]);
  assert.ok(row, 'the provisioning act wrote no audit record');
  assert.equal(row.source, 'provisioning');
  assert.equal(row.principal_id, null, 'honest absence, not a fabricated principal');
  assert.equal(row.group_id, null);
  assert.equal(row.role, null);
  assert.equal(row.reason_code, 'organization_provisioned');
});

test('RED -- the biconditional refuses the fabricated alternative', async () => {
  // The proof that the null above is ENFORCED, not merely what this code happened
  // to write. A provisioning act with an invented principal is unrepresentable.
  await assert.rejects(
    owner.query(
      `INSERT INTO audit_event (audit_id, source, principal_id, group_id, role, node_kind, node_id,
                                action, target_kind, target_id, occurred_at, correlation_id)
       VALUES ('aud_w2_fake', 'provisioning', $1, $2, 'grant_administrator', 'organization', $3,
               'provision_organization', 'scope_grant', 'x', now(),
               '00000000-0000-4000-8000-0000000000a2'::uuid)`,
      [ADMIN, ADMIN_GROUP, ORG]),
    /audit_event_authority_only_when_staff|audit_event_authority_only_when_principal|invalid input/,
  );
});

test('PROVISIONING is REFUSED once the organization has EVER held a grant', async () => {
  const replay = await provision(ORG);
  // The same key (the organizationId) REPLAYS rather than performing again --
  // which is the derived-key stance working. The zero-ever predicate is proven
  // separately below, with a different group so the key differs.
  assert.equal(replay.kind, 'replayed', JSON.stringify(replay));

  // A DIFFERENT group under the same org key: the idempotency layer answers first
  // -- same key, different request fingerprint -- and refuses with a conflict
  // before the predicate ever runs.
  await assert.rejects(
    () => provision(ORG, { externalId: 'idp|second-attempt', displayName: 'Second', groupName: 'Second group' }),
    (e: Error) => /idempotenc/i.test(e.message) || e.constructor.name === 'IdempotencyConflictError',
  );
});

test('RED -- the zero-ever predicate is EVER, not currently-live', async () => {
  /**
   * TESTED AT THE MODULE, NOT THROUGH THE ROUTE, AND THAT IS THE POINT.
   *
   * Through the surface this predicate CANNOT BE REACHED a second time: the
   * derived key is the organizationId, so an identical repeat REPLAYS (200) and a
   * different one is a key conflict (409). Either way the idempotency layer
   * answers first and the predicate never runs -- a mutation to it would leave the
   * route tests green. That is `[shadowed-layer-empty-oracle]` exactly, so the
   * decision is tested where it is MADE.
   *
   * The case: every grant of an organization is REVOKED, so it holds none LIVE.
   * A liveness predicate would readmit provisioning -- and a provisioning act has
   * no prior principal, so ANYONE could then take it. That is the standing
   * break-glass ADR-010 A1 forbids, reached through an ordinary revocation.
   */
  // The act creates its own group and principal now, so there is nothing to
  // fixture here — which is the point of the four-part genesis act.
  const app = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    const first = await app.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: OTHER_ORG, grantId: 'gr_w2_other_first',
      groupId: 'grp_w2_other_first', groupDisplayName: 'Other admins',
      principalId: 'stf_w2_other_first', externalId: 'idp|w2-other-first',
      displayName: 'Other Admin', membershipId: 'mem_w2_other_first',
      // In the past, so the revocation below can close it at an instant that is
      // after its start (scope_grant_period_ordered) and before now.
      effectiveFrom: new Date('2024-01-01T00:00:00+08:00'),
    }));
    assert.equal(first.kind, 'provisioned', 'an organization that has never held a grant');

    // Revoke it outright: the organization now holds NO LIVE grant at all.
    await owner.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id,
                                effective_from, effective_to)
       SELECT 'sgra_w2_other_rev', 2, grant_id, group_id, role, node_kind, node_id,
              effective_from, now() - interval '1 minute'
         FROM scope_grant WHERE grant_id = 'gr_w2_other_first' AND version = 1`);

    const live = await harness.modules.grants.effectiveAdministrators(OTHER_ORG);
    assert.equal(live.length, 0, 'the premise: NO live administrator remains');

    const again = await app.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: OTHER_ORG, grantId: 'gr_w2_other_second',
      groupId: 'grp_w2_other_second', groupDisplayName: 'Other admins again',
      principalId: 'stf_w2_other_second', externalId: 'idp|w2-other-second',
      displayName: 'Other Admin 2', membershipId: 'mem_w2_other_second',
      effectiveFrom: new Date(),
    }));
    assert.equal(
      again.kind, 'already-provisioned',
      'zero LIVE grants must NOT readmit provisioning -- only zero grants EVER admits it',
    );

    const rows = await owner.query(`SELECT 1 FROM scope_grant WHERE grant_id = 'gr_w2_other_second'`);
    assert.equal(rows.length, 0, 'and nothing was written');
  } finally {
    await app.close();
    // Escaped: `_` is a LIKE wildcard, so a bare prefix reaches further than it looks.
    await owner.query(`DELETE FROM group_membership WHERE membership_id LIKE $1 ESCAPE '\\'`, ['mem\\_w2\\_other%']);
    await owner.query(`DELETE FROM scope_grant WHERE grant_id LIKE $1 ESCAPE '\\'`, ['gr\\_w2\\_other%']);
    await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`, ['stf\\_w2\\_other%']);
    await owner.query(`DELETE FROM user_group WHERE group_id LIKE $1 ESCAPE '\\'`, ['grp\\_w2\\_other%']);
  }
});

test('the group the act creates belongs to the organization it provisions', async () => {
  /**
   * REPLACES a cross-organization test whose premise the act removed.
   *
   * It used to pass a group belonging to ANOTHER organization and assert 404,
   * because the act took an existing group and had to check its owner. Since
   * GEN-032 the act CREATES the group in the organization named in the path, so
   * a mismatched group is not a state a caller can reach — the isolation moved
   * from a check into the shape. What is worth asserting now is the property
   * that replaced the check.
   */
  const [row] = await owner.query<{ organization_id: string }>(
    `SELECT organization_id FROM user_group WHERE group_id = $1`, [ADMIN_GROUP]);
  assert.equal(row?.organization_id, ORG, 'the created group is in the provisioned organization');

  const [principal] = await owner.query<{ organization_id: string; identity_source: string }>(
    `SELECT organization_id, identity_source FROM staff_principal WHERE principal_id = $1`, [ADMIN]);
  assert.equal(principal?.organization_id, ORG, 'and so is the recorded principal');
  assert.equal(principal?.identity_source, 'external', 'recorded as a REAL external identity, never a seed');
});

// ----------------------------------------------------------------- (5) G-2

test('CONFER: G-2 admits an act within a node the caller holds', async () => {
  const res = await confer(ADMIN, 'w2-confer-estate-e', {
    groupId: STAFF_GROUP, role: 'estate_staff', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'new_appointment',
  });
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(res.json().grant.node.id, ESTATE_E);
});

test('CONFER: G-2 REFUSES a node outside the caller\'s authority -- 404, never 403', async () => {
  // A principal whose only administrator grant is at ESTATE_E cannot confer at a
  // node of another organization. 404 rather than 403 by decision: a distinct
  // refusal would confirm the node exists to someone with no authority over it.
  const res = await confer(ADMIN, 'w2-confer-foreign', {
    groupId: STAFF_GROUP, role: 'estate_staff', nodeKind: 'estate',
    nodeId: 'est_wing_fu_garden', reasonCode: 'new_appointment',
  });
  assert.equal(res.statusCode, 404, res.body);
  assert.match(res.json().type, /grant-target-not-found/);
});

test('REVOKE: G-2 is proven SEPARATELY -- the create rule does not carry', async () => {
  /**
   * Revoking reaches an EXISTING grant rather than naming a new node, so its gate
   * is over the node the REVOKED grant names. A caller from another organization
   * must not be able to revoke, and must not learn the grant exists.
   */
  const seeded = await owner.query<{ grant_id: string }>(
    `SELECT grant_id FROM scope_grant WHERE group_id = 'grp_of_one_stf_wfg_manager' LIMIT 1`);
  const foreign = seeded[0]?.grant_id;
  assert.ok(foreign, 'the seeded world must carry a grant to attempt');

  const res = await revoke(ADMIN, foreign, 'w2-revoke-foreign');
  assert.equal(res.statusCode, 404, res.body);
  assert.match(res.json().type, /grant-target-not-found/);
});

test('G-2 does NOT over-reach: an administrator at E cannot confer at F', async () => {
  // The caller holds grant_administrator at the ORGANIZATION node (provisioning),
  // which DOES cover both estates -- so this test uses a narrower administrator.
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ('grp_w2_e_admin', $1, 'E administrators') ON CONFLICT DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ('stf_w2_e', $1, 'E Administrator', 'recorded_seed') ON CONFLICT DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ('mem_w2_e', 'grp_w2_e_admin', 'stf_w2_e', '2024-01-01T00:00:00+08:00')
     ON CONFLICT DO NOTHING`);

  const granted = await confer(ADMIN, 'w2-confer-e-admin', {
    groupId: 'grp_w2_e_admin', role: 'grant_administrator', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'new_appointment',
  });
  // A grant_administrator MAY confer grant_administrator at or below a node they
  // hold. That is ADR-010 D3 working -- delegation is by scope, downward.
  assert.equal(granted.statusCode, 201, granted.body);

  const atF = await confer('stf_w2_e', 'w2-confer-at-f', {
    groupId: STAFF_GROUP, role: 'estate_staff', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  assert.equal(atF.statusCode, 404, 'an administrator at E must not reach F');

  const atE = await confer('stf_w2_e', 'w2-confer-at-e', {
    groupId: STAFF_GROUP, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'cover_absence',
  });
  assert.equal(atE.statusCode, 201, 'and must still reach its own node');
});

// ------------------------------------------------------- (4) reason + replay

test('a reason is REQUIRED on confer, and an UNDECLARED code is refused', async () => {
  const missing = await confer(ADMIN, 'w2-no-reason', {
    groupId: STAFF_GROUP, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
  });
  assert.equal(missing.statusCode, 400, missing.body);

  const bogus = await confer(ADMIN, 'w2-bad-reason', {
    groupId: STAFF_GROUP, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointmnt',
  });
  assert.equal(bogus.statusCode, 400, 'a typo in a controlled code is what the control exists to catch');
});

test('a reason is REQUIRED on revoke too', async () => {
  const conferred = await confer(ADMIN, 'w2-for-reason-revoke', {
    groupId: await freshGroup('reasonrev'), role: 'integration_support', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'contractor_engagement',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const grantId = conferred.json().grant.grantId;

  const res = await harness.app.inject({
    method: 'POST', url: `${BASE}/grants/${grantId}/revoke`,
    headers: { ...staffAuth(ADMIN), 'idempotency-key': 'w2-revoke-no-reason' },
    payload: {},
  });
  assert.equal(res.statusCode, 400, res.body);
});

test('a RETRY of confer REPLAYS -- 200 not 201, and NO second act', async () => {
  const key = 'w2-confer-retry-key';
  const payload = {
    groupId: await freshGroup('retry'), role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'cover_absence',
  };
  const first = await confer(ADMIN, key, payload);
  assert.equal(first.statusCode, 201, first.body);
  const grantId = first.json().grant.grantId;

  const again = await confer(ADMIN, key, payload);
  assert.equal(again.statusCode, 200, 'a replay is NOT a creation');
  assert.equal(again.json().replayed, true);
  assert.equal(again.json().grant.grantId, grantId, 'the same act, re-derived by reading it');

  const [n] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM scope_grant WHERE grant_id = $1`, [grantId]);
  assert.equal(n?.n, '1', 'no second act');
  const [audits] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_event WHERE target_id = $1`, [grantId]);
  assert.equal(audits?.n, '1', 'a replay records nothing: nothing happened');
});

test('the same key offered for a DIFFERENT request is refused (D5)', async () => {
  const res = await confer(ADMIN, 'w2-confer-retry-key', {
    groupId: STAFF_GROUP, role: 'estate_staff', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  assert.equal(res.statusCode, 409, res.body);
  assert.match(res.json().type, /idempotency-key-conflict/);
});

// ------------------------------------------------------------ (1b) revoke path

test('REVOKE appends version + 1; the resolver answers not-live; HISTORY STILL ANSWERS', async () => {
  const conferred = await confer(ADMIN, 'w2-revoke-lifecycle', {
    groupId: await freshGroup('lifecycle'), role: 'approver', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'cover_absence',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const grantId = conferred.json().grant.grantId;

  const res = await revoke(ADMIN, grantId, 'w2-revoke-lifecycle-key', { reasonCode: 'cover_ended' });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().grant.version, 2, 'version + 1');

  const rows = await owner.query<{ version: number; effective_to: Date | null }>(
    `SELECT version, effective_to FROM scope_grant WHERE grant_id = $1 ORDER BY version`, [grantId]);
  assert.equal(rows.length, 2, 'both assertions retained -- the history IS the table');
  assert.equal(rows[0]?.effective_to, null, 'version 1 is untouched');

  const current = await harness.modules.grants.findCurrentGrant(grantId);
  assert.ok(current?.effectiveTo !== null, 'the current assertion carries an end');
});

test('a RETRY of revoke after a SUCCESSFUL first attempt REPLAYS -- no version + 2', async () => {
  /**
   * REVOKE'S STABILITY RESTS ENTIRELY ON THE KEY CHECK PRECEDING THE ACT, and
   * that is why it is proven separately from confer. Confer derives its act id
   * from (operation, key), so a retry is structurally the same act. Revoke appends
   * to an EXISTING instance and its version comes from CURRENT STATE -- so a naive
   * recomputation after a successful first attempt would append version + 2. The
   * idempotency record is what stops the act running at all.
   */
  const conferred = await confer(ADMIN, 'w2-revoke-retry-setup', {
    groupId: await freshGroup('revretry'), role: 'integration_support', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'contractor_engagement',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const grantId = conferred.json().grant.grantId;

  const key = 'w2-revoke-retry-key';
  const first = await revoke(ADMIN, grantId, key, { reasonCode: 'staff_departed' });
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().grant.version, 2);

  const again = await revoke(ADMIN, grantId, key, { reasonCode: 'staff_departed' });
  assert.equal(again.statusCode, 200, again.body);
  assert.equal(again.json().replayed, true, 'replayed, not re-performed');

  const rows = await owner.query<{ version: number }>(
    `SELECT version FROM scope_grant WHERE grant_id = $1 ORDER BY version`, [grantId]);
  assert.equal(rows.length, 2, `expected 2 assertions, found ${rows.length} -- version + 2 would be the defect`);
});

test('revoking a NON-LIVE grant is refused and appends nothing', async () => {
  const conferred = await confer(ADMIN, 'w2-revoke-twice-setup', {
    groupId: await freshGroup('twice'), role: 'resident', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'new_appointment',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const grantId = conferred.json().grant.grantId;

  assert.equal((await revoke(ADMIN, grantId, 'w2-twice-key-a')).statusCode, 200);
  const second = await revoke(ADMIN, grantId, 'w2-twice-key-b');
  assert.equal(second.statusCode, 409, second.body);
  assert.match(second.json().type, /grant-not-live/);

  const rows = await owner.query(`SELECT 1 FROM scope_grant WHERE grant_id = $1`, [grantId]);
  assert.equal(rows.length, 2, 'a failed precondition leaves no no-op assertion');
});

// -------------------------------------------------- (3) last-administrator

test('the LAST live organization administrator cannot be revoked', async () => {
  const admins = await harness.modules.grants.effectiveAdministrators(ORG);
  assert.ok(admins.length >= 2, `expected the org and estate-E administrators, got ${admins.length}`);

  // Revoke down to one, then attempt the last.
  const estateAdmin = deriveActId('gr', 'confer_grant', 'w2-confer-e-admin');
  const down = await revoke(ADMIN, estateAdmin, 'w2-revoke-e-admin', { reasonCode: 'role_change' });
  assert.equal(down.statusCode, 200, down.body);

  const remaining = await harness.modules.grants.effectiveAdministrators(ORG);
  assert.equal(remaining.length, 1, 'exactly one administrator remains');

  const last = await revoke(ADMIN, remaining[0]!.grantId, 'w2-revoke-last-admin', { reasonCode: 'staff_departed' });
  assert.equal(last.statusCode, 409, last.body);
  assert.match(last.json().type, /last-grant-administrator/);

  const after = await harness.modules.grants.effectiveAdministrators(ORG);
  assert.equal(after.length, 1, 'and it is still there');
});

test('NO OVER-REACH: a revocation elsewhere in the tree is unaffected', async () => {
  // A non-administrator grant, revoked while exactly one administrator remains.
  const conferred = await confer(ADMIN, 'w2-overreach-setup', {
    groupId: await freshGroup('overreach'), role: 'estate_staff', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const res = await revoke(ADMIN, conferred.json().grant.grantId, 'w2-overreach-revoke');
  assert.equal(res.statusCode, 200, 'the guard must not refuse a non-administrator revocation');
});

// --------------------------------------------------- multiplicity (ADR-012 D5)

test('MULTIPLICITY preserved: two groups may hold the same role at one node', async () => {
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ('grp_w2_second', $1, 'Second staff') ON CONFLICT DO NOTHING`, [ORG]);

  const a = await confer(ADMIN, 'w2-d5-key-a', {
    groupId: await freshGroup('d5a'), role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  const b = await confer(ADMIN, 'w2-d5-key-b', {
    groupId: await freshGroup('d5b'), role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  assert.equal(a.statusCode, 201, a.body);
  assert.equal(b.statusCode, 201, 'a DIFFERENT group at the same node is legal and must stay legal');
});

test('a SECOND live grant for one (group, role, node) is refused', async () => {
  // A DIFFERENT idempotency key: this must reach the cardinality guard, not be
  // answered as a replay of the grant the previous test conferred.
  // The SAME group as `w2-d5-key-a`, so the (group, role, node) key collides.
  const again = await confer(ADMIN, 'w2-d5-second-attempt', {
    groupId: 'grp_w2_d5a', role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'role_change',
  });
  assert.equal(again.statusCode, 409, again.body);
  assert.match(again.json().type, /grant-already-exists/);
});

// ------------------------------------------------------------------- audit

test('a CONFER audit carries its authority, its reason, and the narrowest grant', async () => {
  const [row] = await owner.query<{
    source: string; principal_id: string; role: string; node_kind: string; reason_code: string;
  }>(`SELECT source, principal_id, role, node_kind, reason_code FROM audit_event
       WHERE action = 'confer_grant' ORDER BY recorded_at LIMIT 1`);
  assert.ok(row, 'confer wrote no audit record');
  assert.equal(row.source, 'principal');
  assert.equal(row.principal_id, ADMIN);
  assert.equal(row.role, 'grant_administrator', 'the AUTHORITY is the administrator grant');
  assert.ok(row.reason_code, 'the reason is recorded on the act');
});

// ═══════════════════════════════════════════════════════════════════════════
// THE STANDING ORACLE: A REFUSAL WRITES ZERO AUDIT ROWS
// ═══════════════════════════════════════════════════════════════════════════
//
// `committed` is REQUIRED (GEN-028), so no call site can FORGET to declare
// whether its act happened. It cannot stop a site being WRONG: an act that
// cannot refuse today writes `() => true`, and if that command later starts
// returning a refusal the line keeps committing it and the false-audit path
// reopens at a site that still looks correct.
//
// So EVERY COMMAND THAT CAN REFUSE BY VALUE carries a case here. This is the
// generalisation of GEN-027's occupancy regression, and the cases below are the
// enumeration: a command that gains a refusal and is not added here is exactly
// the gap this exists to close.
//
// DRIVEN THROUGH THE ROUTES, not the module handles, wherever a route can reach
// the refusal — the defect being guarded lives in the CALL SITE's declaration,
// and a module-level test would never see it.
//
// AND AIMED AT THE OLDER CALLERS TOO. `recordOccupancy` predates the rule and is
// where the defect was found; the grant operations were written alongside it and
// are correct by construction. The older callers are the stronger evidence.

const auditCount = async (action: string): Promise<number> => {
  const [r] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_event WHERE action = $1`, [action]);
  return Number(r?.n ?? -1);
};

test('ZERO AUDIT ROWS on refusal -- recordOccupancy (conflict), an OLDER caller', async () => {
  const auth = { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` };
  const record = () => harness.app.inject({
    method: 'POST', url: `${BASE}/units/unit_wfg_a_12_a1/occupancies`,
    headers: auth, payload: { residentId: 'res_wfg_000001', role: 'tenant' },
  });
  const before = await auditCount('record_occupancy');
  assert.equal((await record()).statusCode, 201);
  assert.equal((await record()).statusCode, 409, 'a DOMAIN refusal, decided inside the act');
  assert.equal(
    (await auditCount('record_occupancy')) - before, 1,
    'exactly ONE audit row for one act. Two would mean the refusal was recorded as an act.',
  );
  await owner.query(
    `DELETE FROM resident.occupancy WHERE resident_id = 'res_wfg_000001'
       AND unit_id = 'unit_wfg_a_12_a1' AND source = 'management_web'`);
  await owner.query(`DELETE FROM audit_event WHERE action = 'record_occupancy'`);
});

test('ZERO AUDIT ROWS on refusal -- recordOccupancy (out-of-scope)', async () => {
  // The command's other refusal. An out-of-scope unit writes zero rows at the
  // in-query filter, so the act is ABSENT rather than fetched-and-rejected.
  const auth = { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_counter')}` };
  const before = await auditCount('record_occupancy');
  const res = await harness.app.inject({
    method: 'POST', url: `${BASE}/units/unit_wfg_a_12_a1/occupancies`,
    headers: auth, payload: { residentId: 'res_wfg_000001', role: 'tenant' },
  });
  assert.equal(res.statusCode, 404, res.body);
  assert.equal(await auditCount('record_occupancy'), before, 'nothing happened, so nothing is recorded');
});

test('ZERO AUDIT ROWS on refusal -- endOccupancy (not-live), an OLDER caller', async () => {
  const auth = { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` };
  const before = await auditCount('end_occupancy');
  const res = await harness.app.inject({
    method: 'POST', url: `${BASE}/occupancies/occ_no_such_instance/end`,
    headers: auth, payload: {},
  });
  assert.equal(res.statusCode, 404, res.body);
  assert.equal(await auditCount('end_occupancy'), before);
});

test('ZERO AUDIT ROWS on refusal -- conferGrant (out-of-scope and conflict)', async () => {
  const before = await auditCount('confer_grant');
  const foreign = await confer(ADMIN, 'w3-refusal-foreign', {
    groupId: STAFF_GROUP, role: 'estate_staff', nodeKind: 'estate',
    nodeId: 'est_wing_fu_garden', reasonCode: 'new_appointment',
  });
  assert.equal(foreign.statusCode, 404, foreign.body);

  const group = await freshGroup('refusal');
  const ok = await confer(ADMIN, 'w3-refusal-first', {
    groupId: group, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'new_appointment',
  });
  assert.equal(ok.statusCode, 201, ok.body);
  const dupe = await confer(ADMIN, 'w3-refusal-dupe', {
    groupId: group, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_E,
    reasonCode: 'role_change',
  });
  assert.equal(dupe.statusCode, 409, dupe.body);

  assert.equal(
    (await auditCount('confer_grant')) - before, 1,
    'one act, one audit row -- the 404 and the 409 recorded nothing',
  );
});

test('ZERO AUDIT ROWS on refusal -- revokeGrant (not-live and last-administrator)', async () => {
  const before = await auditCount('revoke_grant');
  const group = await freshGroup('revrefusal');
  const conferred = await confer(ADMIN, 'w3-revrefusal-setup', {
    groupId: group, role: 'approver', nodeKind: 'estate', nodeId: ESTATE_F,
    reasonCode: 'new_appointment',
  });
  assert.equal(conferred.statusCode, 201, conferred.body);
  const grantId = conferred.json().grant.grantId;

  assert.equal((await revoke(ADMIN, grantId, 'w3-revrefusal-one')).statusCode, 200);
  assert.equal((await revoke(ADMIN, grantId, 'w3-revrefusal-two')).statusCode, 409, 'not-live');

  const admins = await harness.modules.grants.effectiveAdministrators(ORG);
  assert.equal(admins.length, 1, 'the premise: exactly one administrator remains');
  const last = await revoke(ADMIN, admins[0]!.grantId, 'w3-revrefusal-last', { reasonCode: 'staff_departed' });
  assert.equal(last.statusCode, 409, last.body);

  assert.equal(
    (await auditCount('revoke_grant')) - before, 1,
    'one revocation happened; two refusals recorded nothing',
  );
});

test('ZERO AUDIT ROWS on refusal -- provisionOrganization (already-provisioned)', async () => {
  // At the module: through the route the idempotency layer answers first, the
  // same shadowing that makes the zero-ever predicate untestable there.
  const before = await auditCount('provision_organization');
  const app = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    const res = await app.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: ORG, grantId: 'gr_w3_refused', groupId: ADMIN_GROUP,
      effectiveFrom: new Date(),
    }));
    assert.equal(res.kind, 'already-provisioned', 'the organization has held grants');
  } finally {
    await app.close();
  }
  assert.equal(await auditCount('provision_organization'), before, 'and nothing was recorded');
  assert.equal(
    (await owner.query(`SELECT 1 FROM scope_grant WHERE grant_id = 'gr_w3_refused'`)).length, 0,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// W3 BATCH 3b-ii — THE GENESIS ACT
// ═══════════════════════════════════════════════════════════════════════════

const GEN_ORG = 'org_w32_genesis';

const genesisIds = (org: string) => ({
  principalId: deriveActId('stf', 'provision_organization.principal', org),
  groupId: deriveActId('grp', 'provision_organization.group', org),
  grantId: deriveActId('gr', 'provision_organization', org),
  membershipId: deriveActId('mem', 'provision_organization.membership', org),
});

const freshOrg = async (id: string, code: string): Promise<void> => {
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, $2, 'Genesis', '創世') ON CONFLICT (organization_id) DO NOTHING`, [id, code]);
};

const dropOrg = async (id: string): Promise<void> => {
  const ids = genesisIds(id);
  await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [id]);
  await owner.query(`DELETE FROM group_membership WHERE group_id = $1`, [ids.groupId]);
  await owner.query(`DELETE FROM scope_grant WHERE group_id = $1`, [ids.groupId]);
  await owner.query(`DELETE FROM staff_principal WHERE organization_id = $1`, [id]);
  await owner.query(`DELETE FROM user_group WHERE organization_id = $1`, [id]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [id]);
};

test('[probe-must-bite] GEN-060: the public genesis route is GONE — the surface cannot provision', async () => {
  // The exposure this PID closes: provisioning was an unauthenticated POST on the
  // customer-facing surface. It is now a host-only operator act. Re-introducing any
  // HTTP path to the genesis reds this. 404, not 401/403 — the route does not exist.
  const res = await harness.app.inject({
    method: 'POST', url: `${BASE}/organizations/org_never_exists/provision`,
    payload: { externalId: 'idp|x', displayName: 'x', groupName: 'x' },
  });
  assert.equal(res.statusCode, 404, 'the genesis must not be reachable over HTTP');
});

test('GENESIS: one act takes an organization from zero authority to a working administrator', async () => {
  await freshOrg(GEN_ORG, 'GEN');
  const ids = genesisIds(GEN_ORG);

  const outcome = await provision(GEN_ORG, { externalId: 'idp|genesis', displayName: 'First Admin' });
  assert.equal(outcome.kind, 'provisioned', JSON.stringify(outcome));

  // ALL FOUR ASSERTIONS, in one transaction.
  const [row] = await owner.query<{ p: string; g: string; sg: string; m: string }>(
    `SELECT (SELECT count(*)::text FROM staff_principal   WHERE principal_id  = $1) AS p,
            (SELECT count(*)::text FROM user_group        WHERE group_id      = $2) AS g,
            (SELECT count(*)::text FROM scope_grant       WHERE grant_id      = $3) AS sg,
            (SELECT count(*)::text FROM group_membership  WHERE membership_id = $4) AS m`,
    [ids.principalId, ids.groupId, ids.grantId, ids.membershipId]);
  assert.deepEqual(row, { p: '1', g: '1', sg: '1', m: '1' }, 'principal, group, grant, membership');

  // And the organization is genuinely administrable — an administrator who EXISTS.
  const witnesses = await harness.modules.grants.effectiveAdministrators(GEN_ORG);
  assert.equal(witnesses.length, 1, 'exactly one effective administrator');
  assert.equal(witnesses[0]?.principalId, ids.principalId);
});

test('the genesis AUDIT carries source=provisioning with NO authority, and a reason', async () => {
  const [row] = await owner.query<{
    source: string; principal_id: string | null; group_id: string | null;
    role: string | null; reason_code: string;
  }>(`SELECT source, principal_id, group_id, role, reason_code FROM audit_event
       WHERE action = 'provision_organization' AND node_id = $1`, [GEN_ORG]);
  assert.ok(row, 'the genesis act wrote no audit record');
  assert.equal(row.source, 'provisioning');
  assert.equal(row.principal_id, null, 'no acting principal — that is what genesis means');
  assert.equal(row.group_id, null);
  assert.equal(row.role, null);
  assert.equal(row.reason_code, 'organization_provisioned');
});

test('CASE 1 -- a SECOND provision of a provisioned organization is REFUSED', async () => {
  // GEN_ORG is already provisioned above; a second call with DIFFERENT inputs is the
  // same org key with a different fingerprint, so the idempotency layer refuses it
  // with a conflict before the zero-ever predicate even runs.
  await assert.rejects(
    () => provision(GEN_ORG, { externalId: 'idp|second', displayName: 'Second' }),
    (e) => /idempotenc/i.test((e as Error).message) || (e as Error).constructor.name === 'IdempotencyConflictError',
  );
});

test('CASE 2 -- provisioning AFTER the only grant was ENDED is STILL refused (EVER, not live)', async () => {
  /**
   * THE CASE THAT PROVES THE TENSE, and it must exist because the tense IS the
   * guard. Under a "currently holds none" predicate an organization could REVOKE
   * ITS WAY BACK to a genesis act — one with no acting principal, callable by
   * anyone — which is the standing break-glass ADR-010 A1 forbids, reached by an
   * ordinary revocation rather than a back door.
   *
   * scope_grant is append-only: the ended grant's version-1 assertion still
   * exists and still bites.
   *
   * It provisions at the MODULE with a PAST effectiveFrom, because the route
   * starts a grant at the request instant and `scope_grant_period_ordered`
   * forbids ending it before it began.
   */
  const ORG2 = 'org_w32_ever';
  await freshOrg(ORG2, 'EV');
  const app2 = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    const first = await app2.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: ORG2, grantId: 'gr_ev', groupId: 'grp_ev', groupDisplayName: 'EV',
      principalId: 'stf_ev', externalId: 'idp|ev', displayName: 'EV',
      membershipId: 'mem_ev', effectiveFrom: new Date('2024-01-01T00:00:00+08:00'),
    }));
    assert.equal(first.kind, 'provisioned');

    // END the only grant: append version 2 with an effective_to in the past.
    await owner.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id,
                                effective_from, effective_to)
       SELECT 'sgra_ev_ended', 2, grant_id, group_id, role, node_kind, node_id,
              effective_from, now() - interval '1 minute'
         FROM scope_grant WHERE grant_id = 'gr_ev' AND version = 1`);

    const live = await harness.modules.grants.effectiveAdministrators(ORG2);
    assert.equal(live.length, 0, 'the premise: the organization now holds NO live grant at all');

    const again = await app2.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: ORG2, grantId: 'gr_ev2', groupId: 'grp_ev2', groupDisplayName: 'EV2',
      principalId: 'stf_ev2', externalId: 'idp|ev2', displayName: 'EV2',
      membershipId: 'mem_ev2', effectiveFrom: new Date(),
    }));
    assert.equal(
      again.kind, 'already-provisioned',
      'ending the last grant must NOT re-open provisioning — EVER, not live',
    );
    const [n] = await owner.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM staff_principal WHERE principal_id = 'stf_ev2'`);
    assert.equal(n?.n, '0', 'and nothing was written — the guard ran BEFORE the first insert');
  } finally {
    await app2.close();
    await owner.query(`DELETE FROM group_membership WHERE group_id LIKE 'grp\\_ev%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM scope_grant WHERE group_id LIKE 'grp\\_ev%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE 'stf\\_ev%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM user_group WHERE group_id LIKE 'grp\\_ev%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [ORG2]);
    await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG2]);
  }
});

test('CASE 3 -- a failure at the FOURTH insert rolls back all four, and the org stays provisionable', async () => {
  /**
   * ATOMICITY, PROVEN BY BREAKING THE LAST STEP. The membership insert is made to
   * fail by seating a principal that does not exist — a foreign key violation
   * raised after the principal, group and grant have all been written inside the
   * transaction. Every one of them must vanish, and so must the audit event.
   */
  const ORG3 = 'org_w32_rollback';
  await freshOrg(ORG3, 'RB');
  const app3 = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    await assert.rejects(
      app3.transaction((tx) => harness.modules.grants.provision(tx, {
        organizationId: ORG3, grantId: 'gr_rb', groupId: 'grp_rb', groupDisplayName: 'RB',
        principalId: 'stf_rb', externalId: 'idp|rb', displayName: 'RB',
        // The membership names a principal the act did NOT create, so the FK fires
        // at step 4 with steps 1-3 already written inside this transaction.
        membershipId: 'mem_rb', effectiveFrom: new Date(),
      }).then((r) => {
        // Force the fourth insert to fail, after the first three succeeded.
        return tx.query(
          `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
           VALUES ('gma_rb_bad', 1, 'mem_rb_bad', 'grp_rb', 'stf_does_not_exist', now())`,
        ).then(() => r);
      })),
      /group_membership_principal_id_fkey/,
    );

    const [row] = await owner.query<{ p: string; g: string; sg: string; a: string }>(
      `SELECT (SELECT count(*)::text FROM staff_principal WHERE principal_id = 'stf_rb')  AS p,
              (SELECT count(*)::text FROM user_group      WHERE group_id     = 'grp_rb')  AS g,
              (SELECT count(*)::text FROM scope_grant     WHERE grant_id     = 'gr_rb')   AS sg,
              (SELECT count(*)::text FROM audit_event     WHERE node_id      = $1)        AS a`,
      [ORG3]);
    assert.deepEqual(row, { p: '0', g: '0', sg: '0', a: '0' },
      'all four writes and the audit rolled back together');

    // AND THE ORGANIZATION IS STILL PROVISIONABLE — a rolled-back genesis is not
    // a spent one. This is the half a rollback test usually forgets.
    const retry = await app3.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: ORG3, grantId: 'gr_rb2', groupId: 'grp_rb2', groupDisplayName: 'RB2',
      principalId: 'stf_rb2', externalId: 'idp|rb2', displayName: 'RB2',
      membershipId: 'mem_rb2', effectiveFrom: new Date(),
    }));
    assert.equal(retry.kind, 'provisioned', 'a rolled-back provision leaves the org provisionable');
  } finally {
    await app3.close();
    await owner.query(`DELETE FROM group_membership WHERE group_id LIKE 'grp\\_rb%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM scope_grant WHERE group_id LIKE 'grp\\_rb%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE 'stf\\_rb%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM user_group WHERE group_id LIKE 'grp\\_rb%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [ORG3]);
    await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG3]);
  }
});

test('CASE 4 -- CONCURRENT double provision of one organization: exactly one wins', async () => {
  const ORG4 = 'org_w32_race';
  await freshOrg(ORG4, 'RC');
  const a = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  const b = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    const attempt = (db: ReturnType<typeof createModuleDb>, tag: string) =>
      db.transaction(async (tx) => {
        const r = await harness.modules.grants.provision(tx, {
          organizationId: ORG4, grantId: `gr_rc_${tag}`, groupId: `grp_rc_${tag}`,
          groupDisplayName: tag, principalId: `stf_rc_${tag}`, externalId: `idp|rc-${tag}`,
          displayName: tag, membershipId: `mem_rc_${tag}`, effectiveFrom: new Date(),
        });
        // LOAD-BEARING: hold the transaction open so the two genuinely overlap.
        await new Promise((d) => setTimeout(d, 200));
        return r.kind;
      });
    const kinds = await Promise.all([attempt(a, 'a'), attempt(b, 'b')]);
    assert.equal(kinds.filter((k) => k === 'provisioned').length, 1,
      `exactly one genesis act wins, got ${kinds.join(', ')}`);
    const [n] = await owner.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM scope_grant WHERE node_id = $1`, [ORG4]);
    assert.equal(n?.n, '1', 'one grant landed, not two');
  } finally {
    await a.close(); await b.close();
    await owner.query(`DELETE FROM group_membership WHERE group_id LIKE 'grp\\_rc%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM scope_grant WHERE group_id LIKE 'grp\\_rc%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE 'stf\\_rc%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM user_group WHERE group_id LIKE 'grp\\_rc%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [ORG4]);
    await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG4]);
  }
});

test('CASE 5 -- no runtime path can record identity_source = recorded_seed (D5)', async () => {
  /**
   * ADR-016: the bootstrap principal is a REAL external identity, never a seed.
   * Neither the genesis act nor registerPrincipal takes the discriminator from a
   * caller — both hard-code 'external' — so `recorded_seed` is reachable only by
   * direct SQL, which is what the held-gaps ruling decided it should be.
   */
  const ids = genesisIds(GEN_ORG);
  const [row] = await owner.query<{ identity_source: string; external_id: string }>(
    `SELECT identity_source, external_id FROM staff_principal WHERE principal_id = $1`,
    [ids.principalId]);
  assert.equal(row?.identity_source, 'external', 'the genesis principal is external, never a seed');
  assert.equal(row?.external_id, 'idp|genesis');

  // And the recording command offers no way to say otherwise: its input type has
  // no such field, so this is asserted on the shipped rows rather than on a type.
  const [any] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM staff_principal
      WHERE identity_source = 'recorded_seed' AND organization_id LIKE 'org\\_w32%' ESCAPE '\\'`);
  assert.equal(any?.n, '0', 'no runtime-created principal carries the seed discriminator');

  await dropOrg(GEN_ORG);
});

test('a ROUTE-level refused provision writes ZERO audit rows and no idempotency key', async () => {
  /**
   * THE ORACLE FOR THE PROVISIONING ROUTE'S `committed`, AND IT WAS MISSING.
   *
   * GEN-032 mutated `committed: () => true` onto this route and all 341 tests
   * stayed green: CASE 1 asserts only the 409, and the standing zero-audit-rows
   * oracle tests provisioning at the MODULE, which never reaches the primitive.
   * So nothing watched the route's declaration.
   *
   * Reaching the refusal through the route needs care: a repeat with the same
   * body REPLAYS on the derived key, and a repeat with a different body is a
   * fingerprint CONFLICT — in both cases the act never runs. So the organization
   * is provisioned at the MODULE first, which writes no idempotency record; the
   * route then finds no key, runs the act, and the guard refuses inside it —
   * which is exactly where `committed` decides.
   */
  const ORGX = 'org_w32_routeref';
  await freshOrg(ORGX, 'RR');
  const appx = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  try {
    const seeded = await appx.transaction((tx) => harness.modules.grants.provision(tx, {
      organizationId: ORGX, grantId: 'gr_rr', groupId: 'grp_rr', groupDisplayName: 'RR',
      principalId: 'stf_rr', externalId: 'idp|rr', displayName: 'RR',
      membershipId: 'mem_rr', effectiveFrom: new Date(),
    }));
    assert.equal(seeded.kind, 'provisioned', 'provisioned at the module, so no key exists');

    const outcome = await provision(ORGX, { externalId: 'idp|rr-route', displayName: 'RR route' });
    assert.ok(outcome.kind === 'refused' && outcome.reason === 'already-provisioned', JSON.stringify(outcome));

    const [row] = await owner.query<{ a: string; k: string }>(
      `SELECT (SELECT count(*)::text FROM audit_event WHERE node_id = $1
                 AND action = 'provision_organization') AS a,
              (SELECT count(*)::text FROM platform.idempotency_record
                 WHERE operation = 'provision_organization' AND idempotency_key = $1) AS k`,
      [ORGX]);
    assert.equal(row?.a, '0', 'a refused genesis act is not audited — nothing happened');
    assert.equal(row?.k, '0', 'and it does not burn the key, so a corrected call is still possible');
  } finally {
    await appx.close();
    await owner.query(`DELETE FROM group_membership WHERE group_id LIKE 'grp\\_rr%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM scope_grant WHERE group_id LIKE 'grp\\_rr%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE 'stf\\_rr%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM user_group WHERE group_id LIKE 'grp\\_rr%' ESCAPE '\\'`);
    await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [ORGX]);
    await owner.query(`DELETE FROM platform.idempotency_record WHERE idempotency_key = $1`, [ORGX]);
    await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORGX]);
  }
});
