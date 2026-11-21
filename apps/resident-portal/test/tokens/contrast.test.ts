/**
 * Contrast holds where the export's did not (PID test 4).
 *
 * neutral.500 measures 4.34:1 on the page ground and FAILS AA
 * for normal text there (design-system section 15.2). The export uses it that
 * way extensively. This asserts it carries no TEXT anywhere in the hand-written
 * stylesheet — page-ground text is neutral.600 (5.72:1). Made red by putting
 * `color: var(--pemo-neutral-500)` into base.css.
 *
 * neutral.500 stays permitted for non-text decoration (borders, icon fills), so
 * the assertion is over the `color` property specifically, not over every use.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/tokens-source.ts';

const css = readFileSync(join(APP_ROOT, 'src/theme/base.css'), 'utf8');

/** Matches a `color:` (but not background-color/border-color) set to neutral.500. */
const TEXT_NEUTRAL_500 = /(?<![-\w])color\s*:\s*var\(\s*--pemo-neutral-500\s*\)/g;

test('neutral.500 never carries text — page-ground text is neutral.600', () => {
  const offences = [...css.matchAll(TEXT_NEUTRAL_500)].map(
    (m) => `base.css:${css.slice(0, m.index).split('\n').length}`,
  );
  assert.deepEqual(
    offences,
    [],
    `neutral.500 is used as a text colour at:\n  ${offences.join('\n  ')}\n` +
      `It fails AA on the page ground (4.34:1). Use neutral.600.`,
  );
});

test('the assertion is not vacuous — it would catch neutral.500 as text', () => {
  const planted = '.x { color: var(--pemo-neutral-500); }';
  assert.match(planted, TEXT_NEUTRAL_500, 'the scanner does not catch neutral.500 as a text colour');
});

test('the scanner does not false-positive on a non-text use of neutral.500', () => {
  const decoration = '.y { border-color: var(--pemo-neutral-500); background-color: var(--pemo-neutral-500); }';
  const hits = [...decoration.matchAll(TEXT_NEUTRAL_500)];
  assert.equal(hits.length, 0, 'the scanner wrongly flags border-color/background-color');
});

/**
 * accent.heading is a management-surface token, reverted to ink on the
 * portal (Ruling 2). The constrained-token machinery stays: if it is ever used,
 * it may appear ONLY as the .pemo-page-title h1 style. This guard enforces that —
 * and it currently has NO user, which is the intended state.
 */
const ACCENT_HEADING = /var\(\s*--pemo-accent-heading\s*\)/g;

test('accent.heading has no current user — reverted to ink, machinery retained', () => {
  const uses = [...css.matchAll(ACCENT_HEADING)];
  assert.equal(uses.length, 0, 'accent.heading is used in base.css; the portal reverted it to ink (Ruling 2)');
});

test('the accent.heading token is still DEFINED, so a later designer can reintroduce it as a page-title style', () => {
  // The guard is only meaningful while the token exists to be guarded.
  const palette = readFileSync(join(APP_ROOT, 'src/theme/palette.g.css'), 'utf8');
  assert.match(palette, /--pemo-accent-heading:/, 'the accent.heading token was dropped; the guard now guards nothing');
});

test('the accent.heading guard is not vacuous — it would catch a use', () => {
  const planted = '.pemo-caption { color: var(--pemo-accent-heading); }';
  assert.match(planted, ACCENT_HEADING, 'the guard would not catch a use of accent.heading');
});
