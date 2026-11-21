/**
 * USER-VISIBLE TEXT TYPED STRAIGHT INTO JSX — caught here, because nothing else
 * catches it.
 *
 * FOUND BY TRYING TO MAKE A GUARD FAIL. UI-045 mutated a panel heading into a
 * bare JSX literal, expecting `client-copy-scan.test.ts` to redden, and the suite
 * stayed GREEN. That scan walks MESSAGES; the data-claim register walks MESSAGES;
 * the forbidden-terms boundary walks MESSAGES. A string that never enters MESSAGES
 * is invisible to all three — it cannot be translated, cannot be classified, and
 * cannot be scanned for the terms this surface must not use.
 *
 * So the mutation did not prove the assertion. It proved the assertion had a hole,
 * which is the entire reason for making assertions fail on purpose.
 *
 * THE ALLOW-LIST IS ENDONYMS ONLY, AND IT IS ASSERTED TO STAY THAT WAY. A language
 * names itself in its own script in both locales — that is what an endonym is, and
 * routing `English` through an en/zh-Hant pair would ask for a translation of a
 * word that must not be translated. Shell.tsx's ENG / 繁 / 简 tab is the same case
 * and the same decision.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..', '..', 'src');

/** Untranslatable by nature: a language's name in its own script. */
const ENDONYMS = new Set(['ENG', '繁', '简', 'English', '繁體中文']);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (e.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * JSX text nodes: text between a tag's `>` and a CLOSING `</`, on one line, with
 * no braces and at least one letter.
 *
 * ITS LIMITS, STATED. Requiring the closing `</` is what keeps `=>` and numeric
 * comparisons out; a first version without it reported every arrow function in
 * app.tsx, and a check that cries wolf is one nobody reads. The cost is that text
 * split across lines, or followed by an element rather than a close, is not seen.
 * This is a heuristic over source text, not a parser, and it is written down as
 * one — the two control tests below exist so it can never quietly match nothing.
 */
function jsxTextNodes(source: string): string[] {
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  for (const m of body.matchAll(/(?<![=!<>-])>\s*([^<>{}\n]*?[A-Za-z\u4e00-\u9fff][^<>{}\n]*?)\s*<\//g)) {
    const text = (m[1] as string).trim();
    if (text) found.push(text);
  }
  return found;
}

test('the scanner finds text at all — an empty scanner agrees with everything', () => {
  const sample = '<h2 className="x">Sensor reading history</h2><p>{t(M.a, l)}</p>';
  assert.deepEqual(jsxTextNodes(sample), ['Sensor reading history']);
});

test('the scanner ignores interpolated text, which is where real copy lives', () => {
  assert.deepEqual(jsxTextNodes('<span>{t(MESSAGES.s5.title, locale)}</span>'), []);
  // The false positive that made the first version useless.
  assert.deepEqual(jsxTextNodes('const f = (a) => a.filter((s) => s.id === state);'), []);
});

test('NO user-visible string is typed directly into JSX', () => {
  const offences: string[] = [];
  for (const file of tsxFiles(SRC)) {
    for (const text of jsxTextNodes(readFileSync(file, 'utf8'))) {
      if (ENDONYMS.has(text)) continue;
      offences.push(`${file.slice(SRC.length + 1)}: "${text}"`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    'user-visible text bypassed MESSAGES, so it cannot be translated, classified or ' +
      `scanned for forbidden terms:\n  ${offences.join('\n  ')}`,
  );
});

test('the allow-list is endonyms only, and stays small', () => {
  // A growing allow-list is how this check would quietly stop meaning anything.
  assert.ok(ENDONYMS.size <= 6, `the endonym allow-list has grown to ${ENDONYMS.size}`);
  for (const e of ENDONYMS) {
    assert.ok(e.length <= 8, `"${e}" is too long to be a language endonym`);
  }
});
