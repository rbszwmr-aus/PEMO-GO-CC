/**
 * TWO CONCURRENT PUBLISHES, ONE SNAPSHOT — proven WITHOUT A RACE (GEN-049).
 *
 * GEN-040 case 12 fired two publishes with Promise.all and hoped they overlapped.
 * Alone they did (6/6); after fifteen preceding tests they serialised naturally
 * and the missing guard went undetected one run in three. A red that depends on
 * timing certifies nothing — `[a-race-is-not-a-bite]`.
 *
 * This test FORCES the interleaving. Connection A opens a transaction and inserts
 * version 2 of the notice, then HOLDS it open. Connection B — a second pool, so
 * a second server connection — runs the real publish act naming version 1. B's
 * INSERT of version 2 must block on `notice_version_unique` until A commits, then
 * fail, and the act must turn that into a `stale-state` refusal with nothing of
 * B's left behind. Every step is ordered by the code, not by the scheduler.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createModuleDb, loadConfig, likePrefix, likeEscapeClause, createOutboxPublisher } from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createOccupancyAudience } from '../../modules/resident/dist/index.js';
import { createNoticeAudienceResolver } from '../../modules/notices/dist/index.js';
import { createNoticeActs, type ActorContext, type NoticeTarget } from '../../apps/api/dist/management/notice-acts.js';
import { deriveActId } from '../../modules/platform/dist/index.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
let owner: ReturnType<typeof createModuleDb>;
let dbA: ReturnType<typeof createModuleDb>;   // the holder
let dbB: ReturnType<typeof createModuleDb>;   // the act's own pool — a DIFFERENT connection
let residentDb: ReturnType<typeof createModuleDb>;
let auditDb: ReturnType<typeof createModuleDb>;

const ruleNodes = {
  async servingScopeNodes(_o: string, locationId: string) {
    const rows = await owner.query<{ node_kind: string; node_id: string }>(
      `SELECT node_type AS node_kind, node_id FROM property.location_serving_scope WHERE location_id = $1`, [locationId]);
    return rows.map((r) => `${r.node_kind}:${r.node_id}`);
  },
};
const unitExpansion = {
  async unitsUnder(_o: string, nodes: readonly { kind: string; id: string }[]) {
    const b = nodes.filter((n) => n.kind === 'building').map((n) => n.id);
    return (await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
        WHERE f.building_id = ANY($1) AND u.unit_class='residential'`, [b])).map((r) => r.unit_id);
  },
};
const servingScope = { async resolveServedUnits() { return [] as string[]; } };

const acts = () => createNoticeActs({
  noticesDb: dbB, auditDb, ruleNodes,
  resolveAudience: (rule, asAt) =>
    createNoticeAudienceResolver(unitExpansion, servingScope, createOccupancyAudience(residentDb)).resolveAudience(rule, asAt),
  publishEvent: async (tx, type, payload) => {
    await createOutboxPublisher(tx).publish({
      messageId: randomUUID(), contractName: type, contractVersion: '1.0.0',
      occurredAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
      source: 'pemo.notices', correlationId: randomUUID(), causationId: null,
      scope: { organizationId: ORG }, payload,
    });
  },
});
const staffScope = () => roleScope('estate_staff',
  [{ grantId: 'gr_049', groupId: 'grp_049', role: 'estate_staff', node: { kind: 'building', id: BLOCK_A },
     effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null }],
  async (nodes) => nodes.map((n) => `${n.kind}:${n.id}`));
const actor = (): ActorContext => ({
  organizationId: ORG, principalId: 'stf_wfg_manager', correlationId: randomUUID(), now: new Date(),
  witness: { groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff', nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
});
const target: NoticeTarget = { nodeKind: 'building', nodeId: BLOCK_A, locationId: null, residentGroupId: null };
const content = () => ({ noticeType: 'general', titleEn: 'T', titleZhHant: '標題', bodyEn: 'B', bodyZhHant: '內容',
  publishAt: null, expireAt: null, mandatoryAck: false, incidentRef: null } as never);

test.before(() => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  dbA = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
  dbB = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
  residentDb = createModuleDb({ schema: 'resident', database: cfg.databaseOwner });
  auditDb = createModuleDb({ schema: 'access', database: cfg.databaseOwner });
});
test.after(async () => {
  const esc = likeEscapeClause;
  await dbA.query(`DELETE FROM notice_audience WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await dbA.query(`DELETE FROM notice_target WHERE assertion_id IN (SELECT assertion_id FROM notice WHERE notice_id LIKE $1 ${esc})`, [likePrefix('ntc_')]);
  await dbA.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${esc}`, [likePrefix('ntc_')]);
  await owner.query(`DELETE FROM platform.outbox_message WHERE contract_name LIKE 'notice.%'`);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind='notice'`);
  await Promise.all([owner.close(), dbA.close(), dbB.close(), residentDb.close(), auditDb.close()]);
});

test('a second publish that loses to a held transaction is REFUSED stale-state, deterministically', async () => {
  const a = acts();
  const scope = await staffScope();
  const composed = await a.compose({ clientKey: `n49-${randomUUID()}`, content: content(), targets: [target] }, actor(), scope);
  const id = (composed as { noticeId: string }).noticeId;
  const [row] = await dbA.query<{ assertion_id: string }>(`SELECT assertion_id FROM notice WHERE notice_id=$1 AND version=1`, [id]);

  // ─── the interleaving is FORCED, not hoped for ──────────────────────────
  let release!: () => void;
  const held = new Promise<void>((r) => { release = r; });
  const holder = dbA.transaction(async (tx) => {
    // A writes version 2 as a copy of version 1 and HOLDS the transaction open.
    await tx.query(
      `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition, notice_type,
                           title_en, title_zh_hant, body_en, body_zh_hant, publish_at, expire_at,
                           mandatory_ack, incident_ref, response_options, recorded_by)
       SELECT $2, notice_id, 2, organization_id, 'publication_released', notice_type,
              title_en, title_zh_hant, body_en, body_zh_hant, publish_at, expire_at,
              mandatory_ack, incident_ref, response_options, recorded_by
         FROM notice WHERE assertion_id = $1`,
      // THE DERIVED ID, exactly as the act computes it — so B collides on the same
      // primary key a real concurrent publish would, not on a row invented here.
      [row!.assertion_id, deriveActId('nota', `${id}.2`, 'publication_released')]);
    await held;   // B is now guaranteed to be waiting on the unique index, or to have already lost
  });

  // B: the REAL act, on its own connection, naming version 1. It must block, not fail fast.
  const started = Date.now();
  const bPromise = a.publish(id, 1, actor(), scope);
  // Give B time to reach the INSERT and block on A's uncommitted row.
  await new Promise((r) => setTimeout(r, 300));
  release();
  await holder;
  const b = await bPromise;

  assert.equal(b.kind, 'stale-state', `the loser must be REFUSED as stale, got ${b.kind}`);
  assert.ok(Date.now() - started >= 250, 'B blocked on the held transaction rather than failing fast — the interleaving really happened');

  const [n] = await dbA.query<{ n: string }>(`SELECT count(*)::text AS n FROM notice WHERE notice_id=$1 AND version=2`, [id]);
  assert.equal(n?.n, '1', 'exactly one version 2 exists');
  const [snap] = await dbA.query<{ n: string }>(`SELECT count(*)::text AS n FROM notice_audience WHERE notice_id=$1`, [id]);
  assert.equal(snap?.n, '0', "B's snapshot rolled back with B's transaction — nothing of the loser survives");
  const [ev] = await owner.query<{ n: string }>(`SELECT count(*)::text AS n FROM platform.outbox_message WHERE contract_name='notice.published' AND payload->>'noticeId'=$1`, [id]);
  assert.equal(ev?.n, '0', 'and no event');
});
