/**
 * ADR-020 cut A — the Ticket/Case schemas, their computed states, and the line
 * between what a resident may read and what management keeps.
 *
 * SCHEMA ORIGINATION ONLY: no write surface, no route, no contract. These
 * exercise the SHAPE, the two computed states, the visibility model and the
 * single-sourced Ticket->Case link, which is everything cut A ships.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig, likePrefix, likeEscapeClause } from '../../modules/platform/dist/index.js';
import { createTicketDirectory, createResidentThread } from '../../modules/helpdesk/dist/index.js';
import { createCaseReporters } from '../../modules/service-case/dist/index.js';

const ORG = 'org_wingfu_holdings';

let owner: ReturnType<typeof createModuleDb>;
let helpdeskDb: ReturnType<typeof createModuleDb>;
let caseDb: ReturnType<typeof createModuleDb>;

test.before(() => {
  const cfg = loadConfig();
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  helpdeskDb = createModuleDb({ schema: 'helpdesk', database: cfg.databaseOwner });
  caseDb = createModuleDb({ schema: 'service_case', database: cfg.databaseOwner });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await helpdeskDb.query(`DELETE FROM ticket_message WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_t_')]);
  await helpdeskDb.query(`DELETE FROM ticket_reference WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_t_')]);
  await helpdeskDb.query(`DELETE FROM ticket WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_t_')]);
  await caseDb.query(`DELETE FROM case_external_link WHERE case_id LIKE $1 ${esc}`, [likePrefix('cse_t_')]);
  await caseDb.query(`DELETE FROM case_note WHERE case_id LIKE $1 ${esc}`, [likePrefix('cse_t_')]);
  await caseDb.query(`DELETE FROM service_case WHERE case_id LIKE $1 ${esc}`, [likePrefix('cse_t_')]);
  await Promise.all([owner.close(), helpdeskDb.close(), caseDb.close()]);
});

/**
 * `suffix` exists so a supersession test can write TWO DISTINCT assertions at one
 * version. Without it both rows share an assertion_id and the PRIMARY KEY rejects
 * the second — so the test passes while the supersession constraint is dropped,
 * proving the wrong thing. Measured: bite 1 did not fire until this was fixed.
 */
// GEN-055: disposition (the act) and status (the state) are now disjoint columns.
// This helper still takes the old single word and maps it, so the supersession and
// lifecycle facts these tests assert are unchanged.
const DISP = { opened: 'report_opened', triaged: 'triage_recorded', escalated: 'escalation_recorded',
  closed: 'closure_recorded', reopened: 'reopening_recorded' } as Record<string, string>;
const STAT = { opened: 'open', triaged: 'triaged', escalated: 'in_progress',
  closed: 'closed', reopened: 'open' } as Record<string, string>;
const ticketAssertion = (id: string, v: number, disposition: string,
                         extra: Record<string, unknown> = {}, suffix = '') =>
  helpdeskDb.query(
    `INSERT INTO ticket (assertion_id, ticket_id, version, organization_id, disposition, status,
                         channel, category, description, primary_case_ref, closure_reason, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'phone', 'water', 'd', $7, $8, 'stf_wfg_manager')`,
    [`tkta_t_${id}_${v}${suffix}`, id, v, ORG, DISP[disposition] ?? disposition, STAT[disposition] ?? 'open',
     extra['primaryCaseRef'] ?? null, extra['closureReason'] ?? null]);

const CDISP = { open: 'case_opened', closed: 'closure_recorded', reopened: 'reopening_recorded' } as Record<string, string>;
const caseAssertion = (id: string, v: number, state: string,
                       closureReason: string | null = null, suffix = '') =>
  caseDb.query(
    `INSERT INTO service_case (assertion_id, case_id, version, organization_id, state, disposition,
                               closure_reason, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'stf_wfg_manager')`,
    [`csea_t_${id}_${v}${suffix}`, id, v, ORG, state, CDISP[state] ?? 'status_changed', closureReason]);

// ─── 1. supersession, on BOTH instances ─────────────────────────────────────

test('1 — UNIQUE(instance, version) refuses a second assertion on a Ticket', async () => {
  await ticketAssertion('tkt_t_dup', 1, 'opened');
  // A DISTINCT assertion at the SAME version — the real supersession race. Reusing
  // the assertion_id would let the primary key reject it and prove nothing.
  await assert.rejects(() => ticketAssertion('tkt_t_dup', 1, 'triaged', {}, '_b'),
    /ticket_version_unique/);
});

test('1b — and on a Case', async () => {
  await caseAssertion('cse_t_dup', 1, 'open');
  await assert.rejects(() => caseAssertion('cse_t_dup', 1, 'in_progress', null, '_b'),
    /service_case_version_unique/);
});

// ─── 2. computed state, and the CAS-04 stop ─────────────────────────────────

