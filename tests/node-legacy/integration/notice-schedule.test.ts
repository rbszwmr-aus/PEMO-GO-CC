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
  await noticesDb.query(`DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`, [likePrefix('ntc_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind = 'notice'`);
  await Promise.all([owner.close(), noticesDb.close(), residentDb.close(), platformDb.close(), auditDb.close()]);
});

test('an inverted schedule is REFUSED at compose, not thrown by the database (GEN-052)', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const r = await a.compose(
    { clientKey: `n52-inv-${randomUUID()}`,
      content: content({ publishAt: new Date('2026-09-10T01:00:00Z'), expireAt: new Date('2026-09-09T01:00:00Z') }),
      targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  assert.equal(r.kind, 'schedule-inverted',
    'the contract declares notice-schedule-inverted; the CHECK constraint used to fire first and surface as a 500');
});

test('revising a draft into an inverted schedule is refused the same way', async () => {
  const a = acts();
  const staff = await scopeAt('estate_staff', `building:${BLOCK_A}`);
  const c = await a.compose({ clientKey: `n52-rev-${randomUUID()}`, content: content(), targets: [targetBuilding(BLOCK_A)] }, actor(), staff);
  const id = (c as { noticeId: string }).noticeId;
  const r = await a.revise(id, 1, { clientKey: randomUUID(),
    content: { publishAt: new Date('2026-09-10T01:00:00Z'), expireAt: new Date('2026-09-09T01:00:00Z') } as never }, actor(), staff);
  assert.equal(r.kind, 'schedule-inverted');
});
