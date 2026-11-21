/**
 * R6: the runtime role (PEMO_APP_ROLE / PEMO_R1_USER / PEMO_DB_USER) is not
 * an owner or superuser, cannot escalate, and cannot write outside the
 * granted tables or outbox columns. Case, ticket and audit still succeed
 * atomically as that role. The 4b repro uses a throwaway rt_* name, never
 * pemo_app / pemo_owner.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createModuleDb, loadConfig, likePrefix, likeEscapeClause } from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createReportableSet, createTicketDirectory } from '../../modules/helpdesk/dist/index.js';
import { createCaseActs, type StaffActor, type ResidentReporter } from '../../apps/api/dist/management/case-acts.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const PREFIX = 'p2r6_';

type Handle = ReturnType<typeof createModuleDb>;

let owner: Handle;
let helpdeskOwner: Handle;
let caseOwner: Handle;
let auditOwner: Handle;
let helpdeskApp: Handle;
let caseApp: Handle;
let auditApp: Handle;
let strataApp: Handle;

const runtimeDatabase = () => loadConfig().moduleDatabases.helpdesk;

test.before(() => {
  const cfg = loadConfig();
  const runtime = runtimeDatabase();
  assert.ok(runtime.user, 'runtime role must be set (PEMO_APP_ROLE, PEMO_R1_USER or PEMO_DB_USER)');
  assert.notEqual(runtime.user, cfg.databaseOwner.user, 'runtime must not be the owner login');
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  helpdeskOwner = createModuleDb({ schema: 'helpdesk', database: cfg.databaseOwner });
  caseOwner = createModuleDb({ schema: 'service_case', database: cfg.databaseOwner });
  auditOwner = createModuleDb({ schema: 'access', database: cfg.databaseOwner });
  helpdeskApp = createModuleDb({ schema: 'helpdesk', database: cfg.moduleDatabases.helpdesk });
  caseApp = createModuleDb({ schema: 'service_case', database: cfg.moduleDatabases.helpdesk });
  auditApp = createModuleDb({ schema: 'access', database: cfg.moduleDatabases.access });
  strataApp = createModuleDb({ schema: 'strata', database: cfg.moduleDatabases.strata });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await owner.query(`DELETE FROM service_case.service_case WHERE case_id LIKE $1 ${esc}`, [likePrefix(PREFIX)]);
  await owner.query(`DELETE FROM helpdesk.ticket WHERE recorded_by = 'stf_wfg_manager' AND description LIKE $1 ${esc}`, [likePrefix(PREFIX)]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix(`${PREFIX}occ_`)]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix(`${PREFIX}res_`)]);
  await Promise.all([
    owner.close(), helpdeskOwner.close(), caseOwner.close(), auditOwner.close(),
    helpdeskApp.close(), caseApp.close(), auditApp.close(), strataApp.close(),
  ]);
});

const isPermissionDenied = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string };
  return err.code === '42501' || /permission denied/i.test(err.message ?? '');
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
const nodes = {
  async servingScopeNodes(_o: string, locationId: string) {
    const rows = await owner.query<{ node_type: string; node_id: string }>(
      `SELECT node_type, node_id FROM property.location_serving_scope WHERE location_id=$1`, [locationId]);
    return rows.map((r) => `${r.node_type}:${r.node_id}`);
  },
};
const ownerCovers = async (_org: string, principalId: string, nodeKeys: readonly string[]) => {
  const grants = await owner.query<{ node_kind: string; node_id: string }>(
    `SELECT g.node_kind, g.node_id FROM access.scope_grant g JOIN access.group_membership m ON m.group_id=g.group_id
      WHERE m.principal_id=$1 AND g.role='estate_staff' AND g.effective_to IS NULL`, [principalId]);
  const out = new Set<string>();
  for (const g of grants) {
    out.add(`${g.node_kind}:${g.node_id}`);
    if (g.node_kind === 'estate' || g.node_kind === 'building') {
      const q = g.node_kind === 'estate'
        ? `SELECT b.building_id, f.floor_id, u.unit_id FROM property.building b
             JOIN property.floor f ON f.building_id=b.building_id JOIN property.unit u ON u.floor_id=f.floor_id WHERE b.estate_id=$1`
        : `SELECT b.building_id, f.floor_id, u.unit_id FROM property.building b
             JOIN property.floor f ON f.building_id=b.building_id JOIN property.unit u ON u.floor_id=f.floor_id WHERE b.building_id=$1`;
      for (const r of await owner.query<{ building_id: string; floor_id: string; unit_id: string }>(q, [g.node_id])) {
        out.add(`building:${r.building_id}`); out.add(`floor:${r.floor_id}`); out.add(`unit:${r.unit_id}`);
      }
    }
  }
  return nodeKeys.length > 0 && nodeKeys.every((k) => out.has(k));
};

const makeActs = (helpdesk: Handle, cases: Handle, audit: Handle) => {
  const ticketDirectory = createTicketDirectory(helpdesk);
  return createCaseActs({
    helpdeskDb: helpdesk, caseDb: cases, auditDb: audit, platformDb: owner, nodes,
    reportable: createReportableSet(occupancy, servingScopeUnits),
    ownerCovers,
    ticketsOfCase: (org, caseId) => ticketDirectory.ticketsForCase(org, caseId).then((ts) =>
      ts.map((tkt) => ({ ticketId: tkt.ticketId, version: 0 }))),
  });
};

const staffActor = (): StaffActor => ({
  organizationId: ORG, principalId: 'stf_wfg_manager', correlationId: randomUUID(), now: new Date(),
  witness: { groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff',
             nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
});
const reporter = (residentId: string): ResidentReporter => ({
  organizationId: ORG, principalId: `prn_${residentId}`, residentId,
  correlationId: randomUUID(), now: new Date(),
});

const scopeOver = (...keys: string[]) =>
  roleScope('estate_staff', keys.map((k, i) => ({
    grantId: `gr_r6_${i}`, groupId: 'grp_r6', role: 'estate_staff' as const,
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

test('R6 — runtime role is not superuser, cannot create roles, owns no tables', async () => {
  const runtime = runtimeDatabase();
  const [row] = await owner.query<{ rolsuper: boolean; rolcreaterole: boolean; rolbypassrls: boolean }>(
    `SELECT rolsuper, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=$1`,
    [runtime.user],
  );
  assert.ok(row);
  assert.equal(row.rolsuper, false);
  assert.equal(row.rolcreaterole, false);
  assert.equal(row.rolbypassrls, false);
  const owned = await owner.query<{ n: string }>(
    `SELECT n.nspname||'.'||c.relname AS n
       FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE r.rolname=$1 AND c.relkind IN ('r','p')`,
    [runtime.user],
  );
  assert.equal(owned.length, 0, `runtime role must own no tables, got ${owned.map((r) => r.n).join(',')}`);
});

test('R6 — runtime role cannot escalate or UPDATE/DELETE the probed tables (0-row privilege checks)', async () => {
  await assert.rejects(() => helpdeskApp.query('ALTER ROLE CURRENT_USER SUPERUSER'), isPermissionDenied);
  await assert.rejects(() => helpdeskApp.query('CREATE ROLE rt_pemo_should_not_exist_4b'), isPermissionDenied);
  await assert.rejects(() => auditApp.query(`UPDATE access.audit_event SET reason_code='tampered' WHERE false`), isPermissionDenied);
  await assert.rejects(() => auditApp.query(`DELETE FROM access.audit_event WHERE false`), isPermissionDenied);
  await assert.rejects(() => caseApp.query(`UPDATE service_case.service_case SET case_id=case_id WHERE false`), isPermissionDenied);
  await assert.rejects(() => strataApp.query(`UPDATE strata.email_outbox SET to_address=to_address WHERE false`), isPermissionDenied);
  await assert.rejects(() => strataApp.query(`UPDATE strata.email_outbox SET body_text=body_text WHERE false`), isPermissionDenied);
  await strataApp.query(`UPDATE strata.email_outbox SET status=status WHERE false`);
});

test('R6 — opening a case as the runtime role writes ticket, case and audit atomically', async () => {
  const [unit] = await owner.query<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit WHERE floor_id='fl_wfg_a_12' AND unit_class='residential' ORDER BY 1 LIMIT 1`,
  );
  assert.ok(unit);
  const residentId = `${PREFIX}res_ok`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [residentId, ORG, 'r6']);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_${PREFIX}occ_ok`, `${PREFIX}occ_ok`, residentId, unit.unit_id]);

  const fixtureActs = makeActs(helpdeskOwner, caseOwner, auditOwner);
  const submitted = await fixtureActs.submitByResident({
    clientKey: `${PREFIX}${randomUUID()}`, channel: 'resident_app', category: 'water',
    description: `${PREFIX}ok`, unitId: unit.unit_id, locationId: null,
  } as never, reporter(residentId));
  assert.equal(submitted.kind, 'ok', JSON.stringify(submitted));
  const ticketId = (submitted as { ticketId: string }).ticketId;

  const acts = makeActs(helpdeskApp, caseApp, auditApp);
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const opened = await acts.openCaseFromTicket(ticketId, staffActor(), scope);
  assert.equal(opened.kind, 'ok', JSON.stringify(opened));
  const caseId = (opened as { caseId: string }).caseId;
  const [cases] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_case.service_case WHERE case_id=$1`, [caseId]);
  const [tickets] = await owner.query<{ primary_case_ref: string | null }>(
    `SELECT max(primary_case_ref) AS primary_case_ref FROM helpdesk.ticket_current WHERE ticket_id=$1`, [ticketId]);
  const [audits] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM access.audit_event
      WHERE action='open_case_from_ticket' AND (target_id=$1 OR target_id=$2)`,
    [caseId, ticketId]);
  assert.equal(cases?.n, '1');
  assert.equal(tickets?.primary_case_ref, caseId);
  assert.ok(Number(audits?.n ?? 0) >= 1, 'an audit row must be recorded');
});
