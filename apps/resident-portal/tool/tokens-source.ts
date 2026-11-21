/**
 * Paths and the two token sources this app reads.
 *
 * There is no fixture corpus here — this PID renders no data — so unlike the
 * management web's tool/corpus-source.ts there is nothing to guard against a
 * stubbed source. The two things read are DESIGN TOKEN sources, not data:
 *
 *   - severity.json, read READ-ONLY across the package boundary. It is the
 *     normative machine form of design-system section 3's seven levels, frozen
 *     at contract 0.2.0. Taking values from it is not a contract dependency;
 *     this app takes VALUES, never shape, and never a facility, booking, price
 *     or availability. See the third-boundary-crossing finding in the Step 2
 *     report: this is the third surface to reach severity.json, which is what
 *     makes the packages/design-tokens/ move worth a PID.
 *
 *   - tokens/palette.json, the non-severity palette, which lives in this app.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = resolve(HERE, '..');
export const REPO_ROOT = resolve(HERE, '../../..');

/** Read-only, cross-package, values-only. Never written by this PID. */
export const SEVERITY_JSON = join(
  REPO_ROOT,
  'packages/api-contracts/resident-mobile/severity.json',
);

/** The resident-mobile theme this app's palette is parity-checked against. */
export const DART_PEER = join(REPO_ROOT, 'apps/resident-mobile/lib/theme/pemo_colors.dart');

export const PALETTE_JSON = join(APP_ROOT, 'tokens/palette.json');

export function readSeverityJson(): any {
  if (!existsSync(SEVERITY_JSON)) {
    throw new Error(`severity.json is missing at ${SEVERITY_JSON}. Design tokens cannot be generated.`);
  }
  return JSON.parse(readFileSync(SEVERITY_JSON, 'utf8'));
}

export function readPaletteJson(): any {
  return JSON.parse(readFileSync(PALETTE_JSON, 'utf8'));
}
