/**
 * The 4S style layer: not stale, equal to the guide, and AA where the guide
 * asks for it. Guide values live in style-4s.guide.json (data) so no colour
 * literal enters a .ts file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/tokens-source.ts';
import { buildStyle4sCss, readStyle4s, s4Variables } from '../../tool/generate-style-4s.ts';

const guide = JSON.parse(readFileSync(join(APP_ROOT, 'test/tokens/style-4s.guide.json'), 'utf8'));
const tokens = readStyle4s();

function luminance(hex: string): number {
  const h = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
function resolve(ref: string): string {
  const parts = ref.split('.');
  let v: any = parts[0] === 'tag' ? tokens.tags : parts[0] === 'sidebar' ? tokens.sidebar : tokens.colour;
  for (const p of parts[0] === 'tag' || parts[0] === 'sidebar' ? parts.slice(1) : parts) v = v[p];
  return v as string;
}

test('src/theme/style-4s.g.css is not stale', () => {
  const onDisk = readFileSync(join(APP_ROOT, 'src/theme/style-4s.g.css'), 'utf8');
  assert.equal(onDisk, buildStyle4sCss(tokens), 'run `pnpm run generate`');
});

test('every value the guide fixes is what the data says', () => {
  const drift: string[] = [];
  for (const [section, entries] of Object.entries<Record<string, any>>(guide.expect)) {
    for (const [k, want] of Object.entries(entries)) {
      const got = (tokens as any)[section][k];
      if (JSON.stringify(got) !== JSON.stringify(want)) drift.push(`${section}.${k}: ${JSON.stringify(got)} != guide ${JSON.stringify(want)}`);
    }
  }
  assert.deepEqual(drift, []);
});

test('every aliased legacy property points at a defined 4S token', () => {
  const defined = new Set(s4Variables(tokens).map(([n]) => n));
  for (const [alias, ref] of Object.entries<string>(tokens.aliases)) {
    const name = /var\((--s4-[a-z0-9-]+)\)/.exec(ref)?.[1];
    assert.ok(name && defined.has(name), `${alias} -> ${ref}`);
  }
});

test('declared text pairs meet WCAG AA', () => {
  const failures: string[] = [];
  for (const [fg, bg, min] of tokens.contrastPairs as Array<[string, string, number]>) {
    const ratio = contrast(resolve(fg), resolve(bg));
    if (ratio < min) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
  }
  assert.deepEqual(failures, []);
});

test('the guide secondary-text colour is kept but not used as a text colour', () => {
  assert.ok(contrast(resolve('secondaryText'), resolve('white')) < 4.5, 'guide secondary text fails AA on white: that is why secondaryTextAA exists');
  assert.ok(contrast(resolve('secondaryTextAA'), resolve('canvas')) >= 4.5);
  assert.equal(tokens.aliases['--pemo-neutral-500'], 'var(--s4-secondary-text-aa)');
});
