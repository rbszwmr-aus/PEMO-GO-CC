/**
 * THE NODE FLOOR IS DECLARED, ENFORCED, AND MATCHES WHAT THE TOOLS NEED (GEN-050 D2).
 * Three UI tool scripts run under `--experimental-strip-types`, which exists from
 * Node 22.6. `engines.node` used to say `>=20`, which would let a 20.x install
 * fail at the first `pnpm run generate` with a flag error instead of at install
 * with a version error. `.nvmrc` pins the major this corpus is developed on.
 * (This host cannot run an older Node, so the floor is asserted from the files;
 * `engine-strict=true` is what makes pnpm refuse rather than warn.)
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf8')) as { engines?: { node?: string } };

test('engines.node is at least the strip-types floor, and enforced', () => {
  const m = /^>=(\d+)\.(\d+)/.exec(pkg.engines?.node ?? '');
  assert.ok(m, `engines.node is "${pkg.engines?.node}", not a >=major.minor floor`);
  const [maj, min] = [Number(m![1]), Number(m![2])];
  assert.ok(maj > 22 || (maj === 22 && min >= 6), `engines.node ${pkg.engines?.node} is below 22.6, which --experimental-strip-types needs`);
  assert.match(readFileSync(resolve(REPO, '.npmrc'), 'utf8'), /^engine-strict=true$/m, 'without engine-strict the floor is advice');
  const nvm = readFileSync(resolve(REPO, '.nvmrc'), 'utf8').trim();
  assert.ok(Number(nvm) >= maj, `.nvmrc pins ${nvm}, below the floor's major`);
});
