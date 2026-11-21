/**
 * No colour literal in hand-written source.
 *
 * Severity colour comes from severity.json; the rest comes from
 * tokens/palette.json, which is data and is parity-checked. Both arrive in
 * source only through generated files. Anything else is a one-off colour, which
 * design system section 19 forbids — and a one-off colour is what made the
 * original design-system-versus-export adjudication nearly impossible to scope.
 *
 * The scan covers src, tool and test. Generated files and the token data are the
 * only exemptions, and they are named rather than pattern-matched loosely.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';

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
      continue; // the directory does not exist yet
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

  assert.deepEqual(
    offences,
    [],
    `colour literals must come from severity.json or tokens/palette.json:\n  ${offences.join('\n  ')}`,
  );
});

test('the scan actually reaches files — it cannot pass by scanning nothing', () => {
  // A scan that silently walks an empty tree is green and worthless. This is the
  // same class of defect as a test suite that reaches no server.
  let count = 0;
  for (const dir of SCANNED_DIRS) {
    try {
      count += walk(join(APP_ROOT, dir)).length;
    } catch {
      /* not yet created */
    }
  }
  assert.ok(count >= 6, `the scan found only ${count} files; it is not reaching the source tree`);
});

test('generated colour files exist and DO carry colour — the exemption is real, not vacuous', () => {
  const gen = readFileSync(join(APP_ROOT, 'src/theme/severity-tokens.g.css'), 'utf8');
  assert.ok(/#[0-9A-Fa-f]{6}/.test(gen), 'the generated file carries no colour; generation is broken');
});
