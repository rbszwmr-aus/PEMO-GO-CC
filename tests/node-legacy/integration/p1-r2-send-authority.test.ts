/**
 * P1-R2: notice/invoice send requires a covering send scope before recipients
 * are resolved; /admin/email/test is admin-only.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { expandedNodeKeys } from '../../apps/api/dist/management/authorizing-grant.js';
import type { ActorContext } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1r2_';

let harness: Harness;

test.before(async () => {
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  harness = await startHarness();
});

test.after(async () => {
  await harness.close();
});

const staffBearer = (principalId: string): { authorization: string } => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

const managerActor = (): ActorContext => ({
  organizationId: ORG,
  principalId: 'stf_wfg_manager',
  correlationId: randomUUID(),
  now: new Date(),
  witness: {
    groupId: 'grp_of_one_stf_wfg_manager',
    role: 'estate_staff',
    nodeKind: 'estate',
    nodeId: 'est_wing_fu_garden',
  },
});

test('P1-R2 — floor-1 staff cannot send a floor-1+2 notice (403, no addresses); non-admin cannot use email test', async () => {

  const occupied = await harness.admin.query<{ floor_id: string; household_id: string; contact_email: string | null }>(
    `WITH cur AS (
        SELECT DISTINCT ON (occupancy_id) *
          FROM resident.occupancy
         ORDER BY occupancy_id, version DESC
      )
      SELECT f.floor_id, h.household_id, h.contact_email
        FROM resident.household h
        JOIN property.unit u ON u.unit_id = h.unit_id
        JOIN property.floor f ON f.floor_id = u.floor_id
        JOIN cur o ON o.unit_id = h.unit_id
       WHERE f.building_id = 'blk_wfg_a'
         AND o.status = 'active'
         AND o.effective_from <= now()
         AND (o.effective_to IS NULL OR o.effective_to > now())
       ORDER BY f.floor_id, h.household_id`,
  );
  assert.ok(occupied.length > 0, 'need at least one occupied Block A household');
  const floor1 = occupied[0]!.floor_id;
  const [otherFloor] = await harness.admin.query<{ floor_id: string }>(
    `SELECT floor_id FROM property.floor
      WHERE building_id = 'blk_wfg_a' AND floor_id <> $1
      ORDER BY floor_id LIMIT 1`,
    [floor1],
  );
  assert.ok(otherFloor, 'need a second Block A floor');
  const floor2 = otherFloor.floor_id;
  const [unit2] = await harness.admin.query<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit
      WHERE floor_id = $1 AND unit_class = 'residential' ORDER BY 1 LIMIT 1`,
    [floor2],
  );
  assert.ok(unit2, `need a residential unit on ${floor2}`);
  const hh2 = `${PREFIX}hh2`;
  const res2 = `${PREFIX}res2`;
  const occ2 = `${PREFIX}occ2`;
  await harness.admin.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (resident_id) DO NOTHING`,
    [res2, ORG, 'P1 review occupant'],
  );
  await harness.admin.query(
    `INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email)
     VALUES ($1, $2, $3, $4) ON CONFLICT (household_id) DO NOTHING`,
    [hh2, ORG, unit2.unit_id, null],
  );
  await harness.admin.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, household_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1, 1, $2, $3, $4, $5, 'residential', 'tenant', 'active', 'seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_${occ2}`, occ2, res2, hh2, unit2.unit_id],
  );
  const byFloor = new Map<string, { household_id: string; contact_email: string | null }>([
    [floor1, { household_id: occupied[0]!.household_id, contact_email: occupied[0]!.contact_email }],
    [floor2, { household_id: hh2, contact_email: null }],
  ]);

  const households: { household_id: string; floor_id: string; prior: string | null }[] = [
    { household_id: byFloor.get(floor1)!.household_id, floor_id: floor1, prior: byFloor.get(floor1)!.contact_email },
    { household_id: byFloor.get(floor2)!.household_id, floor_id: floor2, prior: byFloor.get(floor2)!.contact_email },
  ];
  const email1 = `p1r2-f1-${randomUUID().slice(0, 8)}@wingfu.example`;
  const email2 = `p1r2-f2-${randomUUID().slice(0, 8)}@wingfu.example`;
  await harness.admin.query(
    `UPDATE resident.household SET contact_email=$2 WHERE household_id=$1`,
    [households[0]!.household_id, email1],
  );
  await harness.admin.query(
    `UPDATE resident.household SET contact_email=$2 WHERE household_id=$1`,
    [households[1]!.household_id, email2],
  );

  const [unit1Row] = await harness.admin.query<{ unit_id: string }>(
    `SELECT unit_id FROM resident.household WHERE household_id=$1`,
    [households[0]!.household_id],
  );
  const unit1 = unit1Row!.unit_id;
  const unit2Id = unit2.unit_id;

  const expand = async (nodes: readonly { kind: string; id: string }[]) =>
    expandedNodeKeys(await harness.modules.scopeExpansion.expand(ORG, nodes as never));
  const managerScope = await roleScope('estate_staff', [{
    grantId: 'grant_seed_mgr_estate',
    groupId: 'grp_of_one_stf_wfg_manager',
    role: 'estate_staff' as const,
    node: { kind: 'estate' as const, id: 'est_wing_fu_garden' },
    effectiveFrom: '2024-01-01T00:00:00.000Z',
    effectiveTo: null,
  }], expand);

  const composed = await harness.modules.noticeActs.compose({
    clientKey: `${PREFIX}${randomUUID()}`,
    content: {
      noticeType: 'general',
      titleEn: 'P1-R2 two-floor notice',
      titleZhHant: 'P1-R2 兩層通告',
      bodyEn: 'Body EN',
      bodyZhHant: '正文',
      publishAt: null,
      expireAt: null,
      mandatoryAck: false,
      incidentRef: null,
    },
    targets: [
      { nodeKind: 'unit', nodeId: unit1, locationId: null, residentGroupId: null },
      { nodeKind: 'unit', nodeId: unit2Id, locationId: null, residentGroupId: null },
    ],
  }, managerActor(), managerScope);
  assert.equal(composed.kind, 'ok', `compose failed: ${JSON.stringify(composed)}`);
  const noticeId = (composed as { noticeId: string }).noticeId;
  const published = await harness.modules.noticeActs.publish(
    noticeId, (composed as { version: number }).version ?? 1, managerActor(), managerScope,
  );
  assert.equal(published.kind, 'ok', `publish failed: ${JSON.stringify(published)}`);

  const staffId = `${PREFIX}stf_floor1`;
  const groupId = `${PREFIX}grp_floor1`;
  await harness.admin.query(
    `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1,$2,$3,'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [staffId, ORG, 'P1-R2 floor-1 staff'],
  );
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (group_id) DO NOTHING`,
    [groupId, ORG, 'P1-R2 floor-1 group'],
  );
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1,$2,$3, now() - interval '1 day')
     ON CONFLICT (membership_id, version) DO NOTHING`,
    [`${PREFIX}mem_floor1`, groupId, staffId],
  );
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1,$2,'estate_staff','floor',$3, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`,
    [`${PREFIX}grant_floor1`, groupId, floor1],
  );

  const sent = await harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email`,
    headers: staffBearer(staffId),
  });
  assert.equal(sent.statusCode, 403, sent.body);
  assert.equal(sent.body.includes(email1), false, 'must not leak floor-1 recipient');
  assert.equal(sent.body.includes(email2), false, 'must not leak floor-2 recipient');
  assert.match(sent.body, /403|"status":403/);
  const problem = JSON.parse(sent.body) as { emails?: unknown; results?: unknown; to?: unknown; status: number };
  assert.equal(problem.emails, undefined);
  assert.equal(problem.results, undefined);
  assert.equal(problem.to, undefined);

  const adminTest = await harness.app.inject({
    method: 'POST',
    url: '/api/management-web/v0/admin/email/test',
    headers: staffBearer('stf_wfg_block_a'),
    payload: { to: 'someone@wingfu.example' },
  });
  assert.equal(adminTest.statusCode, 403, adminTest.body);
  assert.equal(adminTest.body.includes('someone@wingfu.example'), false, 'admin test must not echo the recipient on 403');

  // restore household emails; test staff is torn down by harness.close (no reseed here),
  // but we put the addresses back so a later reseed-less run is not surprised.
  for (const h of households) {
    await harness.admin.query(
      `UPDATE resident.household SET contact_email=$2 WHERE household_id=$1`,
      [h.household_id, h.prior],
    );
  }
});
