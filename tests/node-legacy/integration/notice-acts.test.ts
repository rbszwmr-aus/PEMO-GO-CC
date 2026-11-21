/**
 * ADR-019 cut B, N2 — the notice write surface, as ACTS.
 *
 * No routes here: these are the acts a route will call in the next PID, exercised
 * directly, exactly as `W2`'s grant acts were before `W3` wired them. The
 * authority rules are therefore testable without a request, and the request layer
 * cannot quietly acquire one of its own.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createModuleDb, loadConfig, likePrefix, likeEscapeClause, createOutboxPublisher,
} from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import type { RoleScope } from '../../modules/access/dist/index.js';
import { createOccupancyAudience } from '../../modules/resident/dist/index.js';
import { createNoticeAudienceResolver } from '../../modules/notices/dist/index.js';
import { createNoticeActs, type ActorContext, type NoticeTarget } from '../../apps/api/dist/management/notice-acts.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const BLOCK_B = 'blk_wfg_b';

let owner: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;
let residentDb: ReturnType<typeof createModuleDb>;
let platformDb: ReturnType<typeof createModuleDb>;

/** Serving-scope expansion and unit expansion, through the OWNER handle. */
const ruleNodes = {
  async servingScopeNodes(_org: string, locationId: string) {
    const rows = await owner.query<{ node_kind: string; node_id: string }>(
      `SELECT node_type AS node_kind, node_id FROM property.location_serving_scope
        WHERE location_id = $1`, [locationId]);
    return rows.map((r) => `${r.node_kind}:${r.node_id}`);
  },
};
const unitExpansion = {
  async unitsUnder(_org: string, nodes: readonly { kind: string; id: string }[]) {
    const buildings = nodes.filter((n) => n.kind === 'building').map((n) => n.id);
    const floors = nodes.filter((n) => n.kind === 'floor').map((n) => n.id);
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id = u.floor_id
        WHERE f.building_id = ANY($1) OR u.floor_id = ANY($2)`, [buildings, floors]);
    return rows.map((r) => r.unit_id);
  },
};
const servingScope = {
  async resolveServedUnits(_org: string, locationId: string) {
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.location_serving_scope s
         JOIN property.unit u ON u.floor_id = s.node_id
        WHERE s.location_id = $1 AND s.node_type = 'floor'`, [locationId]);
    return rows.map((r) => r.unit_id);
  },
};

