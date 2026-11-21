/**
 * R1: restricted runtime role (pemo_app). Injected failures before/after each
 * write, during audit, and at final commit leave no partial rows. Two concurrent
 * identical open-case calls produce one case.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createModuleDb, loadConfig, likePrefix, likeEscapeClause,
} from '../../modules/platform/dist/index.js';
import { roleScope } from '../../modules/access/dist/index.js';
import { createReportableSet, createTicketDirectory } from '../../modules/helpdesk/dist/index.js';
import { createCaseActs, type StaffActor, type ResidentReporter } from '../../apps/api/dist/management/case-acts.js';

const ORG = 'org_wingfu_holdings';
const BLOCK_A = 'blk_wfg_a';
const PREFIX = 'p1r1rt_';

let owner: ReturnType<typeof createModuleDb>;
let helpdeskOwner: ReturnType<typeof createModuleDb>;
let caseOwner: ReturnType<typeof createModuleDb>;
let auditOwner: ReturnType<typeof createModuleDb>;
let helpdeskApp: ReturnType<typeof createModuleDb>;
let caseApp: ReturnType<typeof createModuleDb>;
let auditApp: ReturnType<typeof createModuleDb>;

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

const scopeOver = (...keys: string[]) =>
  roleScope('estate_staff', keys.map((k, i) => ({
    grantId: `gr_r1_${i}`, groupId: 'grp_r1', role: 'estate_staff' as const,
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
const reporter = (residentId: string): ResidentReporter => ({
  organizationId: ORG, principalId: `prn_${residentId}`, residentId,
  correlationId: randomUUID(), now: new Date(),
});

type Handle = ReturnType<typeof createModuleDb>;

const withClient = <T extends object>(base: T, extra: object): T => {
  const out = { ...base, ...extra } as T & { _pgClient?: unknown };
  const src = base as { _pgClient?: unknown };
  if (src._pgClient !== undefined) out._pgClient = src._pgClient;
  return out;
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

type PgClient = { query: (...args: never[]) => Promise<unknown> };

const interceptHelpdesk = (
  db: Handle,
  onQuery: (text: string, run: () => Promise<unknown>) => Promise<unknown>,
  afterAct?: () => void,
): Handle => withClient(db, {
  inTransaction: false,
  query: db.query.bind(db),
  queryOne: db.queryOne.bind(db),
  close: db.close.bind(db),
  transaction: (fn: (tx: Handle) => Promise<unknown>) => db.transaction(async (tx) => {
    const client = (tx as Handle & { _pgClient?: PgClient })._pgClient;
    if (client === undefined) throw new Error('expected enumerable _pgClient on the transaction handle');
    const orig = client.query.bind(client);
    client.query = ((text: unknown, values?: unknown) => {
      const sql = typeof text === 'string' ? text : String((text as { text?: string }).text ?? text);
      return onQuery(sql, () => orig(text as never, values as never));
    }) as PgClient['query'];
    try {
      const result = await fn(tx);
      afterAct?.();
      return result;
    } finally {
      client.query = orig;
    }
  }),
}) as Handle;

const runtimeDatabase = () => loadConfig().moduleDatabases.helpdesk;

test.before(() => {
  const cfg = loadConfig();
  const helpdeskRuntime = cfg.moduleDatabases.helpdesk;
  owner = createModuleDb({ schema: 'platform', database: cfg.databaseOwner });
  helpdeskOwner = createModuleDb({ schema: 'helpdesk', database: cfg.databaseOwner });
  caseOwner = createModuleDb({ schema: 'service_case', database: cfg.databaseOwner });
  auditOwner = createModuleDb({ schema: 'access', database: cfg.databaseOwner });
  helpdeskApp = createModuleDb({ schema: 'helpdesk', database: helpdeskRuntime });
  // service_case has no login of its own; the helpdesk login may SELECT and
  // must call the named commands to write.
  caseApp = createModuleDb({ schema: 'service_case', database: helpdeskRuntime });
  auditApp = createModuleDb({ schema: 'access', database: cfg.moduleDatabases.access });
});

test.after(async () => {
  const esc = likeEscapeClause;
  await owner.query(`DELETE FROM service_case.service_case WHERE case_id LIKE $1 ${esc}`, [likePrefix(PREFIX)]);
  await owner.query(`DELETE FROM helpdesk.ticket_message WHERE ticket_id LIKE $1 ${esc}`, [likePrefix('tkt_')]);
  await owner.query(`DELETE FROM helpdesk.ticket WHERE recorded_by = 'stf_wfg_manager' AND description LIKE $1 ${esc}`, [likePrefix(PREFIX)]);
  await owner.query(`DELETE FROM resident.occupancy WHERE occupancy_id LIKE $1 ${esc}`, [likePrefix(`${PREFIX}occ_`)]);
  await owner.query(`DELETE FROM resident.resident WHERE resident_id LIKE $1 ${esc}`, [likePrefix(`${PREFIX}res_`)]);
  await Promise.all([
    owner.close(), helpdeskOwner.close(), caseOwner.close(), auditOwner.close(),
    helpdeskApp.close(), caseApp.close(), auditApp.close(),
  ]);
});

const seat = async (tag: string) => {
  const [unit] = await owner.query<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit WHERE floor_id='fl_wfg_a_12' AND unit_class='residential' ORDER BY 1 LIMIT 1`,
  );
  assert.ok(unit);
  const id = `${PREFIX}res_${tag}`;
  await owner.query(
    `INSERT INTO resident.resident (resident_id, organization_id, display_name)
     VALUES ($1,$2,$3) ON CONFLICT (resident_id) DO NOTHING`, [id, ORG, tag]);
  await owner.query(
    `INSERT INTO resident.occupancy (assertion_id, version, occupancy_id, resident_id, unit_id,
                                     unit_class, role, status, source, effective_from)
     VALUES ($1,1,$2,$3,$4,'residential','tenant','active','seed', now() - interval '1 day')
     ON CONFLICT (assertion_id) DO NOTHING`,
    [`occa_${PREFIX}occ_${tag}`, `${PREFIX}occ_${tag}`, id, unit.unit_id]);
  return { residentId: id, unitId: unit.unit_id };
};

const openTicket = async (tag: string) => {
  const me = await seat(tag);
  const fixtureActs = makeActs(helpdeskOwner, caseOwner, auditOwner);
  const s = await fixtureActs.submitByResident({
    clientKey: `${PREFIX}${randomUUID()}`, channel: 'resident_app', category: 'water',
    description: `${PREFIX}${tag}`, unitId: me.unitId, locationId: null,
  } as never, reporter(me.residentId));
  assert.equal(s.kind, 'ok', JSON.stringify(s));
  return { ticketId: (s as { ticketId: string }).ticketId, ...me };
};

const counts = async (ticketId: string) => {
  const [cases] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_case.service_case WHERE originating_ticket_ref=$1`, [ticketId]);
  const [tickets] = await owner.query<{ n: string; primary_case_ref: string | null }>(
    `SELECT count(*)::text AS n, max(primary_case_ref) AS primary_case_ref
       FROM helpdesk.ticket_current WHERE ticket_id=$1`, [ticketId]);
  const [audits] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM access.audit_event WHERE target_id IN (
       SELECT case_id FROM service_case.service_case WHERE originating_ticket_ref=$1
     ) OR (target_kind='service_case' AND target_id LIKE 'cse_%' AND correlation_id IN (
       SELECT correlation_id FROM access.audit_event WHERE target_id=$1
     ))`, [ticketId]);
  const [audits2] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM access.audit_event
      WHERE action = 'open_case_from_ticket' AND (
        target_id IN (SELECT case_id FROM service_case.service_case WHERE originating_ticket_ref=$1)
        OR target_id=$1)`,
    [ticketId],
  );
  return {
    cases: Number(cases?.n ?? 0),
    ticketLinked: tickets?.primary_case_ref ?? null,
    audits: Number(audits2?.n ?? audits?.n ?? 0),
  };
};

const assertUnchanged = async (ticketId: string, before: Awaited<ReturnType<typeof counts>>, label: string) => {
  const after = await counts(ticketId);
  assert.equal(after.cases, before.cases, `${label}: no new case`);
  assert.equal(after.ticketLinked, before.ticketLinked, `${label}: ticket link unchanged`);
  assert.equal(after.audits, before.audits, `${label}: no new audit`);
};

test('R1 — restricted runtime role: failure before/after each write, during audit, and at final commit leaves no partial rows', async () => {
  const runtime = runtimeDatabase();
  assert.ok(runtime.user, 'runtime role must be set (PEMO_R1_USER or PEMO_DB_USER)');
  const [upd] = await owner.query<{ can_update: boolean }>(
    `SELECT has_table_privilege($1, 'service_case.service_case', 'UPDATE,DELETE') AS can_update`,
    [runtime.user],
  );
  assert.equal(upd?.can_update, false, `${runtime.user} must not UPDATE/DELETE service_case (create a throwaway SELECT+INSERT role and set PEMO_R1_USER)`);

  const scenarios: { name: string; wrap: (db: Handle) => Handle }[] = [
    {
      name: 'before case insert',
      wrap: (db) => interceptHelpdesk(db, async (text, run) => {
        if (text.includes('INSERT INTO service_case') || text.includes('open_from_ticket') || text.includes('append_assertion')) throw new Error('injected before case insert');
        return run();
      }),
    },
    {
      name: 'after case insert, before ticket write',
      wrap: (db) => interceptHelpdesk(db, async (text, run) => {
        if (text.includes('INSERT INTO ticket ')) throw new Error('injected after case, before ticket');
        return run();
      }),
    },
    {
      name: 'after ticket write, before audit',
      wrap: (db) => interceptHelpdesk(db, async (text, run) => {
        if (text.includes('audit_event') || text.includes('append_audit_event')) throw new Error('injected after ticket, before audit');
        return run();
      }),
    },
    {
      name: 'during audit insert',
      wrap: (db) => interceptHelpdesk(db, async (text, run) => {
        if (text.includes('audit_event') || text.includes('append_audit_event')) throw new Error('injected during audit');
        return run();
      }),
    },
    {
      name: 'at final commit',
      wrap: (db) => interceptHelpdesk(db, async (_text, run) => run(), () => {
        throw new Error('injected final commit failure');
      }),
    },
  ];

  for (const scenario of scenarios) {
    const t = await openTicket(scenario.name.replace(/[^a-z]/g, '').slice(0, 12));
    const before = await counts(t.ticketId);
    const failing = makeActs(scenario.wrap(helpdeskApp), caseApp, auditApp);
    const scope = await scopeOver(`building:${BLOCK_A}`);
    await assert.rejects(
      () => failing.openCaseFromTicket(t.ticketId, staffActor(), scope),
      /injected/,
    );
    await assertUnchanged(t.ticketId, before, scenario.name);
    assert.notEqual(before.cases === 0 && (await counts(t.ticketId)).ticketLinked !== null && (await counts(t.ticketId)).audits > 0, true,
      `${scenario.name}: the old 0 case / 1 ticket / 1 audit result must be impossible`);
  }
});

test('R1 — two concurrent identical open-case calls on the restricted runtime role give one case', async () => {
  const t = await openTicket('conc');
  const scope = await scopeOver(`building:${BLOCK_A}`);
  const acts = makeActs(helpdeskApp, caseApp, auditApp);
  const [a, b] = await Promise.all([
    acts.openCaseFromTicket(t.ticketId, staffActor(), scope),
    acts.openCaseFromTicket(t.ticketId, staffActor(), scope),
  ]);
  assert.equal(a.kind, 'ok', JSON.stringify(a));
  assert.equal(b.kind, 'ok', JSON.stringify(b));
  const caseA = (a as { caseId: string }).caseId;
  const caseB = (b as { caseId: string }).caseId;
  assert.equal(caseA, caseB, 'both callers must observe the same case');
  const [n] = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM service_case.service_case WHERE originating_ticket_ref=$1`,
    [t.ticketId],
  );
  assert.equal(n?.n, '1', 'exactly one case row');
});