test('2 — a Ticket open -> closed -> reopened computes to reopened', async () => {
  await ticketAssertion('tkt_t_life', 1, 'opened');
  await ticketAssertion('tkt_t_life', 2, 'closed', { closureReason: 'fixed' });
  await ticketAssertion('tkt_t_life', 3, 'reopened');
  // GEN-055 D0: lifecycle_state is now the STATUS column; `reopened` is a disposition
  // (an act), and the status a reopening puts the ticket in is `open`. The disposition
  // records what was done, the status what the ticket is — the whole point of splitting them.
  const [row] = await helpdeskDb.query<{ lifecycle_state: string; disposition: string }>(
    `SELECT lifecycle_state, disposition FROM ticket_current WHERE ticket_id = 'tkt_t_life'`);
  assert.equal(row?.lifecycle_state, 'open', 'the status after a reopening act is open');
  assert.equal(row?.disposition, 'reopening_recorded', 'and the act is recorded distinctly');
  const [n] = await helpdeskDb.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ticket WHERE ticket_id = 'tkt_t_life'`);
  assert.equal(n?.n, '3', 'the superseded assertions survive — they are the timeline');
});

test('2b — a Case reaches closed ONLY through a distinct closing assertion', async () => {
  await caseAssertion('cse_t_life', 1, 'open');
  await caseAssertion('cse_t_life', 2, 'pending_verification');
  const [pending] = await caseDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM case_current WHERE case_id = 'cse_t_life'`);
  assert.equal(pending?.lifecycle_state, 'pending_verification');

  await caseAssertion('cse_t_life', 3, 'closed', 'work_completed');
  const [closed] = await caseDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM case_current WHERE case_id = 'cse_t_life'`);
  assert.equal(closed?.lifecycle_state, 'closed');
});

test('2c — AN EXTERNAL STATUS ALONE NEVER YIELDS CLOSED (CAS-04)', async () => {
  // The vendor says completed. Nobody has verified it. The Case must not be closed.
  await caseAssertion('cse_t_ext', 1, 'open');
  await caseAssertion('cse_t_ext', 2, 'pending_verification');
  await caseDb.query(
    `INSERT INTO case_external_link (link_id, case_id, external_system, external_ref, last_status)
     VALUES ('cxl_t_1', 'cse_t_ext', 'acme', 'WO-1', 'completed')`);

  const [row] = await caseDb.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM case_current WHERE case_id = 'cse_t_ext'`);
  assert.equal(row?.lifecycle_state, 'pending_verification',
    'an external completion is a CLAIM; closing is a human act');

  // And the definition of state must not so much as MENTION the external table.
  const [def] = await owner.query<{ definition: string }>(
    `SELECT pg_get_viewdef('service_case.case_current'::regclass) AS definition`);
  assert.ok(!/case_external_link/.test(def!.definition),
    'the computed state must not read the external link at all');
});

// ─── 3. visibility, immutable and the only filter ───────────────────────────

const seedThread = async () => {
  await ticketAssertion('tkt_t_msg', 1, 'opened');
  await helpdeskDb.query(
    `INSERT INTO ticket_message (message_id, ticket_id, author_ref, author_kind, body, visibility)
     VALUES ('tmsg_t_1','tkt_t_msg','res_wfg_chan','resident','my report','resident_visible'),
            ('tmsg_t_2','tkt_t_msg','stf_wfg_manager','staff_principal','SECRET INTERNAL NOTE','internal')`);
};

test('3 — the resident thread returns resident_visible only', async () => {
  await seedThread();
  const visible = await createResidentThread(helpdeskDb).visibleMessages('tkt_t_msg');
  assert.deepEqual(visible.map((m) => m.messageId), ['tmsg_t_1']);
  assert.ok(!visible.some((m) => /SECRET INTERNAL NOTE/.test(m.body)),
    'an internal note must never appear in a resident thread');
});

test('3b — visibility cannot be changed after insert: no UPDATE grant anywhere', async () => {
  const helpdeskLogin = loadConfig().moduleDatabases.helpdesk.user;
  const cap = async (rel: string) => {
    const [row] = await owner.query<{ sel: boolean; ins: boolean; upd: boolean; del: boolean }>(
      `SELECT has_table_privilege($1, $2, 'SELECT') AS sel,
              has_table_privilege($1, $2, 'INSERT') AS ins,
              has_table_privilege($1, $2, 'UPDATE') AS upd,
              has_table_privilege($1, $2, 'DELETE') AS del`,
      [helpdeskLogin, rel],
    );
    return row;
  };
  assert.deepEqual(await cap('helpdesk.ticket_message'), { sel: true, ins: true, upd: false, del: false },
    'helpdesk stays append-only: SELECT+INSERT, never UPDATE');
  assert.deepEqual(await cap('service_case.service_case'), { sel: true, ins: false, upd: false, del: false },
    'service_case rows are written by named commands; the helpdesk login may only SELECT');
});

// ─── 4. a Case note is unreachable from any resident read ───────────────────

