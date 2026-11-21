/**
 * W3 batch iii -- the delegation floors (ADR-017), through the ROUTES.
 *
 * YOU CANNOT CAUSE AUTHORITY YOU CANNOT YOURSELF CONFER. Adding a member hands
 * them the union of the group's live grants in one act, so the floor is G-2
 * lifted to that SET -- a conjunction, never a subset -- and an EMPTY set falls
 * back to the organization node rather than passing vacuously.
 *
 * Driven through the routes, because that is where the floor is composed: the
 * module is handed a node set and cannot tell whether it was filtered correctly.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig, deriveActId } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { provisionForTest } from '../../apps/api/dist/testing/provision-organization.js';

const BASE = '/api/management-web/v0';
const ORG = 'org_w33';
const EST_A = 'est_w33_a';
const EST_B = 'est_w33_b';

let harness: Harness;
let owner: ReturnType<typeof createModuleDb>;

/** The genesis administrator: created by the provisioning act, not fixtured. */
const ORG_ADMIN = deriveActId('stf', 'provision_organization.principal', ORG);
const ORG_ADMIN_GROUP = deriveActId('grp', 'provision_organization.group', ORG);

const auth = (p: string) => ({ authorization: `Bearer ${harness.modules.staffAuth.issue(p)}` });

const addMember = (caller: string, groupId: string, principalId: string, key: string,
                   reasonCode: string | undefined = 'new_appointment') =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/groups/${groupId}/members`,
    headers: { ...auth(caller), 'idempotency-key': key },
    payload: reasonCode === undefined ? { principalId } : { principalId, reasonCode },
  });

const removeMember = (caller: string, membershipId: string, key: string) =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/memberships/${membershipId}/remove`,
    headers: { ...auth(caller), 'idempotency-key': key },
    payload: { reasonCode: 'staff_departed' },
  });

const registerPrincipal = (caller: string, externalId: string, displayName = 'Someone') =>
  harness.app.inject({
    method: 'POST', url: `${BASE}/principals`,
    headers: auth(caller),
    payload: { organizationId: ORG, externalId, displayName },
  });

/** A group + a live grant at a node, through the owner handle: fixture, not subject. */
const groupWithGrants = async (tag: string, nodes: readonly string[], role = 'estate_staff') => {
  const gid = `grp_w33_${tag}`;
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [gid, ORG, tag]);
  for (const [i, node] of nodes.entries()) {
    await owner.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_w33_' || $1, 1, 'gr_w33_' || $1, $2, $3, $4, $5, now() - interval '1 day')
       ON CONFLICT (grant_id, version) DO NOTHING`,
      [`${tag}_${i}`, gid, role, node.split(':')[0], node.split(':')[1]]);
  }
  return gid;
};

/** A principal, and optionally an administrator grant + membership at a node. */
const person = async (tag: string, adminAt?: string) => {
  const pid = `stf_w33_${tag}`;
  await owner.query(
    `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source, external_id)
     VALUES ($1, $2, $3, 'external', $4) ON CONFLICT (principal_id) DO NOTHING`,
    [pid, ORG, tag, `idp|w33-${tag}`]);
  if (adminAt !== undefined) {
    const gid = `grp_w33_adm_${tag}`;
    await owner.query(
      `INSERT INTO user_group (group_id, organization_id, display_name)
       VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [gid, ORG, `adm ${tag}`]);
    await owner.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_w33_adm_' || $1, 1, 'gr_w33_adm_' || $1, $2, 'grant_administrator', $3, $4, now() - interval '1 day')
       ON CONFLICT (grant_id, version) DO NOTHING`,
      [tag, gid, adminAt.split(':')[0], adminAt.split(':')[1]]);
    await owner.query(
      `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
       VALUES ('gma_w33_adm_' || $1, 1, 'mem_w33_adm_' || $1, $2, $3, now() - interval '1 day')
       ON CONFLICT (membership_id, version) DO NOTHING`, [tag, gid, pid]);
  }
  return pid;
};

test.before(async () => {
  harness = await startHarness();
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'W33', 'W33', 'W33') ON CONFLICT (organization_id) DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO property.estate (estate_id, organization_id, name_en, name_zh_hant)
     VALUES ($1, $3, 'A', 'A'), ($2, $3, 'B', 'B') ON CONFLICT (estate_id) DO NOTHING`,
    [EST_A, EST_B, ORG]);

  // The organization is brought into existence by the GENESIS ACT (GEN-060: no
  // longer an HTTP route — the same act the operator CLI calls, run here from the
  // harness's modules), so the org administrator is a real one rather than a fixture.
  const outcome = await provisionForTest(harness, {
    organizationId: ORG, reasonCode: 'organization_provisioned', externalId: 'idp|w33-genesis',
    displayName: 'Genesis Admin', groupName: 'Org administrators',
  });
  assert.equal(outcome.kind, 'provisioned', JSON.stringify(outcome));
});

