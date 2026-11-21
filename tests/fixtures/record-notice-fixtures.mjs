#!/usr/bin/env node
/**
 * RECORD THE NOTICES FIXTURES FROM REAL RESPONSES (GEN-047 D3).
 *
 * ─── WHY A RECORDER RATHER THAN HAND-WRITTEN JSON ────────────────────────────
 *
 * `GEN-042` shipped eleven write routes, R1 and R3 with NO fixtures, and both its
 * own report and `GEN-043`'s repeated the sentence "no fixtures were added for the
 * new operations" without either close ruling catching it (`UI-045` G1). A fixture
 * is the only artifact that lets a UI build against an operation before the server
 * is reachable, so eleven operations were uncontracted in practice while looking
 * contracted on paper.
 *
 * They are RECORDED, not typed out, because a hand-written fixture is a claim about
 * what the server returns and drifts the moment the server changes. Every document
 * this writes came back over HTTP from the real routes against the seeded world.
 *
 * ─── DETERMINISM ─────────────────────────────────────────────────────────────
 *
 * Client keys are FIXED, so `deriveActId` produces the same notice ids on every
 * run and re-recording is a no-op when nothing changed. The genuinely per-run
 * values — correlation ids and wall-clock timestamps — are normalised to the
 * constants below, and that normalisation is the ONLY edit made to a real
 * response body. Everything else is byte-faithful.
 *
 *   node tests/fixtures/record-notice-fixtures.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHarness } from '../../apps/api/dist/testing/harness.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MGMT = '/api/management-web/v0';
const RES = '/api/resident-mobile/v0';
const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const MANAGER = 'stf_wfg_manager';
const APPROVER = 'stf_wfg_dual_role';
const ELSEWHERE = 'stf_wfg_counter';

const CORRELATION = '2b3c4d5e-0000-4000-8000-000000000030';
const INSTANT = '2026-09-03T09:00:00+08:00';

/** The only edit to a real response: per-run values pinned so re-recording is stable. */
const normalise = (v) => {
  if (Array.isArray(v)) return v.map(normalise);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => {
      if (k === 'correlationId') return [k, CORRELATION];
      if (/At$|^generatedAt$|^recordedAt$/.test(k) && typeof x === 'string') return [k, INSTANT];
      return [k, normalise(x)];
    }));
  }
  return v;
};

const written = [];
const write = (surface, file, body, schema, operationId, httpStatus, notes) => {
  const path = join(REPO, 'tests/fixtures', surface, file);
  writeFileSync(path, JSON.stringify(normalise(body), null, 2) + '\n');
  written.push({ file, screen: 'notices', state: file.split('/')[1].replace('.json', ''),
                 schema, operationId, httpStatus, notes,
                 scenario: 'scenarios/management__notices__lifecycle.sql', worldInstant: INSTANT });
};

const harness = await startHarness();
const cfg = loadConfig();
const owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
const noticesDb = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });

const staff = (p = MANAGER) => ({ authorization: `Bearer ${harness.modules.staffAuth.issue(p)}` });
const resident = (r) => ({ authorization: `Bearer ${harness.modules.auth.issue(r)}` });
const post = (url, headers, payload) => harness.app.inject({ method: 'POST', url, headers, payload });
const get = (url, headers) => harness.app.inject({ method: 'GET', url, headers });
const jsonOf = (r) => JSON.parse(r.body);

// ─── RESET FIRST, so the recorder is re-runnable ─────────────────────────────
// The client keys are FIXED, which is what makes the notice ids stable — and it
// also means a second run REPLAYS the compose and gets version 1 for a notice
// already at version 7. The first re-run died exactly there. Removing this
// recorder's own notices makes the script idempotent, which is the property the
// fixtures themselves are supposed to have.
const RECORDER_TITLES = ['Scheduled water interruption, 14 August',
                         'Scheduled water interruption, 14 August (revised)'];
// (every extra notice the refusal block composes reuses the same title, so this covers them)
const mine = await noticesDb.query(
  `SELECT DISTINCT notice_id FROM notice WHERE title_en = ANY($1)`, [RECORDER_TITLES]);
for (const { notice_id } of mine) {
  await noticesDb.query(`DELETE FROM notice_acknowledgement WHERE notice_id=$1`, [notice_id]);
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id=$1`, [notice_id]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id=$1)`,
    [notice_id]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id=$1`, [notice_id]);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice' AND target_id=$1`, [notice_id]);
}
await owner.query(
  `DELETE FROM platform.idempotency_record WHERE idempotency_key LIKE 'fx-notices-%'`);