const acts = () => createNoticeActs({
  noticesDb,
  auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
  ruleNodes,
  resolveAudience: (rule, asAt) =>
    createNoticeAudienceResolver(unitExpansion, servingScope, createOccupancyAudience(residentDb))
      .resolveAudience(rule, asAt),
  /**
   * SCHEMA-QUALIFIED, and that is a finding rather than a preference.
   *
   * D5 requires the event to land in the SAME TRANSACTION as the assertion and the
   * snapshot — an event without its snapshot, or a snapshot without its event, is a
   * lie either way. That transaction is `notices`-scoped, and
   * `createOutboxPublisher` writes `outbox_message` UNQUALIFIED, so it resolves
   * only under a platform-scoped `search_path`. The publisher is written for a
   * caller already inside platform; a cross-schema act has to qualify.
   */
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

/** A scope of a given role covering exactly these nodes, via the ONE constructor. */
const scopeAt = <R extends 'estate_staff' | 'approver'>(role: R, ...nodeKeys: string[]) =>
  roleScope(role,
    nodeKeys.map((k, i) => ({
      grantId: `gr_n2_${i}`, groupId: 'grp_n2', role,
      node: { kind: k.split(':')[0] as 'building', id: k.split(':')[1]! },
      effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null,
    })),
    async (nodes) => nodes.map((n) => `${n.kind}:${n.id}`));

const actor = (): ActorContext => ({
  organizationId: ORG, principalId: 'stf_wfg_manager', correlationId: randomUUID(),
  now: new Date(),
  // THE REAL SEEDED WITNESS. An invented group id is refused by audit_event's
  // foreign key — correctly: an audit row naming a group that does not exist
  // records authority nobody held.
  witness: {
    groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
    nodeKind: 'estate', nodeId: 'est_wing_fu_garden',
  },
});

const targetBuilding = (id: string): NoticeTarget =>
  ({ nodeKind: 'building', nodeId: id, locationId: null, residentGroupId: null });

const content = (over: Record<string, unknown> = {}) => ({
  noticeType: 'general', titleEn: 'T', titleZhHant: '標題',
  bodyEn: 'Body', bodyZhHant: '內容',
  publishAt: null, expireAt: null, mandatoryAck: false, incidentRef: null, ...over,
} as never);

test.before(() => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  noticesDb = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
  residentDb = createModuleDb({ schema: 'resident', database: cfg.databaseOwner });
  platformDb = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`,
    [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind = 'notice'`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation LIKE 'compose\\_notice' ESCAPE '\\'`);
  await Promise.all([owner.close(), noticesDb.close(), residentDb.close(), platformDb.close()]);
});

const audienceOf = async (noticeId: string, version: number) =>
  (await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_audience WHERE notice_id=$1 AND publishing_version=$2`,
    [noticeId, version]))[0]!.n;

const outboxOf = async (noticeId: string) =>
  (await owner.query<{ contract_name: string }>(
    `SELECT contract_name FROM platform.outbox_message
      WHERE payload->>'notice_id' = $1 ORDER BY contract_name`, [noticeId])).map((r) => r.contract_name);

const auditsOf = async (noticeId: string) =>
  (await owner.query<{ action: string; group_id: string | null; role: string | null }>(
    `SELECT action, group_id, role FROM access.audit_event
      WHERE target_kind='notice' AND target_id=$1 ORDER BY occurred_at, action`, [noticeId]));

// ─── 1. the happy paths, gated and ungated ──────────────────────────────────

test('1 — gated: compose -> submit -> approve -> publish, with snapshot, event and audit', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver', `building:${BLOCK_A}`);
  const ctx = actor();

  const composed = await a.compose(
    { clientKey: `n2-gated-${randomUUID()}`,
      content: content({ noticeType: 'planned_interruption' }),
      targets: [targetBuilding(BLOCK_A)] }, ctx, staff);
  assert.equal(composed.kind, 'ok', JSON.stringify(composed));
  const id = (composed as { noticeId: string }).noticeId;

  // Publishing before approval is refused: planned_interruption is GATED by seed.
  const early = await a.publish(id, 1, ctx, staff);
  assert.equal(early.kind, 'approval-required');

  assert.equal((await a.submit(id, 1, ctx, staff)).kind, 'ok');
  assert.equal((await a.approve(id, 2, 'approved_as_submitted', ctx, approver)).kind, 'ok');
  const published = await a.publish(id, 3, ctx, staff);
  assert.equal(published.kind, 'ok', JSON.stringify(published));

  const v = (published as { version: number }).version;
  assert.notEqual(await audienceOf(id, v), '0', 'the snapshot was written');
  assert.deepEqual(await outboxOf(id), ['notice.published']);

  const audits = await auditsOf(id);
  assert.deepEqual(audits.map((r) => r.action).sort(),
    ['approve_notice', 'compose_notice', 'publish_notice', 'submit_notice']);
  assert.ok(audits.every((r) => r.group_id !== null && r.role !== null),
    'every audit row carries the GEN-030 witness — the group and role the authority ran through');
});

test('1b — ungated: compose -> publish, no approval step', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `n2-ungated-${randomUUID()}`, content: content({ noticeType: 'general' }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  assert.equal((await a.publish(id, 1, actor(), staff)).kind, 'ok');
});

// ─── 2. the covering conjunction ────────────────────────────────────────────

test('2 — the floor is a CONJUNCTION: covering A only cannot address A and B', async () => {
  const a = acts();
  const onlyA = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const both = await scopeAt('estate_staff', `building:${BLOCK_A}`, `building:${BLOCK_B}`);

  const refusedAct = await a.compose(
    { clientKey: `n2-conj-${randomUUID()}`, content: content(),
      targets: [targetBuilding(BLOCK_A), targetBuilding(BLOCK_B)] }, actor(), onlyA);
  assert.equal(refusedAct.kind, 'out-of-scope',
    'covering SOME addressed nodes is not partial authority to address some — there is no partial notice');

  const allowed = await a.compose(
    { clientKey: `n2-conj2-${randomUUID()}`, content: content(),
      targets: [targetBuilding(BLOCK_A), targetBuilding(BLOCK_B)] }, actor(), both);
  assert.equal(allowed.kind, 'ok');
});

