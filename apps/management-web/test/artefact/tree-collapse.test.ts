/**
 * Expand all / Collapse all in the PRODUCTION bundle.
 *
 * A mutation that only changes source on disk does not prove the served
 * artefact. These checks read dist/. Expand all missing must fail, not skip.
 * Collapse all missing fails for its own reason.
 * The tree screen (test ids) and the shared messages (labels) are separate chunks of the one artefact; the two ids must share a chunk and the two labels must share a chunk.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';

const DIST = join(APP_ROOT, 'dist');
const MESSAGES = join(APP_ROOT, 'src/i18n/messages.ts');
const SCREEN = join(APP_ROOT, 'src/screens/S3Properties.tsx');

const EXPAND = 'tree-expand-all';
const COLLAPSE = 'tree-collapse-all';
const EXPAND_COPY = 'Expand all';
const COLLAPSE_COPY = 'Collapse all';

export function treeCollapseState(js: string): { expandAll: boolean; collapseAll: boolean } {
  return {
    expandAll: js.includes(EXPAND) && js.includes(EXPAND_COPY),
    collapseAll: js.includes(COLLAPSE) && js.includes(COLLAPSE_COPY),
  };
}

/** Both header actions present. Missing Expand all fails closed. */
export function treeCollapseHolds(js: string): boolean {
  const s = treeCollapseState(js);
  return s.expandAll && s.collapseAll;
}

function bundles(): Array<{ name: string; body: string }> {
  const assets = join(DIST, 'assets');
  assert.ok(existsSync(assets), 'dist/assets does not exist — run the production build first');
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, body: readFileSync(join(assets, f), 'utf8') }));
}

test('the production bundle exists and is non-trivial for the tree-collapse check', () => {
  const b = bundles();
  assert.ok(b.length > 0, 'no JS bundle was emitted');
  const total = b.reduce((n, x) => n + x.body.length, 0);
  assert.ok(total > 50_000, `the bundle is only ${total} bytes; this is not a real build`);
});

test('Expand all and Collapse all needles are findable in source', () => {
  const src = readFileSync(SCREEN, 'utf8') + readFileSync(MESSAGES, 'utf8');
  assert.ok(src.includes(EXPAND), 'S3 tree no longer carries data-testid=tree-expand-all');
  assert.ok(src.includes(COLLAPSE), 'S3 tree no longer carries data-testid=tree-collapse-all');
  assert.ok(src.includes(EXPAND_COPY), 'messages no longer carry Expand all');
  assert.ok(src.includes(COLLAPSE_COPY), 'messages no longer carry Collapse all');
});

test('the production bundle contains Expand all and Collapse all', () => {
  // Screens load on demand, so the tree screen (the test ids) and the shared messages (the copy) are different chunks.
  // Within each, BOTH strings must sit in the SAME chunk: one chunk carries both test ids, one carries both labels.
  const chunks = bundles();
  const withIds = chunks.filter((b) => b.body.includes(EXPAND) && b.body.includes(COLLAPSE));
  const withCopy = chunks.filter((b) => b.body.includes(EXPAND_COPY) && b.body.includes(COLLAPSE_COPY));
  assert.ok(withIds.length > 0, 'no single JS chunk carries both tree-expand-all and tree-collapse-all — the actions are not in the served artefact');
  assert.ok(withCopy.length > 0, 'no single JS chunk carries both the Expand all and Collapse all labels');
  assert.ok(treeCollapseHolds(withIds[0]!.body + '\n' + withCopy[0]!.body), 'Expand all and Collapse all are not both present');
});

test('Expand all missing fails closed', () => {
  const empty = 'function App(){return null}';
  assert.equal(treeCollapseHolds(empty), false, 'missing Expand all must not pass');
  const collapseOnly = `data-testid="${COLLAPSE}" ${COLLAPSE_COPY}`;
  const state = treeCollapseState(collapseOnly);
  assert.equal(state.expandAll, false, 'Collapse all alone was reported as Expand all');
  assert.equal(state.collapseAll, true);
  assert.equal(treeCollapseHolds(collapseOnly), false, 'Expand all missing must fail, not skip');
});

test('Collapse all missing fails for its own reason', () => {
  const expandOnly = `data-testid="${EXPAND}" ${EXPAND_COPY}`;
  const state = treeCollapseState(expandOnly);
  assert.equal(state.expandAll, true);
  assert.equal(state.collapseAll, false, 'Expand all alone was reported as Collapse all');
  assert.equal(treeCollapseHolds(expandOnly), false, 'Collapse all missing must fail for its own reason');
});
