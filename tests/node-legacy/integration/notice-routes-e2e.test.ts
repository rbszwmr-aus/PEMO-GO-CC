/**
 * GEN-043 C3/C4 — the notice routes, END TO END over HTTP.
 *
 * ─── WHY THIS FILE EXISTS, AND WHAT GEN-042 GOT WRONG ───────────────────────
 *
 * The acts have 27 passing cases beneath these routes. That is not coverage of the
 * ROUTES, because a route is an adapter and an adapter fails by being DISCONNECTED
 * rather than by computing the wrong answer. `GEN-042` shipped `revise` and
 * `correct` passing an EMPTY content object: the act was correct, the version
 * advanced, the change was silently discarded, and the route tests were green
 * because they asserted the version had moved.
 *
 * So every assertion here is about RESULTING STATE OR CONTENT — the row that
 * exists, the text that changed, the notice that is or is not in a list — and
 * never about a status code alone. `[adapter-bite-severs-the-plumbing]`.
 *
 * The resident routes matter most: the adapter is where token -> principal ->
 * resident is decided, which is the "acting as oneself" boundary, and it cannot be
 * exercised anywhere below HTTP.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createModuleDb, loadConfig, likePrefix, likeEscapeClause } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const MGMT = '/api/management-web/v0';
const RES = '/api/resident-mobile/v0';
const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const BLOCK_B = 'blk_wfg_b';
const MANAGER = 'stf_wfg_manager';
/**
 * THE APPROVER IS A DIFFERENT PRINCIPAL, and that is the point of the test rather
 * than a fixture detail. `approve` and `decline` demand a `RoleScope<'approver'>`,
 * which the manager's estate_staff grants cannot produce — the first version of
 * this test used the manager throughout and got 404, because an empty approver
 * scope covers nothing. Seeded: stf_wfg_dual_role holds approver at Block A.
 */
const APPROVER = 'stf_wfg_dual_role';
/**
 * A staff principal whose scope EXCLUDES Block A — seeded with `estate_staff` at
 * `location:loc_wfg_clubhouse` only. Without a caller like this the read tests can
 * only assert that a notice IS present, and a route that ignored the caller's
 * scope entirely would pass them. This is the negative half.
 */
const ELSEWHERE = 'stf_wfg_counter';

let harness: Harness;
let owner: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;

const staff = (p = MANAGER) => ({ authorization: `Bearer ${harness.modules.staffAuth.issue(p)}` });
const resident = (r: string) => ({ authorization: `Bearer ${harness.modules.auth.issue(r)}` });

const post = (url: string, headers: Record<string, string>, payload: unknown) =>
  harness.app.inject({ method: 'POST', url, headers, payload });
const get = (url: string, headers: Record<string, string>) =>
  harness.app.inject({ method: 'GET', url, headers });

const key = () => ({ 'idempotency-key': randomUUID() });

/** A resident occupying a unit in a block, so the resolver reaches them. */
const seat = async (tag: string, building = BLOCK_A) => {
  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [building]))[0]!.unit_id;
  const id = `res_e2e_${tag}`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [id, ORG, tag]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`, [`occa_e2e_${tag}`, `occ_e2e_${tag}`, id, unit]);
  return id;
};

const composeVia = async (over: Record<string, unknown> = {}) => {
  const res = await post(`${MGMT}/notices`, { ...staff(), ...key() }, {
    noticeType: 'general', titleEn: 'Original title', titleZhHant: '原標題',
    bodyEn: 'Original body', bodyZhHant: '原內容',
    targets: [{ nodeKind: 'building', nodeId: BLOCK_A }], ...over,
  });
  assert.equal(res.statusCode, 201, res.body);
  return JSON.parse(res.body) as { noticeId: string; version: number };
};

const currentOf = async (noticeId: string) =>
  (await noticesDb.query<{ title_en: string; body_en: string; version: number; lifecycle_state: string }>(
    `SELECT title_en, body_en, version, lifecycle_state FROM notice_current WHERE notice_id=$1`,
    [noticeId]))[0];

test.before(async () => {
  harness = await startHarness();
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  noticesDb = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await noticesDb.query(`DELETE FROM notice_acknowledgement WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`,
    [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix('occ_e2e_')]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix('res_e2e_')]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice'`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation LIKE 'compose\\_notice' ESCAPE '\\'`);
  await Promise.all([owner.close(), noticesDb.close()]);
  await harness.close();
});

// ─── the eight staff write routes ───────────────────────────────────────────

test('C3 — compose over HTTP creates the draft WITH the submitted content', async () => {
  const { noticeId } = await composeVia({ titleEn: 'A specific title', bodyEn: 'A specific body' });
  const cur = await currentOf(noticeId);
  assert.equal(cur?.title_en, 'A specific title',
    'the body reached the act — not merely a 201');
  assert.equal(cur?.body_en, 'A specific body');
  assert.equal(cur?.lifecycle_state, 'draft');
});

test('C3 — revise over HTTP APPLIES the new content (the GEN-042 defect)', async () => {
  const { noticeId } = await composeVia();
  const res = await post(`${MGMT}/notices/${noticeId}/revise`, { ...staff(), ...key() },
    { fromVersion: 1, titleEn: 'Revised title', bodyEn: 'Revised body' });
  assert.equal(res.statusCode, 200, res.body);

  const cur = await currentOf(noticeId);
  assert.equal(cur?.version, 2, 'the version advanced');
  assert.equal(cur?.title_en, 'Revised title',
    'AND THE CONTENT CHANGED. GEN-042 asserted only the first of these, and the route '
    + 'was discarding the body while passing its test');
  assert.equal(cur?.body_en, 'Revised body');
});

test('C3 — submit, approve, publish over HTTP, ending live with a snapshot', async () => {
  const r = await seat('flow');
  const { noticeId } = await composeVia({ noticeType: 'planned_interruption' });

  const sub = await post(`${MGMT}/notices/${noticeId}/submit`, { ...staff(), ...key() },
    { fromVersion: 1 });
  assert.equal(sub.statusCode, 200, sub.body);
  assert.equal((await currentOf(noticeId))?.lifecycle_state, 'pending_approval');

  const app2 = await post(`${MGMT}/notices/${noticeId}/approve`,
    { ...staff(APPROVER), ...key() }, { fromVersion: 2, reasonCode: 'approved_as_submitted' });
  assert.equal(app2.statusCode, 200, app2.body);
  assert.equal((await currentOf(noticeId))?.lifecycle_state, 'approved');

  assert.equal((await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() },
    { fromVersion: 3 })).statusCode, 200);
  assert.equal((await currentOf(noticeId))?.lifecycle_state, 'live');

  const [aud] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_audience WHERE notice_id=$1`, [noticeId]);
  assert.notEqual(aud?.n, '0', 'publishing wrote the audience snapshot');
  assert.ok((await owner.query(
    `SELECT 1 FROM platform.outbox_message WHERE payload->>'notice_id'=$1`, [noticeId])).length > 0,
    'and emitted the event');
  void r;
});