// ─── 3. the approver's own floor ────────────────────────────────────────────

test('3 — an approver covering only B cannot approve a notice addressed to A', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const wrongApprover = await scopeAt('approver', `building:${BLOCK_B}`);
  const rightApprover = await scopeAt('approver', `building:${BLOCK_A}`);
  const ctx = actor();

  const composed = await a.compose(
    { clientKey: `n2-appr-${randomUUID()}`, content: content({ noticeType: 'emergency' }),
      targets: [targetBuilding(BLOCK_A)] }, ctx, staff);
  const id = (composed as { noticeId: string }).noticeId;
  await a.submit(id, 1, ctx, staff);

  assert.equal((await a.approve(id, 2, null, ctx, wrongApprover)).kind, 'out-of-scope');
  assert.equal((await a.approve(id, 2, null, ctx, rightApprover)).kind, 'ok');
});

// ─── 4. fail-closed approval policy ─────────────────────────────────────────

test('4 — a type with NO policy row is GATED (fail-closed)', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  await noticesDb.query(`DELETE FROM approval_policy WHERE organization_id=$1 AND notice_type='general'`, [ORG]);
  try {
    const composed = await a.compose(
      { clientKey: `n2-failclosed-${randomUUID()}`, content: content({ noticeType: 'general' }),
        targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
    const id = (composed as { noticeId: string }).noticeId;
    const r = await a.publish(id, 1, actor(), staff);
    assert.equal(r.kind, 'approval-required',
      'no row is "nobody has decided", and the safe reading of that is that somebody must look');
  } finally {
    await noticesDb.query(
      `INSERT INTO approval_policy (organization_id, notice_type, requires_approval)
       VALUES ($1,'general',false) ON CONFLICT DO NOTHING`, [ORG]);
  }
});

// ─── 5/6/7. publish invariants ──────────────────────────────────────────────

test('5 — publication may not be half-translated', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `n2-lang-${randomUUID()}`, content: content({ bodyZhHant: '  ' }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  const r = await a.publish(id, 1, actor(), staff);
  assert.equal(r.kind, 'incomplete-translation');
  assert.equal(await audienceOf(id, 2), '0', 'a refusal leaves no snapshot');
  assert.deepEqual(await outboxOf(id), [], 'and emits no event');
});

test('6 — a rule resolving to nobody is refused, with no snapshot and no event', async () => {
  const a = acts();
  // Block B exists and has units, but no residents occupy them in the seed.
  const staffB = await scopeAt('estate_staff', `building:${BLOCK_B}`);
  const composed = await a.compose(
    { clientKey: `n2-empty-${randomUUID()}`, content: content(),
      targets: [targetBuilding(BLOCK_B)] }, actor(), staffB);
  const id = (composed as { noticeId: string }).noticeId;
  const r = await a.publish(id, 1, actor(), staffB);
  assert.equal(r.kind, 'empty-audience',
    'far likelier a mistargeted notice than a deliberate broadcast to an empty building');
  assert.equal(await audienceOf(id, 2), '0');
  assert.deepEqual(await outboxOf(id), []);
});

test('7 — the snapshot is AS AT publication: a later mover-in is not added', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `n2-asat-${randomUUID()}`, content: content(),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  const published = await a.publish(id, 1, actor(), staff);
  const v = (published as { version: number }).version;
  const before = await audienceOf(id, v);

  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [BLOCK_A]))[0]!.unit_id;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ('res_n2_late',$1,'Late') ON CONFLICT (resident_id) DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ('occa_n2_late',1,'occ_n2_late','res_n2_late',$1,'residential','tenant','active','seed', now())`,
    [unit]);
  try {
    assert.equal(await audienceOf(id, v), before,
      'who was told is a fact about the moment of publication and does not change afterwards');
  } finally {
    await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id='occ_n2_late'`);
    await owner.query(`DELETE FROM resident.resident WHERE resident_id='res_n2_late'`);
  }
});

