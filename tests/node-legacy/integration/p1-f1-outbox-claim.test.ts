/**
 * F1: only the request that claims a pending outbox row may call SMTP;
 * after SMTP accepts, a failed mark leaves the row `sending` and is never
 * auto-resent (`unknown` once the claim is older than SENDING_UNKNOWN_AFTER_MS).
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import nm from '../../apps/api/node_modules/nodemailer/lib/nodemailer.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { setCreateTransport, setDeliverMail } from '../../apps/api/dist/management/mailer.js';
import {
  failNextMarkResult,
  outboxPresentationStatus,
  SENDING_UNKNOWN_AFTER_MS,
} from '../../modules/strata/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { expandedNodeKeys } from '../../apps/api/dist/management/authorizing-grant.js';
import type { ActorContext } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const PREFIX = 'p1f1_';

let harness: Harness;

test.before(async () => {
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  harness = await startHarness();
});

test.after(async () => {
  setDeliverMail(undefined);
  setCreateTransport(undefined);
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
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

const staffBearer = (): { authorization: string } => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}`,
});

const publishOneRecipientNotice = async (email: string): Promise<string> => {
  const [unit] = await harness.admin.query<{ unit_id: string }>(
    `WITH cur AS (
        SELECT DISTINCT ON (occupancy_id) *
          FROM resident.occupancy
         ORDER BY occupancy_id, version DESC
      )
      SELECT u.unit_id
        FROM property.unit u
        JOIN property.floor f ON f.floor_id = u.floor_id
       WHERE f.building_id = 'blk_wfg_a'
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
  );
  assert.ok(unit, 'need an unoccupied Block A residential unit');
  const suffix = randomUUID().slice(0, 8);
  const hh = `${PREFIX}hh_${suffix}`;
  const res = `${PREFIX}res_${suffix}`;
  const occ = `${PREFIX}occ_${suffix}`;
  await harness.admin.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (resident_id) DO NOTHING`,
    [res, ORG, 'P1-F1 occupant'],
  );
  await harness.admin.query(
    `INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (household_id) DO UPDATE SET contact_email = EXCLUDED.contact_email, unit_id = EXCLUDED.unit_id`,
    [hh, ORG, unit.unit_id, email],
  );
  await harness.admin.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, household_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1, 1, $2, $3, $4, $5, 'residential', 'tenant', 'active', 'seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_${occ}`, occ, res, hh, unit.unit_id],
  );

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
      titleEn: 'P1-F1 claim-before-send',
      titleZhHant: 'P1-F1 先佔用再發送',
      bodyEn: 'Body EN',
      bodyZhHant: '正文',
      publishAt: null,
      expireAt: null,
      mandatoryAck: false,
      incidentRef: null,
    },
    targets: [{ nodeKind: 'unit' as const, nodeId: unit.unit_id, locationId: null, residentGroupId: null }],
  }, managerActor(), managerScope);
  assert.equal(composed.kind, 'ok', `compose failed: ${JSON.stringify(composed)}`);
  const noticeId = (composed as { noticeId: string }).noticeId;
  const published = await harness.modules.noticeActs.publish(
    noticeId, (composed as { version: number }).version ?? 1, managerActor(), managerScope,
  );
  assert.equal(published.kind, 'ok', `publish failed: ${JSON.stringify(published)}`);
  return noticeId;
};

const postSend = (noticeId: string) => harness.app.inject({
  method: 'POST',
  url: `/api/management-web/v0/notices/${noticeId}/email`,
  headers: staffBearer(),
});

test('F1a — two concurrent sends of the same key give one SMTP call', async () => {
  await harness.reseed();
  const email = `p1f1-a-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);

  const calls: string[] = [];
  setDeliverMail(async (message) => {
    calls.push(message.to);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      status: 'log-only',
      transport: 'log',
      detail: 'fake SMTP accepted the concurrent test message',
    };
  });

  const [first, second] = await Promise.all([postSend(noticeId), postSend(noticeId)]);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(calls.length, 1, `expected one SMTP call, got ${JSON.stringify(calls)}`);
  assert.equal(calls[0], email);
});

test('F1b — SMTP accept then markResult throw, retry does not resend; row is sending/unknown', async () => {
  await harness.reseed();
  const email = `p1f1-b-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);

  const calls: string[] = [];
  setDeliverMail(async (message) => {
    calls.push(message.to);
    return {
      status: 'log-only',
      transport: 'log',
      detail: 'fake SMTP accepted the message',
    };
  });
  failNextMarkResult();

  const first = await postSend(noticeId);
  assert.ok(first.statusCode >= 500, `first send should fail after accept, got ${first.statusCode} ${first.body}`);
  assert.equal(calls.length, 1, 'SMTP must have accepted once');

  const afterAccept = await harness.admin.query<{ status: string; claimed_at: Date | null }>(
    `SELECT status, claimed_at FROM strata.email_outbox
      WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  assert.equal(afterAccept.length, 1, JSON.stringify(afterAccept));
  assert.equal(afterAccept[0]!.status, 'sending');
  assert.ok(afterAccept[0]!.claimed_at, 'claimed_at must be set');

  const retry = await postSend(noticeId);
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(calls.length, 1, 'retry must not call SMTP again after an accepted send');

  const still = await harness.admin.query<{ status: string; claimed_at: Date }>(
    `SELECT status, claimed_at FROM strata.email_outbox
      WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  assert.equal(still[0]!.status, 'sending');
  const pastUnknown = new Date(still[0]!.claimed_at.getTime() + SENDING_UNKNOWN_AFTER_MS + 1);
  assert.equal(
    outboxPresentationStatus({ status: still[0]!.status, claimedAt: still[0]!.claimed_at }, pastUnknown),
    'unknown',
  );

  await harness.admin.query(
    `UPDATE strata.email_outbox
        SET claimed_at = now() - interval '16 minutes'
      WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  const delivery = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer(),
  });
  assert.equal(delivery.statusCode, 200, delivery.body);
  const body = JSON.parse(delivery.body) as { email: { sends: { status: string }[] } };
  assert.equal(body.email.sends[0]?.status, 'unknown');
});



type FakeMode = 'accept' | 'close' | 'reset' | 'silent' | 'reject5xx';
let fakeMode: FakeMode = 'accept';
let dataCount = 0;
const SOCK = `/tmp/pemo-f1-smtp-${process.pid}.sock`;
const STALE_SOCK = `/tmp/pemo-f1-stale-${process.pid}.sock`;

/** Bind a unix socket and die without unlinking, so connect() is ECONNREFUSED. */
const createStaleUnixSocket = (path: string): void => {
  try { fs.unlinkSync(path); } catch { /* none */ }
  const r = spawnSync(process.execPath, ['-e', `
    const net = require('net');
    const s = net.createServer();
    s.listen(${JSON.stringify(path)}, () => { process.kill(process.pid, 'SIGKILL'); });
  `], { encoding: 'utf8' });
  if (r.signal !== 'SIGKILL' && r.status !== 0) {
    throw new Error(`stale unix socket setup failed: status=${r.status} signal=${String(r.signal)} ${r.stderr}`);
  }
  if (!fs.existsSync(path)) {
    throw new Error('stale unix socket inode was not left behind');
  }
};

