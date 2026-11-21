/**
 * THE RESIDUE SCAN, extended (UI-028-ST kept it; this extends it to data).
 *
 * The only facility names, prices and states that may appear are those a fixture
 * supplies. So hand-written source (NOT the generated corpus) must carry no HKSTP
 * residue, no invented facility value, and never the export's "25 Aug" — which is
 * `expectedReturn: null` in the corpus and must never be materialised as a date.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { CORPUS } from '../../src/data/corpus.g.ts';

/** A comment cannot reach a screen; strip block and line comments before scanning residue. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** Hand-written source only: exclude generated files (which legitimately embed fixtures). */
function handSrc(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e) && !/\.g\.ts$/.test(e)) out.push(full);
    }
  };
  walk(join(APP_ROOT, 'src'));
  return out;
}

const HKSTP = [
  'science park', 'innocentre', 'innocell', 'novatek', 'meiyi', 'cost centre', 'cost center',
  'park tenant', 'hkstp', 'mice venue', 'grand hall',
];
const INVENTED_DATES = ['25 aug', '25 august'];

test('no HKSTP residue in hand-written source', () => {
  const hits: string[] = [];
  for (const f of handSrc()) {
    const body = stripComments(readFileSync(f, 'utf8')).toLowerCase();
    for (const term of HKSTP) if (body.includes(term)) hits.push(`${relative(APP_ROOT, f)} contains "${term}"`);
  }
  assert.deepEqual(hits, [], `HKSTP residue:\n  ${hits.join('\n  ')}`);
});

test('the export\'s "25 Aug" / "reopening" never appears — expectedReturn:null is no date', () => {
  const hits: string[] = [];
  for (const f of handSrc()) {
    const body = stripComments(readFileSync(f, 'utf8')).toLowerCase();
    for (const term of INVENTED_DATES) if (body.includes(term)) hits.push(`${relative(APP_ROOT, f)} contains "${term}"`);
  }
  assert.deepEqual(hits, [], `invented date/return:\n  ${hits.join('\n  ')}`);
});

test('no facility NAME from the corpus is hard-coded in a component', () => {
  // Gather every facility name the fixtures carry, then prove none appears in
  // hand-written source — a facility value may live only in the generated corpus.
  const names = new Set<string>();
  for (const body of Object.values(CORPUS)) {
    JSON.stringify(body).replace(/"name":\{"en":"([^"]+)","zh-Hant":"([^"]+)"\}/g, (_, en, zh) => {
      names.add(en); names.add(zh); return '';
    });
  }
  assert.ok(names.size >= 4, 'no facility names were extracted — the check is vacuous');
  const hits: string[] = [];
  for (const f of handSrc()) {
    const body = readFileSync(f, 'utf8');
    for (const name of names) if (body.includes(name)) hits.push(`${relative(APP_ROOT, f)} hard-codes facility name "${name}"`);
  }
  assert.deepEqual(hits, [], `hard-coded facility value(s):\n  ${hits.join('\n  ')}`);
});
