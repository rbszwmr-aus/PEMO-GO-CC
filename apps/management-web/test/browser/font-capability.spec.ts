/**
 * THE ANTI-TOFU GUARD. It runs before every other browser project.
 *
 * UI-019-ST F3: the stack of absences behind a typography assertion is
 *
 *     no test -> no assertion -> no layout engine -> no font -> no glyph
 *
 * and each layer looks exactly like success from above. Choosing a real browser
 * over jsdom bought ONE layer. This buys the next one.
 *
 * Installing the font fixed this host. THIS FIXES EVERY FUTURE HOST, which is
 * why it ships regardless of the install.
 *
 * The instrument is a differential against a reference whose answer is known:
 * U+E000 is Private Use, no font provides a glyph for it, so its rendered width
 * IS the width of "missing" on whatever stack is in play. It asks the renderer a
 * question it cannot answer wrongly — no font name is trusted and no recorded
 * number is compared against.
 */

import { expect, test } from '@playwright/test';
import { measure, renderedCjkCodepoints, MISSING_GLYPH_REFERENCE } from '../../tool/font-capability.ts';
import { FONT_STACK } from './support/harness.ts';

test('this host can draw every CJK codepoint the product renders', async ({ page }) => {
  await page.setContent('<!doctype html><body></body>');

  const chars = renderedCjkCodepoints();

  // The set must be derived and non-empty. An empty oracle agrees with
  // everything: zero codepoints would make "no tofu" trivially true.
  expect(chars.length, 'no CJK codepoints were derived from the corpus or the client copy').toBeGreaterThan(100);

  const verdict = await measure((fn, args) => page.evaluate(fn, args), chars, FONT_STACK);

  expect(verdict.missingWidth, 'the missing-glyph reference measured zero — the probe is not rendering').toBeGreaterThan(0);

  expect(
    verdict.tofu,
    `${verdict.tofu.length} of ${verdict.sampled} CJK codepoints render as tofu, identical in width to ` +
      `U+E000 (${verdict.missingWidth.toFixed(2)}px). This host cannot draw the script this product ` +
      `renders, so every typography assertion below would be green and meaningless.\n` +
      `Install the specified face: sudo apt install -y fonts-noto-cjk\n` +
      `Sample: ${verdict.tofu.slice(0, 30).join('')}`,
  ).toEqual([]);
});

test('the probe itself is honest — a guaranteed-missing glyph IS detected as missing', async ({ page }) => {
  // If this fails, the differential cannot distinguish anything and every
  // verdict above is worthless. It is the check on the check.
  await page.setContent('<!doctype html><body></body>');
  const verdict = await measure(
    (fn, args) => page.evaluate(fn, args),
    [MISSING_GLYPH_REFERENCE, ''],
    FONT_STACK,
  );
  expect(verdict.tofu, 'private-use codepoints were NOT detected as tofu; the probe cannot detect absence').toHaveLength(2);
  expect(verdict.capable).toBe(false);
});