// ─── 8/9/10. correct, withdraw, decline ─────────────────────────────────────

const publishedNotice = async (tag: string) => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `${tag}-${randomUUID()}`, content: content(), targets: [targetBuilding(BLOCK_A)] },
    actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  const pub = await a.publish(id, 1, actor(), staff);
  return { a, staff, id, version: (pub as { version: number }).version };
};

test('8 — a correction may not retarget; content-only appends a version and keeps the snapshot', async () => {
  const { a, staff, id, version } = await publishedNotice('n2-correct');
  const before = await audienceOf(id, version);

  const retarget = await a.correct(id, version,
    { clientKey: randomUUID(), content: {}, targets: [targetBuilding(BLOCK_B)] },
    'factual_error', actor(), staff);
  assert.equal(retarget.kind, 'retargeting-forbidden',
    'the snapshot records who WAS addressed; a correction that retargeted would leave it describing '
    + 'an audience the notice no longer has');

  const ok = await a.correct(id, version,
    { clientKey: randomUUID(), content: { bodyEn: 'Corrected body' } },
    'factual_error', actor(), staff);
  assert.equal(ok.kind, 'ok', JSON.stringify(ok));
  assert.equal(await audienceOf(id, version), before, 'the original snapshot is untouched');
  assert.equal(await audienceOf(id, version + 1), '0', 'and a correction resolves no new audience');
});

test('9 — withdraw retains the snapshot and emits notice.withdrawn', async () => {
  const { a, staff, id, version } = await publishedNotice('n2-withdraw');
  const before = await audienceOf(id, version);
  const r = await a.withdraw(id, version, 'issued_in_error', actor(), staff);
  assert.equal(r.kind, 'ok', JSON.stringify(r));

  assert.equal(await audienceOf(id, version), before,
    'withdrawing un-tells people going forward; it does not make it untrue that they were told');
  assert.deepEqual(await outboxOf(id), ['notice.published', 'notice.withdrawn']);

  const [state] = await noticesDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM notice_current WHERE notice_id=$1`, [id]);
  assert.equal(state?.lifecycle_state, 'withdrawn');
});

test('10 — decline returns to draft, and revise -> resubmit works', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `n2-decline-${randomUUID()}`, content: content({ noticeType: 'emergency' }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;

  await a.submit(id, 1, actor(), staff);
  const declined = await a.decline(id, 2, 'inaccurate', actor(), approver);
  assert.equal(declined.kind, 'ok');

  const [state] = await noticesDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM notice_current WHERE notice_id=$1`, [id]);
  assert.equal(state?.lifecycle_state, 'draft', 'declining sends work back, it does not dead-end it');

  const revised = await a.revise(id, 3, { clientKey: randomUUID(), content: { bodyEn: 'Fixed' } },
    actor(), staff);
  assert.equal(revised.kind, 'ok');
  assert.equal((await a.submit(id, 4, actor(), staff)).kind, 'ok');
  assert.equal((await a.approve(id, 5, null, actor(), approver)).kind, 'ok');
});

// ─── 11. the two idempotency stances ────────────────────────────────────────

