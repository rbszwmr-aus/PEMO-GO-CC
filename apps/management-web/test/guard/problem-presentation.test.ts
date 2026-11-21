/**
 * A PROBLEM IS PRESENTED BY ITS TYPE — total over the notices refusals (UI-051 D4).
 *
 * The bite this exists for: collapsing the refusals into one generic panel. The
 * publish refusal for a half-translated notice must look different from a
 * stale-version refusal, or the author learns that publishing is forbidden rather
 * than that a translation is missing. The set of types is DERIVED from the
 * contract's Problem.type enum, so a new notices refusal fails here until it has
 * its own presentation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { MGMT_CONTRACT_DIR } from '../../tool/corpus-source.ts';
import { PRESENTED_TYPES, presentProblem } from '../../src/data/problem-presentation.ts';

function noticeTypes(): string[] {
  const doc = parseYaml(readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8')) as any;
  const all = doc.components.schemas.Problem.properties.type.enum as string[];
  return all.filter((t) => /\/problems\/notice-/.test(t));
}

test('the notices problem types derive from the contract, and there are several', () => {
  const types = noticeTypes();
  assert.ok(types.length >= 8, `only ${types.length} notice problem types derived`);
  assert.ok(types.includes('https://pemo.local/problems/notice-incomplete-translation'));
});

test('EVERY notices refusal has its own presentation — none falls back to generic', () => {
  const missing = noticeTypes().filter((t) => presentProblem({ type: t }).title === null);
  assert.deepEqual(missing, [], `notice refusals with no specific presentation:\n  ${missing.join('\n  ')}`);
});

test('the presentations are DISTINCT — no two notices refusals share a title', () => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const t of noticeTypes()) {
    const en = presentProblem({ type: t }).title?.en ?? '';
    const prior = seen.get(en);
    if (prior) clashes.push(`${t} and ${prior} both say "${en}"`);
    seen.set(en, t);
  }
  assert.deepEqual(clashes, [], `refusals collapsed into one panel:\n  ${clashes.join('\n  ')}`);
});

test('the bilingual-missing refusal names the missing language, not a generic failure', () => {
  const p = presentProblem({ type: 'https://pemo.local/problems/notice-incomplete-translation' });
  assert.equal(p.kind, 'notice-incomplete-translation');
  assert.match(p.title?.en ?? '', /language/i);
  assert.notEqual(p.title?.en, presentProblem({ type: 'https://pemo.local/problems/notice-stale-version' }).title?.en);
});

test('a type this surface does not expect renders the server’s own title, and is still discriminated', () => {
  const p = presentProblem({ type: 'https://pemo.local/problems/grant-not-live' });
  assert.equal(p.title, null);
  assert.equal(p.kind, 'grant-not-live');
  assert.ok(!PRESENTED_TYPES.includes('https://pemo.local/problems/grant-not-live'));
});