test.after(async () => {
  /**
   * SCOPED BY ORGANIZATION, NOT BY PREFIX -- this file owns a whole one.
   *
   * The acts under test DERIVE their ids (`mem_<digest>`), so a prefix pattern
   * cannot reach them: a `mem_w33_%` delete left route-created memberships
   * behind and the foreign key caught it. The organization is the boundary these
   * rows actually share, so it is the boundary the teardown uses. Ordered by
   * dependency: memberships and grants reference groups; groups and principals
   * reference the organization.
   */
  await owner.query(`DELETE FROM audit_event WHERE node_id = $1`, [ORG]);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation IN
                     ('add_membership','remove_membership','register_principal','provision_organization')`);
  await owner.query(
    `DELETE FROM group_membership WHERE group_id IN
       (SELECT group_id FROM user_group WHERE organization_id = $1)`, [ORG]);
  await owner.query(
    `DELETE FROM scope_grant WHERE group_id IN
       (SELECT group_id FROM user_group WHERE organization_id = $1)`, [ORG]);
  await owner.query(`DELETE FROM staff_principal WHERE organization_id = $1`, [ORG]);
  await owner.query(`DELETE FROM user_group WHERE organization_id = $1`, [ORG]);
  await owner.query(`DELETE FROM property.estate WHERE organization_id = $1`, [ORG]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG]);
  await owner.close();
  await harness.close();
});

// ────────────────────────────────────────── CASE 1: the escalation this stops

test('CASE 1 -- an administrator at ONE BUILDING cannot add to a group holding org authority', async () => {
  /**
   * THE ESCALATION THE FLOOR EXISTS FOR. Without the lift, an administrator at a
   * building could add themselves to the group that holds grant_administrator at
   * the ORGANIZATION and inherit everything, because the old per-grant check
   * asked only whether they administered *a* node.
   */
  const attacker = await person('attacker', `estate:${EST_A}`);
  const orgGroup = await groupWithGrants('orgauth', [`organization:${ORG}`], 'grant_administrator');

  const refused = await addMember(attacker, orgGroup, attacker, 'w33-escalate-key');
  assert.equal(refused.statusCode, 403, refused.body);
  assert.match(refused.json().type, /insufficient-administration-scope/);

  // The genesis org administrator DOES cover it.
  const allowed = await addMember(ORG_ADMIN, orgGroup, attacker, 'w33-escalate-ok');
  assert.equal(allowed.statusCode, 201, allowed.body);
});

test('CASE 2 -- a group holding grants at A and B needs an administrator covering BOTH', async () => {
  const onlyA = await person('onlya', `estate:${EST_A}`);
  const target = await person('target2');
  const group = await groupWithGrants('ab', [`estate:${EST_A}`, `estate:${EST_B}`]);

  const refused = await addMember(onlyA, group, target, 'w33-multi-refused');
  assert.equal(refused.statusCode, 403, 'covering A but not B is not partial authority — it is none');

  const allowed = await addMember(ORG_ADMIN, group, target, 'w33-multi-allowed');
  assert.equal(allowed.statusCode, 201, allowed.body);
});

test('CASE 3 -- an EMPTY group requires the ORGANIZATION node, not a vacuous pass', async () => {
  /**
   * A conjunction over no nodes is vacuously TRUE, which would admit anybody —
   * and that is PRE-STAGING, not a no-op: the caller inherits whatever a
   * legitimate administrator later confers, and the conferrer's own G-2 looks at
   * the node and never enumerates members.
   */
  const buildingAdmin = await person('empty_caller', `estate:${EST_A}`);
  const target = await person('target3');
  const empty = await groupWithGrants('empty', []);

  const refused = await addMember(buildingAdmin, empty, target, 'w33-empty-refused');
  assert.equal(refused.statusCode, 403, 'a grantless group is the strongest floor, not the weakest');

  const allowed = await addMember(ORG_ADMIN, empty, target, 'w33-empty-allowed');
  assert.equal(allowed.statusCode, 201, allowed.body);
});

// ─────────────────────────────────── CASE 4/5: removeMembership's two guards

test('CASE 4 -- removing the LAST effective administrator is refused', async () => {
  const membershipId = deriveActId('mem', 'provision_organization.membership', ORG);
  const witnesses = await harness.modules.grants.effectiveAdministrators(ORG);
  const orgAdminWitnesses = witnesses.filter((w) => w.principalId === ORG_ADMIN);
  assert.ok(orgAdminWitnesses.length > 0, 'the premise: the genesis administrator is effective');

  // Remove every OTHER administrator first so the genesis one is the last.
  for (const w of witnesses.filter((x) => x.principalId !== ORG_ADMIN)) {
    await removeMember(ORG_ADMIN, w.membershipId, `w33-clear-${w.membershipId.slice(-8)}`);
  }
  const remaining = await harness.modules.grants.effectiveAdministrators(ORG);
  assert.equal(new Set(remaining.map((w) => w.principalId)).size, 1, 'exactly one person remains');

  const refused = await removeMember(ORG_ADMIN, membershipId, 'w33-last-admin');
  assert.equal(refused.statusCode, 409, refused.body);
  assert.match(refused.json().type, /last-grant-administrator/);
});

test('CASE 5 -- a caller who cannot administer the group cannot remove from it', async () => {
  const outsider = await person('outsider', `estate:${EST_B}`);
  const target = await person('target5');
  const group = await groupWithGrants('remove_floor', [`estate:${EST_A}`]);
  const seated = await addMember(ORG_ADMIN, group, target, 'w33-rf-seat');
  assert.equal(seated.statusCode, 201, seated.body);
  const membershipId = seated.json().membership.membershipId;

  const refused = await removeMember(outsider, membershipId, 'w33-rf-refused');
  assert.equal(refused.statusCode, 403, refused.body);
  assert.match(refused.json().type, /insufficient-administration-scope/);
});

// ───────────────────────────────────────── CASE 6: registerPrincipal's floor

test('CASE 6 -- standalone registerPrincipal requires an ORG administrator, and emits no seed row', async () => {
  const buildingAdmin = await person('reg_caller', `estate:${EST_A}`);

  const refused = await registerPrincipal(buildingAdmin, 'idp|w33-refused');
  assert.equal(refused.statusCode, 403, refused.body);

  const allowed = await registerPrincipal(ORG_ADMIN, 'idp|w33-allowed', 'New Starter');
  assert.equal(allowed.statusCode, 201, allowed.body);

  const [row] = await owner.query<{ identity_source: string; external_id: string }>(
    `SELECT identity_source, external_id FROM staff_principal WHERE external_id = 'idp|w33-allowed'`);
  assert.equal(row?.identity_source, 'external', 'no runtime path can emit a seed row (GEN-031 D5)');
});

// ───────────────────────────────────────────────────── CASE 7/8: D4 and D6

test('CASE 7 -- every floor refusal is a DOMAIN error, never a 500', async () => {
  const outsider = await person('d4', `estate:${EST_B}`);
  const group = await groupWithGrants('d4', [`estate:${EST_A}`]);
  const target = await person('d4_target');

  for (const res of [
    await addMember(outsider, group, target, 'w33-d4-add'),
    await registerPrincipal(outsider, 'idp|w33-d4'),
  ]) {
    assert.notEqual(res.statusCode, 500, res.body);
    assert.equal(res.statusCode, 403);
    assert.match(res.json().type, /^https:\/\/pemo\.local\/problems\//, 'a declared Problem type');
    assert.equal(res.json().retryable, false, 'a decision, not a transient condition');
  }
});

test('CASE 8 -- client-key retry replays; a NEW key after removal re-instates', async () => {
  const target = await person('reinstate');
  const group = await groupWithGrants('reinstate', [`estate:${EST_A}`]);

  const first = await addMember(ORG_ADMIN, group, target, 'w33-reinstate-1');
  assert.equal(first.statusCode, 201, first.body);
  const membershipId = first.json().membership.membershipId;

  // SAME key -> replay, no second assertion.
  const retry = await addMember(ORG_ADMIN, group, target, 'w33-reinstate-1');
  assert.equal(retry.statusCode, 200, 'a replay is not a creation');
  assert.equal(retry.json().replayed, true);
  const [n1] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM group_membership WHERE membership_id = $1`, [membershipId]);
  assert.equal(n1?.n, '1', 'no second assertion');

  // Remove, then re-add with a NEW key: a re-instatement is a NEW instance, and a
  // DERIVED (group, principal) key would have wrongly collapsed it against the
  // first membership. This is why the stance is client-key.
  const removed = await removeMember(ORG_ADMIN, membershipId, 'w33-reinstate-remove');
  assert.equal(removed.statusCode, 200, removed.body);

  const again = await addMember(ORG_ADMIN, group, target, 'w33-reinstate-2');
  assert.equal(again.statusCode, 201, 're-instatement must be possible');
  assert.notEqual(again.json().membership.membershipId, membershipId, 'a NEW instance');
});

