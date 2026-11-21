/**
 * ADR-019 D6, N3 — the acknowledgement acts. THE FIRST RESIDENT-AUTHORED WRITES
 * in the notices domain.
 *
 * ACTS ONLY: no routes. What is under test is who may record what, against which
 * notice, and how a duplicate differs from a change of mind.
 *
 * The authorization subject here is unusual and worth stating: a resident is
 * admitted by the AUDIENCE SNAPSHOT, not by a grant and not by where they live
 * today. This is the first place GEN-037's snapshot does load-bearing work rather
 * than merely existing.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createModuleDb, loadConfig, likePrefix, likeEscapeClause, createOutboxPublisher,
} from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createOccupancyAudience } from '../../modules/resident/dist/index.js';
import { createNoticeAudienceResolver } from '../../modules/notices/dist/index.js';
import { createNoticeActs, type ActorContext } from '../../apps/api/dist/management/notice-acts.js';
import {
  createNoticeAcknowledgementActs, type ResidentActor,
} from '../../apps/api/dist/management/notice-acknowledgement-acts.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';

let owner: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;
let residentDb: ReturnType<typeof createModuleDb>;

/** The principal -> resident binding. In production this is the identity layer. */
const BINDINGS: Record<string, string> = {};
const residentOfPrincipal = async (principalId: string) => BINDINGS[principalId];

const ackActs = () => createNoticeAcknowledgementActs(noticesDb, residentOfPrincipal);

const ruleNodes = {
  async servingScopeNodes(_o: string, locationId: string) {
    const rows = await owner.query<{ node_type: string; node_id: string }>(
      `SELECT node_type, node_id FROM property.location_serving_scope WHERE location_id=$1`, [locationId]);
    return rows.map((r) => `${r.node_type}:${r.node_id}`);
  },
};
const unitExpansion = {
  async unitsUnder(_o: string, nodes: readonly { kind: string; id: string }[]) {
    const buildings = nodes.filter((n) => n.kind === 'building').map((n) => n.id);
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
        WHERE f.building_id = ANY($1)`, [buildings]);
    return rows.map((r) => r.unit_id);
  },
};
const servingScope = { async resolveServedUnits() { return []; } };

const noticeActs = () => createNoticeActs({
  noticesDb,
  auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
  ruleNodes,
  resolveAudience: (rule, asAt) =>
    createNoticeAudienceResolver(unitExpansion, servingScope, createOccupancyAudience(residentDb))
      .resolveAudience(rule, asAt),
  /**
   * NO ADAPTER (GEN-042 H1). The publisher qualifies `platform.outbox_message`
   * itself now, so a notices-scoped transaction can write the event directly and
   * every future module gets that for free instead of copying an adapter.
   */
  publishEvent: async (tx, type, payload) => {
    await createOutboxPublisher(tx).publish({
      messageId: randomUUID(), contractName: type, contractVersion: '1.0.0',
      occurredAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
      source: 'pemo.notices', correlationId: randomUUID(), causationId: null,
      scope: { organizationId: ORG }, payload,
    });
  },
});

const staffActor = (): ActorContext => ({
  organizationId: ORG, principalId: 'stf_wfg_manager', correlationId: randomUUID(), now: new Date(),
  witness: { groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
             nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
});

const resActor = (residentId: string, principalId = `prn_${residentId}`): ResidentActor => {
  BINDINGS[principalId] = residentId;
  return { organizationId: ORG, principalId, residentId,
           correlationId: randomUUID(), occurredAt: new Date() };
};

/** A resident occupying a unit in Block A, so the resolver reaches them. */
const seatResident = async (tag: string) => {
  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [BLOCK_A]))[0]!.unit_id;
  const id = `res_n3_${tag}`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [id, ORG, `N3 ${tag}`]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_n3_${tag}`, `occ_n3_${tag}`, id, unit]);
  return id;
};

