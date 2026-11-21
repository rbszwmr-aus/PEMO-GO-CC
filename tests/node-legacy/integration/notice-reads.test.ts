/**
 * GEN-042 R1/R2/R3 — the first notices READ surfaces.
 *
 * Three properties carry the weight here, and each is a place where a plausible
 * one-line change would be wrong:
 *
 *   R1 membership   the AUDIENCE SNAPSHOT, never current occupancy. This is the
 *                   read-path bite GEN-040 was owed and could not write.
 *   R1 boundary     what a resident receives is a deliberate subset; the omitted
 *                   fields are governance facts about staff, not about them.
 *   R2 visibility   staff READ by intersection and WRITE by covering. Using the
 *                   write rule for reads hides an estate notice from a building
 *                   manager who must answer residents about it.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createModuleDb, loadConfig, likePrefix, likeEscapeClause, createOutboxPublisher,
} from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createOccupancyAudience } from '../../modules/resident/dist/index.js';
import {
  createNoticeAudienceResolver, createResidentNotices, createStaffNotices,
} from '../../modules/notices/dist/index.js';
import { createNoticeActs, type ActorContext } from '../../apps/api/dist/management/notice-acts.js';
import { createNoticeAcknowledgementActs } from '../../apps/api/dist/management/notice-acknowledgement-acts.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const BLOCK_B = 'blk_wfg_b';

let owner: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;
let residentDb: ReturnType<typeof createModuleDb>;

const BINDINGS: Record<string, string> = {};

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

/** Locations whose serving scope reaches any node the caller holds (R2's Location leg). */
const visibleLocations = async (_org: string, scopeNodeKeys: readonly string[]) => {
  const rows = await owner.query<{ location_id: string }>(
    `SELECT DISTINCT location_id FROM property.location_serving_scope
      WHERE (node_type || ':' || node_id) = ANY($1)`, [scopeNodeKeys]);
  return rows.map((r) => r.location_id);
};

