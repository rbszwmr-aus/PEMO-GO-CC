/**
 * ADR-020 cut C, C2 — the cases write surface: intake, triage, opening a Case.
 *
 * ACTS ONLY. What is under test is who may report about what, who may triage, and
 * the atomicity of opening a Case from a Ticket.
 *
 * ─── TWO AUTHORITY MODELS, AND THEY DO NOT SUBSTITUTE ───────────────────────
 *
 * Staff are gated by a covering `RoleScope<'estate_staff'>`; a resident holds no
 * grant at all and is gated by WHERE THEY LIVE. Most of these cases exist to pin
 * the resident rule, because it is the new one and the tempting wrong versions —
 * "anywhere in the estate", "any shared Location" — are the ones that read fine.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createModuleDb, loadConfig, likePrefix, likeEscapeClause, deriveActId,
} from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createReportableSet } from '../../modules/helpdesk/dist/index.js';
import { createCaseActs, type StaffActor, type ResidentReporter } from '../../apps/api/dist/management/case-acts.js';

const ORG = 'org_wingfu_holdings';
const OTHER_ORG = 'org_harbour_property';
const BLOCK_A = 'blk_wfg_a';
const BLOCK_B = 'blk_wfg_b';
const LIFT_A = 'loc_wfg_lift_bank_low';   // serves floors 01, 12, 20 of Block A

let owner: ReturnType<typeof createModuleDb>;
let helpdeskDb: ReturnType<typeof createModuleDb>;
let caseDb: ReturnType<typeof createModuleDb>;

const nodes = {
  async servingScopeNodes(_o: string, locationId: string) {
    const rows = await owner.query<{ node_type: string; node_id: string }>(
      `SELECT node_type, node_id FROM property.location_serving_scope WHERE location_id=$1`, [locationId]);
    return rows.map((r) => `${r.node_type}:${r.node_id}`);
  },
};

const occupancy = {
  async unitsOccupiedBy(_o: string, residentId: string, asAt: Date) {
    const rows = await owner.query<{ unit_id: string }>(
      `WITH cur AS (SELECT DISTINCT ON (occupancy_id) * FROM resident.occupancy
                     WHERE resident_id=$1 ORDER BY occupancy_id, version DESC)
       SELECT unit_id FROM cur
        WHERE effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)`,
      [residentId, asAt]);
    return rows.map((r) => r.unit_id);
  },
};
const servingScopeUnits = {
  async resolveServedUnits(_o: string, locationId: string) {
    const rows = await owner.query<{ unit_id: string }>(
      `SELECT u.unit_id FROM property.location_serving_scope s
         JOIN property.unit u ON u.floor_id = s.node_id
        WHERE s.location_id=$1 AND s.node_type='floor'`, [locationId]);
    return rows.map((r) => r.unit_id);
  },
};

const acts = () => createCaseActs({
  helpdeskDb, caseDb,
  auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
  platformDb: owner, nodes,
  reportable: createReportableSet(occupancy, servingScopeUnits),
});

/**
 * A grant EXPANDS DOWNWARD, and the test must expand it the way production does.
 *
 * The first version of this helper used an identity expander, so a grant at
 * `building:blk_wfg_a` produced the single key `building:blk_wfg_a` and covered
 * none of its units — six cases failed `out-of-scope` against a floor that was
 * behaving correctly. A ticket names a UNIT, and staff hold grants at buildings
 * and estates; the whole point of expansion is to close that gap.
 */
const scopeOver = (...keys: string[]) =>
  roleScope('estate_staff', keys.map((k, i) => ({
    grantId: `gr_c2_${i}`, groupId: 'grp_c2', role: 'estate_staff' as const,
    node: { kind: k.split(':')[0] as 'building', id: k.split(':')[1]! },
    effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null,
  })), async (ns) => {
    const out = new Set<string>();
    for (const n of ns) {
      out.add(`${n.kind}:${n.id}`);
      if (n.kind === 'building') {
        const rows = await owner.query<{ floor_id: string; unit_id: string }>(
          `SELECT f.floor_id, u.unit_id FROM property.floor f
             JOIN property.unit u ON u.floor_id = f.floor_id
            WHERE f.building_id = $1`, [n.id]);
        for (const r of rows) { out.add(`floor:${r.floor_id}`); out.add(`unit:${r.unit_id}`); }
      }
    }
    return [...out];
  });

const staffActor = (): StaffActor => ({
  organizationId: ORG, principalId: 'stf_wfg_manager', correlationId: randomUUID(), now: new Date(),
  witness: { groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
             nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
});

const reporter = (residentId: string, org = ORG): ResidentReporter => ({
  organizationId: org, principalId: `prn_${residentId}`, residentId,
  correlationId: randomUUID(), now: new Date(),
});

/** A resident occupying a unit ON A FLOOR THE LIFT SERVES, so both legs are testable. */
const seat = async (tag: string, floorId = 'fl_wfg_a_12') => {
  const unit = (await owner.query<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit WHERE floor_id=$1 AND unit_class='residential' ORDER BY 1 LIMIT 1`,
    [floorId]))[0]!.unit_id;
  const id = `res_c2_${tag}`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [id, ORG, tag]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`, [`occa_c2_${tag}`, `occ_c2_${tag}`, id, unit]);
  return { residentId: id, unitId: unit };
};

const intake = (over: Record<string, unknown> = {}) => ({
  clientKey: `c2-${randomUUID()}`, channel: 'resident_app', category: 'water',
  description: 'Water coming through the ceiling.', unitId: null, locationId: null, ...over,
} as never);

test.before(() => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  helpdeskDb = createModuleDb({ schema: 'helpdesk', database: cfg.databaseOwner });
  caseDb = createModuleDb({ schema: 'service_case', database: cfg.databaseOwner });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await caseDb.query(`DELETE FROM service_case WHERE case_id LIKE $1 ${esc}`, [likePrefix('cse_')]);
  await helpdeskDb.query(`DELETE FROM ticket_message WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_')]);
  await helpdeskDb.query(`DELETE FROM ticket_reference WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_')]);
  await helpdeskDb.query(`DELETE FROM ticket WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_')]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix('occ_c2_')]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix('res_c2_')]);
  await owner.query(`DELETE FROM access.audit_event WHERE target_kind IN ('ticket','service_case')`);
  await owner.query(`DELETE FROM platform.idempotency_record WHERE operation='submit_ticket'`);
  await Promise.all([owner.close(), helpdeskDb.close(), caseDb.close()]);
});

const auditsFor = async (targetId: string) =>
  (await owner.query<{ action: string; group_id: string | null }>(
    `SELECT action, group_id FROM access.audit_event WHERE target_id=$1`, [targetId]));

// ─── 1. the two intake paths ────────────────────────────────────────────────


test('a staff intake naming an unknown channel is REFUSED, not thrown by the CHECK (GEN-053 D3)', async () => {
  const me = await seat('chan');
  const r = await acts().submitByStaff({ ...intake({ unitId: me.unitId }), channel: 'carrier_pigeon' } as never,
    staffActor(), await scopeOver(`building:${BLOCK_A}`));
  assert.equal(r.kind, 'invalid-channel', 'the constraint used to fire at INSERT and surface as an exception');
});