test('CASE 8b -- registerPrincipal derived-key retry replays and does not violate the index', async () => {
  const first = await registerPrincipal(ORG_ADMIN, 'idp|w33-derived', 'Derived');
  assert.equal(first.statusCode, 201, first.body);
  const principalId = first.json().principal.principalId;

  const retry = await registerPrincipal(ORG_ADMIN, 'idp|w33-derived', 'Derived');
  assert.equal(retry.statusCode, 200, 'the derived key replays');
  assert.equal(retry.json().principal.principalId, principalId);

  const [n] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM staff_principal WHERE external_id = 'idp|w33-derived'`);
  assert.equal(n?.n, '1', 'recorded once — the per-org unique index is the backstop, not the mechanism');
});

test('I6 -- removeMembership echoes the PAIR it acted on, not empty strings', async () => {
  /**
   * The response was unreadable back: it named the membership instance and
   * returned empty strings for the group and the person it had just separated.
   * The command resolves the instance anyway, so carrying the pair costs nothing.
   */
  const target = await person('echo');
  const group = await groupWithGrants('echo', [`estate:${EST_A}`]);
  const seated = await addMember(ORG_ADMIN, group, target, 'w33-echo-seat');
  assert.equal(seated.statusCode, 201, seated.body);
  const membershipId = seated.json().membership.membershipId;

  const removed = await removeMember(ORG_ADMIN, membershipId, 'w33-echo-remove');
  assert.equal(removed.statusCode, 200, removed.body);
  assert.equal(removed.json().membership.groupId, group, 'the group acted on');
  assert.equal(removed.json().membership.principalId, target, 'and the person');
  assert.equal(removed.json().membership.version, 2);

  // A REPLAY re-derives the same body by READING THE ACT (ADR-015 D4), rather
  // than echoing the request back — so the pair survives the retry too.
  const replay = await removeMember(ORG_ADMIN, membershipId, 'w33-echo-remove');
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json().replayed, true);
  assert.equal(replay.json().membership.groupId, group, 're-derived, not echoed');
  assert.equal(replay.json().membership.principalId, target);
});
