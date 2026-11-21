/**
 * 简 means 简 all the way down: the words the Backend sends in English and Traditional only are shown in
 * Simplified (i18n/hans.ts), the help desk timeline shows a time a person can read, and the nav says 登记 / 登記.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const TRAD_ONLY = new Set([...(JSON.parse(readFileSync(join(import.meta.dirname, '../i18n/traditional-only-chars.json'), 'utf8')).chars as string)]);

test('zh-Hans Overview: the data strings carry no Traditional-only character', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 's2', 'default', 'zh-Hans'), { waitUntil: 'load' });
  await expect(page.locator('main')).toBeVisible();
  const text = await page.locator('main').innerText();
  expect([...new Set([...text].filter((c) => TRAD_ONLY.has(c)))]).toEqual([]);
});

test('Help desk timeline: each turn shows a readable Hong Kong time, never the raw ISO string', async ({ strictPage: page }) => {
  for (const [lang, zone] of [['en', 'HKT'], ['zh-Hant', '香港時間'], ['zh-Hans', '香港时间']] as const) {
    await page.goto(urlFor(await appOrigin(), 'helpdeskDetail', 'detail', lang) + '&contact=hd_2026_0812_001', { waitUntil: 'load' });
    const times = page.locator('[data-testid="helpdesk-timeline-time"]');
    expect(await times.count()).toBeGreaterThan(0);
    for (const text of await times.allInnerTexts()) {
      expect(text, lang).toContain(zone);
      expect(text, lang).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  }
});

test('the Visitors nav item for registering says 登記 / 登记, as short as its English “Register”', async ({ strictPage: page }) => {
  for (const [lang, label] of [['en', 'Register'], ['zh-Hant', '登記'], ['zh-Hans', '登记']] as const) {
    await page.goto(urlFor(await appOrigin(), 'visitorRegister', 'blank', lang), { waitUntil: 'load' });
    await expect(page.locator('[data-testid="nav-item"][data-nav="visitor-register"]')).toHaveText(new RegExp(`${label}$`));
  }
});

test('the Facility booking nav item for check-in says 簽到 / 签到, not the Visitors word 登記', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'bookingCheckin', 'default', 'zh-Hant'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="nav-item"][data-nav="bk-checkin"]')).toHaveText(/簽到$/);
  await page.goto(urlFor(await appOrigin(), 'bookingCheckin', 'default', 'zh-Hans'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="nav-item"][data-nav="bk-checkin"]')).toHaveText(/签到$/);
});
