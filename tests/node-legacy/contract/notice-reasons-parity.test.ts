/**
 * THE REASON-CODE VOCABULARY HAS ONE SOURCE (GEN-052 D3, from UI-051 G3).
 * Same claim generate-notice-reasons.mjs --check makes in prove.sh, as a test so
 * the four-condition runner can bite it: a code added to the registry without
 * regeneration must red here.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { NOTICE_REASON_CODE_UNION } from '../../apps/api/dist/management/notice-reason-codes.js';
import { NOTICE_REASONS } from '../../apps/api/dist/management/notice-reasons.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(readFileSync(resolve(REPO, 'packages/api-contracts/notice-reasons.json'), 'utf8')) as
  { acts: Record<string, { codes: string[]; required: boolean }> };
const union = [...new Set(Object.values(registry.acts).flatMap((a) => a.codes))].sort();

test('registry JSON, generated type, live registry and contract enum agree', () => {
  assert.deepEqual([...NOTICE_REASON_CODE_UNION].sort(), union, 'the generated type is stale — run pnpm gen:notice-reasons');
  const live = [...new Set(Object.values(NOTICE_REASONS).flatMap((d) => d.codes))].sort();
  assert.deepEqual(live, union, 'the live registry carries a code the JSON source does not');
  const doc = parse(readFileSync(resolve(REPO, 'packages/api-contracts/management-web/openapi.yaml'), 'utf8')) as
    { components: { schemas: { NoticeTransitionRequest: { properties: { reasonCode: { enum: string[] } } } } } };
  assert.deepEqual([...doc.components.schemas.NoticeTransitionRequest.properties.reasonCode.enum].sort(), union,
    'the contract enum disagrees with the registry');
  assert.ok(union.length >= 10, `only ${union.length} codes — the registry is not being read`);
});