const acts = () => createNoticeActs({
  noticesDb,
  auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
  ruleNodes,
  resolveAudience: (rule, asAt) =>
    createNoticeAudienceResolver(unitExpansion, servingScope, createOccupancyAudience(residentDb))
      .resolveAudience(rule, asAt),
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

const scopeOver = (...nodeKeys: string[]) =>
  roleScope('estate_staff', nodeKeys.map((k, i) => ({
    grantId: `gr_r_${i}`, groupId: 'grp_r', role: 'estate_staff' as const,
    node: { kind: k.split(':')[0] as 'building', id: k.split(':')[1]! },
    effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null,
  })), async (nodes) => nodes.map((n) => `${n.kind}:${n.id}`));

const seatResident = async (tag: string, building = BLOCK_A) => {
  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [building]))[0]!.unit_id;
  const id = `res_r_${tag}`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [id, ORG, tag]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`, [`occa_r_${tag}`, `occ_r_${tag}`, id, unit]);
  BINDINGS[`prn_${id}`] = id;
  return id;
};

const publish = async (tag: string, targets: string[], opts: Record<string, unknown> = {}) => {
  const a = acts();
  const scope = await scopeOver(...targets.map((t) => `building:${t}`));
  const composed = await a.compose({
    clientKey: `r-${tag}-${randomUUID()}`,
    content: { noticeType: 'general', titleEn: `T ${tag}`, titleZhHant: '標', bodyEn: 'B',
               bodyZhHant: '內', publishAt: null, expireAt: null, mandatoryAck: false,
               incidentRef: null, responseOptions: null, ...opts } as never,
    targets: targets.map((t) => ({ nodeKind: 'building', nodeId: t, locationId: null, residentGroupId: null })),
  }, staffActor(), scope);
  const id = (composed as { noticeId: string }).noticeId;
  const pub = await a.publish(id, 1, staffActor(), scope);
  return { id, acts: a, scope, version: (pub as { version?: number }).version, result: pub };
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
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix('occ_r_')]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix('res_r_')]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice'`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation='compose_notice'`);
  await Promise.all([owner.close(), noticesDb.close(), residentDb.close()]);
});

// ─── 6. THE CASE-7 READ-PATH BITE ───────────────────────────────────────────

test('6 — a resident seated AFTER publication does not see the notice', async () => {
  const early = await seatResident('early');
  const { id } = await publish('asat', [BLOCK_A]);
  const late = await seatResident('late');

  const reads = createResidentNotices(noticesDb);
  const mine = await reads.forResident(early, new Date());
  const theirs = await reads.forResident(late, new Date());

  assert.ok(mine.some((n) => n.noticeId === id), 'the addressed resident sees it');
  assert.ok(!theirs.some((n) => n.noticeId === id),
    'THE SNAPSHOT, NOT THE RULE: a resident who arrived after publication was never told, '
    + 'and re-resolving current occupancy is the plausible wrong rule that would show it to them');
});

// ─── 7. the state filter ────────────────────────────────────────────────────

test('7 — draft, pending, approved and withdrawn never appear; expired does, flagged', async () => {
  const r = await seatResident('states');
  const reads = createResidentNotices(noticesDb);

  // A draft, never published: it has no audience row at all, which is the first
  // line of defence, and the state filter is the second.
  const a = acts();
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const draft = await a.compose({
    clientKey: `r-draft-${randomUUID()}`,
    content: { noticeType: 'general', titleEn: 'D', titleZhHant: 'D', bodyEn: 'B', bodyZhHant: 'B',
               publishAt: null, expireAt: null, mandatoryAck: false, incidentRef: null,
               responseOptions: null } as never,
    targets: [{ nodeKind: 'building', nodeId: BLOCK_A, locationId: null, residentGroupId: null }],
  }, staffActor(), scope);
  const draftId = (draft as { noticeId: string }).noticeId;

  const withdrawn = await publish('withdrawn', [BLOCK_A]);
  await withdrawn.acts.withdraw(withdrawn.id, withdrawn.version!, 'issued_in_error', staffActor(), withdrawn.scope);

  const expired = await publish('expired', [BLOCK_A], { expireAt: null });
  await owner.query(
    `UPDATE notices.notice SET expire_at = now() - interval '1 hour' WHERE notice_id=$1`, [expired.id]);

  const items = await reads.forResident(r, new Date());
  const ids = items.map((n) => n.noticeId);
  assert.ok(!ids.includes(draftId), 'a draft is never visible');
  assert.ok(!ids.includes(withdrawn.id), 'a withdrawal that stayed visible would not be a withdrawal');
  const exp = items.find((n) => n.noticeId === expired.id);
  assert.ok(exp !== undefined, 'an expired notice is still a record the resident may read');
  assert.equal(exp.expired, true, 'and it is FLAGGED, not silently indistinguishable from a live one');
});

// ─── 8. the projection boundary ─────────────────────────────────────────────

test('8 — the resident item carries no governance field at all', async () => {
  const r = await seatResident('boundary');
  const { id } = await publish('boundary', [BLOCK_A]);
  const [item] = (await createResidentNotices(noticesDb).forResident(r, new Date()))
    .filter((n) => n.noticeId === id);
  assert.ok(item !== undefined);

  // ASSERTED ON THE EMITTED OBJECT, not on the query: the audience boundary is
  // about what the server hands over (ADR-007).
  const keys = Object.keys(item).sort();
  const forbidden = ['approver', 'approvedBy', 'recordedBy', 'reasonCode', 'closureReason',
                     'targets', 'targetingRule', 'recipients', 'version', 'assertionId',
                     'disposition', 'history'];
  const leaked = forbidden.filter((f) => keys.includes(f));
  assert.deepEqual(leaked, [],
    'a resident never learns who approved it, why it was corrected, who else was told, '
    + 'or the editorial history of what was said');

  // And the caller's OWN status is present — that is theirs.
  assert.ok(keys.includes('myRead') && keys.includes('myAcknowledged') && keys.includes('myResponse'));
});

test('8b — one resident never sees another resident status', async () => {
  const mine = await seatResident('mine');
  const other = await seatResident('other');
  const { id } = await publish('twoacks', [BLOCK_A]);

  const ackActs = createNoticeAcknowledgementActs(noticesDb, async (p) => BINDINGS[p]);
  await ackActs.acknowledge(id, {
    organizationId: ORG, principalId: `prn_${other}`, residentId: other,
    correlationId: randomUUID(), occurredAt: new Date(),
  });

  const [item] = (await createResidentNotices(noticesDb).forResident(mine, new Date()))
    .filter((n) => n.noticeId === id);
  assert.equal(item!.myAcknowledged, null,
    "another recipient's acknowledgement must not appear as this caller's");
});

// ─── 9. staff read INTERSECTS, write COVERS ─────────────────────────────────

test('9 — a block-A manager sees an A+B notice; a block-C manager does not', async () => {
  await seatResident('inter');
  const bothScope = await scopeOver(`building:${BLOCK_A}`, `building:${BLOCK_B}`);
  const a = acts();
  const composed = await a.compose({
    clientKey: `r-inter-${randomUUID()}`,
    content: { noticeType: 'general', titleEn: 'AB', titleZhHant: 'AB', bodyEn: 'B', bodyZhHant: 'B',
               publishAt: null, expireAt: null, mandatoryAck: false, incidentRef: null,
               responseOptions: null } as never,
    targets: [BLOCK_A, BLOCK_B].map((b) => ({ nodeKind: 'building', nodeId: b, locationId: null, residentGroupId: null })),
  }, staffActor(), bothScope);
  const id = (composed as { noticeId: string }).noticeId;

  const staffReads = createStaffNotices(noticesDb, visibleLocations);
  const seenByA = await staffReads.list(ORG, [`building:${BLOCK_A}`]);
  const seenByC = await staffReads.list(ORG, ['building:blk_does_not_exist']);

  assert.ok(seenByA.some((n) => n.noticeId === id),
    'READ IS INCLUSIVE: a building manager must be able to read a notice that affects their '
    + 'building, even though they could not have addressed it');
  assert.ok(!seenByC.some((n) => n.noticeId === id), 'and a manager elsewhere sees nothing');

  // The asymmetry, stated as a fact: the same caller CANNOT write it.
  const onlyA = await scopeOver(`building:${BLOCK_A}`);
  const refusedWrite = await a.revise(id, 1, { clientKey: randomUUID(), content: {} }, staffActor(), onlyA);
  assert.equal(refusedWrite.kind, 'out-of-scope',
    'WRITE IS CONJUNCTIVE: reading it does not confer the authority to change it');
});

test('9b — detail carries the disposition history; the resident projection has no such field', async () => {
  await seatResident('hist');
  const { id } = await publish('hist', [BLOCK_A]);
  const detail = await createStaffNotices(noticesDb, visibleLocations)
    .detail(ORG, id, [`building:${BLOCK_A}`]);
  assert.ok(detail !== undefined);
  assert.ok(detail.history.length >= 2, 'compose and publish are both in the chain');
  assert.ok(detail.history.every((h) => typeof h.recordedBy === 'string'));
  assert.ok(detail.targets.length > 0, 'staff see the targeting rule; residents do not');
});

// ─── 10. outstanding acknowledgements ───────────────────────────────────────

test('10 — outstanding lists every recipient, unacknowledged first, and is scoped like detail', async () => {
  const acked = await seatResident('acked');
  const notAcked = await seatResident('notacked', BLOCK_A);
  const { id } = await publish('outstanding', [BLOCK_A], { mandatoryAck: true });

  const ackActs = createNoticeAcknowledgementActs(noticesDb, async (p) => BINDINGS[p]);
  await ackActs.acknowledge(id, {
    organizationId: ORG, principalId: `prn_${acked}`, residentId: acked,
    correlationId: randomUUID(), occurredAt: new Date(),
  });

  const staffReads = createStaffNotices(noticesDb, visibleLocations);
  const rows = await staffReads.outstanding(ORG, id, [`building:${BLOCK_A}`]);
  const byId = new Map(rows.map((r) => [r.residentId, r]));
  assert.ok(byId.get(acked)?.acknowledged !== null, 'the acknowledgement is recorded');
  assert.equal(byId.get(notAcked)?.acknowledged ?? null, null, 'and the outstanding one is not');
  assert.equal(rows[0]?.acknowledged ?? null, null, 'unacknowledged recipients come first');

  const outOfScope = await staffReads.outstanding(ORG, id, ['building:blk_does_not_exist']);
  assert.deepEqual(outOfScope, [],
    'a caller who cannot see the notice cannot see who received it — the same predicate, not a second rule');
});