// A resident seated in Block A, so the audience resolver reaches them.
const RESIDENT_ID = 'res_fx_notices';
const unit = (await owner.query(
  `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
    WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [BLOCK_A]))[0].unit_id;
await owner.query(
  `INSERT INTO resident.resident (resident_id, organization_id, display_name)
   VALUES ($1,$2,'Fixture resident') ON CONFLICT (resident_id) DO NOTHING`, [RESIDENT_ID, ORG]);
await owner.query(
  `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                   unit_class, role, status, source, effective_from)
   VALUES ('occa_fx_notices',1,'occ_fx_notices',$1,$2,'residential','tenant','active','seed',
           now() - interval '1 day') ON CONFLICT (assertion_id) DO NOTHING`, [RESIDENT_ID, unit]);

const compose = {
  noticeType: 'planned_interruption',
  titleEn: 'Scheduled water interruption, 14 August',
  titleZhHant: '8月14日計劃性停水',
  bodyEn: 'Water to Block A will be interrupted from 09:00 to 17:00 on 14 August.',
  bodyZhHant: 'A座供水將於8月14日上午九時至下午五時暫停。',
  mandatoryAck: true,
  responseOptions: ['will_be_home', 'will_be_away'],
  targets: [{ nodeKind: 'building', nodeId: BLOCK_A }],
};

// ─── the eight staff writes, in the order the lifecycle allows ───────────────
const composed = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-compose' }, compose);
const id = jsonOf(composed).noticeId;
write('management-web', 'notices/compose-request.json', compose, 'ComposeNoticeRequest', 'composeNotice', 201,
      'The request that produced notices/compose.json. Bilingual and mandatory-ack, targeting one building.');
write('management-web', 'notices/compose.json', jsonOf(composed), 'NoticeActResponse', 'composeNotice', 201,
      'A draft, version 1. Compose is CLIENT-KEYED: the same key makes one draft, not two.');

let version = jsonOf(composed).version;
const step = async (op, path, payload, note, principal = MANAGER) => {
  const res = await post(`${MGMT}/notices/${id}/${path}`, { ...staff(principal), 'idempotency-key': `fx-notices-${path}` }, payload);
  if (res.statusCode >= 300) throw new Error(`${op} failed ${res.statusCode}: ${res.body}`);
  version = jsonOf(res).version;
  write('management-web', `notices/${path}-request.json`, payload, 'NoticeTransitionRequest', op, 200,
        `The request that produced notices/${path}.json.`);
  write('management-web', `notices/${path}.json`, jsonOf(res), 'NoticeActResponse', op, 200, note);
};

await step('reviseNotice', 'revise', { fromVersion: version, titleEn: 'Scheduled water interruption, 14 August (revised)' },
           'Content, schedule AND targeting may all change while a notice is a draft.');
await step('submitNotice', 'submit', { fromVersion: version },
           'draft -> pending_approval. A gated type only; submitting an ungated one is refused.');
await step('approveNotice', 'approve', { fromVersion: version },
           "pending_approval -> approved, against the APPROVER's own floor.", APPROVER);
await step('publishNotice', 'publish', { fromVersion: version },
           'approved -> live, taking the audience snapshot in the same transaction.');
await step('correctNotice', 'correct', { fromVersion: version, reasonCode: 'factual_error', bodyEn: 'Water to Block A will be interrupted from 09:00 to 18:00 on 14 August.' },
           'Content only. A correction may not retarget: the snapshot records who WAS addressed.');

// DECLINE needs its own notice: approving consumed the only pending_approval
// state on the first one, and a lifecycle can be walked one way at a time. The
// first recording pass simply skipped the operation, which is exactly the shape
// of the gap this whole item exists to close — so the parity check catches it.
{
  const c2 = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-compose-decline' }, compose);
  const id2 = jsonOf(c2).noticeId;
  const sub = await post(`${MGMT}/notices/${id2}/submit`, { ...staff(), 'idempotency-key': 'fx-notices-submit-decline' },
                         { fromVersion: jsonOf(c2).version });
  const declineReq = { fromVersion: jsonOf(sub).version, reasonCode: 'needs_translation' };
  const dec = await post(`${MGMT}/notices/${id2}/decline`, { ...staff(APPROVER), 'idempotency-key': 'fx-notices-decline' }, declineReq);
  if (dec.statusCode >= 300) throw new Error(`decline failed ${dec.statusCode}: ${dec.body}`);
  write('management-web', 'notices/decline-request.json', declineReq, 'NoticeTransitionRequest', 'declineNotice', 200,
        'The request that produced notices/decline.json. A reason is REQUIRED to decline.');
  write('management-web', 'notices/decline.json', jsonOf(dec), 'NoticeActResponse', 'declineNotice', 200,
        'pending_approval -> draft, not a dead end: the point of declining is that the author revises and resubmits.');
}

// R3 and the detail, while the notice is live and has a snapshot.
write('management-web', 'notices/outstanding.json',
      jsonOf(await get(`${MGMT}/notices/${id}/acknowledgements`, staff())),
      'NoticeOutstandingResponse', 'getNoticeOutstanding', 200,
      'UI-045 G1: this operation had NO fixture, so its screen was built as a stated gap with no renderer.');

// ─── the three resident acts, against the live notice ────────────────────────
write('resident-mobile', 'notices/read.json',
      jsonOf(await post(`${RES}/notices/${id}/read`, resident(RESIDENT_ID), undefined)),
      'NoticeAckResponse', 'markNoticeRead', 200, 'A FACT, not a state. Repeating it is a no-op returning the original act.');
write('resident-mobile', 'notices/acknowledge.json',
      jsonOf(await post(`${RES}/notices/${id}/acknowledge`, resident(RESIDENT_ID), undefined)),
      'NoticeAckResponse', 'acknowledgeNotice', 200, 'Once-only: a duplicate returns the original act.');
const respondReq = { option: 'will_be_home' };
write('resident-mobile', 'notices/respond-request.json', respondReq, 'NoticeResponseRequest', 'respondToNotice', 200,
      'Only a DECLARED option is accepted; free text is refused.');
write('resident-mobile', 'notices/respond.json',
      jsonOf(await post(`${RES}/notices/${id}/respond`, resident(RESIDENT_ID), respondReq)),
      'NoticeAckResponse', 'respondToNotice', 200, 'Latest-wins, and only a declared option.');
write('resident-mobile', 'notices/my-notices.json',
      jsonOf(await get(`${RES}/notices`, resident(RESIDENT_ID))),
      'MyNoticesResponse', 'getMyNotices', 200,
      'R1. Gated by the audience SNAPSHOT, and carrying no governance field at all.');

// ─── withdraw last: it ends the notice's visibility ──────────────────────────
await step('withdrawNotice', 'withdraw', { fromVersion: version, reasonCode: 'superseded' },
           'live -> withdrawn. The snapshot is RETAINED: withdrawing un-tells people going forward.');

// ─── one refusal per write surface, as a Problem ─────────────────────────────
// ─── GEN-052 D1: ONE FIXTURE PER NOTICE PROBLEM TYPE, checked by the TYPE it carries ──
// Each refusal is provoked by the real act and written ONLY if the body carries
// the Problem type the fixture is named for — a refusal that came back as some
// other type is reported and skipped, never filed under the wrong name (UI-051 G2).
const refusal = async (name, expectType, res, op, note) => {
  const body = jsonOf(res); const got = String(body.type ?? '').split('/').pop();
  if (got !== expectType) { console.log(`  SKIP ${name}: expected ${expectType}, got ${got} (${res.statusCode})`); return; }
  write('management-web', `notices/refusal-${name}.json`, body, 'Problem', op, res.statusCode, note);
};
{
  // wrong-state: revise a notice that is no longer a draft (the first notice is withdrawn).
  await refusal('wrong-state', 'notice-wrong-state',
    await post(`${MGMT}/notices/${id}/revise`, { ...staff(), 'idempotency-key': 'fx-notices-ws' }, { fromVersion: version, titleEn: 'x' }),
    'reviseNotice', 'revise refuses on STATE: a withdrawn notice is not a draft.');
  // incomplete-translation: an ungated draft with one language empty, published.
  const half = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-half' },
    { ...compose, noticeType: 'general', bodyZhHant: '' });
  const halfId = jsonOf(half).noticeId;
  await refusal('incomplete-translation', 'notice-incomplete-translation',
    await post(`${MGMT}/notices/${halfId}/publish`, { ...staff(), 'idempotency-key': 'fx-notices-half-pub' }, { fromVersion: 1 }),
    'publishNotice', 'publish refuses a half-translated notice: a CONTENT refusal, shown at act time, never predicted in permittedActions.');
  // approval-required: publish a GATED draft straight away.
  const gatedDraft = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-gated' }, compose);
  await refusal('approval-required', 'notice-approval-required',
    await post(`${MGMT}/notices/${jsonOf(gatedDraft).noticeId}/publish`, { ...staff(), 'idempotency-key': 'fx-notices-gated-pub' }, { fromVersion: 1 }),
    'publishNotice', 'a gated type publishes only from approved; from draft it is approval-required.');
  // retargeting-forbidden: correct a LIVE notice with different targets.
  const live = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-live2' }, { ...compose, noticeType: 'general' });
  const liveId = jsonOf(live).noticeId;
  const pub = await post(`${MGMT}/notices/${liveId}/publish`, { ...staff(), 'idempotency-key': 'fx-notices-live2-pub' }, { fromVersion: 1 });
  await refusal('retargeting-forbidden', 'notice-retargeting-forbidden',
    await post(`${MGMT}/notices/${liveId}/correct`, { ...staff(), 'idempotency-key': 'fx-notices-retarget' },
      { fromVersion: jsonOf(pub).version, reasonCode: 'factual_error', targets: [{ nodeKind: 'building', nodeId: 'blk_wfg_b' }] }),
    'correctNotice', 'a correction may not retarget: the snapshot records who WAS addressed.');
  // not-found
  await refusal('not-found', 'notice-not-found',
    await get(`${MGMT}/notices/ntc_does_not_exist`, staff()), 'getNotice', 'out of scope and does-not-exist are one answer.');
  // schedule-inverted: publishAt after expireAt.
  const inv = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-inv' },
    { ...compose, noticeType: 'general', publishAt: '2026-09-10T09:00:00+08:00', expireAt: '2026-09-09T09:00:00+08:00' });
  if (inv.statusCode < 300) {
    await refusal('schedule-inverted', 'notice-schedule-inverted',
      await post(`${MGMT}/notices/${jsonOf(inv).noticeId}/publish`, { ...staff(), 'idempotency-key': 'fx-notices-inv-pub' }, { fromVersion: 1 }),
      'publishNotice', 'publish refuses a schedule whose expiry precedes its publication.');
  } else await refusal('schedule-inverted', 'notice-schedule-inverted', inv, 'composeNotice', 'compose refuses a schedule whose expiry precedes its publication.');
  // empty-audience: a building with no residential occupants.
  const empty = await post(`${MGMT}/notices`, { ...staff(), 'idempotency-key': 'fx-notices-empty' },
    { ...compose, noticeType: 'general', targets: [{ nodeKind: 'building', nodeId: 'blk_wfg_b' }] });  // blk_wfg_b: zero residents
  if (empty.statusCode < 300) {
    await refusal('empty-audience', 'notice-empty-audience',
      await post(`${MGMT}/notices/${jsonOf(empty).noticeId}/publish`, { ...staff(), 'idempotency-key': 'fx-notices-empty-pub' }, { fromVersion: 1 }),
      'publishNotice', 'a rule resolving to nobody is refused: never published to an empty room.');
  } else await refusal('empty-audience', 'notice-empty-audience', empty, 'composeNotice', 'a rule addressing no node is refused at compose.');
}

const stale = await post(`${MGMT}/notices/${id}/revise`, { ...staff(), 'idempotency-key': 'fx-notices-stale' },
                         { fromVersion: 1, titleEn: 'x' });
write('management-web', 'notices/refusal-stale-version.json', jsonOf(stale), 'Problem', 'reviseNotice', stale.statusCode,
      'A stale fromVersion on a notice that has moved. RELABELLED at GEN-052: the type is notice-stale-version.');
const outOfScope = await post(`${MGMT}/notices`, { ...staff(ELSEWHERE), 'idempotency-key': 'fx-notices-oos' }, compose);
write('management-web', 'notices/refusal-out-of-scope.json', jsonOf(outOfScope), 'Problem', 'composeNotice', outOfScope.statusCode,
      'A caller whose scope does not COVER every addressed node (ADR-017 conjunction).');

writeFileSync(join(REPO, 'tests/fixtures/notices-manifest-entries.json'),
              JSON.stringify(written, null, 2) + '\n');

// ─── LEAVE THE DATABASE AS IT WAS FOUND ──────────────────────────────────────
// The world this recorder builds belongs in the SCENARIO FILE, which is how it is
// reproduced, not in the shared dev database. Leaving it behind put a `tenant`
// occupancy into the seeded world and reddened `party-interest-seed`'s F1 — a
// test asserting that a particular contradiction is CONSTRUCTED in a test and
// never seeded. A recorder that quietly changes the world every other test reads
// is a worse problem than the fixtures it produces are worth.
for (const { notice_id } of await noticesDb.query(
  `SELECT DISTINCT notice_id FROM notice WHERE title_en = ANY($1)`, [RECORDER_TITLES])) {
  await noticesDb.query(`DELETE FROM notice_acknowledgement WHERE notice_id=$1`, [notice_id]);
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id=$1`, [notice_id]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id=$1)`, [notice_id]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id=$1`, [notice_id]);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice' AND target_id=$1`, [notice_id]);
}
await owner.query(`DELETE FROM platform.idempotency_record WHERE idempotency_key LIKE 'fx-notices-%'`);
await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id = 'occ_fx_notices'`);
await owner.query(`DELETE FROM resident.resident  WHERE resident_id  = 'res_fx_notices'`);

console.log(`recorded ${written.length} fixture(s); notice ${id}; world restored`);
await Promise.all([owner.close(), noticesDb.close()]);
await harness.close();