/** A published notice addressed to Block A, optionally asking a question. */
const publishedNotice = async (tag: string, responseOptions: string[] | null = null) => {
  const a = noticeActs();
  const scope = await roleScope('estate_staff',
    [{ grantId: 'g', groupId: 'grp', role: 'estate_staff',
       node: { kind: 'building', id: BLOCK_A }, effectiveFrom: '2020-01-01T00:00:00.000Z',
       effectiveTo: null }],
    async (nodes) => nodes.map((n) => `${n.kind}:${n.id}`));
  const composed = await a.compose({
    clientKey: `n3-${tag}-${randomUUID()}`,
    content: { noticeType: 'general', titleEn: 'T', titleZhHant: '標', bodyEn: 'B',
               bodyZhHant: '內', publishAt: null, expireAt: null, mandatoryAck: true,
               incidentRef: null, responseOptions } as never,
    targets: [{ nodeKind: 'building', nodeId: BLOCK_A, locationId: null, residentGroupId: null }],
  }, staffActor(), scope);
  const id = (composed as { noticeId: string }).noticeId;
  const pub = await a.publish(id, 1, staffActor(), scope);
  assert.equal(pub.kind, 'ok', JSON.stringify(pub));
  return { noticeId: id, version: (pub as { version: number }).version, scope, acts: a };
};

test.before(() => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  noticesDb = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
  residentDb = createModuleDb({ schema: 'resident', database: cfg.databaseOwner });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await noticesDb.query(`DELETE FROM notice_acknowledgement WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`,
    [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix('occ_n3_')]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix('res_n3_')]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice'`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation='compose_notice'`);
  await Promise.all([owner.close(), noticesDb.close(), residentDb.close()]);
});

const rowsFor = async (noticeId: string, residentId: string) =>
  (await noticesDb.query<{ kind: string; response: string | null; occurred_at: Date }>(
    `SELECT kind, response, occurred_at FROM notice_acknowledgement
      WHERE notice_id=$1 AND resident_id=$2 ORDER BY occurred_at, kind`, [noticeId, residentId]));

// ─── 1. the addressed resident records all three ────────────────────────────

test('1 — an addressed resident may read, acknowledge and respond; status reflects all', async () => {
  const r = await seatResident('happy');
  const { noticeId } = await publishedNotice('happy', ['will_attend', 'will_not_attend']);
  const acts = ackActs();
  const me = resActor(r);

  assert.equal((await acts.markRead(noticeId, me)).kind, 'ok');
  assert.equal((await acts.acknowledge(noticeId, me)).kind, 'ok');
  assert.equal((await acts.respond(noticeId, 'will_attend', randomUUID(), me)).kind, 'ok');

  const status = (await acts.acknowledgementStatus(noticeId)).find((s) => s.residentId === r);
  assert.ok(status !== undefined, 'the recipient appears in the status');
  assert.ok(status.read !== null && status.acknowledged !== null);
  assert.equal(status.response, 'will_attend');

  // THE MEASURED AUDIT SHAPE (D6): provenance in the domain row, and NO
  // access.audit_event row — a resident is not a staff principal, so the audit
  // table's foreign key could not hold one.
  const [prov] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_acknowledgement
      WHERE notice_id=$1 AND resident_id=$2 AND correlation_id IS NOT NULL AND received_at IS NOT NULL`,
    [noticeId, r]);
  assert.equal(prov?.n, '3', 'every act carries its own provenance in the domain table');

  const [audits] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM access.audit_event
      WHERE target_kind='notice' AND target_id=$1 AND action LIKE '%notice%'
        AND principal_id = $2`, [noticeId, r]);
  assert.equal(audits?.n, '0',
    'a resident-authored audit_event row is structurally impossible: principal_id references '
    + 'access.staff_principal and a resident is not one (GEN-006)');
});

// ─── 2. the snapshot, not the current occupancy, is the authorization ───────

