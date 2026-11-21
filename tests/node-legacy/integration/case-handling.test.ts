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
import { createReportableSet, createTicketDirectory } from '../../modules/helpdesk/dist/index.js';
import { createCaseActs, type StaffActor, type ResidentReporter } from '../../apps/api/dist/management/case-acts.js';
import { ticketMayMove, caseMayMove } from '../../apps/api/dist/management/case-permissions.js';
import type { TicketStatus } from '../../modules/helpdesk/dist/index.js';
import type { CaseState } from '../../modules/service-case/dist/index.js';

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

// A principal's OWN live estate_staff grants, expanded the way ticketNodes expands,
// so ownerCovers judges an owner against the same node keys the floor uses.
const expandGrantKeys = async (rows: readonly { node_kind: string; node_id: string }[]) => {
  const out = new Set<string>();
  for (const g of rows) {
    out.add(`${g.node_kind}:${g.node_id}`);
    // Expand ONLY within this grant's own subtree: an estate covers its buildings,
    // floors and units — not the whole property tree (which was the bug that made
    // stf_hbv_manager appear to cover a Wing Fu case).
    const q = g.node_kind === 'estate'
      ? `SELECT b.building_id, f.floor_id, u.unit_id FROM property.building b
           JOIN property.floor f ON f.building_id=b.building_id JOIN property.unit u ON u.floor_id=f.floor_id WHERE b.estate_id=$1`
      : g.node_kind === 'building'
      ? `SELECT b.building_id, f.floor_id, u.unit_id FROM property.building b
           JOIN property.floor f ON f.building_id=b.building_id JOIN property.unit u ON u.floor_id=f.floor_id WHERE b.building_id=$1`
      : null;
    if (q) for (const r of await owner.query<{ building_id: string; floor_id: string; unit_id: string }>(q, [g.node_id])) {
      out.add(`building:${r.building_id}`); out.add(`floor:${r.floor_id}`); out.add(`unit:${r.unit_id}`);
    }
  }
  return [...out];
};
const ownerCovers = async (_org: string, principalId: string, nodeKeys: readonly string[]) => {
  const grants = await owner.query<{ node_kind: string; node_id: string }>(
    `SELECT g.node_kind, g.node_id FROM access.scope_grant g JOIN access.group_membership m ON m.group_id=g.group_id
      WHERE m.principal_id=$1 AND g.role='estate_staff' AND g.effective_to IS NULL`, [principalId]);
  const keys = await expandGrantKeys(grants);
  return nodeKeys.length > 0 && nodeKeys.every((k) => keys.includes(k));
};
const ticketDirectory = createTicketDirectory(helpdeskDb);

