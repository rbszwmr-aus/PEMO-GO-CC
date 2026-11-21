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
import { createNoticePermissions, noticeActRegistry, type NoticeActSubject }
  from '../../apps/api/dist/management/notice-permissions.js';
import { ACT_OPERATION_IDS } from '../../modules/access/dist/index.js';
import { createStaffNotices } from '../../modules/notices/dist/index.js';

const ORG = 'org_wingfu_holdings';
const GATED = 'planned_interruption';
const UNGATED = 'general';
const BLOCK_A = 'blk_wfg_a';
const BLOCK_B = 'blk_wfg_b';

let owner: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;
let residentDb: ReturnType<typeof createModuleDb>;
let platformDb: ReturnType<typeof createModuleDb>;
/** ONE audit handle for the whole file. The matrix invokes `acts()` ~140 times,
  * and a factory that opened a pool each time exhausted the server's connections
  * — every case failing with `sorry, too many clients already`, which looks
  * exactly like a subject defect and is not one. */
let auditDb: ReturnType<typeof createModuleDb>;

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
  auditDb,
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
  auditDb = createModuleDb({ schema: 'access', database: cfg.databaseOwner });
});


test.after(async () => {
  const esc = likeEscapeClause;
  await noticesDb.query(`DELETE FROM notice_audience WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`,
    [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  // RESTORE THE SEED, never delete it. `database/seeds/60-notices-lift-interruption.sql`
  // declares planned_interruption as GATED, and deleting the row left the type
  // relying on the fail-closed default instead of on its seeded value. Nothing in
  // this file noticed — but GEN-040's fail-closed bite then reddened case 1 as
  // collateral, and the harness's blast-radius rule caught it. A test that
  // consumes a row the seed owns has to put it back as it was.
  await noticesDb.query(
    `INSERT INTO approval_policy (organization_id, notice_type, requires_approval)
     VALUES ($1,$2,true)
     ON CONFLICT (organization_id, notice_type) DO UPDATE SET requires_approval = true`,
    [ORG, GATED]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind = 'notice'`);
  await Promise.all([owner.close(), noticesDb.close(), residentDb.close(), platformDb.close(), auditDb.close()]);
});

const setPolicy = async (type: string, gated: boolean) => {
  await noticesDb.query(
    `INSERT INTO approval_policy (organization_id, notice_type, requires_approval) VALUES ($1,$2,$3)
     ON CONFLICT (organization_id, notice_type) DO UPDATE SET requires_approval = EXCLUDED.requires_approval`,
    [ORG, type, gated]);
};

const perms = () => createNoticePermissions(noticesDb, ruleNodes);

/** A NEW notice put into `state`, so a probe that succeeds cannot disturb the next. */
/**
 * `gated` is a DIMENSION, not a function of the state (GEN-052 ruling, addition 1).
 * GEN-047's matrix chose the type from the state — gated for pending/approved,
 * ungated otherwise — so no draft was ever probed under BOTH policies, and a hand
 * rule listing submitNotice on an ungated draft went unseen until UI-051. Now a
 * state that both policies can reach is probed under each.
 */
const freshInState = async (state: string, gated?: boolean): Promise<{ id: string; version: number }> => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver', `building:${BLOCK_A}`);
  if (gated === undefined) gated = state === 'pending_approval' || state === 'approved';
  const type = gated ? GATED : UNGATED;
  const composed = await a.compose(
    { clientKey: `n47-${state}-${randomUUID()}`, content: content({ noticeType: type }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  let version = 1;
  const step = (r: unknown) => { version = (r as { version: number }).version; };
  if (state === 'draft') return { id, version };
  if (gated) {
    step(await a.submit(id, version, actor(), staff));
    if (state === 'pending_approval') return { id, version };
    step(await a.approve(id, version, null, actor(), approver));
    if (state === 'approved') return { id, version };
  }
  step(await a.publish(id, version, actor(), staff));
  if (state === 'withdrawn') step(await a.withdraw(id, version, 'superseded', actor(), staff));
  return { id, version };
};

/**
 * DOES THE ACT ITSELF ALLOW THIS CALLER, on floor and state alone?
 *
 * The act is really invoked, on a notice created for this probe. A refusal of
 * `out-of-scope`, `wrong-state` or `approval-required` is the floor or the state
 * saying no — the two things `permittedActions` claims to predict. ANY other
 * outcome (ok, or a CONTENT refusal such as an empty audience or a missing
 * translation) means the caller was permitted and the act got as far as the
 * content, which is exactly the boundary D1 draws.
 */
const AUTHORITY_REFUSALS = new Set(['out-of-scope', 'wrong-state', 'approval-required']);

const actAllows = async (
  act: string, state: string,
  staff: RoleScope<'estate_staff'>, approver: RoleScope<'approver'>, gated?: boolean,
): Promise<boolean> => {
  const attempt = async (): Promise<string> => {
    const a = acts();
    const { id, version } = await freshInState(state, gated);
    const ac = actor();
    const key = randomUUID();
    switch (act) {
      case 'reviseNotice':   return (await a.revise(id, version, { clientKey: key, content: {} }, ac, staff)).kind;
      case 'submitNotice':   return (await a.submit(id, version, ac, staff)).kind;
      case 'approveNotice':  return (await a.approve(id, version, null, ac, approver)).kind;
      case 'declineNotice':  return (await a.decline(id, version, 'poor_timing', ac, approver)).kind;
      case 'publishNotice':  return (await a.publish(id, version, ac, staff)).kind;
      case 'correctNotice':  return (await a.correct(id, version, { clientKey: key, content: {} }, 'factual_error', ac, staff)).kind;
      case 'withdrawNotice': {
        const viaStaff = (await a.withdraw(id, version, 'superseded', ac, staff)).kind;
        if (!AUTHORITY_REFUSALS.has(viaStaff)) return viaStaff;
        const second = await freshInState(state, gated);
        return (await acts().withdraw(second.id, second.version, 'superseded', actor(), approver)).kind;
      }
      default: throw new Error(`unknown act ${act}`);
    }
  };
  return !AUTHORITY_REFUSALS.has(await attempt());
};

// state × policy. pending_approval and approved exist only under a gated policy;
// live/withdrawn are reached by direct publish (ungated) or via approval (gated).
const CELLS: readonly [string, boolean][] = [
  ['draft', false], ['draft', true],
  ['pending_approval', true], ['approved', true],
  ['live', false], ['live', true], ['withdrawn', false],
];

test('1 — permitted_actions AGREES WITH THE ACTS, for every caller in every state, under both policies', async () => {
  await setPolicy(GATED, true);
  await setPolicy(UNGATED, false);
  const none = { staff: 'estate_staff', approver: 'approver' } as const;
  void none;

  const callers = {
    'staff covering':      { estate_staff: await scopeAt('estate_staff', `building:${BLOCK_A}`),
                             approver: await scopeAt('approver') },
    'staff NOT covering':  { estate_staff: await scopeAt('estate_staff', `building:${BLOCK_B}`),
                             approver: await scopeAt('approver') },
    'approver covering':   { estate_staff: await scopeAt('estate_staff'),
                             approver: await scopeAt('approver', `building:${BLOCK_A}`) },
    'dual role':           { estate_staff: await scopeAt('estate_staff', `building:${BLOCK_A}`),
                             approver: await scopeAt('approver', `building:${BLOCK_A}`) },
  };
  // THE VOCABULARY IS THE CONTRACT'S (A1): the notice acts are the act operationIds
  // that end in "Notice", less the creation act, which is judged on a NODE (A2).
  const NOTICE_OPS = ACT_OPERATION_IDS.filter((o) => o.endsWith('Notice') && o !== 'composeNotice');

  for (const [state, gated] of CELLS) {
    const { id } = await freshInState(state, gated);
    for (const [who, caller] of Object.entries(callers)) {
      const claimed = [...(await perms().for(ORG, [id], caller)).get(id) ?? []].sort();
      const actual: string[] = [];
      for (const act of NOTICE_OPS) {
        if (await actAllows(act, state, caller.estate_staff, caller.approver, gated)) actual.push(act);
      }
      assert.deepEqual(claimed, actual.sort(),
        `permitted_actions disagreed with the acts for "${who}" in state "${state}" (${gated ? 'gated' : 'ungated'}) — `
        + `a control the client renders and an act that refuses it must not be able to disagree`);
    }
  }
});

test('1b — the field is a DRY RUN, not a hand list: content refusals are not predicted', async () => {
  await setPolicy(UNGATED, false);
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver');
  // A draft with an EMPTY Chinese body: publish will refuse on CONTENT.
  const composed = await a.compose(
    { clientKey: `n47-half-${randomUUID()}`,
      content: content({ noticeType: UNGATED, bodyZhHant: '' }), targets: [targetBuilding(BLOCK_A)] },
    actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;

  const claimed = (await perms().for(ORG, [id], { estate_staff: staff, approver })).get(id) ?? [];
  assert.ok(claimed.includes('publishNotice'),
    'publish is PERMITTED — the caller has the authority; the notice is merely unfinished. '
    + 'Hiding the control would teach the author that publishing is forbidden rather than '
    + 'that a translation is missing');
  const r = await a.publish(id, 1, actor(), staff);
  assert.equal(r.kind, 'incomplete-translation', 'and the refusal is SHOWN, by attempting it');
});

test('2 — state_entered_at is the LATEST assertion, never the instance', async () => {
  await setPolicy(GATED, true);
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver', `building:${BLOCK_A}`);
  const reads = createStaffNotices(noticesDb, async () => []);

  const composed = await a.compose(
    { clientKey: `n47-clock-${randomUUID()}`, content: content({ noticeType: GATED }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;

  const at = async () => {
    const d = await reads.detail(ORG, id, [`building:${BLOCK_A}`]);
    return { state: d!.lifecycleState, enteredAt: d!.stateEnteredAt as Date };
  };
  const created = await at();
  assert.equal(created.state, 'draft');

  const submitted = await a.submit(id, 1, actor(), staff);
  const pending = await at();
  assert.equal(pending.state, 'pending_approval');
  assert.ok(pending.enteredAt.getTime() >= created.enteredAt.getTime(),
    'entering a new state moves the clock; the instance was created once and that moment is gone');

  await a.approve(id, (submitted as { version: number }).version, null, actor(), approver);
  const approved = await at();
  assert.equal(approved.state, 'approved');
  assert.ok(approved.enteredAt.getTime() >= pending.enteredAt.getTime());

  // THE BITE'S TARGET: the FIRST assertion's timestamp, which is what "instance
  // created_at" would give, must NOT be what the field reports once the notice
  // has moved on.
  const [first] = await noticesDb.query<{ recorded_at: Date }>(
    `SELECT recorded_at FROM notice WHERE notice_id=$1 AND version=1`, [id]);
  const [latest] = await noticesDb.query<{ recorded_at: Date }>(
    `SELECT recorded_at FROM notice WHERE notice_id=$1 ORDER BY version DESC LIMIT 1`, [id]);
  assert.equal(approved.enteredAt.getTime(), latest!.recorded_at.getTime(),
    'state_entered_at is the assertion that put the notice in this state');
  assert.notEqual(first!.recorded_at.getTime(), latest!.recorded_at.getTime(),
    'and this notice really did move, so the two timestamps are genuinely different — '
    + 'without that the assertion above would hold for the wrong reason');
});

test('3 — G4 filters narrow the RESULT, never the access', async () => {
  await setPolicy(UNGATED, false);
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const reads = createStaffNotices(noticesDb, async () => []);
  const keys = [`building:${BLOCK_A}`];

  const composed = await a.compose(
    { clientKey: `n47-filter-${randomUUID()}`, content: content({ noticeType: UNGATED }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;

  const all = await reads.list(ORG, keys);
  assert.ok(all.some((n) => n.noticeId === id));

  const drafts = await reads.list(ORG, keys, { lifecycleState: ['draft'] });
  assert.ok(drafts.some((n) => n.noticeId === id), 'a draft is returned when drafts are asked for');
  const live = await reads.list(ORG, keys, { lifecycleState: ['live'] });
  assert.ok(!live.some((n) => n.noticeId === id), 'and absent when they are not');

  const wrongType = await reads.list(ORG, keys, { noticeType: [GATED] });
  assert.ok(!wrongType.some((n) => n.noticeId === id));

  // ABSENT AND EMPTY BOTH MEAN ALL. A filter that defaulted to none would look
  // like an empty estate, which is the failure nobody reports as a bug.
  const empty = await reads.list(ORG, keys, { lifecycleState: [], noticeType: [] });
  assert.equal(empty.length, all.length, 'an empty filter means ALL, never NONE');
});

test('4 — the list carries both languages (UI-045 G2)', async () => {
  await setPolicy(UNGATED, false);
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const reads = createStaffNotices(noticesDb, async () => []);
  const composed = await a.compose(
    { clientKey: `n47-bilingual-${randomUUID()}`,
      content: content({ noticeType: UNGATED, titleEn: 'Water', titleZhHant: '停水' }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (composed as { noticeId: string }).noticeId;
  const item = (await reads.list(ORG, [`building:${BLOCK_A}`])).find((n) => n.noticeId === id);
  assert.equal(item?.titleEn, 'Water');
  assert.equal(item?.titleZhHant, '停水',
    'at 2.0.0 the list carried titleEn only, so "the title in the current locale" was '
    + 'not satisfiable on the list at all');
});

test('5 — the vocabularies stay DISJOINT (D6)', () => {
  // A disposition literal where a lifecycle state is expected is a TS2367 "no
  // overlap" error, not a comparison that silently never matches — which is what
  // it was at GEN-040, where every approval refused as wrong-state.
  const state = 'pending_approval' as const;
  // @ts-expect-error a disposition may not be passed where a lifecycle state is expected
  const subject: NoticeActSubject = { state: 'approval_requested', gated: true, addressedNodeKeys: [] };
  void subject;
  // and an act operationId is a THIRD vocabulary: a lifecycle literal is not one.
  // @ts-expect-error a lifecycle state is not an act operationId
  const notAnAct: (typeof ACT_OPERATION_IDS)[number] = 'pending_approval';
  void notAnAct;
  assert.equal(state, 'pending_approval');
});

test('6 — the CONTAINER list agrees with the creation act (A2/A3): composeNotice per node', async () => {
  await setPolicy(UNGATED, false);
  const a = acts();
  const staffA = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const approver = await scopeAt('approver');
  const caller = { estate_staff: staffA, approver };

  for (const [node, expectPermitted] of [[BLOCK_A, true], [BLOCK_B, false]] as const) {
    // What the CONTAINER says:
    const listed = await noticeActRegistry.permitted({ kind: 'node', nodeKey: `building:${node}` }, caller);
    // What the ACT does, addressed to that node:
    const r = await a.compose(
      { clientKey: `n47-node-${node}-${randomUUID()}`, content: content({ noticeType: UNGATED }),
        targets: [targetBuilding(node)] }, actor(), staffA);
    const allowed = r.kind !== 'out-of-scope';
    assert.equal(listed.includes('composeNotice'), expectPermitted, `container list for ${node}`);
    assert.equal(allowed, expectPermitted, `compose against ${node}`);
    assert.equal(listed.includes('composeNotice'), allowed,
      'the node carries composeNotice iff compose addressed there is not refused on the floor — one verdict, one call');
  }
});
