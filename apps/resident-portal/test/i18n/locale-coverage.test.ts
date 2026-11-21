/**
 * Three languages, no gaps (COPA S01, 8.3.8): English, Traditional Chinese and Simplified Chinese.
 * Same rules as the management app's suite: nothing missing, no Traditional-only characters in a Simplified
 * string, no branch on the Traditional locale alone.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, bcp47, isLocale, t } from '../../src/i18n/locale.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const TRAD_ONLY = new Set([...(JSON.parse(readFileSync(join(import.meta.dirname, 'traditional-only-chars.json'), 'utf8')).chars as string)]);

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => typeof v === 'object' && v !== null && !Array.isArray(v);

function leaves(node: unknown, path: string, out: Array<{ path: string; text: Bag }> = []): Array<{ path: string; text: Bag }> {
  if (Array.isArray(node)) node.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  else if (isBag(node)) {
    if (typeof node.en === 'string' && typeof node['zh-Hant'] === 'string') out.push({ path, text: node });
    else for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

test('the locale model has three languages', () => {
  assert.deepEqual([...LOCALES], ['en', 'zh-Hant', 'zh-Hans']);
  for (const l of LOCALES) assert.equal(isLocale(l), true, l);
  assert.equal(bcp47('zh-Hans'), 'zh-Hans-CN');
  assert.equal(t({ en: 'a', 'zh-Hant': '繁' }, 'zh-Hans'), '繁', 'Simplified falls back to Traditional, never to English');
});

test('every portal message is present in all three languages, and Simplified holds no Traditional-only character', () => {
  const all = leaves(MESSAGES, 'MESSAGES');
  assert.ok(all.length > 300, `walked ${all.length} messages`);
  const bad: string[] = [];
  for (const { path, text } of all) {
    for (const l of LOCALES) {
      const v = text[l];
      if (typeof v !== 'string' || v.trim() === '') bad.push(`${path} is missing ${l}`);
    }
    const hans = text['zh-Hans'];
    if (typeof hans === 'string') {
      const stray = [...new Set([...hans].filter((c) => TRAD_ONLY.has(c)))];
      if (stray.length) bad.push(`${path}: ${stray.join('')} in ${hans.slice(0, 40)}`);
    }
  }
  assert.deepEqual(bad, []);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.slice(ROOT.length + 1).split('\\').join('/');

test('no source branches on the Traditional locale alone, which would show Simplified readers English', () => {
  const offenders: string[] = [];
  for (const file of walk(join(ROOT, 'src'))) {
    if (rel(file) === 'src/i18n/locale.ts') continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/\blocale\s*[!=]==\s*'zh-Hant'/.test(line)) offenders.push(`${rel(file)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], "use pick(locale, {…}), isChinese(locale) or t(text, locale)");
});