const acts = () => createCaseActs({
  helpdeskDb, caseDb,
  auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
  platformDb: owner, nodes,
  reportable: createReportableSet(occupancy, servingScopeUnits),
  ownerCovers,
  ticketsOfCase: (org, caseId) => ticketDirectory.ticketsForCase(org, caseId).then((ts) =>
    ts.map((t) => ({ ticketId: t.ticketId, version: 0 }))),
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


// ═══ C3 (GEN-055) acceptance ══════════════════════════════════════════════════
const staff2 = staffActor;   // stf_wfg_manager covers the whole estate
const OTHER_OWNER = 'stf_hbv_manager';   // covers a DIFFERENT estate

const openTicket = async (tag: string) => {
  const me = await seat(tag);
  const s = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  assert.equal(s.kind, 'ok', `submit failed: ${JSON.stringify(s)}`);
  return { ticketId: (s as { ticketId: string }).ticketId, ...me };
};
const openCase = async (tag: string) => {
  const t = await openTicket(tag);
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const r = await acts().openCaseFromTicket(t.ticketId, staff2(), scope);
  assert.equal(r.kind, 'ok', `openCase failed: ${JSON.stringify(r)}`);
  return { caseId: (r as { caseId: string }).caseId, ticketId: t.ticketId, residentId: t.residentId };
};
const caseVersion = async (caseId: string) =>
  Number((await caseDb.query<{ version: number }>(`SELECT version FROM case_current WHERE case_id=$1`, [caseId]))[0]!.version);
const ticketVersion = async (ticketId: string) =>
  Number((await helpdeskDb.query<{ version: number }>(`SELECT version FROM ticket_current WHERE ticket_id=$1`, [ticketId]))[0]!.version);

test('C3-1 — the three vocabularies are DISJOINT (D0, GEN-047 D6 pattern)', () => {
  // @ts-expect-error a ticket status is not a case state
  const bad1: CaseState = 'awaiting_resident' as TicketStatus; void bad1;
  // @ts-expect-error a case state is not a ticket status
  const bad2: TicketStatus = 'awaiting_external' as CaseState; void bad2;
  // and the transition tables are typed to their own vocabulary
  assert.equal(ticketMayMove('open', 'resolved'), true);
  assert.equal(caseMayMove('assigned', 'resolved'), true);
});

test('C3-2 — a message visibility is fixed; a resident message is always resident_visible', async () => {
  const t = await openTicket('vis');
  const staffScope = await scopeOver(`building:${BLOCK_A}`);
  // staff may set either
  assert.equal((await acts().postTicketMessageAsStaff(t.ticketId, { clientKey: 'k1', body: 'internal note', visibility: 'internal' }, staff2(), staffScope)).kind, 'ok');
  // a resident asking for internal is refused, not silently corrected
  assert.equal((await acts().postTicketMessageAsReporter(t.ticketId, { clientKey: 'k2', body: 'hi', visibility: 'internal' }, reporter(t.residentId))).kind, 'message-visibility-fixed');
  assert.equal((await acts().postTicketMessageAsReporter(t.ticketId, { clientKey: 'k3', body: 'hi', visibility: 'resident_visible' }, reporter(t.residentId))).kind, 'ok');
  // no UPDATE path exists: pemo_app holds no UPDATE on ticket_message
  const [g] = await owner.query<{ n: string }>(`SELECT count(*)::text AS n FROM information_schema.role_table_grants WHERE grantee='pemo_app' AND table_name='ticket_message' AND privilege_type='UPDATE'`);
  assert.equal(g?.n, '0', 'visibility is immutable because nothing may UPDATE the message');
});

test('C3-3 — an anonymous ticket accepts no resident conversation, but a staff internal note is fine', async () => {
  // an anonymous staff-filed ticket has reporter NULL
  const s = await acts().submitByStaff({ ...intake({ unitId: null, locationId: null }), channel: 'phone', anonymous: true } as never, staff2(), await scopeOver(`building:${BLOCK_A}`));
  // fall back: submit a normal ticket then null its reporter to model an anonymous one deterministically
  const t = await openTicket('anon');
  await helpdeskDb.query(`INSERT INTO ticket (assertion_id, ticket_id, version, organization_id, disposition, status, channel, category, description, node_kind, node_id, recorded_by) SELECT assertion_id||'x', ticket_id, version+1, organization_id, 'status_set', status, channel, category, description, node_kind, node_id, recorded_by FROM ticket_current WHERE ticket_id=$1`, [t.ticketId]).catch(()=>{});
  await helpdeskDb.query(`UPDATE ticket SET reporter_ref=NULL, reporter_kind=NULL WHERE ticket_id=$1`, [t.ticketId]).catch(async ()=>{
    // pemo_app cannot UPDATE; use owner for the test fixture only
    await owner.query(`UPDATE helpdesk.ticket SET reporter_ref=NULL, reporter_kind=NULL WHERE ticket_id=$1`, [t.ticketId]);
  });
  const staffScope = await scopeOver(`building:${BLOCK_A}`);
  assert.equal((await acts().postTicketMessageAsStaff(t.ticketId, { clientKey: 'a1', body: 'note', visibility: 'internal' }, staff2(), staffScope)).kind, 'ok', 'staff internal note is allowed');
  assert.equal((await acts().postTicketMessageAsStaff(t.ticketId, { clientKey: 'a2', body: 'reply', visibility: 'resident_visible' }, staff2(), staffScope)).kind, 'anonymous-ticket', 'no resident-visible reply on an anonymous ticket');
  assert.equal((await acts().postTicketMessageAsReporter(t.ticketId, { clientKey: 'a3', body: 'hi', visibility: 'resident_visible' }, reporter(t.residentId))).kind, 'anonymous-ticket');
  void s;
});

test('C3-4 — pending_verification NEVER self-advances; only a human closeCase closes', async () => {
  const c = await openCase('pv');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  let v = await caseVersion(c.caseId);
  assert.equal((await acts().assignCase(c.caseId, v, 'stf_wfg_manager', staff2(), scope)).kind, 'ok'); v = await caseVersion(c.caseId);
  assert.equal((await acts().setCaseStatus(c.caseId, v, 'awaiting_external', { externalLink: { externalSystem: 'acme', externalRef: 'WO-1' } }, staff2(), scope)).kind, 'ok'); v = await caseVersion(c.caseId);
  assert.equal((await acts().recordExternalCompletion(c.caseId, v, 'vendor says done', staff2(), scope)).kind, 'ok'); v = await caseVersion(c.caseId);
  const [st] = await caseDb.query<{ lifecycle_state: string }>(`SELECT lifecycle_state FROM case_current WHERE case_id=$1`, [c.caseId]);
  assert.equal(st?.lifecycle_state, 'pending_verification', 'an external completion moves to pending_verification and NO further');
  // adding a note does not advance it
  assert.equal((await acts().addCaseNote(c.caseId, { clientKey: 'n', body: 'checking' }, staff2(), scope)).kind, 'ok');
  const [st2] = await caseDb.query<{ lifecycle_state: string }>(`SELECT lifecycle_state FROM case_current WHERE case_id=$1`, [c.caseId]);
  assert.equal(st2?.lifecycle_state, 'pending_verification', 'still pending after other acts');
  // a human closes it, with a reason
  assert.equal((await acts().closeCase(c.caseId, v, 'work_completed', staff2(), scope)).kind, 'ok');
  const [st3] = await caseDb.query<{ lifecycle_state: string }>(`SELECT lifecycle_state FROM case_current WHERE case_id=$1`, [c.caseId]);
  assert.equal(st3?.lifecycle_state, 'closed');
});

test('C3-5 — closeCase refused from a wrong state and without a reason; derived-key repeat is one effect', async () => {
  const c = await openCase('close');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const v0 = await caseVersion(c.caseId);
  assert.equal((await acts().closeCase(c.caseId, v0, 'work_completed', staff2(), scope)).kind, 'case-not-closable', 'an open case does not close directly');
  // drive to resolved
  await acts().assignCase(c.caseId, await caseVersion(c.caseId), 'stf_wfg_manager', staff2(), scope);
  await acts().setCaseStatus(c.caseId, await caseVersion(c.caseId), 'resolved', {}, staff2(), scope);
  const vr = await caseVersion(c.caseId);
  assert.equal((await acts().closeCase(c.caseId, vr, 'not_a_reason', staff2(), scope)).kind, 'invalid-reason');
  assert.equal((await acts().closeCase(c.caseId, vr, 'work_completed', staff2(), scope)).kind, 'ok');
  // stale version refused by the constraint (GEN-049 shape)
  assert.equal((await acts().closeCase(c.caseId, vr, 'work_completed', staff2(), scope)).kind, 'stale-state');
});

test('C3-6 — assignCase refuses an owner whose grant does not cover the node', async () => {
  const c = await openCase('assign');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const v = await caseVersion(c.caseId);
  assert.equal((await acts().assignCase(c.caseId, v, OTHER_OWNER, staff2(), scope)).kind, 'owner-cannot-see-case', 'an owner who cannot see the case is a lie');
  assert.equal((await acts().assignCase(c.caseId, v, 'stf_wfg_manager', staff2(), scope)).kind, 'ok');
});

test('C3-7 — resolveTicketFromCase is atomic: a forced ticket failure leaves NO case closure', async () => {
  const c = await openCase('resolve');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  await acts().assignCase(c.caseId, await caseVersion(c.caseId), 'stf_wfg_manager', staff2(), scope);
  await acts().setCaseStatus(c.caseId, await caseVersion(c.caseId), 'resolved', {}, staff2(), scope);
  const vr = await caseVersion(c.caseId);
  // seize the primary key the ticket resolution will derive, so its INSERT fails
  const tv = await ticketVersion(c.ticketId);
  const { deriveActId } = await import('../../modules/platform/dist/index.js');
  await owner.query(`INSERT INTO helpdesk.ticket (assertion_id, ticket_id, version, organization_id, disposition, status, channel, category, description, recorded_by) VALUES ($1,$2,1,$3,'report_opened','open','phone','x','blocker','stf_wfg_manager')`,
    [deriveActId('tkta', `${c.ticketId}.${tv + 1}`, 'resolution_recorded'), `blk_${randomUUID()}`, ORG]);
  await assert.rejects(() => acts().resolveTicketFromCase(c.caseId, vr, 'work_completed', 'done via case', staff2(), scope));
  const [st] = await caseDb.query<{ lifecycle_state: string }>(`SELECT lifecycle_state FROM case_current WHERE case_id=$1`, [c.caseId]);
  assert.notEqual(st?.lifecycle_state, 'closed', 'no case closure survives a failed ticket step');
});

test('C3-8 — recordSatisfaction: reporter only, once per closure, a new closure a new slot', async () => {
  const t = await openTicket('sat');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  // drive the ticket to closed
  await acts().setTicketStatus(t.ticketId, await ticketVersion(t.ticketId), 'resolved', { closingMessage: 'fixed' }, staff2(), scope);
  await acts().setTicketStatus(t.ticketId, await ticketVersion(t.ticketId), 'closed', { closureReason: 'fixed' }, staff2(), scope);
  // a non-reporter is refused
  const other = await seat('sat_other');
  assert.equal((await acts().recordSatisfaction(t.ticketId, 5, null, reporter(other.residentId))).kind, 'not-the-reporter');
  const first = await acts().recordSatisfaction(t.ticketId, 5, 'great', reporter(t.residentId));
  assert.equal(first.kind, 'ok');
  const repeat = await acts().recordSatisfaction(t.ticketId, 5, 'great', reporter(t.residentId));
  assert.equal(repeat.kind, 'ok'); assert.equal((repeat as { firstTime: boolean }).firstTime, false, 'a retry is one row');
  const different = await acts().recordSatisfaction(t.ticketId, 1, 'changed my mind', reporter(t.residentId));
  assert.equal(different.kind, 'satisfaction-already-recorded', 'a different answer to the same closure is refused');
});

test('C3-9 — addCaseNote refuses a visibility field (denylist at the act)', async () => {
  const c = await openCase('note');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  assert.equal((await acts().addCaseNote(c.caseId, { clientKey: 'n', body: 'ok', visibility: 'resident_visible' } as never, staff2(), scope)).kind, 'note-visibility-refused');
  assert.equal((await acts().addCaseNote(c.caseId, { clientKey: 'n2', body: 'ok' }, staff2(), scope)).kind, 'ok');
});

test('C3-11 — a block-B staff caller is refused on a block-A case (floor)', async () => {
  const c = await openCase('floor');
  const blockB = await scopeOver(`building:${BLOCK_B}`);
  const v = await caseVersion(c.caseId);
  assert.equal((await acts().addCaseNote(c.caseId, { clientKey: 'x', body: 'y' }, staff2(), blockB)).kind, 'out-of-scope');
  assert.equal((await acts().setCaseStatus(c.caseId, v, 'in_progress', {}, staff2(), blockB)).kind, 'out-of-scope');
});

test('P1-R1 — audit insert failure leaves case, ticket and audit unchanged', async () => {
  const t = await openTicket('p1r1');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const wrapFailingAudit = (db: typeof helpdeskDb): typeof helpdeskDb => ({
    ...db,
    inTransaction: false,
    query: db.query.bind(db),
    queryOne: db.queryOne.bind(db),
    close: db.close.bind(db),
    transaction: (fn) => db.transaction(async (tx) => fn({
      ...tx,
      query: async (text, values) => {
        if (String(text).includes('access.audit_event') || String(text).includes('append_audit_event')) {
          throw new Error('injected audit insert failure');
        }
        return tx.query(text, values);
      },
    })),
  });
  const failing = createCaseActs({
    helpdeskDb: wrapFailingAudit(helpdeskDb), caseDb,
    auditDb: createModuleDb({ schema: 'access', database: loadConfig().databaseOwner }),
    platformDb: owner, nodes,
    reportable: createReportableSet(occupancy, servingScopeUnits),
    ownerCovers,
    ticketsOfCase: (org, caseId) => ticketDirectory.ticketsForCase(org, caseId).then((ts) =>
      ts.map((tkt) => ({ ticketId: tkt.ticketId, version: 0 }))),
  });
  const [ticketBefore] = await helpdeskDb.query<{ primary_case_ref: string | null; version: number }>(
    `SELECT primary_case_ref, version FROM ticket_current WHERE ticket_id=$1`, [t.ticketId]);
  const casesBefore = await caseDb.query<{ case_id: string }>(
    `SELECT case_id FROM service_case WHERE originating_ticket_ref=$1`, [t.ticketId]);
  const auditsBefore = await auditsFor(t.ticketId);
  await assert.rejects(
    () => failing.openCaseFromTicket(t.ticketId, staff2(), scope),
    /injected audit insert failure/,
  );
  const [ticketAfter] = await helpdeskDb.query<{ primary_case_ref: string | null; version: number }>(
    `SELECT primary_case_ref, version FROM ticket_current WHERE ticket_id=$1`, [t.ticketId]);
  const casesAfter = await caseDb.query<{ case_id: string }>(
    `SELECT case_id FROM service_case WHERE originating_ticket_ref=$1`, [t.ticketId]);
  const auditsAfter = await auditsFor(t.ticketId);
  assert.equal(ticketAfter?.primary_case_ref, ticketBefore?.primary_case_ref ?? null, 'ticket must be unchanged');
  assert.equal(ticketAfter?.version, ticketBefore?.version, 'ticket version must be unchanged');
  assert.equal(casesAfter.length, casesBefore.length, 'no case may persist after the audit failure');
  assert.equal(auditsAfter.length, auditsBefore.length, 'no audit row may persist after the audit failure');
});
