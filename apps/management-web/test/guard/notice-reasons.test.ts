/**
 * THE REASON-CODE SELECT IS DERIVED, NOT TYPED (UI-054 D2, closing UI-051 G3).
 *
 * Four things, each checked against a source outside this app:
 *   1. the generated notice-reasons.g.ts is not stale against the registry;
 *   2. its union equals the contract's NoticeTransitionRequest.reasonCode enum;
 *   3. the per-act subsets equal the registry's, keyed by operationId;
 *   4. no reason code is typed into the write screen — the subset comes from the
 *      generated module or from nowhere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { APP_ROOT, MGMT_CONTRACT_DIR } from '../../tool/corpus-source.ts';
import { REGISTRY_PATH, OUTPUT_REL, buildNoticeReasonsTs, operationIdOf } from '../../tool/generate-notice-reasons.ts';
import { NOTICE_REASONS, NOTICE_REASON_CODES } from '../../src/data/notice-reasons.g.ts';

const registry = () => JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as { acts: Record<string, { required: boolean; codes: string[] }> };

test('src/data/notice-reasons.g.ts is not stale', () => {
  const committed = readFileSync(join(APP_ROOT, OUTPUT_REL), 'utf8');
  assert.equal(committed, buildNoticeReasonsTs(), `${OUTPUT_REL} differs from what the registry generates; run pnpm run generate`);
});

test('the union equals the contract’s reasonCode enum', () => {
  const doc = parseYaml(readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8')) as any;
  const declared = doc.components.schemas.NoticeTransitionRequest.properties.reasonCode.enum as string[];
  assert.ok(declared.length >= 10, 'the contract enum is suspiciously small');
  assert.deepEqual([...NOTICE_REASON_CODES].sort(), [...declared].sort());
});

test('the per-act subsets are the registry’s, keyed by operationId', () => {
  const reg = registry();
  const expected = Object.fromEntries(Object.entries(reg.acts).map(([a, v]) => [operationIdOf(a), v]));
  assert.deepEqual(
    Object.fromEntries(Object.entries(NOTICE_REASONS).map(([k, v]) => [k, { required: v.required, codes: [...v.codes] }])),
    expected,
  );
  assert.ok('declineNotice' in NOTICE_REASONS && !('submitNotice' in NOTICE_REASONS), 'the keys are not operationIds');
});

test('NO reason code is typed into the write screen — the subset is generated or absent', () => {
  const src = readFileSync(join(APP_ROOT, 'src/screens/S5NoticesWrite.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const offences = NOTICE_REASON_CODES.filter((c) => new RegExp(`(['"\`])${c}\\1`).test(src));
  assert.deepEqual([...offences], [], `reason codes typed into the screen: ${offences.join(', ')}`);
  assert.match(src, /NOTICE_REASONS\[op\]/, 'the screen does not read the generated subsets');
});
