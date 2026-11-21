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

test('1 — a resident submits about their own unit: ticket, display ref, NO audit row', async () => {
  const me = await seat('own');
  const res = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  assert.equal(res.kind, 'ok', JSON.stringify(res));
  const ok = res as { ticketId: string; displayRef?: string };
  assert.match(ok.displayRef ?? '', /^[A-Z]{3}-\d{4}-\d{4}$/,
    'CAS-01 immediate acknowledgement: a human reference comes back from the act itself');

  assert.deepEqual(await auditsFor(ok.ticketId), [],
    'a resident act writes NO audit_event row — the ticket assertion IS the record '
    + '(ADR-014 amendment). The audit table records staff authority-bearing acts.');
});

test('1b — staff submit by phone: ticket AND an audit row carrying the witness', async () => {
  const me = await seat('phonecall');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const res = await acts().submitByStaff(
    intake({ channel: 'phone', unitId: me.unitId }), staffActor(), scope);
  assert.equal(res.kind, 'ok', JSON.stringify(res));
  const rows = await auditsFor((res as { ticketId: string }).ticketId);
  assert.equal(rows.length, 1, 'the staff act is audited');
  assert.ok(rows[0]?.group_id !== null, 'and carries the GEN-030 witness');
});

// ─── 2. the reportable set ──────────────────────────────────────────────────

test('2 — a resident may report a Location that SERVES their unit', async () => {
  const me = await seat('lift', 'fl_wfg_a_12');   // a floor the low-zone lift serves
  const res = await acts().submitByResident(intake({ locationId: LIFT_A }), reporter(me.residentId));
  assert.equal(res.kind, 'ok', JSON.stringify(res));
});

test('2b — but NOT a Location that serves somebody else', async () => {
  // Floor 05 is in Block A and is NOT in the low-zone lift's serving scope.
  const stranger = await seat('otherfloor', 'fl_wfg_a_05');
  const res = await acts().submitByResident(intake({ locationId: LIFT_A }), reporter(stranger.residentId));
  assert.equal(res.kind, 'not-reportable',
    'shared infrastructure is not everybody\'s to report on — serving scope is the rule');
});

test('2c — and NOT another household unit', async () => {
  const me = await seat('mine2', 'fl_wfg_a_12');
  const other = await seat('theirs', 'fl_wfg_a_05');
  const res = await acts().submitByResident(intake({ unitId: other.unitId }), reporter(me.residentId));
  assert.equal(res.kind, 'not-reportable', 'a report is a statement about somebody home');
});

test('2d — naming no subject at all is refused', async () => {
  const me = await seat('nosubject');
  const res = await acts().submitByResident(intake({}), reporter(me.residentId));
  assert.equal(res.kind, 'not-reportable',
    'a report whose subject nobody can check is refused, not accepted as general feedback');
});

// ─── 3. anonymity, fail-closed ──────────────────────────────────────────────

test('3 — anonymous is permitted only where policy says so', async () => {
  const me = await seat('anon');
  const ok = await acts().submitByResident(
    intake({ unitId: me.unitId, anonymous: true }), reporter(me.residentId));
  assert.equal(ok.kind, 'ok', 'Wing Fu allows it by seeded policy');

  const [row] = await helpdeskDb.query<{ reporter_ref: string | null }>(
    `SELECT reporter_ref FROM ticket WHERE ticket_id=$1`, [(ok as { ticketId: string }).ticketId]);
  assert.equal(row?.reporter_ref, null, 'and the reporter really is absent');

  // The other seeded organization has NO ROW — nobody has decided, so it is refused.
  const refusedRes = await acts().submitByResident(
    intake({ unitId: me.unitId, anonymous: true }), reporter(me.residentId, OTHER_ORG));
  assert.equal(refusedRes.kind, 'anonymous-not-permitted',
    'NO ROW MEANS NOT PERMITTED — an anonymous report cannot be replied to, verified, '
    + 'or attributed, so accepting one must be a deliberate choice');
});

// ─── 4. the triage floor ────────────────────────────────────────────────────

test('4 — triage requires cover of the ticket node, and re-triage appends', async () => {
  const me = await seat('triage');
  const submitted = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  const ticketId = (submitted as { ticketId: string }).ticketId;

  const wrong = await acts().triageTicket(ticketId, 1,
    { ticketType: 'leak', priority: 'high', queue: 'q_maintenance', dueAt: null },
    staffActor(), await scopeOver(`building:${BLOCK_B}`));
  assert.equal(wrong.kind, 'out-of-scope', 'block-B staff cannot triage a block-A ticket');

  const right = await acts().triageTicket(ticketId, 1,
    { ticketType: 'leak', priority: 'high', queue: 'q_maintenance', dueAt: null },
    staffActor(), await scopeOver(`building:${BLOCK_A}`));
  assert.equal(right.kind, 'ok', JSON.stringify(right));

  const again = await acts().triageTicket(ticketId, 2,
    { ticketType: 'leak', priority: 'normal', queue: 'q_maintenance', dueAt: null },
    staffActor(), await scopeOver(`building:${BLOCK_A}`));
  assert.equal(again.kind, 'ok', 're-triage is another assertion, not an edit');

  const [cur] = await helpdeskDb.query<{ priority: string; version: number }>(
    `SELECT priority, version FROM ticket_current WHERE ticket_id=$1`, [ticketId]);
  assert.equal(cur?.priority, 'normal');
  assert.equal(cur?.version, 3, 'and the chain is three assertions long');
});

