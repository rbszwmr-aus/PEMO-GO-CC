/**
 * Platform Foundation behaviour: idempotency, quarantine, the outbox, health and
 * readiness, migrations, persistence and secrets.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createEnvelope, loadConfig, createAdminDb, migrateDown, migrateUp } from '../../apps/api/node_modules/@pemo/platform/dist/index.js';
import { startHarness, REPO_ROOT, MIGRATIONS_DIR, type Harness } from '../../apps/api/dist/testing/harness.js';

const run = promisify(execFile);

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');
});
test.after(async () => {
  await harness.close();
});

const BASE = '/api/resident-mobile/v0';
const RESIDENT = 'res_wfg_000412';
const EVENT = 'evt_20260813_smoke01';

test('a duplicate acknowledgement with the same key produces one effect', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  const url = `${BASE}/safety/events/${EVENT}/acknowledgement`;
  const headers = { authorization: harness.token(RESIDENT) };
  const payload = {
    acknowledgementKey: 'ee11bb22-0000-4000-8000-000000000001',
    action: 'i_am_safe' as const,
    occurredAt: '2026-08-13T09:46:12+08:00',
  };

  const first = await harness.app.inject({ method: 'PUT', url, headers, payload });
  const second = await harness.app.inject({ method: 'PUT', url, headers, payload });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.json().replayed, false);
  assert.equal(second.json().replayed, true);

  // Same outcome replayed, including the resident's own action time.
  assert.equal(first.json().acknowledgement.acknowledgedAt, second.json().acknowledgement.acknowledgedAt);

  const rows = await harness.admin.query(
    `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = $1 AND resident_id = $2`,
    [EVENT, RESIDENT],
  );
  assert.equal(rows.length, 1, 'one effect, not two');
});

test('a different key for the same event and resident is refused, not merged', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  const url = `${BASE}/safety/events/${EVENT}/acknowledgement`;
  const headers = { authorization: harness.token(RESIDENT) };

  await harness.app.inject({
    method: 'PUT',
    url,
    headers,
    payload: { acknowledgementKey: 'ff11bb22-0000-4000-8000-000000000001', action: 'seen' },
  });
  const duplicate = await harness.app.inject({
    method: 'PUT',
    url,
    headers,
    payload: { acknowledgementKey: 'ff11bb22-0000-4000-8000-000000000002', action: 'seen' },
  });

  assert.equal(duplicate.statusCode, 409);
  const rows = await harness.admin.query(
    `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = $1 AND resident_id = $2`,
    [EVENT, RESIDENT],
  );
  assert.equal(rows.length, 1);
});

test('an unresolvable unit is quarantined — held, visible and unassigned', async () => {
  // The case that matters most and is easiest to get wrong. Guessing the nearest
  // match is worse than dropping it, because it sends a stranger's safety alert to
  // the wrong household.
  const resolution = await harness.modules.audience.resolve({
    organizationId: 'org_wingfu_holdings',
    sourceUnitId: 'unit_does_not_exist_00',
    sourceLocationId: null,
  });
  assert.equal(resolution.kind, 'unresolved');
  assert.equal(resolution.kind === 'unresolved' ? resolution.reason : '', 'unmapped_unit');

  const held = await harness.modules.quarantine.hold({
    organizationId: 'org_wingfu_holdings',
    sourceReference: 'unit_does_not_exist_00',
    reason: 'unmapped_unit',
    severity: 'critical',
    detail: { note: 'seeded by the quarantine test' },
    occurredAt: '2026-08-13T09:00:00+08:00',
    receivedAt: '2026-08-13T09:00:05+08:00',
    correlationId: '1a2b3c4d-0000-4000-8000-0000000000cc',
  });

  assert.equal(held.status, 'held');
  assert.equal(held.resolvedUnitId, null, 'a quarantined event has no unit, not even a guess');

  // Visible to staff.
  const visible = await harness.modules.quarantine.listHeld('org_wingfu_holdings');
  assert.ok(visible.some((q) => q.quarantineId === held.quarantineId));

  // And it reached no resident: no audience row was created for it anywhere.
  const audience = await harness.admin.query(
    `SELECT 1 FROM home_safety.safety_event_audience WHERE unit_id = 'unit_does_not_exist_00'`,
  );
  assert.equal(audience.length, 0);

  // Marking it resolved requires an explicit unit AND an explicit resolver: the
  // schema refuses a half-resolution.
  await assert.rejects(
    harness.admin.query(
      `UPDATE home_safety.event_quarantine SET status = 'resolved' WHERE quarantine_id = $1`,
      [held.quarantineId],
    ),
    /quarantine_resolution_is_explicit/,
  );
});

test('the outbox records the full envelope and deduplicates by message id', async () => {
  const envelope = createEnvelope({
    contractName: 'pemo.home_safety.safety_response_recorded',
    contractVersion: '0.1.0',
    occurredAt: '2026-08-13T09:46:12+08:00',
    source: 'pemo.home-safety',
    correlationId: '1a2b3c4d-0000-4000-8000-0000000000dd',
    causationId: null,
    scope: { organizationId: 'org_wingfu_holdings', unitId: 'unit_wfg_a_12_a1' },
    payload: { eventId: EVENT, action: 'i_am_safe' },
  });

  await harness.modules.publisher.publish(envelope);
  await harness.modules.publisher.publish(envelope);

  const rows = await harness.admin.query<{ occurred_at: Date; received_at: Date; correlation_id: string }>(
    `SELECT occurred_at, received_at, correlation_id FROM platform.outbox_message WHERE message_id = $1`,
    [envelope.messageId],
  );

  assert.equal(rows.length, 1, 'a duplicate publish must not create a second message');
  assert.equal(rows[0]?.correlation_id, envelope.correlationId);
  // Occurrence and receipt are separate columns and neither is derived from the other.
  assert.notEqual(rows[0]?.occurred_at.toISOString(), rows[0]?.received_at.toISOString());
});

test('an integration failure is recorded rather than discarded', async () => {
  // A fresh correlation identifier per run, so this asserts THIS failure was
  // recorded rather than finding a leftover row from an earlier run.
  const correlationId = randomUUID();

  await harness.modules.deadLetters.record({
    source: 'test.integration',
    reason: 'simulated downstream rejection',
    correlationId,
    detail: { attempt: 1 },
  });

  const rows = await harness.admin.query(
    `SELECT 1 FROM platform.integration_exception WHERE correlation_id = $1`,
    [correlationId],
  );
  assert.equal(rows.length, 1);
});

test('health is alive, readiness reflects the dependency', async () => {
  const health = await harness.app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);

  const ready = await harness.app.inject({ method: 'GET', url: '/ready' });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().ready, true);
});

test('readiness fails closed when the database is unreachable', async () => {
  // Alive but unable to serve is NOT ready. Reporting ready with a dead dependency
  // is how a load balancer sends resident safety traffic into a hole.
  const { buildServer } = await import('../../apps/api/dist/server.js');
  const { wireModules } = await import('../../apps/api/dist/wiring.js');

  const config = loadConfig();
  // /ready probes every module pool. Breaking all moduleDatabase ports
  // (not the leftover shared `database` login) must fail closed.
  const brokenModuleDatabases = Object.fromEntries(
    Object.entries(config.moduleDatabases).map(([name, db]) => [name, { ...db, port: 1 }]),
  ) as typeof config.moduleDatabases;
  const broken = wireModules({
    ...config,
    database: { ...config.database, port: 1 },
    moduleDatabases: brokenModuleDatabases,
  });
  const app = await buildServer(broken);
  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200, 'the process is still alive');

    const ready = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(ready.statusCode, 503);
    assert.equal(ready.json().ready, false);
    assert.equal(ready.json().dependencies[0].ok, false);
  } finally {
    await app.close();
    await broken.close();
  }
});

test('readiness fails closed when a non-platform module pool is closed (P3-1)', async () => {
  const { buildServer } = await import('../../apps/api/dist/server.js');
  const { wireModules } = await import('../../apps/api/dist/wiring.js');

  const modules = wireModules(loadConfig());
  const app = await buildServer(modules);
  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200, 'the process is still alive');
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().ready, true);
    const names = (ready.json().dependencies as { name: string }[]).map((d) => d.name).sort();
    assert.deepEqual(names, [
      'access', 'dev_scaffold', 'helpdesk', 'home_safety', 'notices',
      'platform', 'property', 'resident', 'strata',
    ].sort());

    await modules.propertyDb.close();
    const after = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(after.statusCode, 503);
    assert.equal(after.json().ready, false);
    const property = (after.json().dependencies as { name: string; ok: boolean }[])
      .find((d) => d.name === 'property');
    assert.equal(property?.ok, false);
    const stillAlive = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(stillAlive.statusCode, 200, 'the process is still alive');
  } finally {
    await app.close();
    // propertyDb was already closed as the probe; pg throws if end() runs twice.
    await Promise.all(
      modules.modulePools().filter((p) => p.name !== 'property').map((p) => p.db.close()),
    );
  }
});

test('migrations run clean from empty and roll back to nothing', async () => {
  // Run against a SEPARATE database so the test suite's own data survives.
  const config = loadConfig();
  const admin = createAdminDb(config.databaseOwner);
  await admin.query('DROP DATABASE IF EXISTS pemo_migration_probe');
  await admin.query('CREATE DATABASE pemo_migration_probe');
  await admin.close();

  const probe = createAdminDb({ ...config.databaseOwner, database: 'pemo_migration_probe' });
  try {
    const up = await migrateUp(probe, MIGRATIONS_DIR);
    assert.ok(up.applied.length >= 20, `expected every migration to apply, got ${up.applied.length}`);

    const rolledBack = await migrateDown(probe, MIGRATIONS_DIR);
    assert.equal(rolledBack.length, up.applied.length, 'every migration must roll back');

    const schemas = await probe.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace
        WHERE nspname IN ('platform', 'property', 'resident', 'home_safety', 'dev_scaffold')`,
    );
    assert.deepEqual(schemas, [], 'rollback must leave nothing behind');

    // And up again from empty, to prove the round trip is repeatable.
    const again = await migrateUp(probe, MIGRATIONS_DIR);
    assert.equal(again.applied.length, up.applied.length);
  } finally {
    await probe.close();
    const cleanup = createAdminDb(config.databaseOwner);
    await cleanup.query('DROP DATABASE IF EXISTS pemo_migration_probe');
    await cleanup.close();
  }
});

test('an applied migration cannot be edited afterwards', async () => {
  // Handoff governance rule 5: agents cannot modify another agent's migration.
  // The checksum ledger makes that mechanical rather than a review expectation.
  const config = loadConfig();
  const admin = createAdminDb(config.databaseOwner);
  try {
    await admin.query(
      `UPDATE platform.schema_migration SET checksum = 'tampered' WHERE sequence = 1`,
    );
    await assert.rejects(migrateUp(admin, MIGRATIONS_DIR), /was modified after it was applied/);
  } finally {
    // Restore the real checksum so the suite can run again.
    const { loadMigrations } = await import('../../apps/api/node_modules/@pemo/platform/dist/index.js');
    const migrations = await loadMigrations(MIGRATIONS_DIR);
    const first = migrations.find((m) => m.sequence === 1);
    await admin.query(`UPDATE platform.schema_migration SET checksum = $1 WHERE sequence = 1`, [
      first?.checksum,
    ]);
    await admin.close();
  }
});

test('no secret is committed anywhere in this PID\'s scope', async () => {
  const patterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bpassword\s*[:=]\s*['"][^'"]{6,}['"]/i,
    /\bapi[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i,
    /\bsecret\s*[:=]\s*['"][^'"]{8,}['"]/i,
  ];

  const walk = async (dir: string, out: string[] = []): Promise<string[]> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, out);
      else out.push(full);
    }
    return out;
  };

  const scoped = ['apps', 'modules', 'database', 'tests/contract', 'tests/integration'];
  for (const area of scoped) {
    for (const file of await walk(path.join(REPO_ROOT, area))) {
      if (file.endsWith('.env')) continue; // git-ignored, never committed
      const body = await readFile(file, 'utf8');
      for (const pattern of patterns) {
        assert.ok(!pattern.test(body), `${path.relative(REPO_ROOT, file)} looks like it contains a secret`);
      }
    }
  }

  // And the one local .env really is ignored.
  const { stdout } = await run('git', ['check-ignore', 'database/dev/.env'], { cwd: REPO_ROOT });
  assert.match(stdout, /database\/dev\/\.env/);
});

/**
 * REMOVED — 'this PID wrote only inside its exclusive scope' (superseded).
 *
 * It asserted that every changed path fell inside one global allowlist, written
 * 2026-08-13 and frozen at the first build. `docs/governance/` first existed on
 * 2026-08-27 (GEN-001), so the list could not know about the register and failed
 * on any PID that touched it — latent until GEN-010 became the first PID to both
 * touch it and run this suite.
 *
 * Its job is now done better elsewhere: each PID declares a write_scope, every
 * step reports "0 files outside scope", and a crossing is ruled rather than
 * silently allowed. Plus CI's [PID-ID] enforcement and the grant-completeness
 * check. Per-PID and explicit, where this was one list nobody re-read.
 *
 * Removed rather than widened: widening would have papered over DOC-002 F3,
 * which ruled that a test asserting the governance PROCESS belongs in a
 * governance lint, not in the software suite.
 */