const fakeSmtp = net.createServer((socket) => {
  socket.write('220 fake ESMTP\r\n');
  let buf = '';
  let inData = false;
  socket.on('data', (chunk) => {
    buf += chunk.toString('latin1');
    for (;;) {
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        buf = buf.slice(end + 5);
        inData = false;
        dataCount += 1;
        if (fakeMode === 'accept') socket.write('250 2.0.0 queued\r\n');
        else if (fakeMode === 'close') socket.end();
        else if (fakeMode === 'reset') socket.destroy();
        else if (fakeMode === 'reject5xx') socket.write('550 5.0.0 rejected\r\n');
        continue;
      }
      const nl = buf.indexOf('\r\n');
      if (nl < 0) return;
      const line = buf.slice(0, nl).toUpperCase();
      buf = buf.slice(nl + 2);
      if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250 fake\r\n');
      else if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO') || line.startsWith('RSET')) socket.write('250 OK\r\n');
      else if (line === 'DATA') { socket.write('354 go\r\n'); inData = true; }
      else if (line === 'QUIT') { socket.write('221 bye\r\n'); socket.end(); }
    }
  });
  socket.on('error', () => undefined);
});

test.before(async () => {
  try { fs.unlinkSync(SOCK); } catch { /* none */ }
  await new Promise<void>((resolve) => { fakeSmtp.listen(SOCK, resolve); });
});

test.after(async () => {
  await new Promise<void>((resolve) => { fakeSmtp.close(() => resolve()); });
  try { fs.unlinkSync(SOCK); } catch { /* none */ }
  try { fs.unlinkSync(STALE_SOCK); } catch { /* none */ }
});

const useRealClient = (socketPath: string = SOCK): void => {
  process.env['SMTP_HOST'] = 'smtp.test.invalid';
  delete process.env['SMTP_URL'];
  setDeliverMail(undefined);
  setCreateTransport(((opts: Record<string, unknown>) => nm.createTransport({
    ...opts,
    connectionTimeout: 2500,
    greetingTimeout: 2500,
    socketTimeout: 2500,
    getSocket: (_o: unknown, cb: (e: Error | null, r?: unknown) => void) => {
      const sk = net.connect(socketPath);
      sk.once('connect', () => cb(null, { connection: sk }));
      sk.once('error', (e) => cb(e));
    },
  })) as never);
};

