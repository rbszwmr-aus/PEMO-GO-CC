/**
 * The estate summary, held to its basis: the world yields the counts, AND the
 * counts render as the exact string the corpus carries.
 *
 * This is the getOverview-basis discipline applied to getScope/getPropertyTree:
 * the number is asserted to be COMPUTED against the seeded world, in a test,
 * never a literal served from a handler. The two halves are checked separately
 * because they can fail separately — the world could yield the wrong count, or a
 * right count could render as the wrong string.
 *
 * It is also the payoff of Step 3a made executable: before the widening this
 * derivation produced "3 blocks · 9 units" and disagreed with the corpus; the
 * world was seeded to the magnitude the corpus describes so that it now agrees.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { estateCounts, formatEstateSummary } from '../../modules/property/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';

let db: ReturnType<typeof createModuleDb>;
test.before(() => {
  db = createModuleDb({ schema: 'property', database: loadConfig().moduleDatabases.property });
});
test.after(async () => {
  await db.close();
});

const ESTATE = 'est_wing_fu_garden';

test('the world yields 3 blocks and 812 residential units', async () => {
  const counts = await estateCounts(db, ESTATE);
  assert.equal(counts.blocks, 3, 'three blocks seeded');
  assert.equal(counts.units, 812, 'residential units at corpus magnitude — the 3a payoff');
});

test('the counts render as the EXACT bilingual string the corpus carries', async () => {
  // The fixture is the oracle. Read the summary out of the pinned corpus rather
  // than hardcoding it, so a corpus change moves the assertion with it.
  const scope = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, '../fixtures/management-web/scope/default.json'), 'utf8'),
  ) as { nodes: { node: { kind: string }; summary?: { en: string; 'zh-Hant': string } }[] };
  const fixtureSummary = scope.nodes.find((n) => n.node.kind === 'estate')?.summary;
  assert.ok(fixtureSummary, 'the estate node carries a summary in the corpus');

  const rendered = formatEstateSummary(await estateCounts(db, ESTATE));
  assert.deepEqual(rendered, fixtureSummary, 'computed summary must equal the corpus byte-for-byte');
});

test('the formatter is a pure function of the counts, and both halves are load-bearing', () => {
  // Independent of the database: 3 and 812 must produce the string. If the world
  // count drifts, the test above fails; if the FORMAT drifts, this one does. Two
  // failure modes, two assertions.
  assert.deepEqual(formatEstateSummary({ blocks: 3, units: 812 }), {
    en: '3 blocks · 812 units',
    'zh-Hant': '3座 · 812單位',
  });

  // The unfiltered-class trap made checkable: 1089 is what an aggregate that
  // forgot `unit_class = 'residential'` would report. It must NOT be the summary.
  const wrong = formatEstateSummary({ blocks: 3, units: 1089 });
  assert.notEqual(wrong.en, '3 blocks · 812 units', 'the all-classes count is a different, wrong string');
});

test('singular is handled, and marked as beyond the corpus', () => {
  // The corpus only ever shows plural, so this is defensive rather than verified.
  // Asserted anyway, because "1 blocks" is exactly what ships when no singular
  // fixture exists to catch it.
  assert.equal(formatEstateSummary({ blocks: 1, units: 1 }).en, '1 block · 1 unit');
});
