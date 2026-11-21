/**
 * F2: 0145 adds a nullable send_key and a partial unique index. Historical
 * rows and ids survive. Down refuses while pending (or sending) rows exist.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminDb, loadConfig, loadMigrations, migrateUp } from '../../modules/platform/dist/index.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATIONS_DIR = path.join(REPO, 'database/migrations');

const HISTORICAL = [
  'obx_f2_hist_older',
  'obx_f2_hist_newer',
] as const;

test('F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist', async () => {
  const f2name = process.env['PEMO_F2_DB_NAME'];
  assert.ok(f2name, 'PEMO_F2_DB_NAME must be a throwaway clone of pemo_grok (0145 not applied)');
  const config = loadConfig({ ...process.env, PEMO_DB_NAME: f2name });
  const admin = createAdminDb(config.databaseOwner);
  try {
    const already = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM platform.schema_migration
        WHERE sequence = 145 OR file_name LIKE '%0145%'`,
    );
    assert.equal(already[0]?.n, '0', 'F2 temp DB must not already have 0145 applied');

    await admin.query(
      `INSERT INTO strata.email_outbox (
         outbox_id, organization_id, kind, subject_id, to_address, from_address,
         subject, body_text, status, transport, transport_detail, recorded_by, recorded_at
       ) VALUES
         ($1, 'org_wingfu_holdings', 'invoice', 'chg_f2_demo', 'same@wingfu.example',
          'invoices@wingfu.example', 'Invoice A', 'body older', 'logged', 'log',
          'historical older', 'stf_wfg_manager', '2026-01-01T00:00:00Z'),
         ($2, 'org_wingfu_holdings', 'invoice', 'chg_f2_demo', 'same@wingfu.example',
          'invoices@wingfu.example', 'Invoice A', 'body newer', 'sent', 'smtp',
          'historical newer', 'stf_wfg_manager', '2026-02-01T00:00:00Z')`,
      [HISTORICAL[0], HISTORICAL[1]],
    );
    const before = await admin.query<{ outbox_id: string }>(
      `SELECT outbox_id FROM strata.email_outbox
        WHERE outbox_id = ANY($1::text[]) ORDER BY outbox_id`,
      [HISTORICAL],
    );
    assert.deepEqual(before.map((r) => r.outbox_id), [...HISTORICAL].sort());

    const result = await migrateUp(admin, MIGRATIONS_DIR);
    assert.ok(
      result.applied.includes('0145_strata_email_outbox_send_key.up.sql'),
      `expected 0145 to apply, got ${JSON.stringify(result)}`,
    );

    const afterUp = await admin.query<{ outbox_id: string; send_key: string | null; status: string }>(
      `SELECT outbox_id, send_key, status FROM strata.email_outbox
        WHERE outbox_id = ANY($1::text[]) ORDER BY outbox_id`,
      [HISTORICAL],
    );
    assert.equal(afterUp.length, 2, `historical rows must survive: ${JSON.stringify(afterUp)}`);
    assert.ok(afterUp.every((r) => r.send_key === null), 'old rows keep NULL send_key');
    assert.deepEqual(afterUp.map((r) => r.outbox_id), [...HISTORICAL].sort());

    const renamed = await admin.query<{ outbox_id: string; status: string }>(
      `SELECT outbox_id, status FROM strata.email_outbox
        WHERE outbox_id = ANY($1::text[]) ORDER BY outbox_id`,
      [HISTORICAL],
    );
    assert.deepEqual(
      renamed.map((r) => [r.outbox_id, r.status]),
      [['obx_f2_hist_newer', 'accepted'], ['obx_f2_hist_older', 'log-only']],
      'historical logged/sent are renamed in place, not deleted',
    );

    await admin.query(
      `INSERT INTO strata.email_outbox (
         outbox_id, organization_id, kind, subject_id, to_address, from_address,
         subject, body_text, status, transport, transport_detail, recorded_by
       ) VALUES
         ('obx_f2_queued', 'org_wingfu_holdings', 'notice', 'ntc_f2_demo', 'queued@wingfu.example',
          'notices@wingfu.example', 'Queued', 'queued body', 'queued', 'log',
          'queued', 'stf_wfg_manager'),
         ('obx_f2_unknown', 'org_wingfu_holdings', 'notice', 'ntc_f2_demo', 'unknown@wingfu.example',
          'notices@wingfu.example', 'Unknown', 'unknown body', 'unknown', 'smtp',
          'lost ack', 'stf_wfg_manager')`,
    );

    const allIds = await admin.query<{ outbox_id: string }>(
      `SELECT outbox_id FROM strata.email_outbox
        WHERE outbox_id IN ($1,$2,'obx_f2_queued','obx_f2_unknown') ORDER BY outbox_id`,
      [HISTORICAL[0], HISTORICAL[1]],
    );
    assert.deepEqual(allIds.map((r) => r.outbox_id), [
      'obx_f2_hist_newer', 'obx_f2_hist_older', 'obx_f2_queued', 'obx_f2_unknown',
    ]);

    const ledger = await admin.query<{ sequence: number; checksum: string; file_name: string }>(
      `SELECT sequence, checksum, file_name FROM platform.schema_migration ORDER BY sequence`,
    );
    const seqs = ledger.map((r) => r.sequence);
    assert.equal(new Set(seqs).size, seqs.length, 'migration sequences must be unique');
    const row145 = ledger.find((r) => r.sequence === 145);
    assert.ok(row145, '0145 must be in the ledger');
    const files = await loadMigrations(MIGRATIONS_DIR);
    const file145 = files.find((m: { sequence: number }) => m.sequence === 145);
    assert.ok(file145, '0145 must load');
    assert.equal(row145.checksum, file145.checksum, '0145 ledger checksum must match the file');

    const downSql = await fs.readFile(
      path.join(MIGRATIONS_DIR, '0145_strata_email_outbox_send_key.down.sql'),
      'utf8',
    );
    await assert.rejects(
      () => admin.query(downSql),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        assert.match(message, /queued, pending, sending or unknown/i);
        return true;
      },
    );

    const afterDownAttempt = await admin.query<{ outbox_id: string }>(
      `SELECT outbox_id FROM strata.email_outbox
        WHERE outbox_id IN ($1,$2,'obx_f2_queued','obx_f2_unknown') ORDER BY outbox_id`,
      [HISTORICAL[0], HISTORICAL[1]],
    );
    assert.deepEqual(
      afterDownAttempt.map((r) => r.outbox_id),
      ['obx_f2_hist_newer', 'obx_f2_hist_older', 'obx_f2_queued', 'obx_f2_unknown'],
      'down must not delete rows when it refuses',
    );
  } finally {
    await admin.close();
  }
});
