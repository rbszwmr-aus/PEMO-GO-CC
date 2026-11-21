/**
 * Strata reads and the honest log-transport invoice send, against the seeded
 * Wing Fu Garden rows. Staff bearer. A missing token is a problem, not an
 * empty charge list.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;

test.before(async () => {
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  harness = await startHarness();
  // This branch's seeds confer estate_staff, not grant_administrator.
  // /admin/email/test is admin-only (P1-R2); the manager gets that role here so
  // the existing happy-path check can still run.
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('grant_p1r2_mgr_admin', 'grp_of_one_stf_wfg_manager', 'grant_administrator',
             'organization', 'org_wingfu_holdings', '2024-01-01T00:00:00+08:00')
     ON CONFLICT (grant_id, version) DO NOTHING`,
  );
});

test.after(async () => {
  await harness.close();
});

const auth = (): { authorization: string } => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}`,
});

test('staff bearer lists Wing Fu charges and payments', async () => {
  const charges = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/strata/charges',
    headers: auth(),
  });
  assert.equal(charges.statusCode, 200, charges.body);
  const list = JSON.parse(charges.body) as { charges: Array<{ chargeId: string; contactEmail: string }> };
  const ids = list.charges.map((c) => c.chargeId);
  assert.ok(ids.includes('chg_wfg_a1_202609'));
  assert.ok(ids.includes('chg_wfg_b2_202609'));
  const a1 = list.charges.find((c) => c.chargeId === 'chg_wfg_a1_202609');
  assert.equal(a1?.contactEmail, 'ho.meiyi@wingfu.example');

  const payments = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/strata/payments',
    headers: auth(),
  });
  assert.equal(payments.statusCode, 200, payments.body);
  const pay = JSON.parse(payments.body) as { payments: Array<{ paymentId: string }> };
  assert.ok(pay.payments.some((p) => p.paymentId === 'pay_wfg_r1001'));
});

test('charge detail is in scope and a missing token is 401', async () => {
  const detail = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/strata/charges/chg_wfg_a1_202609',
    headers: auth(),
  });
  assert.equal(detail.statusCode, 200, detail.body);
  const body = JSON.parse(detail.body) as { charge: { invoiceNumber: string } };
  assert.equal(body.charge.invoiceNumber, 'INV-WFG-A1-202609');

  const anon = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/strata/charges',
  });
  assert.equal(anon.statusCode, 401);
  assert.match(anon.headers['content-type'] ?? '', /application\/problem\+json/);
  const problem = JSON.parse(anon.body) as { charges?: unknown };
  assert.equal(problem.charges, undefined);
});

test('invoice email records a log-transport outbox row when SMTP is unset', async () => {
  const sent = await harness.app.inject({
    method: 'POST',
    url: '/api/management-web/v0/strata/charges/chg_wfg_a1_202609/invoice-email',
    headers: auth(),
  });
  assert.equal(sent.statusCode, 200, sent.body);
  const body = JSON.parse(sent.body) as { status: string; transport: string; detail: string; to: string };
  assert.equal(body.transport, 'log');
  assert.equal(body.status, 'log-only');
  assert.equal(body.to, 'ho.meiyi@wingfu.example');
  assert.match(body.detail, /not handed to an SMTP server/);
  assert.equal(JSON.stringify(body).includes('SMTP_PASS'), false);

  const again = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/strata/charges/chg_wfg_a1_202609',
    headers: auth(),
  });
  const detail = JSON.parse(again.body) as {
    charge: { invoiceEmail: { status: string; transport: string } };
    invoiceSends: unknown[];
  };
  assert.equal(detail.charge.invoiceEmail.status, 'log-only');
  assert.equal(detail.charge.invoiceEmail.transport, 'log');
  assert.ok(detail.invoiceSends.length >= 1);
});

test('notice list is the notices module and delivery schedule is null', async () => {
  const list = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/notices',
    headers: auth(),
  });
  assert.equal(list.statusCode, 200, list.body);
  const notices = JSON.parse(list.body) as { notices: Array<{ noticeId: string }> };
  assert.ok(notices.notices.some((n) => n.noticeId === 'ntc_seed_lift'));

  const delivery = await harness.app.inject({
    method: 'GET',
    url: '/api/management-web/v0/notices/ntc_seed_lift/delivery',
    headers: auth(),
  });
  assert.equal(delivery.statusCode, 200, delivery.body);
  const body = JSON.parse(delivery.body) as { schedule: null; email: { sends: unknown[] } };
  assert.equal(body.schedule, null);
  assert.ok(Array.isArray(body.email.sends));
});

test('admin email test accepts only a recipient', async () => {
  const sent = await harness.app.inject({
    method: 'POST',
    url: '/api/management-web/v0/admin/email/test',
    headers: { ...auth(), 'content-type': 'application/json' },
    payload: { to: 'desk@wingfu.example', smtpPass: 'should-not-be-used' },
  });
  assert.equal(sent.statusCode, 200, sent.body);
  const body = JSON.parse(sent.body) as { kind: string; status: string; transport: string; to: string };
  assert.equal(body.kind, 'admin_test');
  assert.equal(body.to, 'desk@wingfu.example');
  assert.equal(body.transport, 'log');
  assert.equal(body.status, 'log-only');
});
