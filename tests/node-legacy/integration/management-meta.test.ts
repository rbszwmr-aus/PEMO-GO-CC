/**
 * The management envelope: independent versioning and byte-exact timestamps.
 *
 * Two things fixture parity will demand of every management response, proven here
 * before any endpoint so they are not discovered one fixture at a time:
 *   - contractVersion is the MANAGEMENT contract's, read from its own file;
 *   - generatedAt renders at +08:00, the exact bytes the corpus carries, not a
 *     Z-instant that is the same moment and different text.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { buildManagementMeta } from '../../apps/api/dist/management/meta.js';
import { MANAGEMENT_CONTRACT_VERSION, CONTRACT_VERSION } from '../../apps/api/dist/contract/contract-version.js';
import type { StaffContext } from '../../apps/api/dist/management/staff-context.js';

const context = (now: Date): StaffContext => ({
  principalId: 'stf_wfg_manager',
  organizationId: 'org_wingfu_holdings',
  correlationId: '2b3c4d5e-0000-4000-8000-000000000001',
  now,
  scope: { principalId: 'stf_wfg_manager', organizationId: 'org_wingfu_holdings', asAt: now.toISOString(), grants: [] },
});

test('the management version is read from the MANAGEMENT contract, not the resident one', async () => {
  const doc = parse(
    await readFile(path.resolve(import.meta.dirname, '../../packages/api-contracts/management-web/openapi.yaml'), 'utf8'),
  ) as { info: { version: string } };
  assert.equal(MANAGEMENT_CONTRACT_VERSION, doc.info.version, 'emitted version equals the pinned management contract');
  assert.notEqual(MANAGEMENT_CONTRACT_VERSION, CONTRACT_VERSION, 'the two surfaces version independently');
});

test('generatedAt renders at +08:00 — the exact bytes the corpus carries', () => {
  // The corpus states 2026-08-12T09:56:00+08:00. The context clock is that instant.
  const meta = buildManagementMeta(context(new Date('2026-08-12T09:56:00+08:00')));
  assert.equal(meta.generatedAt, '2026-08-12T09:56:00+08:00', 'byte-exact, not a Z-equivalent');
  assert.equal(meta.correlationId, '2b3c4d5e-0000-4000-8000-000000000001');
  assert.equal(meta.contractVersion, MANAGEMENT_CONTRACT_VERSION);
});

test('a Z-instant and a +08:00 instant of the same moment render identically', () => {
  // The same moment supplied as UTC must produce the same bytes — otherwise the
  // envelope would depend on how the caller happened to construct the Date.
  const viaZ = buildManagementMeta(context(new Date('2026-08-12T01:56:00Z')));
  assert.equal(viaZ.generatedAt, '2026-08-12T09:56:00+08:00', 'the offset is applied to the instant, not the text');
});
