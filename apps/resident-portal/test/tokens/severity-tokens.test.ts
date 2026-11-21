/**
 * Severity tokens are READ from severity.json, never transcribed (PID section 4).
 *
 * The export defines six levels and has no `offline`. There are SEVEN. These
 * tests make the generated output provably a function of severity.json rather
 * than of anybody's memory, and pin that the count is seven.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, readSeverityJson } from '../../tool/tokens-source.ts';
import { buildSeverityCss, buildSeverityTs } from '../../tool/generate-tokens.ts';

const read = (rel: string) => readFileSync(join(APP_ROOT, rel), 'utf8');

test('severity.json carries SEVEN levels, not the export’s six', () => {
  const s = readSeverityJson();
  assert.equal(s.levelOrder.length, 7);
  assert.deepEqual(s.levelOrder, [
    'normal', 'information', 'advisory', 'warning', 'critical', 'offline', 'unknown',
  ]);
  assert.ok(s.levelOrder.includes('offline'), 'offline is the level the export does not have');
});

test('the generated severity tokens are not stale', () => {
  const s = readSeverityJson();
  assert.equal(read('src/theme/severity-tokens.g.ts'), buildSeverityTs(s), 'run `pnpm run generate`');
  assert.equal(read('src/theme/severity-tokens.g.css'), buildSeverityCss(s), 'run `pnpm run generate`');
});

test('every colour in the generated output came from severity.json', () => {
  const s = readSeverityJson();
  const generated = read('src/theme/severity-tokens.g.css');
  const inJson = new Set<string>();
  for (const level of s.levelOrder) {
    const c = s.levels[level].color;
    for (const v of [c.strong, c.surface, c.border]) inJson.add(v.toUpperCase());
  }
  for (const m of generated.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
    assert.ok(inJson.has(m[0].toUpperCase()), `${m[0]} in the generated CSS is not a severity.json value`);
  }
});

test('the export’s six-tone values are NOT present — seven wins, six is rejected', () => {
  // The export collapses offline+unknown and uses these strongs. None may survive.
  const H = String.fromCharCode(35);
  const rejectedSix = ['C0271F', 'A85408', '8A5A00', '0B6E78', '1E6B4F', '55606E'].map((h) => H + h);
  const css = read('src/theme/severity-tokens.g.css').toUpperCase();
  for (const hex of rejectedSix) {
    assert.ok(!css.includes(hex), `${hex} is an export six-tone value and must not appear`);
  }
});
