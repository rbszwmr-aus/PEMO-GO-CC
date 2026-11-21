/**
 * ADR-019 cut A — the notices schema, and the audience resolver.
 *
 * SCHEMA ORIGINATION ONLY. There is no write surface, no route and no contract
 * here; composing and publishing a notice is N2 and the acknowledgement surface
 * is N3. These tests exercise the SHAPE and the RESOLVER, which is everything
 * cut A actually ships.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig, likePrefix, likeEscapeClause } from '../../modules/platform/dist/index.js';
import { createOccupancyAudience } from '../../modules/resident/dist/index.js';
import { createNoticeAudienceResolver } from '../../modules/notices/dist/index.js';
import type { NoticeTarget } from '../../modules/notices/dist/index.js';

const ORG = 'org_wingfu_holdings';
/** The GEN-006 partial-floor lift: serves floors 01, 12 and 20 of Block A only. */
const LIFT = 'loc_wfg_lift_bank_low';
const BLOCK_A = 'blk_wfg_a';

let owner: ReturnType<typeof createModuleDb>;
let residentDb: ReturnType<typeof createModuleDb>;
let noticesDb: ReturnType<typeof createModuleDb>;

const target = (t: Partial<NoticeTarget>): NoticeTarget => ({
  nodeKind: null, nodeId: null, locationId: null, residentGroupId: null, ...t,
});

/**
 * The property-side ports, backed by real SQL through the OWNER handle.
 *
 * These stand in for the wiring `apps/api` will do in N2 — the point of the test
 * is the resolver's composition and the resident capability, not the injection.
 * They read `property.*` HERE, in the test's own composition layer, which is
 * exactly where such a join is allowed to live; the module itself never does it.
 */
const unitExpansion = {
  async unitsUnder(_org: string, nodes: readonly { kind: string; id: string }[]) {
    const buildings = nodes.filter((n) => n.kind === 'building').map((n) => n.id);
    if (buildings.length === 0) return [];
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.unit u
         JOIN property.floor f ON f.floor_id = u.floor_id
        WHERE f.building_id = ANY($1)`, [buildings]);
    return rows.map((r) => r.unit_id);
  },
};
const servingScope = {
  async resolveServedUnits(_org: string, locationId: string) {
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.location_serving_scope s
         JOIN property.floor f ON f.floor_id = s.node_id AND s.node_type = 'floor'
         JOIN property.unit u ON u.floor_id = f.floor_id
        WHERE s.location_id = $1`, [locationId]);
    return rows.map((r) => r.unit_id);
  },
};

const resolver = () => createNoticeAudienceResolver(
  unitExpansion, servingScope, createOccupancyAudience(residentDb));

test.before(async () => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  residentDb = createModuleDb({ schema: 'resident', database: cfg.databaseOwner });
  noticesDb = createModuleDb({ schema: 'notices', database: cfg.databaseOwner });
});

test.after(async () => {
  await noticesDb.query(
    `DELETE FROM notice_target WHERE assertion_id LIKE $1 ${likeEscapeClause}`, [likePrefix('nota_t_')]);
  await noticesDb.query(`DELETE FROM notice WHERE notice_id LIKE $1 ${likeEscapeClause}`, [likePrefix('ntc_t_')]);
  await noticesDb.query(
    `DELETE FROM notice_acknowledgement WHERE notice_id LIKE $1 ${likeEscapeClause}`, [likePrefix('ntc_t_')]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${likeEscapeClause}`,
                    [likePrefix('occ_t_n1_')]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${likeEscapeClause}`,
                    [likePrefix('res_t_n1_')]);
  await Promise.all([owner.close(), residentDb.close(), noticesDb.close()]);
});

// ─── 1. supersession ────────────────────────────────────────────────────────

test('1 — UNIQUE(instance, version) refuses a second assertion at one version', async () => {
  await noticesDb.query(
    `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                         notice_type, title_en, title_zh_hant, body_en, body_zh_hant, recorded_by)
     VALUES ('nota_t_dup_1','ntc_t_dup',1,$1,'draft_saved','general','t','t','b','b','stf_wfg_manager')`, [ORG]);

  await assert.rejects(
    () => noticesDb.query(
      `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                           notice_type, title_en, title_zh_hant, body_en, body_zh_hant, recorded_by)
       VALUES ('nota_t_dup_2','ntc_t_dup',1,$1,'publication_released','general','t','t','b','b','stf_wfg_manager')`, [ORG]),
    // NAMED, not `|duplicate key`: that alternative would also be satisfied by a
    // PRIMARY KEY violation, which is the vacuity GEN-038 found. The sweep in
    // supersession-sweep.test.ts is the derived, per-table proof.
    /notice_version_unique/,
    'a second assertion at the same version must lose HERE — at the supersession key');
});