test('11 — compose is CLIENT-KEY: the same key makes one draft, not two', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const key = `n2-idem-${randomUUID()}`;
  const first = await a.compose(
    { clientKey: key, content: content(), targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const again = await a.compose(
    { clientKey: key, content: content(), targets: [targetBuilding(BLOCK_A)] }, actor(), staff);

  assert.equal(first.kind, 'ok');
  assert.equal(again.kind, 'ok');
  assert.equal((first as { noticeId: string }).noticeId, (again as { noticeId: string }).noticeId);
  const [n] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice WHERE notice_id=$1`,
    [(first as { noticeId: string }).noticeId]);
  assert.equal(n?.n, '1', 'a retry on a dropped connection must not leave two drafts');
});

test('11b — publish is DERIVED-KEY: a stale from_version is a refusal, not a replay', async () => {
  const { a, staff, id, version } = await publishedNotice('n2-derived');
  // Repeating the act that already ran, naming the version it ran FROM.
  const repeat = await a.publish(id, version - 1, actor(), staff);
  assert.equal(repeat.kind, 'stale-state',
    'the caller is acting on a notice that has since moved — applying it to the new state would be '
    + 'them approving text they never read');
  const [snapshots] = await noticesDb.query<{ n: string }>(
    `SELECT count(DISTINCT publishing_version)::text AS n FROM notice_audience WHERE notice_id=$1`, [id]);
  assert.equal(snapshots?.n, '1', 'and no second snapshot was written');
});

// ─── 12. concurrency ────────────────────────────────────────────────────────

test('12 — two concurrent publishes produce exactly ONE snapshot', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const composed = await a.compose(
    { clientKey: `n2-race-${randomUUID()}`, content: content(), targets: [targetBuilding(BLOCK_A)] },
    actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;

  // Both name version 1. The advisory lock serialises them; the loser reads the
  // state the winner committed and refuses on it.
  const [x, y] = await Promise.all([
    a.publish(id, 1, actor(), staff),
    a.publish(id, 1, actor(), staff),
  ]);
  const kinds = [x.kind, y.kind].sort();
  assert.equal(kinds.filter((k) => k === 'ok').length, 1,
    `exactly one publish must win, got ${kinds.join(', ')}`);

  const [snapshots] = await noticesDb.query<{ n: string }>(
    `SELECT count(DISTINCT publishing_version)::text AS n FROM notice_audience WHERE notice_id=$1`, [id]);
  assert.equal(snapshots?.n, '1', 'the audience must not be addressed twice');
  assert.deepEqual(await outboxOf(id), ['notice.published'], 'and exactly one event');
});

// ─── 14. every act declares a stance and a reason vocabulary ────────────────

test('14 — every notice act declares an idempotency stance and a reason vocabulary', async () => {
  const { NOTICE_STANCES, NOTICE_REASONS, NOTICE_ACTS } =
    await import('../../apps/api/dist/management/notice-reasons.js');

  // DERIVED FROM THE ACT SURFACE, not a hand-kept list — the R5 theme. A ninth act
  // added to NoticeActs and forgotten here reds this, rather than shipping with no
  // declared stance (ADR-015 D1).
  const declared = [...NOTICE_ACTS].sort();
  for (const act of declared) {
    assert.ok(NOTICE_STANCES[act] !== undefined, `${act} declares no idempotency stance`);
    assert.ok(NOTICE_REASONS[act] !== undefined, `${act} declares no reason vocabulary`);
  }
  assert.deepEqual(Object.keys(NOTICE_REASONS).sort(), declared,
    'the reason registry and the stance table must name exactly the same acts');

  // The acts that UNDO or OVERRIDE somebody's decision require a reason; the
  // ordinary forward path does not (ADR-014 D4).
  for (const act of ['decline_notice', 'correct_notice', 'withdraw_notice']) {
    assert.equal(NOTICE_REASONS[act]!.required, true, `${act} must require a reason`);
    assert.ok(NOTICE_REASONS[act]!.codes.length > 0, `${act} must offer codes to choose between`);
  }
  for (const act of ['compose_notice', 'publish_notice']) {
    assert.equal(NOTICE_REASONS[act]!.required, false,
      `${act} must not demand a reason — that is how vocabularies fill with "other"`);
  }
});

test('14b — a refusal is a VALUE, never a thrown fault (ADR-013 C4)', async () => {
  const a = acts();
  const noScope = await scopeAt('estate_staff');
  // Every one of these is an ordinary answer a caller must handle.
  const r = await a.compose(
    { clientKey: `n2-refusal-${randomUUID()}`, content: content(), targets: [targetBuilding(BLOCK_A)] },
    actor(), noScope);
  assert.equal(r.kind, 'out-of-scope');
  assert.equal((await a.publish('ntc_does_not_exist', 1, actor(), noScope)).kind, 'no-such-notice');
});
