/**
 * PROJECT THE TICKET/CASE VOCABULARIES INTO THEIR TWO CONSUMERS.
 *
 * ADR-020 D10, and the same shape `generate-notice-types.mjs` established at
 * GEN-037 — generalised, because this axis has FOUR vocabularies across TWO
 * modules rather than one.
 *
 *   node packages/api-contracts/generate-case-vocabularies.mjs           write
 *   node packages/api-contracts/generate-case-vocabularies.mjs --check   verify
 *
 * THE ASYMMETRY IS THE SAME AND FOR THE SAME REASON:
 *
 *   the TypeScript unions   GENERATED, rewritten in place.
 *   the DDL CHECKs          VERIFIED, never rewritten. A migration that has been
 *                           applied is immutable, so adding a value means a NEW
 *                           migration altering the constraint. This refuses a
 *                           disagreement and names the authoritative migration; it
 *                           does not edit history to agree with the present.
 *
 * The authoritative migration is FOUND, not assumed: the LAST file declaring a
 * given constraint name wins, so a later ALTER supersedes the original CREATE
 * without this script knowing which file that is.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
const REGISTRY = path.join(HERE, 'case-vocabularies.json');
const MIGRATIONS = path.join(REPO, 'database', 'migrations');

/** Which module owns which vocabulary — derived from the table's schema. */
const MODULE_OF = { helpdesk: 'helpdesk', service_case: 'service-case' };

const check = process.argv.includes('--check');
const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const vocabs = registry.vocabularies;

const pascal = (s) => s.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
let failed = 0;

// ─── consumer 1: the TypeScript unions, one file per module ─────────────────
const byModule = new Map();
for (const [name, v] of Object.entries(vocabs)) {
  const schema = v.table.split('.')[0];
  if (!byModule.has(schema)) byModule.set(schema, []);
  byModule.get(schema).push([name, v]);
}

for (const [schema, entries] of byModule) {
  const dir = path.join(REPO, 'modules', MODULE_OF[schema], 'src');
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'vocabularies.ts');

  let body = `/**
 * GENERATED — do not edit. Source: packages/api-contracts/case-vocabularies.json
 * Regenerate: pnpm gen:case-vocabularies
 *
 * ADR-020 D10. The declared vocabularies for the \`${schema}\` schema, projected so
 * that the module, the DDL and any validator cannot drift apart. Adding a value
 * means editing the JSON, running the command, AND writing a migration — the DDL
 * constraint lives in one, and migrations are immutable.
 */
`;
  for (const [name, v] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
    const T = pascal(name);
    const U = name.toUpperCase();
    const vals = [...v.values].sort();
    body += `
/** \`${v.table}.${v.column}\` — constraint \`${v.constraint}\`. */
export type ${T} =
${vals.map((x) => `  | '${x}'`).join('\n')};

export const ${U} = [
${vals.map((x) => `  '${x}',`).join('\n')}
] as const satisfies readonly ${T}[];

type ${T}Missing = Exclude<${T}, (typeof ${U})[number]>;
const _${name}Exhaustive: ${T}Missing extends never ? true : ${T}Missing = true;
void _${name}Exhaustive;

export const is${T} = (value: string): value is ${T} =>
  (${U} as readonly string[]).includes(value);
`;
  }

  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch { current = ''; }
  const rel = path.relative(REPO, target);
  if (current !== body) {
    if (check) {
      console.log(`  FAIL — ${rel} has drifted from case-vocabularies.json.`);
      console.log('         Run: pnpm gen:case-vocabularies');
      failed += 1;
    } else {
      writeFileSync(target, body);
      console.log(`  wrote ${rel} (${entries.length} vocabulary/ies)`);
    }
  } else if (!check) {
    console.log(`  ${rel} already current`);
  }
}

// ─── consumer 2: the DDL constraints, verified ──────────────────────────────
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.up.sql')).sort();
for (const [name, v] of Object.entries(vocabs)) {
  let authoritative = null;
  for (const f of files) {
    const sql = readFileSync(path.join(MIGRATIONS, f), 'utf8');
    if (sql.includes(v.constraint)) authoritative = { file: f, sql };
  }
  if (authoritative === null) {
    console.log(`  FAIL — no migration declares ${v.constraint}; the DDL does not constrain ${name}.`);
    failed += 1;
    continue;
  }
  const re = new RegExp(`${v.constraint}[\\s\\S]{0,200}?IN\\s*\\(([^)]*)\\)`, 'i');
  const m = re.exec(authoritative.sql);
  if (m === null) {
    console.log(`  FAIL — could not read ${v.constraint} in ${authoritative.file}.`);
    failed += 1;
    continue;
  }
  const inDdl = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  const want = [...v.values].sort();
  if (inDdl.length !== want.length || inDdl.some((x, i) => x !== want[i])) {
    console.log(`  FAIL — ${name}: case-vocabularies.json and ${authoritative.file} disagree.`);
    console.log(`         declared: ${want.join(', ')}`);
    console.log(`         DDL:      ${inDdl.join(', ')}`);
    console.log('         Migrations are immutable: add a NEW migration altering the constraint.');
    failed += 1;
  }
}

if (failed > 0) process.exit(1);
const n = Object.keys(vocabs).length;
if (check) console.log(`  ok     case vocabularies agree across declaration, modules and DDL   ${n} vocabulary/ies`);
