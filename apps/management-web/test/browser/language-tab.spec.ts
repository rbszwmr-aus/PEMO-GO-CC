/**
 * The default header is the segmented tab from the 21 Aug HTML pack, not a
 * labelled language combo. ENG and 繁 still write `lang` on the URL. 简 does the same
 * with zh-Hans.
 *
 * Runs against dist/ via the harness. A mutation of source on disk is not
 * what this suite sees.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('default header is the segmented tab, not a language combobox', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  const tab = page.locator('[data-testid="locale-tab"]');
  await expect(tab).toBeVisible();
  await expect(page.locator('[data-testid="locale-seg"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="locale-seg"][data-locale="en"]')).toHaveText('EN');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="zh-Hant"]')).toHaveText('繁');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="zh-Hans"]')).toHaveText('简');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="en"]')).toHaveAttribute('aria-pressed', 'true');

  // Fail closed: if the tab is missing the assertions above fail, even when
  // the combo is also gone. Combo absence is the second half, not a substitute.
  await expect(page.locator('[data-testid="locale-select"]')).toHaveCount(0);
  await expect(page.locator('select[data-testid="locale-select"]')).toHaveCount(0);
  await expect(page.locator('.pemo-field', { hasText: /^(Language|語言)$/ })).toHaveCount(0);
});

test('ENG and 繁 still change locale via the URL', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Overview');

  await page.locator('[data-testid="locale-seg"][data-locale="zh-Hant"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('zh-Hant');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('總覽');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="zh-Hant"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="en"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).toHaveAttribute('lang', /zh-Hant/);

  await page.locator('[data-testid="locale-seg"][data-locale="en"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('en');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Overview');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="en"]')).toHaveAttribute('aria-pressed', 'true');
});

test('简 switches to Simplified Chinese through the URL and the choice survives navigation', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  const hans = page.locator('[data-testid="locale-seg"][data-locale="zh-Hans"]');
  await expect(hans).toBeEnabled();
  await expect(hans).toHaveAttribute('aria-pressed', 'false');

  await hans.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('zh-Hans');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('总览');
  await expect(hans).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid="locale-seg"][data-locale="zh-Hant"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).toHaveAttribute('lang', /zh-Hans/);

  // The choice rides on the URL like the other two: moving to another screen keeps it.
  await page.locator('[data-testid="nav-item"]', { hasText: '物业' }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('zh-Hans');
  await expect(page.locator('html')).toHaveAttribute('lang', /zh-Hans/);

  // A direct link with ?lang=zh-Hans opens in Simplified, set in a Simplified Chinese face.
  await page.goto(urlFor(base, 's2', 'default', 'zh-Hans'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('总览');
  const stack = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(stack, 'the Simplified page lost its Simplified Chinese face').toContain('Noto Sans SC');
});