const sendStatus = (res: { statusCode: number; body: string }): string | undefined => {
  try {
    return (JSON.parse(res.body) as { results?: { status: string }[]; status?: string }).results?.[0]?.status
      ?? (JSON.parse(res.body) as { status?: string }).status;
  } catch {
    return undefined;
  }
};

for (const mode of ['close', 'reset', 'silent'] as const) {
  test(`F1c — real nodemailer, DATA then ${mode}: unknown, next POST does not resend (notice)`, async () => {
    await harness.reseed();
    const email = `p1f1-c-${mode}-${randomUUID().slice(0, 8)}@wingfu.example`;
    const noticeId = await publishOneRecipientNotice(email);
    useRealClient();
    fakeMode = mode;
    dataCount = 0;
    try {
      const first = await postSend(noticeId);
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(sendStatus(first), 'unknown', first.body);
      assert.equal(dataCount, 1, 'server received DATA once');
      const [row] = await harness.admin.query<{ status: string }>(
        `SELECT status FROM strata.email_outbox WHERE kind='notice' AND subject_id=$1`,
        [noticeId],
      );
      assert.equal(row?.status, 'unknown');
      const retry = await postSend(noticeId);
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(dataCount, 1, 'unknown must not be auto-retried');
    } finally {
      setCreateTransport(undefined);
      delete process.env['SMTP_HOST'];
    }
  });

  test(`F1c — real nodemailer, DATA then ${mode}: unknown, next POST does not resend (invoice)`, async () => {
    await harness.reseed();
    const [charge] = await harness.admin.query<{ charge_id: string }>(
      `SELECT c.charge_id
         FROM strata.charge c
         LEFT JOIN strata.email_outbox o
           ON o.kind='invoice' AND o.subject_id=c.charge_id
        WHERE c.organization_id=$1 AND o.outbox_id IS NULL
        ORDER BY c.charge_id LIMIT 1`,
      [ORG],
    );
    assert.ok(charge, 'need a charge with no prior invoice outbox row');
    useRealClient();
    fakeMode = mode;
    dataCount = 0;
    const url = `/api/management-web/v0/strata/charges/${charge.charge_id}/invoice-email`;
    try {
      const first = await harness.app.inject({ method: 'POST', url, headers: staffBearer() });
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(sendStatus(first) ?? (JSON.parse(first.body) as { status?: string }).status, 'unknown', first.body);
      assert.equal(dataCount, 1, 'server received invoice DATA once');
      const retry = await harness.app.inject({ method: 'POST', url, headers: staffBearer() });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(dataCount, 1, 'unknown invoice must not be auto-retried');
    } finally {
      setCreateTransport(undefined);
      delete process.env['SMTP_HOST'];
    }
  });
}

test('F1d — real nodemailer, connection refused is failed; retry against a live server sends once', async () => {
  await harness.reseed();
  const email = `p1f1-d-refused-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);
  // Stale unix socket (bound then abandoned): ECONNREFUSED, no TCP listener.
  createStaleUnixSocket(STALE_SOCK);
  useRealClient(STALE_SOCK);
  dataCount = 0;
  try {
    const first = await postSend(noticeId);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(sendStatus(first), 'failed', first.body);
    const [row] = await harness.admin.query<{ status: string }>(
      `SELECT status FROM strata.email_outbox WHERE kind='notice' AND subject_id=$1`,
      [noticeId],
    );
    assert.equal(row?.status, 'failed');
    assert.equal(dataCount, 0);
    useRealClient(SOCK);
    fakeMode = 'accept';
    dataCount = 0;
    const retry = await postSend(noticeId);
    assert.equal(retry.statusCode, 200, retry.body);
    assert.equal(dataCount, 1, 'a proven connect failure may retry and send once');
  } finally {
    setCreateTransport(undefined);
    delete process.env['SMTP_HOST'];
  }
});

test('F1d — real nodemailer, 5xx after DATA is failed', async () => {
  await harness.reseed();
  const email = `p1f1-d-5xx-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);
  useRealClient();
  fakeMode = 'reject5xx';
  dataCount = 0;
  try {
    const first = await postSend(noticeId);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(sendStatus(first), 'failed', first.body);
    assert.equal(dataCount, 1);
    const [row] = await harness.admin.query<{ status: string }>(
      `SELECT status FROM strata.email_outbox WHERE kind='notice' AND subject_id=$1`,
      [noticeId],
    );
    assert.equal(row?.status, 'failed');
  } finally {
    setCreateTransport(undefined);
    delete process.env['SMTP_HOST'];
  }
});