test('2 — a resident NOT in the snapshot is refused all three', async () => {
  const addressed = await seatResident('inside');
  const { noticeId } = await publishedNotice('snapshot');

  // Seated AFTER publication: the targeting rule would reach them today, and the
  // snapshot does not. The snapshot is what was true when they were told.
  const late = await seatResident('latecomer');
  const acts = ackActs();
  const them = resActor(late);

  assert.equal((await acts.markRead(noticeId, them)).kind, 'not-addressed');
  assert.equal((await acts.acknowledge(noticeId, them)).kind, 'not-addressed');
  assert.equal((await acts.respond(noticeId, 'x', randomUUID(), them)).kind, 'not-addressed');

  assert.equal((await acts.markRead(noticeId, resActor(addressed))).kind, 'ok',
    'while the resident who WAS addressed is admitted');
});

// ─── 3. acting as oneself ───────────────────────────────────────────────────

test('3 — a principal cannot act as another resident', async () => {
  const mine = await seatResident('self');
  const theirs = await seatResident('other');
  const { noticeId } = await publishedNotice('self');

  // A real principal, bound to `mine`, claiming to be `theirs`.
  const forged: ResidentActor = { ...resActor(mine), residentId: theirs };
  assert.equal((await ackActs().markRead(noticeId, forged)).kind, 'not-this-resident');
});

// ─── 4. once-only kinds ─────────────────────────────────────────────────────

test('4 — a duplicate read or acknowledge is a no-op returning the original act', async () => {
  const r = await seatResident('once');
  const { noticeId } = await publishedNotice('once');
  const acts = ackActs();
  const me = resActor(r);

  const first = await acts.markRead(noticeId, me);
  const again = await acts.markRead(noticeId, me);
  assert.equal(first.kind, 'ok');
  assert.equal(again.kind, 'ok');
  assert.equal((first as { acknowledgementId: string }).acknowledgementId,
               (again as { acknowledgementId: string }).acknowledgementId,
               'the retry returns the ORIGINAL act — that is what idempotent means');
  assert.equal((first as { firstTime: boolean }).firstTime, true);
  assert.equal((again as { firstTime: boolean }).firstTime, false);

  assert.equal((await rowsFor(noticeId, r)).filter((x) => x.kind === 'read').length, 1,
    'you cannot read a thing for the first time twice');
});

// ─── 5. the controlled, changeable answer ───────────────────────────────────

test('5 — respond is latest-wins, and only a declared option is accepted', async () => {
  const r = await seatResident('answer');
  const { noticeId } = await publishedNotice('answer', ['will_attend', 'will_not_attend']);
  const acts = ackActs();
  const me = resActor(r);

  // A FRESH ACTOR PER ACT, because `occurredAt` is captured when the actor is
  // built. Reusing one gave both answers the same instant, and the first version of
  // this test then asserted "latest" against a tie — it failed for a reason that
  // had nothing to do with latest-wins.
  assert.equal((await acts.respond(noticeId, 'will_attend', randomUUID(), resActor(r))).kind, 'ok');
  await new Promise((d) => setTimeout(d, 5));
  assert.equal((await acts.respond(noticeId, 'will_not_attend', randomUUID(), resActor(r))).kind, 'ok');

  const responses = (await rowsFor(noticeId, r)).filter((x) => x.kind === 'responded');
  assert.equal(responses.length, 2, 'the earlier answer survives as what they said before');
  const status = (await acts.acknowledgementStatus(noticeId)).find((s) => s.residentId === r);
  assert.equal(status?.response, 'will_not_attend', 'CURRENT is the LATEST answer');

  assert.equal((await acts.respond(noticeId, 'maybe', randomUUID(), resActor(r))).kind, 'undeclared-option');
});

test('5b — a notice that asks nothing refuses an answer', async () => {
  const r = await seatResident('noq');
  const { noticeId } = await publishedNotice('noq', null);
  assert.equal((await ackActs().respond(noticeId, 'anything', randomUUID(), resActor(r))).kind,
    'no-question-asked',
    'no declared question means there is no answer to record, not that any answer will do');
});

