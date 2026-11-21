/**
 * THE ANTI-TOFU GUARD. It runs before every other browser project.
 *
 * UI-019-ST F3: the stack of absences behind a typography assertion is
 *     no test -> no assertion -> no layout engine -> no font -> no glyph
 * and each layer looks like success from above. A real browser bought one layer;
 * this buys the next. The instrument is a differential against U+E000, whose
 * answer is known: it asks the renderer a question it cannot answer wrongly.
 */

import { expect, test } from '@playwright/test';
import { measure, renderedCjkCodepoints, MISSING_GLYPH_REFERENCE } from '../../tool/font-capability.ts';
import { FONT_STACK } from './support/harness.ts';

test('this host can draw every CJK codepoint the portal renders', async ({ page }) => {
  await page.setContent('<!doctype html><body></body>');
  const chars = renderedCjkCodepoints();
  expect(chars.length, 'no CJK codepoints were derived from MESSAGES').toBeGreaterThan(50);

  const verdict = await measure((fn, args) => page.evaluate(fn, args), chars, FONT_STACK);
  expect(verdict.missingWidth, 'the missing-glyph reference measured zero — the probe is not rendering').toBeGreaterThan(0);
  expect(
    verdict.tofu,
    `${verdict.tofu.length} of ${verdict.sampled} CJK codepoints render as tofu (${verdict.missingWidth.toFixed(2)}px). ` +
      `Install fonts-noto-cjk. Sample: ${verdict.tofu.slice(0, 30).join('')}`,
  ).toEqual([]);
});

test('the probe itself is honest — a guaranteed-missing glyph IS detected as missing', async ({ page }) => {
  await page.setContent('<!doctype html><body></body>');
  const verdict = await measure(
    (fn, args) => page.evaluate(fn, args),
    [MISSING_GLYPH_REFERENCE, '\uE001'],
    FONT_STACK,
  );
  expect(verdict.tofu, 'a private-use codepoint was NOT detected as tofu; the probe cannot detect absence').toHaveLength(2);
  expect(verdict.capable).toBe(false);
});
