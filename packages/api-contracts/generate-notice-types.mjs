/**
 * PROJECT THE NOTICE-TYPE DECLARATION INTO ITS TWO CONSUMERS.
 *
 * ADR-019 D7, and the `GEN-034` `I3` pattern applied to a second axis: a
 * generation step performed from memory is a step that will be skipped. `GEN-027`
 * did the enum by hand and `GEN-033` forgot; the remedy is a command, not a
 * discipline.
 *
 *   node packages/api-contracts/generate-notice-types.mjs           write
 *   node packages/api-contracts/generate-notice-types.mjs --check   verify only
 *
 * TWO CONSUMERS, AND THEY ARE VERIFIED DIFFERENTLY — because one of them is
 * immutable:
 *
 *   modules/notices/src/notice-types.ts   GENERATED. Rewritten in place.
 *   the DDL CHECK constraint              VERIFIED, never rewritten. A migration
 *                                         that has been applied is immutable, so
 *                                         adding a type means a NEW migration
 *                                         altering the constraint. This script
 *                                         REFUSES when the declaration and the
 *                                         constraint disagree, and says which
 *                                         migration is authoritative — it does not
 *                                         silently edit history to agree with the
 *                                         present.
 *
 * That asymmetry is the point. A generator that rewrote an applied migration
 * would make the database and the file disagree on every machine that had already
 * run it.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..');
const REGISTRY = path.join(HERE, 'notice-types.json');
const TS_TARGET = path.join(REPO, 'modules', 'notices', 'src', 'notice-types.ts');
const MIGRATIONS = path.join(REPO, 'database', 'migrations');

const check = process.argv.includes('--check');
const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const types = Object.keys(registry.types).sort();

const dispositions = Object.keys(registry.dispositions ?? {}).sort();
const lifecycleStates = [...(registry.lifecycleStates ?? [])].sort();
const overlap = dispositions.filter((d) => lifecycleStates.includes(d));

// THE GENERATOR REFUSES AN OVERLAP RATHER THAN EMITTING ONE. Catching it here
// names the offending literal; catching it downstream only says a type is wrong.
if (overlap.length > 0) {
  console.log(`  FAIL — disposition and lifecycle vocabularies overlap: ${overlap.join(', ')}`);
  console.log('         They must be disjoint (GEN-042 H2): a disposition is what an actor DID,');
  console.log('         a lifecycle state is what the notice IS. Shared literals make a wrong');
  console.log('         comparison type-check and silently never match.');
  process.exit(1);
}

let failed = 0;



// ─── consumer 1: the TypeScript union (generated) ────────────────────────────

// BUILT BY CONCATENATION, NOT BY A NESTED TEMPLATE. A generator emitting template
// literals from inside one is the `sql-literals-hold-only-sql` hazard a layer up:
// two escaping regimes at once, and the first attempt at this block was mangled by
// exactly that. Plain strings have one.
const line = (prefix, xs) => xs.map((x) => prefix + "'" + x + "'").join('\n');

const vocabBlock = dispositions.length === 0 ? '' : [
  '',
  '/**',
  ' * WHAT AN ACTOR DID (disposition) and WHAT STATE THE NOTICE IS IN (lifecycle) are',
  ' * DIFFERENT VOCABULARIES, and they are DISJOINT BY CONSTRUCTION — the generator',
  ' * refuses to emit them if any literal appears in both.',
  ' *',
  ' * They used to share `approved` and `withdrawn`. A state check written against a',
  ' * disposition literal then type-checked and SILENTLY NEVER MATCHED, so at GEN-040',
  ' * every approval refused as wrong-state. With the vocabularies disjoint, the same',
  ' * mistake is a TS2367 "no overlap" comparison error instead of a false condition.',
  ' */',
  'export type NoticeDisposition =',
  line('  | ', dispositions) + ';',
  '',
  'export const NOTICE_DISPOSITIONS = [',
  line('  ', dispositions).split('\n').map((l) => l + ',').join('\n'),
  '] as const satisfies readonly NoticeDisposition[];',
  '',
  'export type NoticeLifecycleState =',
  line('  | ', lifecycleStates) + ';',
  '',
  'export const NOTICE_LIFECYCLE_STATES = [',
  line('  ', lifecycleStates).split('\n').map((l) => l + ',').join('\n'),
  '] as const satisfies readonly NoticeLifecycleState[];',
  '',
  '/**',
  ' * THE DISJOINTNESS, ASSERTED AT COMPILE TIME. If a literal is ever added to both',
  ' * vocabularies this stops being `never` and the assignment fails, naming it.',
  ' */',
  'type VocabularyOverlap = Extract<NoticeDisposition, NoticeLifecycleState>;',
  'const _vocabulariesDisjoint: VocabularyOverlap extends never ? true : VocabularyOverlap = true;',
  'void _vocabulariesDisjoint;',
  '',
].join('\n');


