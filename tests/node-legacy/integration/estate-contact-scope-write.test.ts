/**
 * The THIRD scope-only write — and the one that finally proves the in-query
 * filter AS THE GATE.
 *
 * GEN-013 could not: its act was scoped by a unit, Property Core's fact, so the
 * writing module could not resolve it and the authorizing-grant lookup had to
 * decide. The filter was real, shadowed, and unprovable at the route.
 *
 * Here the scope node is an ESTATE and `property.estate` is the writing module's
 * OWN table, so `findEstateInScope` resolves and filters in ONE query and that
 * query IS the decision. Nothing runs before it. So a mutation to the filter must
 * turn this suite red AT THE ROUTE — and it does, which is the whole point.
 *
 * Audit rows are cleared before the groups they reference: `access.audit_event`
 * pins `access.user_group`, which the seeds replace.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const BASE = '/api/management-web/v0';

/** estate_staff at ESTATE est_wing_fu_garden. */
const MANAGER = 'stf_wfg_manager';
/** estate_staff at LOCATION loc_wfg_clubhouse — expands to no estate at all. */
const COUNTER = 'stf_wfg_counter';

const ORG = 'org_wingfu_holdings';
const IN_SCOPE = 'est_wing_fu_garden';
/** SAME organization, different estate — the sharpest negative. */
const OUT_OF_SCOPE = 'est_tsz_wan_court';

/**
 * ONLY the rows this file created.
 *
 * An earlier version deleted `contact_id LIKE 'ctc_%'` and destroyed the SEEDED
 * contacts, whose ids are `ctc_wfg_office`, `ctc_wfg_emergency`, `ctc_twc_office`
 * — the same prefix the route generates. It surfaced as a domain test failing to
 * see a conflict that should have existed, which reads as a defect in the code
 * under test rather than in the fixture. The route mints `ctc_<uuid>`, so the
 * UUID shape is what distinguishes a test row from a seeded one.
 */
const TEST_ROWS = '^ctc_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

let harness: Harness;

const staffAuth = (principalId: string) => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

const BODY = { contactKind: 'emergency', nameEn: 'Night duty', nameZhHant: '夜間值班', telephone: '+852 2000 0000' };

const add = (principalId: string, estateId: string = IN_SCOPE, body: Record<string, unknown> = BODY) =>
  harness.app.inject({
    method: 'POST',
    url: `${BASE}/estates/${estateId}/contacts`,
    headers: staffAuth(principalId),
    payload: body,
  });

const auditRows = async (): Promise<
  { audit_id: string; principal_id: string; group_id: string; role: string; node_kind: string; node_id: string; target_id: string; occurred_at: Date }[]
> =>
  harness.admin.query(
    `SELECT audit_id, principal_id, group_id, role, node_kind, node_id, target_id, occurred_at
       FROM access.audit_event WHERE action = 'add_estate_contact' ORDER BY recorded_at`);

const written = async (): Promise<number> => {
  const [r] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM property.estate_contact WHERE contact_id ~ $1`, [TEST_ROWS]);
  return Number(r?.n ?? -1);
};

const clearWrites = async (): Promise<void> => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE action = 'add_estate_contact'`);
  await harness.admin.query(`DELETE FROM property.estate_contact WHERE contact_id ~ $1`, [TEST_ROWS]);
};

const addGrant = async (group: string, grantId: string, kind: string, node: string): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [group, ORG, `GEN-014 ${group}`]);
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1, $2, $3, '2024-01-01T00:00:00Z') ON CONFLICT DO NOTHING`,
    [`mem_gen014_${group}`, group, MANAGER]);
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1, $2, 'estate_staff', $3, $4, '2024-01-01T00:00:00Z')`, [grantId, group, kind, node]);
};

const dropTestGroups = async (): Promise<void> => {
  await clearWrites(); // audit rows pin user_group — clear them first.
  await harness.admin.query(`DELETE FROM access.scope_grant WHERE grant_id LIKE 'gnt\\_gen014\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.group_membership WHERE membership_id LIKE 'mem\\_gen014\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.user_group WHERE group_id LIKE 'grp\\_gen014\\_%' ESCAPE '\\'`);
};

