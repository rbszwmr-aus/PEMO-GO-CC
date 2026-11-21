#!/usr/bin/env node
/**
 * EVERY WORKSPACE IMPORT IS DECLARED, AND EVERY DECLARATION IS BUILT (GEN-048 R3).
 *
 * CI was red on every main run from the first push that imported @pemo/notices
 * into apps/api (GEN-040/042) to #93, and nothing on this host noticed: the
 * dependency WAS declared in package.json, so pnpm linked it, but apps/api's
 * tsconfig REFERENCES did not name the module, so on a clean clone `tsc -b`
 * never built its dist first and TS2307 followed. Locally every module was
 * always built in a loop beforehand, which is how "from-nothing rebuild green"
 * became a claim about a pre-built tree.
 *
 * Two derived checks, per package under apps/ and modules/ with a tsconfig:
 *   1. every `@pemo/<x>` imported anywhere in src/ is in package.json deps;
 *   2. every `@pemo/<x>` in deps has a tsconfig `references` entry.
 * Both directions are read from the files; nothing is listed.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) {
  const p = join(d, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist'].includes(e.name)) walk(p, out); } else if (/\.(ts|mts)$/.test(e.name)) out.push(p); } return out; };
const pkgs = ['apps', 'modules'].flatMap((g) => existsSync(join(REPO, g)) ? readdirSync(join(REPO, g)).map((n) => join(REPO, g, n)) : [])
  .filter((p) => existsSync(join(p, 'package.json')) && existsSync(join(p, 'tsconfig.json')));
let failures = [], checked = 0;
for (const p of pkgs) {
  const pk = JSON.parse(readFileSync(join(p, 'package.json'), 'utf8'));
  const deps = new Set(Object.keys({ ...pk.dependencies, ...pk.devDependencies }).filter((k) => k.startsWith('@pemo/')));
  const ts = JSON.parse(readFileSync(join(p, 'tsconfig.json'), 'utf8').replace(/\/\/.*$/gm, ''));
  const refs = new Set((ts.references ?? []).map((r) => '@pemo/' + r.path.split('/').pop()));
  const src = join(p, 'src'); if (!existsSync(src)) continue;
  const imported = new Set();
  for (const f of walk(src)) for (const m of readFileSync(f, 'utf8').matchAll(/from\s+'(@pemo\/[a-z-]+)/g)) imported.add(m[1]);
  for (const i of imported) { checked++; if (!deps.has(i)) failures.push(`${relative(REPO, p)} imports ${i} but does not declare it in package.json`); }
  for (const d of deps) { checked++; if (!refs.has(d)) failures.push(`${relative(REPO, p)} declares ${d} but tsconfig.json has no reference to it — a clean \`tsc -b\` will not build it first`); }
}
if (checked === 0) { console.log('  FAIL  workspace-deps: nothing checked — the scan is not seeing the packages'); process.exit(1); }
if (failures.length) { console.log(`  FAIL  ${failures.length} workspace dependency declaration(s) missing`); for (const f of failures) console.log(`        ${f}`); process.exit(1); }
console.log(`  ok     every workspace import is declared and referenced     ${checked} edge(s), ${pkgs.length} package(s)`);
