/**
 * The condition of D3's approval, and the first cross-surface check this
 * project has ever had.
 *
 * Design system v2.0 section 19 requires that web and mobile consume equivalent
 * semantic tokens, and until this test nothing checked it. The rule the Product
 * Owner recorded on 2026-08-14: two copies with nothing deciding which is real
 * is the disease; two copies with an enforced equality check is a cache. The
 * defect was never duplication — it was silence.
 *
 * The check runs in BOTH directions, so a value that drifts on either surface
 * fails, and a management-only token that quietly appears on mobile fails too.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, REPO_ROOT } from '../../tool/corpus-source.ts';
import { buildPaletteCss, buildPaletteTs, readPaletteJson } from '../../tool/generate-tokens.ts';

const PEER = join(REPO_ROOT, 'apps/resident-mobile/lib/theme/pemo_colors.dart');

/** Parse `static const <name> = Color(0xFFRRGGBB);` out of the resident theme. */
function readPeerColors(): Map<string, string> {
  const src = readFileSync(PEER, 'utf8');
  const out = new Map<string, string>();
  for (const m of src.matchAll(/static const (\w+)\s*=\s*Color\(0x(?:FF|ff)([0-9A-Fa-f]{6})\)/g)) {
    out.set(m[1]!, `#${m[2]!.toUpperCase()}`);
  }
  return out;
}

test('the resident peer theme is readable and non-trivial', () => {
  // If the peer moves or its shape changes, this test must fail loudly rather
  // than silently comparing against an empty map and passing everything.
  const peer = readPeerColors();
  assert.ok(peer.size >= 20, `parsed only ${peer.size} colours from ${PEER}; the parse is broken`);
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
      drift.push(`${token}: management ${def.value} vs resident ${def.peer} ${peerValue}`);
    }
  }
  assert.deepEqual(drift, [], `the two surfaces have drifted:\n  ${drift.join('\n  ')}`);
});

test('every MANAGEMENT-ONLY token is genuinely absent from the resident surface', () => {
  // Asserting the absence, not tolerating it. accent.heading appears in the
  // management export and not in mobile (design system 2.5); if it ever appears
  // on mobile that is a design decision somebody should have to make on purpose.
  const palette = readPaletteJson();
  const peerValues = new Set([...readPeerColors().values()].map((v) => v.toUpperCase()));

  for (const [token, def] of Object.entries<any>(palette.managementOnly)) {
    assert.ok(
      !peerValues.has(String(def.value).toUpperCase()),
      `${token} (${def.value}) is declared management-only but now appears on the resident surface`,
    );
  }
});

test('no severity colour leaks into the non-severity palette', () => {
  // Design system section 19: product screens must not introduce local one-off
  // severity colours. A severity value copied into the brand palette would be
  // exactly that, wearing a different name.
  const palette = readPaletteJson();
  const severity = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/api-contracts/resident-mobile/severity.json'), 'utf8'),
  );
  const severityHexes = new Set<string>();
  for (const level of severity.levelOrder) {
    const c = severity.levels[level].color;
    for (const v of [c.strong, c.surface, c.border]) severityHexes.add(v.toUpperCase());
  }
  for (const group of ['shared', 'managementOnly']) {
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

test('palette.json records the placement debt rather than hiding it', () => {
  // severity.json has the same misplacement — shared vocabulary inside one
  // consumer — and the shared home is a package this PID may not write.
  const palette = readPaletteJson();
  assert.match(palette.placementDebt, /cannot move/i);
  assert.match(palette.source, /Proposed/, 'the Proposed status of design system 2 and 9 must stay declared');
});
