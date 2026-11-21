/**
 * The language control in the PRODUCTION bundle is the segmented tab, not the
 * labelled combo. Proved against dist/, because a mutation that only changes
 * source on disk does not prove the served artefact.
 *
 * Fail-closed: asserting "no combo" while the tab is also missing would pass
 * an empty header. The real predicate is tab-present AND combo-absent. A
 * synthetic bundle with neither fails; a bundle with both fails for its own
 * reason (the combo survived).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';

const DIST = join(APP_ROOT, 'dist');
const LANGUAGE_TAB = join(APP_ROOT, 'src/shell/LanguageTab.tsx');

const TAB_NEEDLE = 'locale-tab';
const SEG_NEEDLE = 'locale-seg';
const COMBO_NEEDLE = 'locale-select';

export function languageControlState(js: string): { tab: boolean; combo: boolean } {
  return {
    tab: js.includes(TAB_NEEDLE) && js.includes(SEG_NEEDLE) && js.includes('简'),
    combo: js.includes(COMBO_NEEDLE),
  };
}

/** The predicate the artefact must satisfy. Missing tab fails closed. */
export function languageControlHolds(js: string): boolean {
  const s = languageControlState(js);
  return s.tab && !s.combo;
}

function bundles(): Array<{ name: string; body: string }> {
  const assets = join(DIST, 'assets');
  assert.ok(existsSync(assets), 'dist/assets does not exist — run the production build first');
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, body: readFileSync(join(assets, f), 'utf8') }));
}

test('the production bundle exists and is non-trivial for the language-tab check', () => {
  const b = bundles();
  assert.ok(b.length > 0, 'no JS bundle was emitted');
  const total = b.reduce((n, x) => n + x.body.length, 0);
  assert.ok(total > 50_000, `the bundle is only ${total} bytes; this is not a real build`);
});

test('the segmented-tab needle is findable in source', () => {
  assert.ok(existsSync(LANGUAGE_TAB), 'LanguageTab.tsx is missing');
  const src = readFileSync(LANGUAGE_TAB, 'utf8');
  assert.ok(src.includes(TAB_NEEDLE), 'LanguageTab.tsx no longer carries data-testid=locale-tab');
  assert.ok(src.includes("label: 'EN'"), 'LanguageTab.tsx no longer carries the EN segment');
  assert.ok(src.includes('简'), 'LanguageTab.tsx no longer carries the visible-only 简 segment');
  assert.ok(!src.includes(COMBO_NEEDLE), 'LanguageTab.tsx still carries the locale-select combo');
});

test('the production bundle contains the segmented language tab', () => {
  const found = bundles().filter((b) => languageControlState(b.body).tab);
  assert.ok(
    found.length > 0,
    'no JS bundle carries locale-tab / locale-seg / ENG — the tab is not in the served artefact',
  );
});

test('the production bundle does not contain the language combobox', () => {
  const found: string[] = [];
  for (const { name, body } of bundles()) {
    if (languageControlState(body).combo) found.push(name);
  }
  assert.deepEqual(
    found,
    [],
    `locale-select survived the production build in: ${found.join(', ')}`,
  );
});

test('combo-absence fails closed if the tab is missing from a bundle', () => {
  // A header with nothing would pass "no combo" and hide the regression.
  const empty = 'function App(){return null}';
  const state = languageControlState(empty);
  assert.equal(state.combo, false, 'the empty bundle was reported as having a combo');
  assert.equal(state.tab, false, 'the empty bundle was reported as having the tab');
  assert.equal(languageControlHolds(empty), false, 'missing tab must not pass');
});

test('a bundle that still has the combo fails even if the tab is also present', () => {
  const both = `data-testid="${TAB_NEEDLE}" data-testid="${SEG_NEEDLE}" 简 data-testid="${COMBO_NEEDLE}"`;
  const state = languageControlState(both);
  assert.equal(state.tab, true);
  assert.equal(state.combo, true);
  assert.equal(languageControlHolds(both), false, 'combo survival must fail for its own reason');
});