test.before(async () => { harness = await startHarness(); await clearWrites(); });
test.after(async () => { await dropTestGroups(); await harness.close(); });
test.beforeEach(clearWrites);

// ─────────────────────────────────────────────────────────────────── the gate
test('THE GATE — a principal whose grant covers the estate adds the contact', async () => {
  const response = await add(MANAGER);
  assert.equal(response.statusCode, 201, response.body);
  const payload = JSON.parse(response.body) as { estateId: string; contact: { contactId: string; contactKind: string } };
  assert.equal(payload.estateId, IN_SCOPE);
  assert.match(payload.contact.contactId, /^ctc_/);
  assert.equal(payload.contact.contactKind, 'emergency');
  assert.equal(await written(), 1);
});

test('THE GATE, RED — an estate in the SAME organization but outside the grant is ABSENT', async () => {
  // THIS is the assertion that makes the in-query filter provable: on this
  // surface nothing runs before the filtered lookup, so the 404 below is the
  // query's answer and no other layer's.
  const response = await add(MANAGER, OUT_OF_SCOPE);
  assert.equal(response.statusCode, 404, response.body);
  assert.match(JSON.parse(response.body).type, /estate-not-found/);
  assert.equal(await written(), 0, 'an out-of-scope act persisted');
  assert.equal((await auditRows()).length, 0, 'an out-of-scope act was audited');
});

test('THE GATE, RED — a principal whose grants expand to NO estate cannot act', async () => {
  const response = await add(COUNTER);
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(await written(), 0);
});

test('THE GATE, RED — REMOVE the grant and the same principal loses the same estate', async () => {
  const before = await add(MANAGER);
  assert.equal(before.statusCode, 201, 'precondition: the write works with the grant');
  await clearWrites();
  await harness.admin.query(
    `UPDATE access.scope_grant SET effective_to = now() - interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  try {
    const after = await add(MANAGER);
    assert.equal(after.statusCode, 404, 'the grant was removed and the act still resolved');
    assert.equal(await written(), 0);
  } finally {
    await harness.admin.query(
      `UPDATE access.scope_grant SET effective_to = NULL WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  }
});

test('THE FILTER IS THE GATE — at the module, the query returns nothing for an estate outside the set', async () => {
  // The decision, tested where it is made. The route test above already bites,
  // because nothing shadows the filter here — this pins it at the layer itself
  // so a later refactor that reintroduces a shadowing layer cannot hide it.
  const admitted = await harness.modules.estateContactWrites.findEstateInScope(IN_SCOPE, [IN_SCOPE]);
  assert.ok(admitted, 'the premise is gone: the estate does not resolve when allowed');
  assert.equal(admitted.estateId, IN_SCOPE);

  assert.equal(
    await harness.modules.estateContactWrites.findEstateInScope(IN_SCOPE, [OUT_OF_SCOPE]),
    undefined, 'an estate outside the allowed set resolved');
  assert.equal(
    await harness.modules.estateContactWrites.findEstateInScope(IN_SCOPE, []),
    undefined, 'an EMPTY allowed set admitted an estate');
  // A real estate id that is simply absent answers the same way — the caller
  // cannot distinguish out-of-scope from non-existent.
  assert.equal(
    await harness.modules.estateContactWrites.findEstateInScope('est_not_a_place', [IN_SCOPE]),
    undefined);
});

// ─────────────────────────────────────────────────────────────────── the audit
test('the audit records actor, authority and the effective instant', async () => {
  await add(MANAGER);
  const rows = await auditRows();
  assert.equal(rows.length, 1, 'the act was written without its audit');
  const row = rows[0]!;
  assert.equal(row.principal_id, MANAGER);
  assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
  assert.equal(row.node_kind, 'estate');
  assert.equal(row.node_id, IN_SCOPE);
  assert.notEqual(row.principal_id, row.group_id);
  assert.match(row.target_id, /^ctc_/);
});

