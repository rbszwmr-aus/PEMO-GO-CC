/**
 * R2: notice send, invoice send/preview, and SMTP test across the
 * authorised / floor-only / no-grant / resident / wrong-estate matrix.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1r2m_';

let harness: Harness;

test.before(async () => {
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  harness = await startHarness();
});

test.after(async () => {
  await harness.close();
});

const staffBearer = (principalId: string) => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

const noLeak = (res: { statusCode: number; body: string }, ...needles: string[]) => {
  for (const n of needles) assert.equal(res.body.includes(n), false, `${res.statusCode} leaked ${n}: ${res.body}`);
};

test('R2 — notice send, invoice send/preview, and SMTP test follow the operation matrix', async () => {
  await harness.reseed();

  const [charge] = await harness.admin.query<{ charge_id: string; contact_email: string | null; floor_id: string }>(
    `SELECT c.charge_id, c.contact_email, u.floor_id
       FROM strata.charge c
       JOIN resident.household h ON h.household_id = c.household_id
       JOIN property.unit u ON u.unit_id = h.unit_id
      WHERE c.organization_id = $1
      ORDER BY u.floor_id, c.charge_id
      LIMIT 1`,
    [ORG],
  );
  assert.ok(charge, 'need a seeded charge');
  const otherFloorStaff = `${PREFIX}otherfloor`;
  const [otherFloor] = await harness.admin.query<{ floor_id: string }>(
    `SELECT floor_id FROM property.floor
      WHERE building_id = 'blk_wfg_a' AND floor_id <> $1
      ORDER BY floor_id LIMIT 1`,
    [charge.floor_id],
  );
  assert.ok(otherFloor);
  const groupId = `${otherFloorStaff}_grp`;
  await harness.admin.query(
    `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1,$2,$3,'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [otherFloorStaff, ORG, 'other floor'],
  );
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (group_id) DO NOTHING`,
    [groupId, ORG, 'other floor'],
  );
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1,$2,$3, now() - interval '1 day') ON CONFLICT (membership_id, version) DO NOTHING`,
    [`${otherFloorStaff}_mem`, groupId, otherFloorStaff],
  );
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1,$2,'estate_staff','floor',$3, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`,
    [`${otherFloorStaff}_grant`, groupId, otherFloor.floor_id],
  );

  const noGrantId = `${PREFIX}nogrant`;
  await harness.admin.query(
    `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1,$2,$3,'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [noGrantId, ORG, 'no grant'],
  );
  const [resident] = await harness.admin.query<{ resident_id: string }>(
    `SELECT resident_id FROM resident.resident WHERE organization_id=$1 ORDER BY 1 LIMIT 1`,
    [ORG],
  );
  assert.ok(resident);
  const residentHdr = { authorization: `Bearer ${harness.token(resident.resident_id)}` };
  const contact = charge.contact_email ?? 'nobody@wingfu.example';

  const invoiceGet = `/api/management-web/v0/strata/charges/${charge.charge_id}`;
  const invoicePost = `${invoiceGet}/invoice-email`;
  const smtpTest = '/api/management-web/v0/admin/email/test';

  const estateGet = await harness.app.inject({ method: 'GET', url: invoiceGet, headers: staffBearer('stf_wfg_manager') });
  assert.equal(estateGet.statusCode, 200, estateGet.body);

  const floorGet = await harness.app.inject({ method: 'GET', url: invoiceGet, headers: staffBearer(otherFloorStaff) });
  assert.ok([403, 404].includes(floorGet.statusCode), floorGet.body);
  noLeak(floorGet, contact);

  const floorPost = await harness.app.inject({ method: 'POST', url: invoicePost, headers: staffBearer(otherFloorStaff) });
  assert.ok([403, 404].includes(floorPost.statusCode), floorPost.body);
  noLeak(floorPost, contact);

  for (const [label, headers] of [
    ['no-grant', staffBearer(noGrantId)],
    ['resident', residentHdr],
    ['wrong-estate', staffBearer('stf_hbv_manager')],
  ] as const) {
    const g = await harness.app.inject({ method: 'GET', url: invoiceGet, headers });
    assert.ok([401, 403, 404].includes(g.statusCode), `${label} invoice GET ${g.statusCode} ${g.body}`);
    noLeak(g, contact);
    const p = await harness.app.inject({ method: 'POST', url: invoicePost, headers });
    assert.ok([401, 403, 404].includes(p.statusCode), `${label} invoice POST ${p.statusCode} ${p.body}`);
    noLeak(p, contact);
    const s = await harness.app.inject({
      method: 'POST', url: smtpTest, headers, payload: { to: 'someone@wingfu.example' },
    });
    assert.ok([401, 403].includes(s.statusCode), `${label} SMTP test ${s.statusCode} ${s.body}`);
    noLeak(s, 'someone@wingfu.example');
  }

  const floorSmtp = await harness.app.inject({
    method: 'POST', url: smtpTest, headers: staffBearer(otherFloorStaff), payload: { to: 'someone@wingfu.example' },
  });
  assert.equal(floorSmtp.statusCode, 403, floorSmtp.body);
  noLeak(floorSmtp, 'someone@wingfu.example');

  const [notice] = await harness.admin.query<{ notice_id: string }>(
    `SELECT notice_id FROM notices.notice_current ORDER BY notice_id LIMIT 1`,
  );
  if (notice) {
    const url = `/api/management-web/v0/notices/${notice.notice_id}/email`;
    for (const [label, headers] of [
      ['no-grant', staffBearer(noGrantId)],
      ['resident', residentHdr],
      ['wrong-estate', staffBearer('stf_hbv_manager')],
    ] as const) {
      const r = await harness.app.inject({ method: 'POST', url, headers });
      assert.ok([401, 403, 404].includes(r.statusCode), `${label} notice send ${r.statusCode} ${r.body}`);
    }
  }
});
