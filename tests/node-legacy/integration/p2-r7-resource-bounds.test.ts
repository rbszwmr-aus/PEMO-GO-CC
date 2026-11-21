/**
 * R7: pool acquisition and statement deadlines are bounded; a cancelled
 * query is released so the process recovers. Email batch size is configurable.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig, poolStats } from '../../modules/platform/dist/index.js';
import { emailBatchSize } from '../../apps/api/dist/management/compose-mail.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

test('R7 — email batch size is a positive env bound with a default of 50', () => {
  assert.equal(emailBatchSize({}), 50);
  assert.equal(emailBatchSize({ PEMO_EMAIL_BATCH_SIZE: '10' }), 10);
  assert.equal(emailBatchSize({ PEMO_EMAIL_BATCH_SIZE: '0' }), 50);
  assert.equal(emailBatchSize({ PEMO_EMAIL_BATCH_SIZE: 'nope' }), 50);
});

test('R7 — a saturated pool wait is bounded and times out cleanly', async () => {
  const cfg = loadConfig();
  const db = createModuleDb({
    schema: 'platform',
    database: cfg.databaseOwner,
    pool: { max: 1, connectionTimeoutMillis: 400, statementTimeoutMillis: 5000 },
  });
  try {
    await db.transaction(async () => {
      const started = Date.now();
      await assert.rejects(
        () => db.query('SELECT 1'),
        (e: unknown) => /timeout|Timeout|terminat/i.test((e as Error).message),
      );
      assert.ok(Date.now() - started < 2500, 'the wait must not hang');
    });
    // Recovery: the held client is released after the transaction.
    const [row] = await db.query<{ ok: number }>('SELECT 1 AS ok');
    assert.equal(row?.ok, 1);
  } finally {
    await db.close();
  }
});

test('R7 — a slow query is cancelled and the pool recovers', async () => {
  const cfg = loadConfig();
  const db = createModuleDb({
    schema: 'platform',
    database: cfg.databaseOwner,
    pool: { max: 2, connectionTimeoutMillis: 2000, statementTimeoutMillis: 400 },
  });
  try {
    await assert.rejects(
      () => db.query('SELECT pg_sleep(5)'),
      (e: unknown) => {
        const err = e as { code?: string; message?: string };
        return err.code === '57014' || /statement timeout|canceling statement/i.test(err.message ?? '');
      },
    );
    const [row] = await db.query<{ ok: number }>('SELECT 1 AS ok');
    assert.equal(row?.ok, 1);
    const stats = poolStats();
    assert.ok(stats.some((s) => s.max >= 2 && s.waitingCount === 0));
  } finally {
    await db.close();
  }
});

test('R7 — /health reports pool stats', async () => {
  const harness: Harness = await startHarness();
  try {
    const res = await harness.app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body) as { status: string; pools?: { name: string; max: number }[] };
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.pools) && body.pools.length > 0, 'health must list pools');
    assert.ok(body.pools.every((p) => p.max > 0 && p.name.length > 0));
  } finally {
    await harness.close();
  }
});