const banner = `/**
 * GENERATED — do not edit. Source: packages/api-contracts/notice-types.json
 * Regenerate: pnpm gen:notice-types
 *
 * ADR-019 D7. The notice-type vocabulary, projected from its declaration so that
 * the module, the DDL and the validator cannot drift apart. Adding a type means
 * editing the JSON and running the command — and then writing a migration, because
 * the DDL constraint lives in one and migrations are immutable.
 */

export type NoticeType =
${types.map((t) => `  | '${t}'`).join('\n')};

export const NOTICE_TYPES = [
${types.map((t) => `  '${t}',`).join('\n')}
] as const satisfies readonly NoticeType[];

/** If a type exists in the union and not in the array, this stops being \`never\`. */
type MissingFromArray = Exclude<NoticeType, (typeof NOTICE_TYPES)[number]>;
const _noticeTypesExhaustive: MissingFromArray extends never ? true : MissingFromArray = true;
void _noticeTypesExhaustive;

export const isNoticeType = (value: string): value is NoticeType =>
  (NOTICE_TYPES as readonly string[]).includes(value);
${vocabBlock}`;

let current = '';
try { current = readFileSync(TS_TARGET, 'utf8'); } catch { current = ''; }
if (current !== banner) {
  if (check) {
    console.log('  FAIL — modules/notices/src/notice-types.ts has drifted from notice-types.json.');
    console.log('         Run: pnpm gen:notice-types');
    failed += 1;
  } else {
    writeFileSync(TS_TARGET, banner);
    console.log(`  wrote modules/notices/src/notice-types.ts (${types.length} types)`);
  }
} else if (!check) {
  console.log(`  modules/notices/src/notice-types.ts already current (${types.length} types)`);
}

// ─── consumer 2: the DDL constraint (verified, never rewritten) ──────────────
//
// The constraint is found rather than assumed: the LAST migration that declares
// `notice_type_check` is the authoritative one, so a later ALTER supersedes the
// original CREATE without this script needing to know which file that is.
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.up.sql')).sort();
let authoritative = null;
for (const f of files) {
  const sql = readFileSync(path.join(MIGRATIONS, f), 'utf8');
  if (/notice_type_check/.test(sql)) authoritative = { file: f, sql };
}

if (authoritative === null) {
  console.log('  FAIL — no migration declares notice_type_check. The DDL does not constrain the vocabulary.');
  failed += 1;
} else {
  const m = /notice_type_check[\s\S]*?CHECK\s*\(\s*notice_type\s+IN\s*\(([^)]*)\)/i.exec(authoritative.sql);
  if (m === null) {
    console.log(`  FAIL — could not read the notice_type_check constraint in ${authoritative.file}.`);
    failed += 1;
  } else {
    const inDdl = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    const same = inDdl.length === types.length && inDdl.every((v, i) => v === types[i]);
    if (!same) {
      console.log(`  FAIL — notice-types.json and ${authoritative.file} disagree.`);
      console.log(`         declared: ${types.join(', ')}`);
      console.log(`         DDL:      ${inDdl.join(', ')}`);
      console.log('         Migrations are immutable: add a NEW migration altering the constraint.');
      failed += 1;
    } else if (!check) {
      console.log(`  DDL constraint in ${authoritative.file} agrees (${inDdl.length} types)`);
    }
  }
}

if (failed > 0) process.exit(1);
if (check) console.log(`  ok     notice types agree across declaration, module and DDL   ${types.length} type(s)`);