// ─── 2. computed state, and no UPDATE path ──────────────────────────────────

test('2 — draft -> published -> withdrawn over three assertions computes to withdrawn', async () => {
  const rows: [number, string][] = [[1, 'draft_saved'], [2, 'publication_released'], [3, 'withdrawal_recorded']];
  for (const [v, d] of rows) {
    await noticesDb.query(
      `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                           notice_type, title_en, title_zh_hant, body_en, body_zh_hant,
                           publish_at, recorded_by)
       VALUES ($1,'ntc_t_life',$2,$3,$4,'general','t','t','b','b', now() - interval '1 hour','stf_wfg_manager')`,
      [`nota_t_life_${v}`, v, ORG, d]);
  }
  const [state] = await noticesDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM notice_current WHERE notice_id = 'ntc_t_life'`);
  assert.equal(state?.lifecycle_state, 'withdrawn');

  // And the earlier assertions SURVIVE. A withdrawal that erased what was
  // published would destroy the record the notice exists to be.
  const chain = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice WHERE notice_id = 'ntc_t_life'`);
  assert.equal(chain[0]?.n, '3', 'the superseded assertions remain');
});

test('2b — there is NO stored lifecycle column to update, and the app cannot UPDATE', async () => {
  const cols = await noticesDb.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='notices' AND table_name='notice'
        AND column_name IN ('state','lifecycle_state','status')`);
  assert.deepEqual(cols, [], 'a stored mutable state would be a second source of truth (0117)');

  const noticesLogin = loadConfig().moduleDatabases.notices.user;
  const [privs] = await noticesDb.query<{ sel: boolean; ins: boolean; upd: boolean; del: boolean }>(
    `SELECT has_table_privilege($1, 'notices.notice', 'SELECT') AS sel,
            has_table_privilege($1, 'notices.notice', 'INSERT') AS ins,
            has_table_privilege($1, 'notices.notice', 'UPDATE') AS upd,
            has_table_privilege($1, 'notices.notice', 'DELETE') AS del`,
    [noticesLogin],
  );
  assert.deepEqual(privs, { sel: true, ins: true, upd: false, del: false },
    'append-only is enforced by privilege, not by everyone remembering');
});

// ─── 3/4/5. the resolver ────────────────────────────────────────────────────

/**
 * A residential occupancy on a unit, effective from an instant.
 *
 * The resident row comes first: `resident.occupancy` has a foreign key to it —
 * a WITHIN-module key, which is exactly the kind ADR-019 D1 permits and the
 * cross-module kind it forbids.
 */
const occupy = async (tag: string, unitId: string, from: string, unitClass = 'residential') => {
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (resident_id) DO NOTHING`,
    [`res_t_n1_${tag}`, ORG, `N1 fixture ${tag}`]);
  return owner.query(
    `INSERT INTO resident.occupancy
       (assertion_id, version, occupancy_id, resident_id, household_id, unit_id, unit_class,
        role, status, source, effective_from)
     VALUES ($1, 1, $2, $3, NULL, $4, $5, 'tenant', 'active', 'seed', $6)`,
    [`occa_t_n1_${tag}`, `occ_t_n1_${tag}`, `res_t_n1_${tag}`, unitId, unitClass, from]);
};

test('3 — the rule resolves AS AT an instant: a later mover-in is absent from the earlier answer', async () => {
  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' ORDER BY 1 LIMIT 1`, [BLOCK_A]))[0]!.unit_id;

  const T1 = new Date('2026-01-01T00:00:00Z');
  const T2 = new Date('2026-06-01T00:00:00Z');
  await occupy('early', unit, '2025-01-01T00:00:00Z');
  await occupy('later', unit, T2.toISOString());

  const rule = { organizationId: ORG, targets: [target({ nodeKind: 'building', nodeId: BLOCK_A })] };
  const atT1 = await resolver().resolveAudience(rule, T1);
  const atT2 = await resolver().resolveAudience(rule, T2);

  const ids = (rs: readonly { residentId: string }[]) => rs.map((r) => r.residentId).sort();
  assert.ok(ids(atT1).includes('res_t_n1_early'), 'the sitting tenant is in the T1 answer');
  assert.ok(!ids(atT1).includes('res_t_n1_later'),
    'THE MOVER-IN MUST BE ABSENT AT T1 — they had not arrived, so they were not told');
  assert.ok(ids(atT2).includes('res_t_n1_later'), 'and present at T2');
});