test('C3 — decline over HTTP returns to draft and requires a reason', async () => {
  const { noticeId } = await composeVia({ noticeType: 'emergency' });
  await post(`${MGMT}/notices/${noticeId}/submit`, { ...staff(), ...key() }, { fromVersion: 1 });

  const noReason = await post(`${MGMT}/notices/${noticeId}/decline`, { ...staff(APPROVER), ...key() },
    { fromVersion: 2 });
  assert.equal(noReason.statusCode, 400, 'a decline without a reason is refused at the route');

  const dec = await post(`${MGMT}/notices/${noticeId}/decline`, { ...staff(APPROVER), ...key() },
    { fromVersion: 2, reasonCode: 'inaccurate' });
  assert.equal(dec.statusCode, 200, dec.body);
  assert.equal((await currentOf(noticeId))?.lifecycle_state, 'draft');
});

test('C3 — correct over HTTP applies content and REFUSES a retarget', async () => {
  const r = await seat('correct');
  const { noticeId } = await composeVia();
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });

  const retarget = await post(`${MGMT}/notices/${noticeId}/correct`, { ...staff(), ...key() },
    { fromVersion: 2, reasonCode: 'factual_error',
      targets: [{ nodeKind: 'building', nodeId: BLOCK_B }] });
  assert.equal(retarget.statusCode, 409, retarget.body);
  assert.match(retarget.body, /retargeting-forbidden/);

  const ok = await post(`${MGMT}/notices/${noticeId}/correct`, { ...staff(), ...key() },
    { fromVersion: 2, reasonCode: 'factual_error', bodyEn: 'Corrected body' });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal((await currentOf(noticeId))?.body_en, 'Corrected body',
    'the correction reached the act');
  void r;
});

test('C3 — withdraw over HTTP retains the snapshot', async () => {
  await seat('withdraw');
  const { noticeId } = await composeVia();
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });
  const [before] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_audience WHERE notice_id=$1`, [noticeId]);

  assert.equal((await post(`${MGMT}/notices/${noticeId}/withdraw`, { ...staff(), ...key() },
    { fromVersion: 2, reasonCode: 'issued_in_error' })).statusCode, 200);
  assert.equal((await currentOf(noticeId))?.lifecycle_state, 'withdrawn');
  const [after] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_audience WHERE notice_id=$1`, [noticeId]);
  assert.equal(after?.n, before?.n, 'withdrawing does not erase who was told');
});

// ─── the three resident write routes: token -> principal -> resident ────────