test('F1e — a stale sending row is reported unknown and is not re-sent', async () => {
  await harness.reseed();
  const email = `p1f1-e-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);
  const calls: string[] = [];
  setDeliverMail(async (message) => {
    calls.push(message.to);
    return { status: 'log-only', transport: 'log', detail: 'fake accept' };
  });
  failNextMarkResult();
  const first = await postSend(noticeId);
  assert.ok(first.statusCode >= 500, first.body);
  await harness.admin.query(
    `UPDATE strata.email_outbox SET claimed_at = now() - interval '16 minutes'
      WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  const retry = await postSend(noticeId);
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(calls.length, 1, 'stale sending must not be re-claimed');
  const delivery = await harness.app.inject({
    method: 'GET',
    url: `/api/management-web/v0/notices/${noticeId}/delivery`,
    headers: staffBearer(),
  });
  assert.equal(delivery.statusCode, 200, delivery.body);
  const body = JSON.parse(delivery.body) as { email: { sends: { status: string }[] } };
  assert.equal(body.email.sends[0]?.status, 'unknown');
});


test('F1g — two concurrent manual resends of an unknown row give one send', async () => {
  await harness.reseed();
  const email = `p1f1-g-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);
  let calls = 0;
  setDeliverMail(async () => {
    calls += 1;
    if (calls === 1) return { status: 'unknown', transport: 'smtp', detail: 'lost ack' };
    return { status: 'accepted', transport: 'smtp', detail: 'accepted' };
  });
  const first = await postSend(noticeId);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(sendStatus(first), 'unknown');
  const [orig] = await harness.admin.query<{ outbox_id: string }>(
    `SELECT outbox_id FROM strata.email_outbox WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  assert.ok(orig);
  const resend = () => harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email/resend`,
    headers: staffBearer(),
    payload: { outboxId: orig.outbox_id },
  });
  const [a, b] = await Promise.all([resend(), resend()]);
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(b.statusCode, 200, b.body);
  assert.equal(calls, 2, 'one original send plus one admitted resend');
  const third = await resend();
  assert.equal(third.statusCode, 200, third.body);
  assert.equal(calls, 2, 'a retry of the same original row is not a new send');
});

test('F1 — manual resend: transport accepted then markResult throw leaves sending, not failed; retry of the same original id does not send again', async () => {
  await harness.reseed();
  const email = `p1f1-resend-mr-${randomUUID().slice(0, 8)}@wingfu.example`;
  const noticeId = await publishOneRecipientNotice(email);
  let calls = 0;
  setDeliverMail(async () => {
    calls += 1;
    if (calls === 1) return { status: 'unknown', transport: 'smtp', detail: 'lost ack' };
    return { status: 'accepted', transport: 'smtp', detail: 'accepted' };
  });
  const first = await postSend(noticeId);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(sendStatus(first), 'unknown');
  const [orig] = await harness.admin.query<{ outbox_id: string }>(
    `SELECT outbox_id FROM strata.email_outbox WHERE kind='notice' AND subject_id=$1`,
    [noticeId],
  );
  assert.ok(orig);
  const resend = () => harness.app.inject({
    method: 'POST',
    url: `/api/management-web/v0/notices/${noticeId}/email/resend`,
    headers: staffBearer(),
    payload: { outboxId: orig.outbox_id },
  });
  failNextMarkResult();
  const accepted = await resend();
  assert.ok(accepted.statusCode >= 500, `resend should fail after accept, got ${accepted.statusCode} ${accepted.body}`);
  assert.equal(calls, 2, 'original send plus one accepted resend');
  const rows = await harness.admin.query<{ outbox_id: string; status: string; generation: number }>(
    `SELECT outbox_id, status, generation FROM strata.email_outbox
      WHERE kind='notice' AND subject_id=$1 ORDER BY generation`,
    [noticeId],
  );
  const resendRow = rows.find((r) => r.outbox_id !== orig.outbox_id);
  assert.ok(resendRow, `expected a resend row, got ${JSON.stringify(rows)}`);
  assert.equal(resendRow.status, 'sending', `accepted resend must not be stored failed: ${JSON.stringify(rows)}`);
  const retry = await resend();
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(calls, 2, 'retry of the same original id must not send again');
  const still = await harness.admin.query<{ status: string }>(
    `SELECT status FROM strata.email_outbox WHERE outbox_id=$1`,
    [resendRow.outbox_id],
  );
  assert.equal(still[0]?.status, 'sending');
});