test('4 — a parking or storage unit in the targeted set contributes no recipient', async () => {
  const parking = (await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class <> 'residential' ORDER BY 1 LIMIT 1`, [BLOCK_A]))[0]!.unit_id;
  await occupy('parking', parking, '2020-01-01T00:00:00Z', 'parking');

  const found = await resolver().resolveAudience(
    { organizationId: ORG, targets: [target({ nodeKind: 'building', nodeId: BLOCK_A })] },
    new Date('2026-08-01T00:00:00Z'));
  assert.ok(!found.map((r) => r.residentId).includes('res_t_n1_parking'),
    'a parking space has an occupancy row and no resident to notify');
});

test('5 — a partial-floor lift resolves to its floors, NOT its block', async () => {
  const asAt = new Date('2026-08-01T00:00:00Z');

  // BUILD THE CONTRAST RATHER THAN HOPING THE SEED PROVIDES IT. One resident on a
  // floor the lift serves, one on a floor of the same block that it does not. A
  // first version of this test relied on the seeded population and passed
  // vacuously when every seeded resident happened to sit on a served floor —
  // lift and block returned the same set and "fewer" was never exercised.
  const served = await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u
      WHERE u.unit_class='residential' AND u.floor_id IN (
        SELECT node_id FROM property.location_serving_scope
         WHERE location_id=$1 AND node_type='floor')
      ORDER BY 1 LIMIT 1`, [LIFT]);
  const unserved = await owner.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      WHERE f.building_id=$1 AND u.unit_class='residential' AND u.floor_id NOT IN (
        SELECT node_id FROM property.location_serving_scope
         WHERE location_id=$2 AND node_type='floor')
      ORDER BY 1 LIMIT 1`, [BLOCK_A, LIFT]);
  assert.ok(served[0] && unserved[0], 'the fixture needs a served and an unserved unit in one block');
  await occupy('onlift', served[0].unit_id, '2020-01-01T00:00:00Z');
  await occupy('offlift', unserved[0].unit_id, '2020-01-01T00:00:00Z');
  const viaLift = await resolver().resolveAudience(
    { organizationId: ORG, targets: [target({ locationId: LIFT })] }, asAt);
  const viaBlock = await resolver().resolveAudience(
    { organizationId: ORG, targets: [target({ nodeKind: 'building', nodeId: BLOCK_A })] }, asAt);

  const servedFloors = await owner.query<{ node_id: string }>(
    `SELECT node_id FROM property.location_serving_scope
      WHERE location_id=$1 AND node_type='floor'`, [LIFT]);
  assert.ok(servedFloors.length >= 2 && servedFloors.length < 20,
    'the fixture must be a PARTIAL floor set, or this test proves nothing');

  const liftIds = viaLift.map((r) => r.residentId);
  const blockIds = viaBlock.map((r) => r.residentId);
  assert.ok(liftIds.includes('res_t_n1_onlift'), 'the resident on a served floor is reached');
  assert.ok(!liftIds.includes('res_t_n1_offlift'),
    'THE RESIDENT ON AN UNSERVED FLOOR OF THE SAME BLOCK MUST NOT BE REACHED — resolving via the '
    + 'physical parent is the bug this Location model exists to prevent');
  assert.ok(blockIds.includes('res_t_n1_offlift'), 'though the BLOCK target does reach them');
  assert.ok(viaLift.length < viaBlock.length, 'so the lift reaches strictly fewer');

  // Every lift recipient lives on a floor the lift actually serves.
  const floors = new Set(servedFloors.map((f) => f.node_id));
  const unitFloor = new Map((await owner.query<{ unit_id: string; floor_id: string }>(
    `SELECT unit_id, floor_id FROM property.unit`)).map((u) => [u.unit_id, u.floor_id]));
  for (const r of viaLift) {
    assert.ok(floors.has(unitFloor.get(r.unitId)!),
      `${r.unitId} is not on a floor the lift serves`);
  }
});

// ─── 7. idempotent acknowledgement ──────────────────────────────────────────

test('7 — a duplicate acknowledgement with the same key is exactly one effect', async () => {
  const ins = (kind: string) => noticesDb.query(
    `INSERT INTO notice_acknowledgement (notice_id, resident_id, kind)
     VALUES ('ntc_t_ack','res_t_n1_ack',$1)`, [kind]);

  await ins('acknowledged');
  await assert.rejects(() => ins('acknowledged'), /notice_ack_unique|duplicate key/,
    'the second identical ack must lose at the constraint, not be filtered in code');

  // read and acknowledged are DIFFERENT facts and both survive.
  await ins('read');
  const [n] = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_acknowledgement WHERE notice_id='ntc_t_ack'`);
  assert.equal(n?.n, '2');
});