test('5c — a retried respond with the same key is one row, not a second answer', async () => {
  const r = await seatResident('retry');
  const { noticeId } = await publishedNotice('retry', ['yes']);
  const acts = ackActs();
  const me = resActor(r);
  const key = randomUUID();
  const a = await acts.respond(noticeId, 'yes', key, me);
  const b = await acts.respond(noticeId, 'yes', key, me);
  assert.equal((a as { acknowledgementId: string }).acknowledgementId,
               (b as { acknowledgementId: string }).acknowledgementId);
  assert.equal((await rowsFor(noticeId, r)).filter((x) => x.kind === 'responded').length, 1);
});

// ─── 6. the state gate ──────────────────────────────────────────────────────

test('6 — refused on a withdrawn notice, ALLOWED on an expired one', async () => {
  const r = await seatResident('state');
  const acts = ackActs();

  // EXPIRED still accepts: a late acknowledgement of a safety notice is a record
  // worth having. Expiry ends visibility, not accountability.
  const exp = await publishedNotice('expired');
  await noticesDb.query(
    `UPDATE notice SET expire_at = now() - interval '1 hour' WHERE notice_id=$1`, [exp.noticeId])
    .catch(async () => {
      // pemo_owner may UPDATE; the app may not. If the grant model forbids it here,
      // reach the same state by asserting a new version with a past expiry.
    });
  const [state] = await noticesDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM notice_current WHERE notice_id=$1`, [exp.noticeId]);
  assert.equal(state?.lifecycle_state, 'expired', 'the fixture must actually be expired');
  assert.equal((await acts.markRead(exp.noticeId, resActor(r))).kind, 'ok');

  // WITHDRAWN refuses.
  const w = await publishedNotice('withdrawn');
  const wd = await w.acts.withdraw(w.noticeId, w.version, 'issued_in_error', staffActor(), w.scope);
  assert.equal(wd.kind, 'ok', JSON.stringify(wd));
  assert.equal((await acts.markRead(w.noticeId, resActor(r))).kind, 'wrong-state');
});

// ─── 7. concurrency ─────────────────────────────────────────────────────────

/**
 * The guarantee holds; the MECHANISM is the partial unique index, not the advisory
 * lock. Measured by dropping each separately — see the note on `lockRecipient`.
 * This test is therefore a test OF THE INDEX, and it is named for the property
 * rather than for the mechanism so it stays true if the mechanism changes.
 */
test('7 — two concurrent acknowledges produce exactly one row', async () => {
  const r = await seatResident('race');
  const { noticeId } = await publishedNotice('race');
  const acts = ackActs();
  const me = resActor(r);

  const [x, y] = await Promise.all([acts.acknowledge(noticeId, me), acts.acknowledge(noticeId, me)]);
  assert.equal(x.kind, 'ok');
  assert.equal(y.kind, 'ok');
  assert.equal((await rowsFor(noticeId, r)).filter((k) => k.kind === 'acknowledged').length, 1);
});

// ─── 8. stances, and refusals as values ─────────────────────────────────────

test('8 — every resident act declares a stance and an explicit no-reason entry', async () => {
  const { NOTICE_STANCES, NOTICE_REASONS } =
    await import('../../apps/api/dist/management/notice-reasons.js');
  for (const act of ['mark_notice_read', 'acknowledge_notice', 'respond_to_notice']) {
    assert.ok(NOTICE_STANCES[act] !== undefined, `${act} declares no stance`);
    assert.ok(NOTICE_REASONS[act] !== undefined,
      `${act} has no registry entry — an act missing from the registry is indistinguishable ` +
      'from an act nobody thought about');
    assert.equal(NOTICE_REASONS[act]!.required, false,
      'a resident is not asked to justify reading their post');
  }
  assert.equal(NOTICE_STANCES['respond_to_notice'], 'client-key',
    'a change of mind and a retry are identical to the server without a client key');
  assert.equal(NOTICE_STANCES['mark_notice_read'], 'derived-key');
});

test('8b — every refusal is a VALUE, never a thrown fault', async () => {
  const acts = ackActs();
  const r = await seatResident('refusal');
  assert.equal((await acts.markRead('ntc_nope', resActor(r))).kind, 'no-such-notice');
});