// ─── 5/6. the atomic open-case ──────────────────────────────────────────────

test('5 — opening a Case links both directions in ONE transaction', async () => {
  const me = await seat('opencase');
  const submitted = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  const ticketId = (submitted as { ticketId: string }).ticketId;

  const opened = await acts().openCaseFromTicket(ticketId, staffActor(),
    await scopeOver(`building:${BLOCK_A}`));
  assert.equal(opened.kind, 'ok', JSON.stringify(opened));
  const caseId = (opened as { caseId: string }).caseId;

  const [c] = await caseDb.query<{ originating_ticket_ref: string; state: string }>(
    `SELECT originating_ticket_ref, state FROM case_current WHERE case_id=$1`, [caseId]);
  assert.equal(c?.originating_ticket_ref, ticketId, 'the Case records which report caused it');
  assert.equal(c?.state, 'open');

  const [t] = await helpdeskDb.query<{ primary_case_ref: string }>(
    `SELECT primary_case_ref FROM ticket_current WHERE ticket_id=$1`, [ticketId]);
  assert.equal(t?.primary_case_ref, caseId,
    'AND the Ticket points back — a Case whose Ticket does not is an orphan nothing can reach');
});

test('5b — ATOMICITY: if the ticket write fails, NO Case row survives', async () => {
  /*
   * THE HAPPY PATH CANNOT SEE ATOMICITY. Case 5 asserts both links exist, and that
   * is equally true of two separate transactions — the difference only appears when
   * something fails BETWEEN them, which is the ordinary case of a crash.
   *
   * So this forces the failure: an assertion is pre-inserted at exactly the version
   * the act will try to write, and `UNIQUE (ticket_id, version)` then refuses the
   * act's ticket INSERT. The Case INSERT has already run at that point. If the two
   * share a transaction the rollback removes it; if they do not, an ORPHAN CASE
   * survives — reachable by nothing, because ADR-020 D9 makes the Ticket the only
   * route from a Case to its reports.
   */
  const me = await seat('atomic');
  const submitted = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  const ticketId = (submitted as { ticketId: string }).ticketId;

  // TAKE THE PRIMARY KEY THE ACT WILL DERIVE, on an unrelated ticket. Occupying
  // version 2 of THIS ticket does not work — it becomes the current assertion, so
  // the act simply writes version 3 and never collides. Seizing the assertion_id
  // blocks the write while leaving ticket_current untouched, which is the failure
  // this test needs: the Case INSERT has already run when the ticket write dies.
  const blockedId = deriveActId('tkta', `${ticketId}.2`, 'status_set');
  await helpdeskDb.query(
    `INSERT INTO ticket (assertion_id, ticket_id, version, organization_id, disposition, status,
                         channel, category, description, recorded_by)
     VALUES ($1,$2,1,$3,'report_opened','open','phone','water','pk blocker','stf_wfg_manager')`,
    [blockedId, `tkt_c2_blocker_${randomUUID()}`, ORG]);

  const scope = await scopeOver(`building:${BLOCK_A}`);
  await assert.rejects(() => acts().openCaseFromTicket(ticketId, staffActor(), scope),
    'the colliding ticket write must fail the act');

  const [n] = await caseDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_case WHERE originating_ticket_ref=$1`, [ticketId]);
  assert.equal(n?.n, '0',
    'NO CASE ROW SURVIVES. A Case whose Ticket does not point back is an orphan that '
    + 'nothing can reach, and two transactions would leave exactly that.');
});

test('6 — a second open returns the ORIGINAL Case, never a second one', async () => {
  const me = await seat('onecase');
  const submitted = await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId));
  const ticketId = (submitted as { ticketId: string }).ticketId;
  const scope = await scopeOver(`building:${BLOCK_A}`);

  const first = await acts().openCaseFromTicket(ticketId, staffActor(), scope);
  const again = await acts().openCaseFromTicket(ticketId, staffActor(), scope);
  assert.equal((first as { caseId: string }).caseId, (again as { caseId: string }).caseId,
    'the derived key is the TICKET: one primary Case per Ticket, ever');

  const [n] = await caseDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_case WHERE originating_ticket_ref=$1`, [ticketId]);
  assert.equal(n?.n, '1', 'and exactly one Case row exists');
});

// ─── 7/8/9. idempotency, attachments, related linking ───────────────────────