// ─── 8. the attachment reference ────────────────────────────────────────────

test('8 — attachment_ref has no FK to its owner, a declared scan_status, and an opaque storage_ref', async () => {
  const fks = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.table_constraints
      WHERE table_schema='platform' AND table_name='attachment_ref' AND constraint_type='FOREIGN KEY'`);
  assert.equal(fks[0]?.n, '0', 'a foreign key would make platform a reader of every module schema');

  await assert.rejects(
    () => owner.query(
      `INSERT INTO platform.attachment_ref
         (attachment_id, owner_module, owner_entity_kind, owner_entity_id, filename,
          content_type, size_bytes, storage_ref, scan_status)
       VALUES ('att_t_bad','notices','notice','ntc_t_x','a.pdf','application/pdf',1,'x','no-such-status')`),
    /attachment_scan_status_check/, 'scan_status is a declared vocabulary');

  // OPAQUE storage_ref: three unrelated shapes all accepted. The ABSENCE of a
  // format constraint is the design (GEN-006-ST left storage undecided), so this
  // asserts the absence WITHOUT enshrining any one format.
  for (const [i, ref] of ['s3://bucket/key', '/var/lib/x/y.bin', 'urn:opaque:whatever'].entries()) {
    await owner.query(
      `INSERT INTO platform.attachment_ref
         (attachment_id, owner_module, owner_entity_kind, owner_entity_id, filename,
          content_type, size_bytes, storage_ref)
       VALUES ($1,'notices','notice','ntc_t_x','a.pdf','application/pdf',1,$2)`,
      [`att_t_ok_${i}`, ref]);
  }
  const [ok] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM platform.attachment_ref WHERE attachment_id LIKE $1 ${likeEscapeClause}`,
    [likePrefix('att_t_ok_')]);
  assert.equal(ok?.n, '3');
  await owner.query(`DELETE FROM platform.attachment_ref WHERE attachment_id LIKE $1 ${likeEscapeClause}`,
                    [likePrefix('att_t_')]);

  const [dflt] = await owner.query<{ column_default: string }>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema='platform' AND table_name='attachment_ref' AND column_name='scan_status'`);
  assert.match(dflt!.column_default, /pending/,
    'the default must not be a security claim about a file nothing has scanned');
});

// ─── 9. the declared type vocabulary ────────────────────────────────────────

test('9 — the notice-type vocabulary agrees across declaration, module and DDL', async () => {
  const { NOTICE_TYPES } = await import('../../modules/notices/dist/index.js');
  const declared = [...NOTICE_TYPES].sort();

  const [ddl] = await owner.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='notice_type_check'`);
  const inDdl = [...ddl!.def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
  assert.deepEqual(inDdl, declared, 'the DDL constraint is a projection of the declaration');

  for (const t of declared) {
    await noticesDb.query(
      `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                           notice_type, title_en, title_zh_hant, body_en, body_zh_hant, recorded_by)
       VALUES ($1, $2, 1, $3, 'draft_saved', $4, 't','t','b','b','stf_wfg_manager')`,
      [`nota_t_ty_${t}`, `ntc_t_ty_${t}`, ORG, t]);
  }
  await assert.rejects(
    () => noticesDb.query(
      `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                           notice_type, title_en, title_zh_hant, body_en, body_zh_hant, recorded_by)
       VALUES ('nota_t_ty_bad','ntc_t_ty_bad',1,$1,'draft_saved','not_a_type','t','t','b','b','stf_wfg_manager')`,
      [ORG]),
    /notice_type_check/);
});

// ─── the OQ1 slot ───────────────────────────────────────────────────────────

test('OQ1 — the resident-group slot exists, is unused, and is not access.group', async () => {
  const [col] = await owner.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='notices' AND table_name='notice_target' AND column_name='resident_group_id'`);
  assert.equal(col?.is_nullable, 'YES', 'the slot exists and is optional');

  const [fk] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.constraint_column_usage u
       JOIN information_schema.table_constraints t ON t.constraint_name=u.constraint_name
      WHERE t.table_schema='notices' AND t.table_name='notice_target' AND t.constraint_type='FOREIGN KEY'
        AND u.table_name='user_group'`);
  assert.equal(fk?.n, '0',
    'resident targeting must never resolve through the STAFF authorization model (ADR-012 D2)');

  const used = await noticesDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notice_target WHERE resident_group_id IS NOT NULL`);
  assert.equal(used[0]?.n, '0', 'ADR-019 OQ1: the entity is deliberately not invented yet');
});
