/**
 * F3: delivery history is authorised per recipient scope, not the notice's
 * current targets. Draft retarget must not expose earlier addresses.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { expandedNodeKeys } from '../../apps/api/dist/management/authorizing-grant.js';
import type { ActorContext } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1f3h_';

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

const emptyUnitOnFloor = async (floorId: string): Promise<string> => {
  const [unit] = await harness.admin.query<{ unit_id: string }>(
    `WITH cur AS (
        SELECT DISTINCT ON (occupancy_id) *
          FROM resident.occupancy
         ORDER BY occupancy_id, version DESC
      )
      SELECT u.unit_id
        FROM property.unit u
       WHERE u.floor_id = $1
         AND u.unit_class = 'residential'
         AND NOT EXISTS (
           SELECT 1 FROM cur o
            WHERE o.unit_id = u.unit_id
              AND o.status = 'active'
              AND o.effective_from <= now()
              AND (o.effective_to IS NULL OR o.effective_to > now())
         )
       ORDER BY u.unit_id
       LIMIT 1`,
    [floorId],
  );
  assert.ok(unit, `need an unoccupied unit on ${floorId}`);
  return unit.unit_id;
};

const occupy = async (tag: string, unitId: string, email: string): Promise<void> => {
  const hh = `${PREFIX}${tag}_hh`;
  const res = `${PREFIX}${tag}_res`;
  const occ = `${PREFIX}${tag}_occ`;
  await harness.admin.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (resident_id) DO NOTHING`,
    [res, ORG, `F3h ${tag}`],
  );
  await harness.admin.query(
    `INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (household_id) DO UPDATE SET contact_email = EXCLUDED.contact_email, unit_id = EXCLUDED.unit_id`,
    [hh, ORG, unitId, email],
  );
  await harness.admin.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, household_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1, 1, $2, $3, $4, $5, 'residential', 'tenant', 'active', 'seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_${occ}`, occ, res, hh, unitId],
  );
};

const managerScope = async () => {
  const expand = async (nodes: readonly { kind: string; id: string }[]) =>
    expandedNodeKeys(await harness.modules.scopeExpansion.expand(ORG, nodes as never));
  return roleScope('estate_staff', [{
    grantId: 'grant_seed_mgr_estate',
    groupId: 'grp_of_one_stf_wfg_manager',
    role: 'estate_staff' as const,
    node: { kind: 'estate' as const, id: 'est_wing_fu_garden' },
    effectiveFrom: '2024-01-01T00:00:00.000Z',
    effectiveTo: null,
  }], expand);
};

const addFloorStaff = async (staffId: string, floorId: string): Promise<void> => {
  const groupId = `${staffId}_grp`;
  await harness.admin.query(
    `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1,$2,$3,'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [staffId, ORG, staffId],
  );
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (group_id) DO NOTHING`,
    [groupId, ORG, staffId],
  );
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1,$2,$3, now() - interval '1 day')
     ON CONFLICT (membership_id, version) DO NOTHING`,
    [`${staffId}_mem`, groupId, staffId],
  );
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1,$2,'estate_staff','floor',$3, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`,
    [`${staffId}_grant`, groupId, floorId],
  );
};

const noBodyLeak = (body: string, ...needles: string[]): void => {
  for (const n of needles) {
    assert.equal(body.includes(n), false, `must not leak ${n}: ${body}`);
  }
};

test('F3h — after draft retarget to floor 1, floor-1 staff read the notice but not the floor-2 send; estate-wide sees it; null-scope is hidden from floor staff; no-grant/resident/wrong-estate get 403/401 with no data', async () => {
  await harness.reseed();
  const floorRows = await harness.admin.query<{ floor_id: string }>(
    `WITH cur AS (
        SELECT DISTINCT ON (occupancy_id) *
          FROM resident.occupancy
         ORDER BY occupancy_id, version DESC
      )
      SELECT f.floor_id
        FROM property.floor f
       WHERE f.building_id = 'blk_wfg_a'
         AND EXISTS (
           SELECT 1 FROM property.unit u
            WHERE u.floor_id = f.floor_id
              AND u.unit_class = 'residential'
              AND NOT EXISTS (
                SELECT 1 FROM cur o
                 WHERE o.unit_id = u.unit_id
                   AND o.status = 'active'
                   AND o.effective_from <= now()
                   AND (o.effective_to IS NULL OR o.effective_to > now())
              )
         )
       ORDER BY f.floor_id
       LIMIT 2`,
  );
  assert.equal(floorRows.length, 2);
  const floor1 = floorRows[0]!.floor_id;
  const floor2 = floorRows[1]!.floor_id;
  const unit1 = await emptyUnitOnFloor(floor1);
  const unit2 = await emptyUnitOnFloor(floor2);
  const email1 = `p1f3h-f1-${randomUUID().slice(0, 8)}@wingfu.example`;
  const email2 = `p1f3h-f2-${randomUUID().slice(0, 8)}@wingfu.example`;
  const legacyEmail = `p1f3h-legacy-${randomUUID().slice(0, 8)}@wingfu.example`;
  await occupy('f1', unit1, email1);
  await occupy('f2', unit2, email2);

  const scope = await managerScope();
  const composed = await harness.modules.noticeActs.compose({
    clientKey: `${PREFIX}${randomUUID()}`,
    content: {
      noticeType: 'general',
      titleEn: 'F3h draft then retarget',
      titleZhHant: 'F3h 草稿改對象',
      bodyEn: 'Body EN',
      bodyZhHant: '正文',
      publishAt: null,
      expireAt: null,
      mandatoryAck: false,
      incidentRef: null,
    },
    targets: [{ nodeKind: 'unit' as const, nodeId: unit2, locationId: null, residentGroupId: null }],
  }, managerActor(), scope);
  assert.equal(composed.kind, 'ok', JSON.stringify(composed));
  const noticeId = (composed as { noticeId: string }).noticeId;
  const version = (composed as { version: number }).version ?? 1;

  const sent = await harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email`,
    headers: staffBearer('stf_wfg_manager'),
  });
  assert.equal(sent.statusCode, 200, sent.body);
  assert.ok(sent.body.includes(email2));

  const revised = await harness.modules.noticeActs.revise(noticeId, version, {
    clientKey: `${PREFIX}rev_${randomUUID()}`,
    content: {},
    targets: [{ nodeKind: 'unit' as const, nodeId: unit1, locationId: null, residentGroupId: null }],
  }, managerActor(), scope);
  assert.equal(revised.kind, 'ok', `draft retarget should succeed: ${JSON.stringify(revised)}`);

  await harness.admin.query(
    `INSERT INTO strata.email_outbox (
       outbox_id, organization_id, kind, subject_id, to_address, from_address,
       subject, body_text, status, transport, transport_detail, recorded_by
     ) VALUES ($1,$2,'notice',$3,$4,'notices@wingfu.example','legacy', 'legacy body',
               'log-only','log','legacy null-scope','stf_wfg_manager')`,
    [`obx_${PREFIX}legacy`, ORG, noticeId, legacyEmail],
  );

  const staffId = `${PREFIX}stf_floor1`;
  await addFloorStaff(staffId, floor1);

  const read = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}`,
    headers: staffBearer(staffId),
  });
  assert.equal(read.statusCode, 200, `floor-1 staff must still read the notice: ${read.body}`);

  const floorGet = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer(staffId),
  });
  assert.equal(floorGet.statusCode, 200, floorGet.body);
  noBodyLeak(floorGet.body, email2, legacyEmail);
  const floorBody = JSON.parse(floorGet.body) as { email: { recipientCount: number; sends: { to: string }[] } };
  assert.equal(floorBody.email.sends.some((s) => s.to === email2), false);
  assert.equal(floorBody.email.sends.some((s) => s.to === legacyEmail), false);

  const estateGet = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer('stf_wfg_manager'),
  });
  assert.equal(estateGet.statusCode, 200, estateGet.body);
  assert.ok(estateGet.body.includes(email2), 'estate-wide staff sees the historical floor-2 send');
  assert.ok(estateGet.body.includes(legacyEmail), 'estate-wide staff sees legacy null-scope rows');

  const noGrantId = `${PREFIX}nogrant`;
  await harness.admin.query(
    `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1,$2,$3,'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [noGrantId, ORG, 'no grant'],
  );
  const noGrant = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer(noGrantId),
  });
  assert.equal(noGrant.statusCode, 403, noGrant.body);
  noBodyLeak(noGrant.body, email1, email2, legacyEmail);

  const [resident] = await harness.admin.query<{ resident_id: string }>(
    `SELECT resident_id FROM resident.resident WHERE organization_id=$1 ORDER BY 1 LIMIT 1`,
    [ORG],
  );
  assert.ok(resident);
  const asResident = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: { authorization: `Bearer ${harness.token(resident.resident_id)}` },
  });
  assert.ok([401, 403].includes(asResident.statusCode), asResident.body);
  noBodyLeak(asResident.body, email1, email2, legacyEmail);

  const wrongEstate = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer('stf_hbv_manager'),
  });
  assert.ok([401, 403, 404].includes(wrongEstate.statusCode), wrongEstate.body);
  noBodyLeak(wrongEstate.body, email1, email2, legacyEmail);
});
