/**
 * Cross-surface token parity — check against the resident-mobile Dart peer.
 *
 * Design system v2.0 section 19 requires web and mobile consume equivalent
 * semantic tokens. The rule: two copies with nothing deciding which is real is
 * the disease; two copies with an enforced equality check is a cache.
 *
 * LIMITATION, recorded rather than hidden (Ruling 3): pemo_colors.dart is a
 * TRANSCRIPTION of design-system section 2, not the normative source. Making a
 * transcription the parity hub catches DRIFT between surfaces but cannot catch
 * all three surfaces being wrong together against the design system — the empty
 * oracle in its most respectable disguise. The check is the mitigation; the
 * finding is in DIVERGENCES.md, and packages/design-tokens/ is the real fix.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, DART_PEER, REPO_ROOT, readPaletteJson } from '../../tool/tokens-source.ts';
import { buildPaletteCss, buildPaletteTs } from '../../tool/generate-tokens.ts';

function readPeerColors(): Map<string, string> {
  const src = readFileSync(DART_PEER, 'utf8');
  const out = new Map<string, string>();
  for (const m of src.matchAll(/static const (\w+)\s*=\s*Color\(0x(?:FF|ff)([0-9A-Fa-f]{6})\)/g)) {
    out.set(m[1]!, `#${m[2]!.toUpperCase()}`);
  }
  return out;
}

test('the resident peer theme is readable and non-trivial', () => {
  const peer = readPeerColors();
  assert.ok(peer.size >= 20, `parsed only ${peer.size} colours from ${DART_PEER}; the parse is broken`);
});

test('every SHARED token matches the resident surface exactly', () => {
  const palette = readPaletteJson();
  const peer = readPeerColors();
  const drift: string[] = [];
  for (const [token, def] of Object.entries<any>(palette.shared)) {
    const peerValue = peer.get(def.peer);
    if (peerValue === undefined) {
      drift.push(`${token}: declared peer \`${def.peer}\` does not exist in pemo_colors.dart`);
    } else if (peerValue.toUpperCase() !== String(def.value).toUpperCase()) {
      drift.push(`${token}: portal ${def.value} vs resident ${def.peer} ${peerValue}`);
    }
  }
  assert.deepEqual(drift, [], `the surfaces have drifted:\n  ${drift.join('\n  ')}`);
});

test('every PORTAL-ONLY token is genuinely absent from the resident surface', () => {
  const palette = readPaletteJson();
  const peerValues = new Set([...readPeerColors().values()].map((v) => v.toUpperCase()));
  for (const [token, def] of Object.entries<any>(palette.portalOnly)) {
    assert.ok(
      !peerValues.has(String(def.value).toUpperCase()),
      `${token} (${def.value}) is declared portal-only but now appears on the resident surface`,
    );
  }
});

test('no severity colour leaks into the non-severity palette', () => {
  const palette = readPaletteJson();
  const severity = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/api-contracts/resident-mobile/severity.json'), 'utf8'),
  );
  const severityHexes = new Set<string>();
  for (const level of severity.levelOrder) {
    const c = severity.levels[level].color;
    for (const v of [c.strong, c.surface, c.border]) severityHexes.add(v.toUpperCase());
  }
  for (const group of ['shared', 'portalOnly']) {
    for (const [token, def] of Object.entries<any>(palette[group])) {
      assert.ok(
        !severityHexes.has(String(def.value).toUpperCase()),
        `${token} carries ${def.value}, which is a severity colour from severity.json`,
      );
    }
  }
});

test('the generated palette files are not stale', () => {
  const palette = readPaletteJson();
  assert.equal(readFileSync(join(APP_ROOT, 'src/theme/palette.g.ts'), 'utf8'), buildPaletteTs(palette));
  assert.equal(readFileSync(join(APP_ROOT, 'src/theme/palette.g.css'), 'utf8'), buildPaletteCss(palette));
});

test('palette.json records the placement debt and the transcription limitation', () => {
  const palette = readPaletteJson();
  assert.match(palette.placementDebt, /cannot move/i);
  assert.match(palette.parity.hubIsATranscription, /transcription/i);
  assert.match(palette.source, /Proposed/, 'the Proposed status of design system section 2 must stay declared');
});
