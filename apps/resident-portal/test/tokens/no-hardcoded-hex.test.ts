/**
 * No colour literal in hand-written source (PID test 3).
 *
 * Severity colour comes from severity.json; the rest from tokens/palette.json.
 * Both arrive in source only through generated files. Anything else is a one-off
 * colour, which design system section 19 forbids. The scan covers src, tool and
 * test; generated files and the token data are the only exemptions, named rather
 * than pattern-matched loosely.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/tokens-source.ts';

const SCANNED_DIRS = ['src', 'tool', 'test'];
const EXEMPT = (rel: string) =>
  /\.g\.(ts|tsx|css)$/.test(rel) || rel === join('tokens', 'palette.json');

const COLOUR_LITERALS: Array<{ name: string; re: RegExp }> = [
  { name: 'hex colour', re: /#[0-9A-Fa-f]{3,8}\b/g },
  { name: 'rgb()/rgba() literal', re: /\brgba?\(\s*\d+[\s,]/g },
  { name: 'hsl()/hsla() literal', re: /\bhsla?\(\s*\d+/g },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

test('no colour literal appears in hand-written source', () => {
  const offences: string[] = [];
  for (const dir of SCANNED_DIRS) {
    let files: string[];
    try {
      files = walk(join(APP_ROOT, dir));
    } catch {
      continue;
    }
    for (const file of files) {
      const rel = relative(APP_ROOT, file);
      if (EXEMPT(rel)) continue;
      const body = readFileSync(file, 'utf8');
      for (const { name, re } of COLOUR_LITERALS) {
        for (const m of body.matchAll(re)) {
          const line = body.slice(0, m.index).split('\n').length;
          offences.push(`${rel}:${line} — ${name} ${m[0]}`);
        }
      }
    }
  }
  assert.deepEqual(offences, [], `colour literal(s) outside the theme:\n  ${offences.join('\n  ')}`);
});

test('the scan is not vacuous — it would catch a planted literal', () => {
  const sample = 'color: ' + String.fromCharCode(35) + '123456;';
  const hit = COLOUR_LITERALS.some(({ re }) => re.test(sample));
  assert.ok(hit, 'the hex scanner does not catch a planted six-digit hex');
});
