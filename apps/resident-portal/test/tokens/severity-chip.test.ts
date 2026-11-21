/**
 * The severity system covers all seven levels, icon AND label, no colour alone
 * (severity.json 3.1). This is a node test, so it does not import the .tsx chip
 * (Node's type stripping cannot parse JSX); it proves completeness over the
 * plain-TS pieces the chip is built from — the generated SEVERITY tokens and the
 * glyph map. The chip's live rendering is covered by the browser suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SEVERITY_ORDER, SEVERITY } from '../../src/theme/severity-tokens.g.ts';
import { SEVERITY_GLYPH } from '../../src/components/severity-glyphs.ts';

test('there are seven levels', () => {
  assert.equal(SEVERITY_ORDER.length, 7);
});

test('every level has a distinct icon glyph — the icon half of icon+label', () => {
  const glyphs = SEVERITY_ORDER.map((l) => SEVERITY_GLYPH[l]);
  for (const [i, g] of glyphs.entries()) {
    assert.ok(g && g.length > 0, `${SEVERITY_ORDER[i]} has no glyph`);
  }
  assert.equal(new Set(glyphs).size, 7, 'two levels share a glyph');
  assert.equal(Object.keys(SEVERITY_GLYPH).length, 7, 'the glyph map is not exactly the seven levels');
});

test('every level has a bilingual label — the label half of icon+label', () => {
  for (const l of SEVERITY_ORDER) {
    assert.ok(SEVERITY[l].label.en.length > 0, `${l} has no English label`);
    assert.ok(SEVERITY[l].label['zh-Hant'].length > 0, `${l} has no Traditional Chinese label`);
  }
});

test('offline and unknown are separate levels — the export’s collapse is refused', () => {
  assert.ok(SEVERITY_ORDER.includes('offline') && SEVERITY_ORDER.includes('unknown'));
  assert.notEqual(SEVERITY.offline.color.strong, SEVERITY.unknown.color.strong);
  assert.notEqual(SEVERITY_GLYPH.offline, SEVERITY_GLYPH.unknown);
});