test('NARROWEST — a second estate-level grant ties and breaks on grant id, stably', async () => {
  await addGrant('grp_gen014_tie', 'gnt_gen014_aaa', 'estate', IN_SCOPE);
  try {
    await add(MANAGER);
    const first = (await auditRows())[0]!;
    await clearWrites();
    await add(MANAGER);
    const second = (await auditRows())[0]!;
    assert.equal(first.group_id, second.group_id, 'the tie-break is not stable');
    const grants = await harness.admin.query<{ grant_id: string; group_id: string }>(
      `SELECT g.grant_id, g.group_id FROM access.scope_grant g
         JOIN access.group_membership m ON m.group_id = g.group_id
        WHERE m.principal_id = $1 AND g.role = 'estate_staff'
          AND g.node_kind = 'estate' AND g.node_id = $2 ORDER BY g.grant_id`,
      [MANAGER, IN_SCOPE]);
    assert.ok(grants.length >= 2, 'the premise is gone: fewer than two tied grants');
    assert.equal(first.group_id, grants[0]?.group_id, 'the winner is not the lowest grant id');
  } finally { await dropTestGroups(); }
});

test('D1.3 at ESTATE depth — re-derivation empties, the retained record still answers', async () => {
  await add(MANAGER);
  const row = (await auditRows())[0]!;
  const occurred = new Date(row.occurred_at);
  const atTime = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
  assert.ok(atTime?.grants.some((g) => g.groupId === row.group_id && g.node.id === row.node_id),
    'the recorded authority is not in force at the recorded instant');

  await harness.admin.query(
    `UPDATE access.group_membership SET effective_from = now() + interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  try {
    const rederived = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
    assert.deepEqual(rederived?.grants ?? [], [],
      'the premise is gone: re-derivation still finds the grant');
    assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
    assert.equal(row.node_id, IN_SCOPE);
  } finally {
    await harness.admin.query(
      `UPDATE access.group_membership SET effective_from = '2024-01-01T00:00:00Z'
        WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  }
});

// ────────────────────────────────────────────────── this surface's own domain
test('DOMAIN — an estate has ONE management office, and the refusal is 409, not 404', async () => {
  // est_wing_fu_garden already carries a seeded management_office contact.
  const response = await add(MANAGER, IN_SCOPE, {
    contactKind: 'management_office', nameEn: 'Second office', nameZhHant: '第二辦公室',
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.match(JSON.parse(response.body).type, /management-office-contact-exists/);
  assert.equal(await written(), 0);
});

test('DOMAIN — the per-kind rule is not blanket uniqueness: emergency contacts are plural', async () => {
  // The seed already holds one emergency contact for this estate, and a second
  // is legitimate. A blanket rule would have refused this.
  const first = await add(MANAGER);
  assert.equal(first.statusCode, 201, first.body);
  const second = await add(MANAGER, IN_SCOPE, { ...BODY, nameEn: 'Weekend duty', nameZhHant: '週末值班' });
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(await written(), 2);
  assert.equal((await auditRows()).length, 2, 'the second act was not audited');
});

test('DOMAIN — the conflict check is reached only IN SCOPE, so out-of-scope stays 404', async () => {
  // est_tsz_wan_court also has a management_office contact. A principal with no
  // scope over it must not learn that from a 409.
  const response = await add(MANAGER, OUT_OF_SCOPE, {
    contactKind: 'management_office', nameEn: 'Probe', nameZhHant: '探測',
  });
  assert.equal(response.statusCode, 404, 'a domain conflict leaked across scope');
  assert.match(JSON.parse(response.body).type, /estate-not-found/);
});

test('EDGE — the request is validated before anything reaches SQL', async () => {
  for (const body of [
    {},
    { contactKind: 'emergency' },
    { contactKind: 'switchboard', nameEn: 'x', nameZhHant: 'x' },
    { contactKind: 'emergency', nameEn: 'x', nameZhHant: 'x', sortOrder: 'first' },
  ]) {
    const response = await add(MANAGER, IN_SCOPE, body as Record<string, unknown>);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(await written(), 0);
});

test('property 4 — the runtime role still cannot amend or delete the audit it writes', async () => {
  await add(MANAGER);
  await assert.rejects(
    harness.modules.propertyDb.query(`UPDATE access.audit_event SET action = 'tampered'`),
    /permission denied/);
  await assert.rejects(
    harness.modules.propertyDb.query(`DELETE FROM access.audit_event`),
    /permission denied/);
  assert.equal((await auditRows()).length, 1);
});
