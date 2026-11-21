/**
 * Three languages, no gaps: English, Traditional Chinese and Simplified Chinese (COPA S01, 8.3.8).
 *
 * The build fails here when a string is missing in any language, when a Simplified string still holds a
 * Traditional-only character, or when code branches on `locale === 'zh-Hant'` and so would show Simplified
 * readers English. `Copy` (src/i18n/locale.ts) makes the first of these a type error for client copy; this suite
 * is the second line, and it also covers the fixtures and the source text the type system cannot see.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, bcp47, isLocale, t } from '../../src/i18n/locale.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { NAV_IA } from '../../src/data/nav-ia.ts';
import { HELPDESK_QUEUE, HELPDESK_STATS } from '../../src/data/helpdesk-fixtures.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const TRAD_ONLY = new Set([...(JSON.parse(readFileSync(join(import.meta.dirname, 'traditional-only-chars.json'), 'utf8')).chars as string)]);

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every localized leaf under a value: an object that carries `en` and `zh-Hant`. */
function leaves(node: unknown, path: string, out: Array<{ path: string; text: Bag }> = []): Array<{ path: string; text: Bag }> {
  if (Array.isArray(node)) node.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  else if (isBag(node)) {
    if (typeof node.en === 'string' && typeof node['zh-Hant'] === 'string') out.push({ path, text: node });
    else for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

const tradOnlyIn = (s: string): string[] => [...new Set([...s].filter((c) => TRAD_ONLY.has(c)))];

test('the locale model has three languages and the URL value round-trips', () => {
  assert.deepEqual([...LOCALES], ['en', 'zh-Hant', 'zh-Hans']);
  for (const l of LOCALES) assert.equal(isLocale(l), true, l);
  assert.equal(isLocale('zh'), false);
  assert.equal(bcp47('zh-Hans'), 'zh-Hans-CN');
  assert.equal(t({ en: 'a', 'zh-Hant': '繁' }, 'zh-Hans'), '繁', 'Simplified falls back to Traditional, never to English');
  assert.equal(t({ en: 'a', 'zh-Hant': '繁', 'zh-Hans': '简' }, 'zh-Hans'), '简');
});

test('every client message is present and non-empty in all three languages', () => {
  const all = leaves(MESSAGES, 'MESSAGES');
  assert.ok(all.length > 1000, `walked ${all.length} messages`);
  const gaps: string[] = [];
  for (const { path, text } of all) {
    for (const l of LOCALES) {
      const v = text[l];
      if (typeof v !== 'string' || v.trim() === '') gaps.push(`${path} is missing ${l}`);
    }
  }
  assert.deepEqual(gaps, []);
});

test('Simplified strings hold no Traditional-only characters', () => {
  const modules: Array<[string, unknown]> = [
    ['MESSAGES', MESSAGES], ['NAV_IA', NAV_IA], ['HELPDESK_QUEUE', HELPDESK_QUEUE], ['HELPDESK_STATS', HELPDESK_STATS],
  ];
  const bad: string[] = [];
  for (const [name, mod] of modules) {
    for (const { path, text } of leaves(mod, name)) {
      const hans = text['zh-Hans'];
      if (typeof hans !== 'string') { bad.push(`${path}: no zh-Hans`); continue; }
      const stray = tradOnlyIn(hans);
      if (stray.length) bad.push(`${path}: ${stray.join('')} in ${hans.slice(0, 40)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the nav and the help desk fixtures are fully translated', () => {
  const missing = [...leaves(NAV_IA, 'NAV_IA'), ...leaves(HELPDESK_QUEUE, 'HELPDESK_QUEUE'), ...leaves(HELPDESK_STATS, 'HELPDESK_STATS')]
    .filter(({ text }) => typeof text['zh-Hans'] !== 'string' || text['zh-Hans'] === '')
    .map(({ path }) => path);
  assert.deepEqual(missing, []);
});

/** Files whose strings come from the Backend contract or an API-shaped corpus: they carry en + zh-Hant, and zh-Hans falls back. */
const API_SHAPED = new Set([
  'src/data/corpus.g.ts', 'src/data/households-corpus.ts', 'src/data/residents-corpus.ts', 'src/data/notices-wfg-corpus.ts',
  'src/data/documents-corpus.ts', 'src/data/types.ts', 'src/data/admin-email-corpus.ts', 'src/i18n/locale.ts', 'src/data/notice-reasons.g.ts',
  'src/theme/severity-tokens.g.ts', 'src/data/unreadable-problem.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.slice(ROOT.length + 1).split('\\').join('/');

/** Index just past the string literal that opens at `i` (single, double or template, with nested ${…}). */
function endOfLiteral(src: string, i: number): number {
  const q = src[i]!;
  let j = i + 1;
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') j += 2;
    else if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
    } else j += 1;
  }
  return j + 1;
}

test('no object literal in src carries zh-Hant without zh-Hans right after it, outside the API-shaped corpora', () => {
  const offenders: string[] = [];
  for (const file of walk(join(ROOT, 'src'))) {
    if (API_SHAPED.has(rel(file))) continue;
    const src = readFileSync(file, 'utf8');
    // A property `{ 'zh-Hant': '…' }` or `, 'zh-Hant': '…'` is a value. A type (`'zh-Hant': string`), a lookup (`['zh-Hant']`)
    // and a ternary (`? 'zh-Hant' : 'en'`) are not.
    for (const m of src.matchAll(/[{,]\s*['"]zh-Hant['"]\s*:\s*(?=['"`])/g)) {
      const start = m.index + m[0].length;
      const after = src.slice(endOfLiteral(src, start), endOfLiteral(src, start) + 80);
      if (!/^\s*,\s*['"]zh-Hans['"]\s*:/.test(after)) offenders.push(`${rel(file)}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(offenders, [], 'add a zh-Hans string beside each zh-Hant one (or move the file into API_SHAPED with a reason)');
});

test('no source branches on the Traditional locale alone, which would show Simplified readers English', () => {
  const offenders: string[] = [];
  for (const file of walk(join(ROOT, 'src'))) {
    if (rel(file) === 'src/i18n/locale.ts') continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\blocale\s*[!=]==\s*'zh-Hant'/.test(line)) offenders.push(`${rel(file)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], "use pick(locale, {…}), isChinese(locale) or t(text, locale) instead of locale === 'zh-Hant'");
});
