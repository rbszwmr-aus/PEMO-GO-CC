/**
 * P1-R3: outbox rows are inserted before any SMTP call; a retry with the same
 * key does not send again.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { setDeliverMail } from '../../apps/api/dist/management/mailer.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { expandedNodeKeys } from '../../apps/api/dist/management/authorizing-grant.js';
import type { ActorContext } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1r3_';

let harness: Harness;

test.before(async () => {
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  harness = await startHarness();
});

test.after(async () => {
  setDeliverMail(undefined);
  await harness.close();
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

test('P1-R3 — crash after outbox insert and before send, then retry, sends each recipient once', async () => {
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
  const emails = [
    `p1r3-a-${randomUUID().slice(0, 8)}@wingfu.example`,
    `p1r3-b-${randomUUID().slice(0, 8)}@wingfu.example`,
  ];
  const households: { household_id: string; prior: string | null }[] = [];
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
      [res, ORG, `P1-R3 occupant ${i}`],
    );
    await harness.admin.query(
      `INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (household_id) DO UPDATE SET contact_email = EXCLUDED.contact_email, unit_id = EXCLUDED.unit_id`,
      [hh, ORG, unit.unit_id, emails[i]],
    );
    await harness.admin.query(
      `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, household_id, unit_id,
                                       unit_class, role, status, source, effective_from)
       VALUES ($1, 1, $2, $3, $4, $5, 'residential', 'tenant', 'active', 'seed', now() - interval '1 day')
       ON CONFLICT (assertion_id) DO NOTHING`,
      [`occa_${occ}`, occ, res, hh, unit.unit_id],
    );
    households.push({ household_id: hh, prior: null });
    unitIds.push(unit.unit_id);
  }
  const unit1 = unitIds[0]!;
  const unit2Id = unitIds[1]!;

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
      titleEn: 'P1-R3 outbox-before-send',
      titleZhHant: 'P1-R3 先寫發件箱',
      bodyEn: 'Body EN',
      bodyZhHant: '正文',
      publishAt: null,
      expireAt: null,
      mandatoryAck: false,
      incidentRef: null,
    },
    targets: [unit1, unit2Id].map((unitId) => ({
      nodeKind: 'unit' as const, nodeId: unitId, locationId: null, residentGroupId: null,
    })),
  }, managerActor(), managerScope);
  assert.equal(composed.kind, 'ok', `compose failed: ${JSON.stringify(composed)}`);
  const noticeId = (composed as { noticeId: string }).noticeId;
  const published = await harness.modules.noticeActs.publish(
    noticeId, (composed as { version: number }).version ?? 1, managerActor(), managerScope,
  );
  assert.equal(published.kind, 'ok', `publish failed: ${JSON.stringify(published)}`);

  setDeliverMail(async () => {
    throw new Error('injected crash after outbox insert');
  });
  const first = await harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email`,
    headers: { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` },
  });
  assert.ok(first.statusCode >= 500, `first send should crash after insert, got ${first.statusCode} ${first.body}`);

  const queued = await harness.admin.query<{ to_address: string; status: string }>(
    `SELECT to_address, status FROM strata.email_outbox
      WHERE kind='notice' AND subject_id=$1 ORDER BY to_address`,
    [noticeId],
  );
  assert.equal(queued.length, 2, `expected two outbox rows after the crash, got ${JSON.stringify(queued)}`);
  assert.ok(queued.every((r) => r.status === 'failed'), 'pre-acceptance crash must mark rows failed');

  const calls: string[] = [];
  setDeliverMail(async (message) => {
    calls.push(message.to);
    return {
      status: 'log-only',
      transport: 'log',
      detail: 'fake SMTP accepted the test message',
    };
  });
  const second = await harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email`,
    headers: { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` },
  });
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(calls.length, 2, `each recipient must be sent one SMTP call for the admitted generation, got ${JSON.stringify(calls)}`);
  assert.deepEqual([...calls].sort(), [...emails].sort());

  const thirdCalls = calls.length;
  const third = await harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email`,
    headers: { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` },
  });
  assert.equal(third.statusCode, 200, third.body);
  assert.equal(calls.length, thirdCalls, 'a retry with the same key must not call SMTP again');

  for (const h of households) {
    await harness.admin.query(
      `UPDATE resident.household SET contact_email=$2 WHERE household_id=$1`,
      [h.household_id, h.prior],
    );
  }
});
