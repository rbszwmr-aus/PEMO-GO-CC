/**
 * RT5-F4: the admin/migration connection has its own statement_timeout,
 * independent of the runtime pool's PEMO_DB_STATEMENT_TIMEOUT_MS.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  createAdminDb,
  createModuleDb,
  loadConfig,
  readAdminStatementTimeoutMillis,
} from '../../modules/platform/dist/index.js';

const refuseSharedCluster = (host: string, port: number): void => {
  const sharedTcp = (host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === 5432;
  if (sharedTcp) {
    throw new Error(`refusing to run against the shared cluster at ${host}:${port}`);
  }
};

test('R7 — admin statement timeout is independent of the runtime timeout', async () => {
  const previousRuntime = process.env['PEMO_DB_STATEMENT_TIMEOUT_MS'];
  const previousAdmin = process.env['PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS'];
  process.env['PEMO_DB_STATEMENT_TIMEOUT_MS'] = '400';
  process.env['PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS'] = '0';
  try {
    const cfg = loadConfig();
    refuseSharedCluster(cfg.database.host, cfg.database.port);
    refuseSharedCluster(cfg.databaseOwner.host, cfg.databaseOwner.port);
    assert.equal(cfg.dbPool.statementTimeoutMillis, 400);
    assert.equal(cfg.dbPool.adminStatementTimeoutMillis, 0);
    assert.equal(readAdminStatementTimeoutMillis(), 0);
    // A runtime value must not leak into the admin reader.
    assert.equal(readAdminStatementTimeoutMillis({ PEMO_DB_STATEMENT_TIMEOUT_MS: '400' }), 0);
    assert.equal(readAdminStatementTimeoutMillis({ PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS: '600000' }), 600000);

    const runtime = createModuleDb({
      schema: 'platform',
      database: cfg.databaseOwner,
      pool: { max: 2, connectionTimeoutMillis: 2000, statementTimeoutMillis: cfg.dbPool.statementTimeoutMillis },
    });
    const admin = createAdminDb(cfg.databaseOwner);
    try {
      const [runtimeShow] = await runtime.query<{ statement_timeout: string }>('SHOW statement_timeout');
      const [adminShow] = await admin.query<{ statement_timeout: string }>('SHOW statement_timeout');
      assert.equal(runtimeShow?.statement_timeout, '400ms');
      assert.equal(adminShow?.statement_timeout, '0');
      await assert.rejects(
        () => runtime.query('SELECT pg_sleep(2)'),
        (e: unknown) => {
          const err = e as { code?: string; message?: string };
          return err.code === '57014' || /statement timeout|canceling statement/i.test(err.message ?? '');
        },
      );
      const started = Date.now();
      await admin.query('SELECT pg_sleep(1)');
      assert.ok(Date.now() - started >= 900, 'admin must not inherit the 400 ms runtime cap');
      const [ok] = await admin.query<{ n: number }>('SELECT 1 AS n');
      assert.equal(ok?.n, 1);
    } finally {
      await runtime.close();
      await admin.close();
    }
  } finally {
    if (previousRuntime === undefined) delete process.env['PEMO_DB_STATEMENT_TIMEOUT_MS'];
    else process.env['PEMO_DB_STATEMENT_TIMEOUT_MS'] = previousRuntime;
    if (previousAdmin === undefined) delete process.env['PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS'];
    else process.env['PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS'] = previousAdmin;
  }
});
