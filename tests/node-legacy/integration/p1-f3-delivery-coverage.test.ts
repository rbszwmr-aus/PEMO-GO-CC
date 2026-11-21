/**
 * F3: GET /notices/:id/delivery returns only recipients whose scope the
 * caller covers. Floor-1-only staff see only their recipients; estate-wide staff see all.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { expandedNodeKeys } from '../../apps/api/dist/management/authorizing-grant.js';
import type { ActorContext } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1f3_';

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

test('F3 — floor-1-only staff GET delivery omits outside addresses; covering staff see all', async () => {
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
  assert.equal(floorRows.length, 2, 'need two Block A floors with an unoccupied unit');
  const floor1 = floorRows[0]!.floor_id;
  const floor2 = floorRows[1]!.floor_id;
  const email1 = `p1f3-f1-${randomUUID().slice(0, 8)}@wingfu.example`;
  const email2 = `p1f3-f2-${randomUUID().slice(0, 8)}@wingfu.example`;
  const unitIds: string[] = [];
  for (const [i, floorId] of [floor1, floor2].entries()) {
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
    assert.ok(unit, `need an unoccupied residential unit on ${floorId}`);
    const hh = `${PREFIX}hh${i}`;
    const res = `${PREFIX}res${i}`;
    const occ = `${PREFIX}occ${i}`;
    await harness.admin.query(
      `INSERT INTO resident.resident (resident_id, organization_id, display_name)
       VALUES ($1, $2, $3) ON CONFLICT (resident_id) DO NOTHING`,
      [res, ORG, `P1-F3 occupant ${i}`],
    );
    await harness.admin.query(
      `INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (household_id) DO UPDATE SET contact_email = EXCLUDED.contact_email, unit_id = EXCLUDED.unit_id`,
      [hh, ORG, unit.unit_id, i === 0 ? email1 : email2],
    );
    await harness.admin.query(
      `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, household_id, unit_id,
                                       unit_class, role, status, source, effective_from)
       VALUES ($1, 1, $2, $3, $4, $5, 'residential', 'tenant', 'active', 'seed', now() - interval '1 day')
       ON CONFLICT (assertion_id) DO NOTHING`,
      [`occa_${occ}`, occ, res, hh, unit.unit_id],
    );
    unitIds.push(unit.unit_id);
  }

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
      titleEn: 'P1-F3 two-floor delivery',
      titleZhHant: 'P1-F3 兩層派送',
      bodyEn: 'Body EN',
      bodyZhHant: '正文',
      publishAt: null,
      expireAt: null,
      mandatoryAck: false,
      incidentRef: null,
    },
    targets: unitIds.map((unitId) => ({
      nodeKind: 'unit' as const, nodeId: unitId, locationId: null, residentGroupId: null,
    })),
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
    [staffId, ORG, 'P1-F3 floor-1 staff'],
  );
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (group_id) DO NOTHING`,
    [groupId, ORG, 'P1-F3 floor-1 group'],
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

  const floorStaffGet = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer(staffId),
  });
  assert.equal(floorStaffGet.statusCode, 200, floorStaffGet.body);
  assert.ok(floorStaffGet.body.includes(email1), 'floor-1 staff sees the covered recipient');
  assert.equal(floorStaffGet.body.includes(email2), false, 'must not leak floor-2 (outside) recipient');
  const floor1Body = JSON.parse(floorStaffGet.body) as { email: { recipientCount: number; sends: unknown[] } };
  assert.equal(floor1Body.email.recipientCount, 1, 'preview must count only covered recipients');
  assert.equal(JSON.stringify(floor1Body).includes(email2), false);

  const allowed = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer('stf_wfg_manager'),
  });
  assert.equal(allowed.statusCode, 200, allowed.body);
  const body = JSON.parse(allowed.body) as { email: { recipientCount: number } };
  assert.equal(body.email.recipientCount, 2);
  assert.ok(allowed.body.includes(email1) && allowed.body.includes(email2), 'estate-wide staff sees all current recipients');
});
