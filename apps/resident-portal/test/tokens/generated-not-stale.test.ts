/**
 * The generated icon manifest is not stale.
 *
 * src/data/icons.g.ts is a function of what PNGs exist in public/icons/. If a
 * PNG is added or removed and `pnpm run generate` is not re-run, the sidebar
 * would render the wrong set. (The token generated files have their own
 * not-stale checks in palette-parity and severity-tokens.)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/tokens-source.ts';
import { buildIconsTs, presentIcons } from '../../tool/generate-icons.ts';

test('src/data/icons.g.ts matches public/icons/', () => {
  const onDisk = readFileSync(join(APP_ROOT, 'src/data/icons.g.ts'), 'utf8');
  assert.equal(onDisk, buildIconsTs(presentIcons()), 'run `pnpm run generate` — the icon manifest is stale');
});
