/**
 * L2 button tabs are two lines: icon and title side by side, the count pill centred under them. Short labels never wrap.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const CASES: Array<{ screen: string; root: string }> = [
  { screen: 'charges', root: 'charge-status' },
  { screen: 'visitorLog', root: 'visitor-status' },
];

for (const { screen, root } of CASES) {
  for (const width of [1440, 1024]) {
    for (const lang of ['en', 'zh-Hant'] as const) {
      test(`Button tabs on ${screen} at ${width} in ${lang}: icon and title on one line, the count centred on the line under, no wrapped title`, async ({ strictPage: page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(urlFor(await appOrigin(), screen, 'default', lang), { waitUntil: 'load' });
        await expect(page.locator(`[id^="${root}-tab-"]`).first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        // Measured in one pass, so a late font swap cannot skew one box against another.
        const rects = await page.evaluate((r) => {
          const box = (el: Element | null) => { const b = el!.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
          return [...document.querySelectorAll(`[id^="${r}-tab-"]`)].map((tab) => ({
            tab: box(tab),
            head: box(tab.querySelector('.pemo-buttontab__head')),
            icon: box(tab.querySelector('.pemo-buttontab__head svg')),
            label: box(tab.querySelector('.pemo-tab__label')),
            count: box(tab.querySelector('.pemo-tab__count')),
          }));
        }, root);
        expect(rects.length).toBeGreaterThanOrEqual(3);
        for (const { tab, head, icon, label, count } of rects) {
          // one line of text, with the icon beside the title
          expect(label.h).toBeLessThan(26);
          expect(Math.abs(icon.y + icon.h / 2 - (label.y + label.h / 2))).toBeLessThan(6);
          expect(icon.x + icon.w).toBeLessThanOrEqual(label.x + 1);
          // the count is under the head and centred on it; two lines in all
          expect(count.y).toBeGreaterThanOrEqual(head.y + head.h - 1);
          expect(Math.abs(count.x + count.w / 2 - (head.x + head.w / 2))).toBeLessThan(2);
          expect(tab.h).toBeLessThan(80);
        }
      });
    }
  }
}

test('Button tabs keep their roles, the selected tint and the overdue highlight', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'charges', 'default', 'en'), { waitUntil: 'load' });
  const list = page.getByTestId('charge-status-tabs');
  await expect(list).toHaveAttribute('role', 'tablist');
  const selected = page.locator('[data-testid="charge-status-tab"][aria-selected="true"]');
  await expect(selected).toHaveCount(1);
  await expect(page.locator('[data-testid="charge-status-tab-count"][data-alert="true"]').first()).toBeVisible();
  await page.locator('[data-testid="charge-status-tab"][data-tab="paid"]').click();
  await expect(page.locator('[data-testid="charge-status-tab"][data-tab="paid"]')).toHaveAttribute('aria-selected', 'true');
});