test('4 — case_note has no visibility column, so a resident-visible note is unwritable', async () => {
  const cols = await owner.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='service_case' AND table_name='case_note'`);
  const names = cols.map((c) => c.column_name).sort();
  assert.ok(!names.includes('visibility'),
    'an absent column is stronger than a default: a visible case note is a migration, not a value');
  assert.ok(!names.includes('author_kind'),
    'a resident cannot author on a Case at all — only on their Ticket');

  // And nothing the resident-facing module exposes can reach it: the resident
  // thread reads ticket_message and there is no service_case reader in helpdesk.
  const [reach] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns
      WHERE table_schema='helpdesk' AND column_name LIKE 'case\\_note%' ESCAPE '\\'`);
  assert.equal(reach?.n, '0');
});

// ─── 5. the single-sourced Ticket -> Case link ──────────────────────────────

test('5 — a Case reaches its Tickets only through the helpdesk interface', async () => {
  await ticketAssertion('tkt_t_l1', 1, 'triaged', { primaryCaseRef: 'cse_t_link' });
  await ticketAssertion('tkt_t_l2', 1, 'triaged', { primaryCaseRef: 'cse_t_link' });
  await helpdeskDb.query(
    `INSERT INTO ticket_reference (ticket_id, organization_id, display_ref)
     VALUES ('tkt_t_l1',$1,'T-0001'), ('tkt_t_l2',$1,'T-0002')`, [ORG]);

  // service_case's function is handed the helpdesk port; it never queries helpdesk.
  const reporters = createCaseReporters(createTicketDirectory(helpdeskDb));
  const found = await reporters.reportersOf(ORG, 'cse_t_link');
  assert.deepEqual(found.map((t) => t.ticketId), ['tkt_t_l1', 'tkt_t_l2'],
    'THREE RESIDENTS, ONE CASE — the shape the split exists for');

  /*
   * NO SECOND COPY OF THE ASSOCIATION — and the exclusions are the interesting part.
   *
   * The rule is that "which Tickets belong to this Case now" has ONE home, on the
   * Ticket (ADR-020 D3/D9). Two columns name a ticket without answering that
   * question, and lumping them in with a `%ticket%` pattern would forbid facts the
   * rule was never about:
   *
   *   case_satisfaction.ticket_ref        the GRAIN of a rating — one per reporter,
   *                                       because three neighbours on one Case each
   *                                       have their own view of the handling.
   *   service_case.originating_ticket_ref PROVENANCE (GEN-044): which report caused
   *                                       this Case to exist. Permanent, and a
   *                                       different question from what is linked now
   *                                       — deriving it from the current links gives
   *                                       the wrong answer the moment one is relinked.
   *
   * Naming them individually keeps the test about the association rather than about
   * the word "ticket", which is `a-check-fails-for-its-own-rules-reason`.
   */
  const [dup] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns
      WHERE table_schema='service_case' AND column_name LIKE '%ticket%'
        AND NOT (table_name = 'case_satisfaction' AND column_name = 'ticket_ref')
        -- Excluded BY COLUMN NAME, not by table: case_current is a view over
        -- service_case and inherits its columns, so naming only the table would
        -- leave the view looking like a second copy of a fact it merely reflects.
        AND column_name <> 'originating_ticket_ref'`);
  assert.equal(dup?.n, '0',
    'a second copy of the LINK would be two answers to one question, with nothing to say which is right');
});

// ─── 9. the display reference ───────────────────────────────────────────────

test('9 — the display reference is per-org unique and is not the stable id', async () => {
  await ticketAssertion('tkt_t_ref', 1, 'opened');
  await helpdeskDb.query(
    `INSERT INTO ticket_reference (ticket_id, organization_id, display_ref)
     VALUES ('tkt_t_ref', $1, 'REF-0001')`, [ORG]);

  const [row] = await helpdeskDb.query<{ ticket_id: string; display_ref: string }>(
    `SELECT ticket_id, display_ref FROM ticket_reference WHERE ticket_id='tkt_t_ref'`);
  assert.notEqual(row!.display_ref, row!.ticket_id, 'the human reference is not the opaque id');

  await ticketAssertion('tkt_t_ref2', 1, 'opened');
  await assert.rejects(
    () => helpdeskDb.query(
      `INSERT INTO ticket_reference (ticket_id, organization_id, display_ref)
       VALUES ('tkt_t_ref2', $1, 'REF-0001')`, [ORG]),
    /ticket_reference_unique_per_org|duplicate key/,
    'unique WITHIN an organization');

  // ...and free ACROSS organizations, so no tenant learns another's count.
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ('org_t_c1','TC1','TC1','TC1') ON CONFLICT (organization_id) DO NOTHING`);
  await helpdeskDb.query(
    `INSERT INTO ticket_reference (ticket_id, organization_id, display_ref)
     VALUES ('tkt_t_ref2','org_t_c1','REF-0001')`);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id='org_t_c1'`);
});
