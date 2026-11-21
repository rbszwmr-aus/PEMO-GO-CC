/**
 * Severity tokens are READ from severity.json, never transcribed.
 *
 * The export defines six levels and has no `offline`. There are seven.
 * ADR-007 D7 gives structural authority to the ADRs; UI-010-ST settled seven
 * against a ruling that could have reduced it. These tests make the generated
 * output provably a function of severity.json rather than of anybody's memory.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, MGMT_CONTRACT_DIR, readSeverityJson } from '../../tool/corpus-source.ts';
import { buildSeverityCss, buildSeverityTs } from '../../tool/generate-tokens.ts';

const read = (rel: string) => readFileSync(join(APP_ROOT, rel), 'utf8');

test('severity.json carries SEVEN levels, not the export’s six', () => {
  const s = readSeverityJson();
  assert.equal(s.levelOrder.length, 7);
  assert.deepEqual(s.levelOrder, [
    'normal',
    'information',
    'advisory',
    'warning',
    'critical',
    'offline',
    'unknown',
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
    inJson.add(c.strong.toUpperCase());
    inJson.add(c.surface.toUpperCase());
    inJson.add(c.border.toUpperCase());
  }
  const inCss = [...generated.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase());
  assert.ok(inCss.length > 0, 'the generated CSS carries no colour at all');
  for (const hex of inCss) {
    assert.ok(inJson.has(hex), `${hex} appears in the generated CSS but not in severity.json`);
  }
  assert.equal(inCss.length, 21, 'seven levels times strong, surface and border');
});

test('all seven levels reach the CSS, each as a strong/surface/border SET', () => {
  // Design system section 19: a strong, surface and border are used as a set;
  // mixing across levels is a one-off colour by another route.
  const css = read('src/theme/severity-tokens.g.css');
  for (const level of readSeverityJson().levelOrder) {
    for (const part of ['strong', 'surface', 'border']) {
      assert.match(css, new RegExp(`--pemo-sev-${level}-${part}:`), `missing --pemo-sev-${level}-${part}`);
    }
  }
});

test('the generated enum agrees with the management contract’s Severity enum', () => {
  // Three artefacts have to agree: severity.json (normative), the management
  // contract's Severity enum, and what this app generates. Asserting that each
  // level "appears somewhere" in the generated file is too weak a bar — a
  // mutation run proved it survived a corrupted first entry — so all three are
  // extracted as ORDERED LISTS and compared structurally.
  const contract = readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8');
  const enumMatch = contract.match(/^ {4}Severity:$[\s\S]*?^ {6}enum: \[([^\]]+)\]/m);
  assert.ok(enumMatch, 'the management contract no longer declares a Severity enum');
  const contractEnum = enumMatch[1]!.split(',').map((s) => s.trim());

  const ts = read('src/theme/severity-tokens.g.ts');
  const orderMatch = ts.match(/export const SEVERITY_ORDER = \[([\s\S]*?)\] as const;/);
  assert.ok(orderMatch, 'SEVERITY_ORDER is missing from the generated module');
  const generatedOrder = [...orderMatch[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

  const normative: string[] = readSeverityJson().levelOrder;

  assert.deepEqual(generatedOrder, normative, 'generated order differs from severity.json');
  assert.deepEqual(contractEnum, normative, 'the management contract differs from severity.json');

  // And every level must have a full token in the generated object, not just a
  // name in the order array.
  for (const level of normative) {
    assert.match(
      ts,
      new RegExp(`"${level}": \\{\\s*\\n\\s*value: "${level}"`),
      `${level} has no generated token body`,
    );
  }
});

test('client connectivity is never a severity', () => {
  // severity.json notASeverity: the server cannot know the client's network
  // state, so it can never emit one. A client-connectivity severity would show a
  // resident a severity unrelated to their safety while stale critical data sat
  // underneath it.
  const s = readSeverityJson();
  assert.ok(s.notASeverity?.clientConnectivity);
  assert.ok(!s.levelOrder.includes('disconnected'));
  assert.ok(!s.levelOrder.includes('no-connection'));
  assert.match(read('src/theme/severity-tokens.g.ts'), /CLIENT_CONNECTIVITY_IS_NOT_A_SEVERITY/);
});