test('C3 — a resident records read, acknowledge and respond over HTTP', async () => {
  const r = await seat('acks');
  const { noticeId } = await composeVia({ responseOptions: ['yes', 'no'] });
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });

  assert.equal((await post(`${RES}/notices/${noticeId}/read`, resident(r), {})).statusCode, 200);
  assert.equal((await post(`${RES}/notices/${noticeId}/acknowledge`, resident(r), {})).statusCode, 200);
  assert.equal((await post(`${RES}/notices/${noticeId}/respond`,
    { ...resident(r), ...key() }, { option: 'yes' })).statusCode, 200);

  const rows = await noticesDb.query<{ kind: string; response: string | null }>(
    `SELECT kind, response FROM notice_acknowledgement WHERE notice_id=$1 AND resident_id=$2 ORDER BY kind`,
    [noticeId, r]);
  assert.deepEqual(rows.map((x) => x.kind), ['acknowledged', 'read', 'responded'],
    'all three rows exist — the token resolved to this resident and reached the act');
  assert.equal(rows.find((x) => x.kind === 'responded')?.response, 'yes',
    'AND the chosen option was plumbed through, not defaulted');
});

test('C3 — a resident NOT in the snapshot is refused at HTTP', async () => {
  const addressed = await seat('inside2');
  const { noticeId } = await composeVia();
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });
  const outsider = await seat('outsider');   // seated AFTER publication

  const res = await post(`${RES}/notices/${noticeId}/read`, resident(outsider), {});
  assert.equal(res.statusCode, 404, res.body);
  assert.match(res.body, /notice-not-addressed/);
  assert.equal((await post(`${RES}/notices/${noticeId}/read`, resident(addressed), {})).statusCode, 200);
});

// ─── the four read routes ───────────────────────────────────────────────────

test('C3 — R1 "my notices" over HTTP carries no governance field', async () => {
  const r = await seat('r1');
  const { noticeId } = await composeVia({ titleEn: 'Visible to residents' });
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });

  const res = await get(`${RES}/notices`, resident(r));
  assert.equal(res.statusCode, 200, res.body);
  const body = JSON.parse(res.body) as { notices: Record<string, unknown>[] };
  const mine = body.notices.find((n) => n['noticeId'] === noticeId);
  assert.ok(mine !== undefined, 'the addressed resident sees it');

  for (const forbidden of ['history', 'targets', 'recordedBy', 'version', 'disposition']) {
    assert.equal(forbidden in mine, false, `${forbidden} must never reach a resident`);
  }
});

test('C3 — R2 list and detail over HTTP, in the ADR-019 shape', async () => {
  const { noticeId } = await composeVia({ titleEn: 'Staff visible' });

  const list = await get(`${MGMT}/notices`, staff());
  assert.equal(list.statusCode, 200, list.body);
  const lb = JSON.parse(list.body) as { meta: unknown; notices: Record<string, unknown>[] };
  const row = lb.notices.find((n) => n['noticeId'] === noticeId);
  assert.ok(row !== undefined, 'a draft appears in the staff list');
  assert.equal(row['titleEn'], 'Staff visible', 'per-language content, not a single title');
  assert.equal('title' in row, false, 'the pre-ADR-019 single title is gone');
  assert.equal(row['lifecycleState'], 'draft');

  const detail = await get(`${MGMT}/notices/${noticeId}`, staff());
  assert.equal(detail.statusCode, 200, detail.body);
  const db = (JSON.parse(detail.body) as { notice: Record<string, unknown> }).notice;
  assert.ok(Array.isArray(db['history']) && (db['history'] as unknown[]).length >= 1,
    'the disposition history is staff-visible');
  assert.ok(Array.isArray(db['targets']), 'and so is the targeting rule');
  for (const gone of ['audience', 'channels', 'approval']) {
    assert.equal(gone in db, false, `${gone} was the S5 model and is gone`);
  }

  // THE NEGATIVE HALF. A caller scoped away from Block A must not see it, in the
  // list or the detail. Without this a route that ignored the caller's scope would
  // pass every assertion above.
  const otherList = await get(`${MGMT}/notices`, staff(ELSEWHERE));
  assert.equal(otherList.statusCode, 200);
  const ob = JSON.parse(otherList.body) as { notices: Record<string, unknown>[] };
  assert.ok(!ob.notices.some((n) => n['noticeId'] === noticeId),
    'a caller whose scope excludes the targeting must not see the notice');

  const otherDetail = await get(`${MGMT}/notices/${noticeId}`, staff(ELSEWHERE));
  assert.equal(otherDetail.statusCode, 404,
    'and the detail answers 404 — out of scope and does not exist are one answer');
});

test('C3 — R3 outstanding over HTTP lists recipients and their status', async () => {
  const r = await seat('r3');
  const { noticeId } = await composeVia({ mandatoryAck: true });
  await post(`${MGMT}/notices/${noticeId}/publish`, { ...staff(), ...key() }, { fromVersion: 1 });
  await post(`${RES}/notices/${noticeId}/acknowledge`, resident(r), {});

  const res = await get(`${MGMT}/notices/${noticeId}/acknowledgements`, staff());
  assert.equal(res.statusCode, 200, res.body);
  const body = JSON.parse(res.body) as {
    mandatoryAck: boolean; recipients: { residentId: string; acknowledged: string | null }[];
  };
  assert.equal(body.mandatoryAck, true);
  const mine = body.recipients.find((x) => x.residentId === r);
  assert.ok(mine?.acknowledged !== null && mine?.acknowledged !== undefined,
    'the acknowledgement recorded over HTTP is visible to staff');
});