test('7 — submit is client-keyed; triage is derived-keyed and refuses a stale version', async () => {
  const me = await seat('idem');
  const k = `c2-idem-${randomUUID()}`;
  const a = await acts().submitByResident({ ...intake({ unitId: me.unitId }), clientKey: k } as never,
    reporter(me.residentId));
  const b = await acts().submitByResident({ ...intake({ unitId: me.unitId }), clientKey: k } as never,
    reporter(me.residentId));
  assert.equal((a as { ticketId: string }).ticketId, (b as { ticketId: string }).ticketId);
  const [n] = await helpdeskDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ticket WHERE ticket_id=$1`, [(a as { ticketId: string }).ticketId]);
  assert.equal(n?.n, '1', 'a retry must not file a second report about the same leak');

  const t = (a as { ticketId: string }).ticketId;
  const scope = await scopeOver(`building:${BLOCK_A}`);
  await acts().triageTicket(t, 1, { ticketType: 'leak', priority: 'high', queue: 'q', dueAt: null },
    staffActor(), scope);
  const stale = await acts().triageTicket(t, 1,
    { ticketType: 'leak', priority: 'low', queue: 'q', dueAt: null }, staffActor(), scope);
  assert.equal(stale.kind, 'stale-state', 'a repeat after the version advanced is refused');
});

test('8 — attachments are BY REFERENCE ONLY, and a missing one is refused', async () => {
  const me = await seat('attach');
  await owner.query(
    `INSERT INTO platform.attachment_ref (attachment_id, owner_module, owner_entity_kind,
                                          owner_entity_id, filename, content_type, size_bytes, storage_ref)
     VALUES ('att_c2_ok','helpdesk','ticket','pending','a.jpg','image/jpeg',10,'opaque')
     ON CONFLICT DO NOTHING`);
  const ok = await acts().submitByResident(
    intake({ unitId: me.unitId, attachmentIds: ['att_c2_ok'] }), reporter(me.residentId));
  assert.equal(ok.kind, 'ok');

  const bad = await acts().submitByResident(
    intake({ unitId: me.unitId, attachmentIds: ['att_does_not_exist'] }), reporter(me.residentId));
  assert.equal(bad.kind, 'no-such-attachment');

  // THE UPLOAD PATH IS DELIBERATELY ABSENT (D5). Creating an attachment_ref row
  // needs the object-store decision GEN-006-ST left open, so this surface accepts
  // ids that already exist and nothing here can mint one. Asserted rather than
  // assumed: no act in the module surface creates an attachment.
  const surface = await import('../../apps/api/dist/management/case-acts.js');
  assert.deepEqual(Object.keys(surface).filter((k) => /attach/i.test(k)), [],
    'no attachment-creating act exists on this surface');

  await owner.query(`DELETE FROM platform.attachment_ref WHERE attachment_id='att_c2_ok'`);
});

test('9 — linking records the fact, and refuses a ticket out of reach', async () => {
  const me = await seat('link1');
  const other = await seat('link2', 'fl_wfg_a_05');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const a = (await acts().submitByResident(intake({ unitId: me.unitId }), reporter(me.residentId))) as { ticketId: string };
  const b = (await acts().submitByResident(intake({ unitId: other.unitId }), reporter(other.residentId))) as { ticketId: string };

  const linked = await acts().linkRelatedTicket(a.ticketId, 1, b.ticketId, staffActor(), scope);
  assert.equal(linked.kind, 'ok', JSON.stringify(linked));
  const [cur] = await helpdeskDb.query<{ related_ticket_ref: string }>(
    `SELECT related_ticket_ref FROM ticket_current WHERE ticket_id=$1`, [a.ticketId]);
  assert.equal(cur?.related_ticket_ref, b.ticketId);

  const outOfReach = await acts().linkRelatedTicket(a.ticketId, 2, 'tkt_does_not_exist',
    staffActor(), scope);
  assert.equal(outOfReach.kind, 'no-such-related-ticket');
});

// ─── 10. stances and refusals ───────────────────────────────────────────────

test('10 — every act declares a stance and an explicit no-reason entry', async () => {
  const { CASE_STANCES, CASE_REASONS, CASE_ACTS } =
    await import('../../apps/api/dist/management/case-reasons.js');
  for (const act of CASE_ACTS) {
    assert.ok(CASE_STANCES[act] !== undefined, `${act} declares no stance`);
    assert.ok(CASE_REASONS[act] !== undefined, `${act} has no registry entry`);
    // GEN-055: a reason is REQUIRED exactly where the act carries a code vocabulary
    // (closeCase, reopenCase, reopenTicket, resolveTicketFromCase); recording acts
    // still demand none. Required-with-no-codes, or codes-with-not-required, is the bug.
    const d = CASE_REASONS[act]!;
    if (d.required) assert.ok(d.codes.length > 0, `${act} requires a reason but declares no codes`);
  }
  assert.equal(CASE_STANCES['submit_ticket'], 'client-key');
  assert.equal(CASE_STANCES['open_case_from_ticket'], 'derived-key');
});
