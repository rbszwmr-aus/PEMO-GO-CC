/**
 * Can this host actually draw the script this product renders?
 *
 * UI-019-ST finding F3. The stack of absences behind a typography assertion is:
 *
 *     no test -> no assertion -> no layout engine -> no font -> no glyph
 *
 * and EACH ABSENCE LOOKS EXACTLY LIKE SUCCESS. Choosing a real browser over
 * jsdom bought one layer of that stack and not the rest: a width-based
 * "Traditional Chinese fits its cell" assertion is green on a host with no CJK
 * font, because tofu has a perfectly reasonable advance width.
 *
 * THE INSTRUMENT
 *
 * A differential against a reference whose answer is known. U+E000 is in the
 * Private Use Area: no font ships a glyph for it, so its rendered width IS the
 * width of "this glyph is missing" on whatever font stack is in play. If a
 * Chinese character measures the same, the character is missing too.
 *
 * This does not ask what font resolved, or trust a font name, or compare against
 * a recorded number. It asks the renderer a question it cannot answer wrongly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT, loadCorpus } from './corpus-source.ts';

/** A glyph no font provides. The reference end of the differential. */
export const MISSING_GLYPH_REFERENCE = '';

const CJK = /[㐀-䶿一-鿿豈-﫿]/gu;

/**
 * Every CJK codepoint this product can put on screen: the corpus's zh-Hant
 * strings plus the client-authored copy. The set is derived, never listed —
 * a hand-kept list would drift the moment a fixture or a string changed.
 */
export function renderedCjkCodepoints(): string[] {
  const found = new Set<string>();

  const { files } = loadCorpus();
  for (const body of files.values()) {
    for (const ch of JSON.stringify(body).match(CJK) ?? []) found.add(ch);
  }

  // Client-authored copy, read as source: these strings are not in the corpus.
  for (const rel of ['src/i18n/messages.ts', 'src/data/states.ts']) {
    const src = readFileSync(join(APP_ROOT, rel), 'utf8');
    for (const ch of src.match(CJK) ?? []) found.add(ch);
  }

  return [...found].sort();
}

export interface FontVerdict {
  capable: boolean;
  missingWidth: number;
  sampled: number;
  tofu: string[];
}

/**
 * Measure inside an already-open page. Takes an evaluator so the same logic
 * serves the Playwright suite and the standalone CLI without duplicating it.
 */
export async function measure(
  evaluate: (fn: (args: { chars: string[]; ref: string; font: string }) => number[], args: { chars: string[]; ref: string; font: string }) => Promise<number[]>,
  chars: string[],
  fontStack: string,
): Promise<FontVerdict> {
  const widths = await evaluate(
    ({ chars, ref, font }) => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:64px ${font}`;
      document.body.appendChild(span);
      const widthOf = (s: string): number => { span.textContent = s; return span.getBoundingClientRect().width; };
      const out = [widthOf(ref), ...chars.map(widthOf)];
      span.remove();
      return out;
    },
    { chars, ref: MISSING_GLYPH_REFERENCE, font: fontStack },
  );

  const missingWidth = widths[0] as number;
  const tofu: string[] = [];
  chars.forEach((ch, i) => {
    if (Math.abs((widths[i + 1] as number) - missingWidth) < 0.5) tofu.push(ch);
  });

  return { capable: tofu.length === 0, missingWidth, sampled: chars.length, tofu };
}

/* ------------------------------------------------------------------ CLI */

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const { chromium } = await import('@playwright/test');
  const chars = renderedCjkCodepoints();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const fontStack = '"Libre Franklin","Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
  const verdict = await measure((fn, args) => page.evaluate(fn, args), chars, fontStack);
  await browser.close();

  console.log('PEMO font capability check — UI-019-ST F3');
  console.log('');
  console.log(`  font stack        : ${fontStack}`);
  console.log(`  CJK codepoints    : ${verdict.sampled} (derived from the corpus and client copy)`);
  console.log(`  missing-glyph ref : U+E000 measures ${verdict.missingWidth.toFixed(2)}px at 64px`);
  console.log(`  rendered as tofu  : ${verdict.tofu.length}`);
  console.log('');
  if (verdict.capable) {
    console.log('  VERDICT: CAPABLE — every rendered CJK codepoint has a real glyph.');
  } else {
    console.log('  VERDICT: NOT CAPABLE — this host cannot draw the script this product renders.');
    console.log(`  sample of tofu    : ${verdict.tofu.slice(0, 40).join('')}`);
    console.log('');
    console.log('  Install the specified face (design system v2.0 section 4.1):');
    console.log('      sudo apt install -y fonts-noto-cjk');
    console.log('');
    console.log('  Typography assertions on this host would be green and meaningless:');
    console.log('  tofu has a perfectly reasonable advance width.');
  }
  process.exit(verdict.capable ? 0 : 1);
}
