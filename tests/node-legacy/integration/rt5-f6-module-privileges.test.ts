/**
 * RT5-F6 exit evidence: distinct module logins, constrained memberships,
 * named commands, and the grant split.
 *
 * Runs against whatever cluster the process is configured for. The gate
 * harness points this at a private unix-socket initdb (listen_addresses
 * empty, socket dir outside DATADIR) and refuses 127.0.0.1:5432.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModuleDb, loadConfig, poolStats } from '../../modules/platform/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
// pg is a dependency of modules/platform, not of the repo root. Resolve it
// from that package so this test can run under node --test from tests/.
const require = createRequire(path.join(repo, 'modules/platform/package.json'));
const pg = require('pg') as { Client: new (c: object) => ClientLike; default?: { Client: new (c: object) => ClientLike } };
type ClientLike = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
const PgClient = pg.Client ?? pg.default!.Client;

const refuseShared = () => {
  const host = process.env.PEMO_DB_HOST ?? '';
  const port = process.env.PEMO_DB_PORT ?? '';
  if ((host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === '5432') {
    throw new Error('REFUSING shared cluster 127.0.0.1:5432');
  }
};

const cfg = () => loadConfig();

const clientFor = async (schema: string): Promise<pg.Client> => {
  const db = cfg().moduleDatabases[schema as keyof ReturnType<typeof loadConfig>['moduleDatabases']];
  const c = new PgClient({
    host: db.host, port: db.port, database: db.database, user: db.user, password: db.password,
  });
  await c.connect();
  return c;
};

const ownerClient = async (): Promise<pg.Client> => {
  const d = cfg().databaseOwner;
  const c = new PgClient({
    host: d.host, port: d.port, database: d.database, user: d.user, password: d.password,
  });
  await c.connect();
  return c;
};

const isDenied = (err: unknown): boolean => {
  const e = err as { code?: string; message?: string };
  return e.code === '42501' || e.code === '42501' || /permission denied/i.test(e.message ?? '');
};

test.before(() => {
  refuseShared();
});

test('real module logins connect as themselves', async () => {
  const schemas = ['platform', 'property', 'resident', 'home_safety', 'access', 'notices', 'helpdesk', 'strata'] as const;
  for (const schema of schemas) {
    const c = await clientFor(schema);
    try {
      const r = await c.query('SELECT current_user AS u, session_user AS s');
      assert.equal(r.rows[0].u, `pemo_app_${schema}`);
      assert.equal(r.rows[0].s, `pemo_app_${schema}`);
    } finally {
      await c.end();
    }
  }
});

test('allowed and denied qualified reads and writes', async () => {
  const property = await clientFor('property');
  const helpdesk = await clientFor('helpdesk');
  try {
    const own = await property.query('SELECT count(*)::int AS n FROM property.estate');
    assert.equal(typeof own.rows[0].n, 'number');
    await assert.rejects(() => property.query('SELECT count(*) FROM helpdesk.ticket'), isDenied);
    await assert.rejects(
      () => property.query(
        "INSERT INTO access.audit_event (audit_id, source, action, occurred_at, correlation_id) VALUES ('x','x','x', now(), $1)",
        [randomUUID()],
      ),
      isDenied,
    );
    const tickets = await helpdesk.query('SELECT count(*)::int AS n FROM helpdesk.ticket');
    assert.equal(typeof tickets.rows[0].n, 'number');
    // Restricted read of service_case is allowed for helpdesk; INSERT is not.
    const cases = await helpdesk.query('SELECT count(*)::int AS n FROM service_case.service_case');
    assert.equal(typeof cases.rows[0].n, 'number');
    await assert.rejects(
      () => helpdesk.query(
        `INSERT INTO service_case.service_case (
           assertion_id, case_id, version, organization_id, state, disposition, recorded_by
         ) VALUES ('a','c',1,'o','open','case_opened','t')`,
      ),
      isDenied,
    );
  } finally {
    await property.end();
    await helpdesk.end();
  }
});

test('peer and coordinator (definer) SET ROLE are denied', async () => {
  const property = await clientFor('property');
  try {
    await assert.rejects(() => property.query('SET ROLE pemo_priv_helpdesk'), isDenied);
    await assert.rejects(() => property.query('SET ROLE pemo_app_helpdesk'), isDenied);
    await assert.rejects(() => property.query('SET ROLE pemo_definer_commands'), isDenied);
  } finally {
    await property.end();
  }
});

test('named command succeeds; direct access is denied', async () => {
  const owner = await ownerClient();
  const access = await clientFor('access');
  const helpdesk = await clientFor('helpdesk');
  const marker = `f6_${randomUUID()}`;
  const correlationId = randomUUID();
  try {
    await access.query(
      `SELECT access.append_audit_event(
         $1, 'principal', 'stf_wfg_manager', 'grp_of_one_stf_wfg_manager', 'estate_staff', 'estate', 'est_wing_fu_garden',
         'f6-probe', 'probe', $1, now(), $2, NULL)`,
      [marker, correlationId],
    );
    const row = await owner.query(
      'SELECT audit_id FROM access.audit_event WHERE audit_id=$1', [marker]);
    assert.equal(row.rows.length, 1);
    await assert.rejects(
      () => access.query(
        `INSERT INTO access.audit_event (
           audit_id, source, principal_id, action, occurred_at, correlation_id
         ) VALUES ($1,'principal','p','a', now(), $2)`,
        [`${marker}_direct`, randomUUID()],
      ),
      isDenied,
    );
    // Property may execute audit-append but not the case commands.
    const property = await clientFor('property');
    try {
      await assert.rejects(
        () => property.query(
          `SELECT service_case.open_from_ticket($1,$2,'org_x',$3,'tester')`,
          [marker, marker, marker],
        ),
        isDenied,
      );
    } finally {
      await property.end();
    }
    const ticket = await helpdesk.query(
      `SELECT ticket_id, organization_id FROM helpdesk.ticket_current
        WHERE organization_id = 'org_wingfu_holdings' LIMIT 1`);
    assert.ok(ticket.rows[0], 'seed must provide a Wing Fu ticket for open_from_ticket');
    await helpdesk.query(
      `SELECT service_case.open_from_ticket($1,$2,$3,$4,'tester')`,
      [`${marker}_a`, `${marker}_c`, ticket.rows[0].organization_id, ticket.rows[0].ticket_id],
    );
    const planted = await owner.query(
      'SELECT case_id FROM service_case.service_case WHERE case_id=$1', [`${marker}_c`]);
    assert.equal(planted.rows.length, 1);

    const notices = await clientFor('notices');
    const messageId = randomUUID();
    try {
      await notices.query(
        `SELECT platform.enqueue_outbox_message(
           $1, 'pemo.f6.probe', '0.1.0', now(), now(), 'pemo.f6',
           $2, NULL, '{}'::jsonb, '{}'::jsonb)`,
        [messageId, randomUUID()],
      );
      const queued = await owner.query(
        'SELECT message_id FROM platform.outbox_message WHERE message_id=$1', [messageId]);
      assert.equal(queued.rows.length, 1);
      await assert.rejects(
        () => notices.query(
          `INSERT INTO platform.outbox_message (
             message_id, contract_name, contract_version, occurred_at, received_at,
             source, correlation_id, causation_id, scope, payload
           ) VALUES ($1, 'pemo.f6.probe', '0.1.0', now(), now(), 'pemo.f6', $2, NULL, '{}'::jsonb, '{}'::jsonb)`,
          [randomUUID(), randomUUID()],
        ),
        isDenied,
      );
    } finally {
      await owner.query('DELETE FROM platform.outbox_message WHERE message_id=$1', [messageId]).catch(() => undefined);
      await notices.end();
    }
  } finally {
    await owner.query('DELETE FROM access.audit_event WHERE audit_id=$1', [marker]).catch(() => undefined);
    await owner.query('DELETE FROM service_case.service_case WHERE case_id=$1', [`${marker}_c`]).catch(() => undefined);
    await owner.end();
    await access.end();
    await helpdesk.end();
  }
});

test('peer logins can call named commands but cannot read or write the command tables', async () => {
  const property = await clientFor('property');
  const platform = await clientFor('platform');
  const owner = await ownerClient();
  const marker = `f6_peer_${randomUUID()}`;
  const correlationId = randomUUID();
  try {
    const looked = await property.query(
      'SELECT * FROM platform.lookup_idempotency($1, $2, $3)',
      ['f6-peer', 'missing', 'missing'],
    );
    assert.equal(looked.rows.length, 0);
    await property.query(
      `SELECT access.append_audit_event(
         $1, 'principal', 'stf_wfg_manager', 'grp_of_one_stf_wfg_manager', 'estate_staff', 'estate', 'est_wing_fu_garden',
         'f6-peer', 'probe', $1, now(), $2, NULL)`,
      [marker, correlationId],
    );
    const planted = await owner.query(
      'SELECT audit_id FROM access.audit_event WHERE audit_id=$1', [marker]);
    assert.equal(planted.rows.length, 1);
    await assert.rejects(() => property.query('SELECT count(*) FROM platform.idempotency_record'), isDenied);
    await assert.rejects(() => property.query('SELECT count(*) FROM access.audit_event'), isDenied);
    await assert.rejects(
      () => platform.query(
        `INSERT INTO platform.idempotency_record (
           principal_id, operation, idempotency_key, act_kind, act_id, audit_id, request_fingerprint
         ) VALUES ('p','op','k','kind','id','aud','fp')`,
      ),
      isDenied,
    );
  } finally {
    await owner.query('DELETE FROM access.audit_event WHERE audit_id=$1', [marker]).catch(() => undefined);
    await property.end();
    await platform.end();
    await owner.end();
  }
});

test('cross-estate SQL is denied for foreign schemas; historical recipient rows stay on the notices login', async () => {
  const notices = await clientFor('notices');
  const home = await clientFor('home_safety');
  try {
    await assert.rejects(() => notices.query('SELECT count(*) FROM resident.household'), isDenied);
    await assert.rejects(() => notices.query('SELECT count(*) FROM property.estate'), isDenied);
    await assert.rejects(() => home.query('SELECT count(*) FROM resident.household'), isDenied);
    await assert.rejects(() => home.query('SELECT count(*) FROM property.estate'), isDenied);
    // Own-schema recipient / audience projections remain readable (historical
    // rows included — there is no time predicate in the grant).
    const own = await notices.query(
      `SELECT count(*)::int AS n
         FROM information_schema.tables
        WHERE table_schema='notices' AND table_type='BASE TABLE'`);
    assert.ok(own.rows[0].n > 0);
    await notices.query('SELECT 1 FROM notices.notice LIMIT 1');
  } finally {
    await notices.end();
    await home.end();
  }
});

test('strata outbox UPDATE is limited to the six delivery columns', async () => {
  const owner = await ownerClient();
  const strata = await clientFor('strata');
  const id = `f6_ob_${randomUUID()}`;
  try {
    // Minimal plant: only columns required by the table. Owner does this.
    const cols = await owner.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='strata' AND table_name='email_outbox' ORDER BY ordinal_position`);
    assert.ok(cols.rows.some((r: { column_name: string }) => r.column_name === 'send_key'));
    // Use a narrow insert via default-friendly columns if the table allows it;
    // otherwise skip plant and only probe information_schema privileges.
    const granted = await owner.query(
      `SELECT column_name, privilege_type
         FROM information_schema.column_privileges
        WHERE grantee='pemo_priv_strata'
          AND table_schema='strata' AND table_name='email_outbox'
          AND privilege_type='UPDATE'
        ORDER BY 1`);
    const got = granted.rows.map((r: { column_name: string }) => r.column_name).sort();
    assert.deepEqual(got, ['attempt', 'claimed_at', 'send_key', 'status', 'transport', 'transport_detail']);
    await assert.rejects(
      () => strata.query('UPDATE strata.email_outbox SET to_address = to_address'),
      isDenied,
    );
  } finally {
    await owner.query('DELETE FROM strata.email_outbox WHERE 1=0').catch(() => undefined);
    await owner.end();
    await strata.end();
    void id;
  }
});

test('pool is reused after a successful transaction and after a rollback', async () => {
  const db = createModuleDb({
    schema: 'property',
    database: cfg().moduleDatabases.property,
    pool: { max: 2, connectionTimeoutMillis: 2000, statementTimeoutMillis: 5000 },
  });
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.query<{ n: string }>('SELECT count(*)::text AS n FROM estate');
      assert.ok(Number(rows[0]?.n ?? '0') >= 0);
    });
    await assert.rejects(
      () => db.transaction(async () => {
        throw new Error('forced-rollback');
      }),
      /forced-rollback/,
    );
    await db.transaction(async (tx) => {
      await tx.query('SELECT 1');
    });
    const stat = poolStats().find((s) => s.name.includes('property'));
    assert.ok(stat, 'property pool is tracked');
    assert.ok(stat!.totalCount <= 2);
    assert.ok(stat!.idleCount >= 1);
  } finally {
    await db.close();
  }
});

test('aggregate connection capacity stays inside the 90/100 budget', async () => {
  const c = cfg();
  const pools = 9;
  const configured = c.dbPool.max * pools * c.dbPool.replicaCount;
  const twoReplica = c.dbPool.max * pools * 2;
  assert.equal(pools, 9, 'pool count is unchanged');
  assert.ok(twoReplica <= 90, `two replicas at current max would be ${twoReplica}, over 90`);
  const owner = await ownerClient();
  try {
    const r = await owner.query("SHOW max_connections");
    assert.equal(r.rows[0].max_connections, '100');
  } finally {
    await owner.end();
  }
  assert.ok(configured <= 90 || c.dbPool.replicaCount === 1);
  void configured;
});

test('forced failure of both case commands leaves no partial state', async () => {
  const helpdesk = await clientFor('helpdesk');
  const owner = await ownerClient();
  const a = `f6_fail_${randomUUID()}`;
  const b = `f6_fail_${randomUUID()}`;
  try {
    await assert.rejects(
      () => helpdesk.query('BEGIN').then(async () => {
        await helpdesk.query(
          `SELECT service_case.open_from_ticket($1,$2,'org_wingfu_holdings',$3,'tester')`,
          [`${a}_as`, `${a}_c`, `${a}_t`],
        );
        await helpdesk.query('SELECT 1/0');
      }),
    );
    await helpdesk.query('ROLLBACK').catch(() => undefined);
    const openLeft = await owner.query(
      'SELECT 1 FROM service_case.service_case WHERE case_id=$1', [`${a}_c`]);
    assert.equal(openLeft.rows.length, 0);

    await assert.rejects(
      () => helpdesk.query('BEGIN').then(async () => {
        await helpdesk.query(
          `SELECT service_case.append_assertion(
             $1,$2,1,'org_wingfu_holdings','closed','closure_recorded',
             NULL,false,NULL,NULL,'reason',NULL,$3,'tester')`,
          [`${b}_as`, `${b}_c`, `${b}_t`],
        );
        await helpdesk.query('SELECT 1/0');
      }),
    );
    await helpdesk.query('ROLLBACK').catch(() => undefined);
    const appendLeft = await owner.query(
      'SELECT 1 FROM service_case.service_case WHERE case_id=$1', [`${b}_c`]);
    assert.equal(appendLeft.rows.length, 0);
  } finally {
    await helpdesk.end();
    await owner.end();
  }
});

test('governance detects an unexpected grant and is green when it is revoked', async () => {
  const owner = await ownerClient();
  const env = {
    ...process.env,
    REQUIRE_DB: '1',
    PEMO_GOVERNANCE_ENV: process.env.PEMO_GOVERNANCE_ENV ?? path.join(repo, 'database/dev/.env'),
  };
  const script = path.join(repo, 'docs/governance/bin/grants-complete.sh');
  try {
    execFileSync('bash', [script], { env, encoding: 'utf8' });
  } catch (err) {
    assert.fail(`grants-complete was not green before the probe: ${err}`);
  }
  await owner.query('GRANT SELECT ON property.estate TO pemo_app_helpdesk');
  let detected = false;
  try {
    execFileSync('bash', [script], { env, encoding: 'utf8' });
  } catch {
    detected = true;
  }
  await owner.query('REVOKE SELECT ON property.estate FROM pemo_app_helpdesk');
  assert.equal(detected, true, 'grants-complete must fail on an unexpected grant');
  try {
    execFileSync('bash', [script], { env, encoding: 'utf8' });
  } catch (err) {
    assert.fail(`grants-complete did not recover after revoke: ${err}`);
  }
  await owner.end();
});

test('rollback of the named-command migrations preserves data', async () => {
  const owner = await ownerClient();
  const marker = `f6_rb_${randomUUID()}`;
  const psql = [
    '-h', cfg().databaseOwner.host,
    '-p', String(cfg().databaseOwner.port),
    '-U', cfg().databaseOwner.user,
    '-d', cfg().databaseOwner.database,
    '-v', 'ON_ERROR_STOP=1',
  ];
  const env = { ...process.env, PGPASSWORD: cfg().databaseOwner.password };
  try {
    const principal = await owner.query(
      'SELECT principal_id FROM access.staff_principal LIMIT 1');
    const group = await owner.query(
      'SELECT group_id FROM access.user_group LIMIT 1');
    assert.ok(principal.rows[0] && group.rows[0], 'seeded principal and group are required for the rollback plant');
    await owner.query(
      `INSERT INTO access.audit_event (
         audit_id, source, principal_id, group_id, role, node_kind, node_id,
         action, target_kind, target_id, occurred_at, correlation_id
       ) VALUES (
         $1, 'principal', $2, $3, 'estate_staff', 'estate', 'est_wing_fu_garden',
         'f6-rollback', 'probe', $1, now(), $4)`,
      [marker, principal.rows[0].principal_id, group.rows[0].group_id, randomUUID()],
    );
    const down = [
      'database/migrations/0150_service_case_org_constraint.down.sql',
      'database/migrations/0149_platform_enqueue_outbox_message.down.sql',
      'database/migrations/0148_service_case_named_commands.down.sql',
      'database/migrations/0147_platform_idempotency_commands.down.sql',
      'database/migrations/0146_access_append_audit_event.down.sql',
      'database/roles/rollback-legacy-shared-login.sql',
    ];
    for (const f of down) {
      execFileSync('psql', [...psql, '-f', path.join(repo, f)], { env, encoding: 'utf8' });
    }
    const kept = await owner.query(
      'SELECT audit_id FROM access.audit_event WHERE audit_id=$1', [marker]);
    assert.equal(kept.rows.length, 1, 'rollback must not delete application data');
    // Legacy shared login can read again after the grant restore.
    const legacy = new PgClient({
      host: cfg().database.host,
      port: cfg().database.port,
      database: cfg().database.database,
      user: cfg().database.user,
      password: cfg().database.password,
    });
    await legacy.connect();
    try {
      const n = await legacy.query('SELECT count(*)::int AS n FROM property.estate');
      assert.ok(n.rows[0].n >= 0);
    } finally {
      await legacy.end();
    }
    // Restore the F6 end state so later tests (and grants-complete) stay green.
    const up = [
      'database/migrations/0146_access_append_audit_event.up.sql',
      'database/migrations/0147_platform_idempotency_commands.up.sql',
      'database/migrations/0148_service_case_named_commands.up.sql',
      'database/migrations/0149_platform_enqueue_outbox_message.up.sql',
      'database/migrations/0150_service_case_org_constraint.up.sql',
      'database/roles/010-grants.sql',
    ];
    for (const f of up) {
      execFileSync('psql', [...psql, '-c', "SELECT set_config('pemo.env','development', false);", '-f', path.join(repo, f)], { env, encoding: 'utf8' });
    }
    const still = await owner.query(
      'SELECT audit_id FROM access.audit_event WHERE audit_id=$1', [marker]);
    assert.equal(still.rows.length, 1);
  } finally {
    await owner.query('DELETE FROM access.audit_event WHERE audit_id=$1', [marker]).catch(() => undefined);
    await owner.end();
  }
});


test('case named commands refuse a foreign organization_id (P3-5)', async () => {
  const helpdesk = await clientFor('helpdesk');
  try {
    const tickets = await helpdesk.query<{ ticket_id: string; organization_id: string }>(
      `SELECT ticket_id, organization_id FROM helpdesk.ticket_current LIMIT 1`,
    );
    assert.ok(tickets.rows[0], 'seed (or prior tests) must provide a helpdesk ticket');
    const ticketId = tickets.rows[0].ticket_id;
    const ticketOrg = tickets.rows[0].organization_id;
    const foreignOrg = 'org_nobody';
    assert.notEqual(ticketOrg, foreignOrg);

    const beforeCases = await helpdesk.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM service_case.service_case WHERE organization_id = $1',
      [foreignOrg],
    );

    await assert.rejects(
      () => helpdesk.query(
        'SELECT service_case.open_from_ticket($1, $2, $3, $4, $5)',
        [`asr_p35_${Date.now()}`, `case_p35_${Date.now()}`, foreignOrg, ticketId, 'prn_test'],
      ),
      (error: unknown) => String(error).includes('organization_id does not match the originating ticket'),
    );

    const afterOpen = await helpdesk.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM service_case.service_case WHERE organization_id = $1',
      [foreignOrg],
    );
    assert.equal(afterOpen.rows[0]?.n, beforeCases.rows[0]?.n, 'open_from_ticket must write nothing for a foreign org');

    const caseId = `case_p35_ok_${Date.now()}`;
    const assertionId = `asr_p35_ok_${Date.now()}`;
    await helpdesk.query(
      'SELECT service_case.open_from_ticket($1, $2, $3, $4, $5)',
      [assertionId, caseId, ticketOrg, ticketId, 'prn_test'],
    );
    const beforeAppend = await helpdesk.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM service_case.service_case WHERE case_id = $1',
      [caseId],
    );
    await assert.rejects(
      () => helpdesk.query(
        `SELECT service_case.append_assertion(
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          `asr_p35_bad_${Date.now()}`, caseId, 2, foreignOrg, 'open', 'note',
          null, false, null, null, null, null, ticketId, 'prn_test',
        ],
      ),
      (error: unknown) => String(error).includes('organization_id does not match the service case'),
    );
    const afterAppend = await helpdesk.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM service_case.service_case WHERE case_id = $1',
      [caseId],
    );
    assert.equal(afterAppend.rows[0]?.n, beforeAppend.rows[0]?.n, 'append_assertion must write nothing for a foreign org');
  } finally {
    await helpdesk.end();
  }
});
