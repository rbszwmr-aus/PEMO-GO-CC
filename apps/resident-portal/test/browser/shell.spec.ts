/**
 * The shell matches the export's navigation architecture at all three breakpoints,
 * and the rulings hold in the rendered artefact.
 */

import { test, expect, appOrigin, urlFor } from './support/harness.ts';

async function widthOf(page: import('@playwright/test').Page, selector: string): Promise<number> {
  const box = await page.locator(selector).boundingBox();
  return box?.width ?? 0;
}

test('desktop >= 1080: a 228px persistent rail (4S guide), no hamburger', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor(base, {}));
  await expect(page.getByTestId('shell')).toHaveAttribute('data-breakpoint', 'desktop');
  expect(await widthOf(page, '[data-testid="rail"]')).toBe(228);
  await expect(page.getByTestId('menu-button')).toHaveCount(0);
});

test('tablet 760-1079: the rail narrows to 190px (4S guide)', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto(urlFor(base, {}));
  await expect(page.getByTestId('shell')).toHaveAttribute('data-breakpoint', 'tablet');
  expect(await widthOf(page, '[data-testid="rail"]')).toBe(190);
});

test('mobile < 760: rail hidden, hamburger opens a drawer with the same list, closes on select', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto(urlFor(base, {}));
  await expect(page.getByTestId('shell')).toHaveAttribute('data-breakpoint', 'mobile');
  await expect(page.getByTestId('rail')).toHaveCount(0);

  await expect(page.getByTestId('drawer')).toHaveCount(0);
  await page.getByTestId('menu-button').click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  // The same full list of eleven services.
  await expect(page.getByTestId('drawer-nav-item')).toHaveCount(11);

  await page.getByTestId('drawer-nav-item').filter({ hasText: 'Passes' }).first().click();
  await expect(page.getByTestId('drawer')).toHaveCount(0);
});

test('the sidebar carries all eleven services with LIVE/SOON tags; the portal opens on Explore', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, {}));
  await expect(page.getByTestId('rail-nav-item')).toHaveCount(11);
  // Nine live, two soon (notices + visitor + invoices shipped).
  await expect(page.locator('[data-testid="rail-nav-item"][data-tag="live"]')).toHaveCount(9);
  await expect(page.locator('[data-testid="rail-nav-item"][data-tag="soon"]')).toHaveCount(2);
  // Opens on Explore: the BOOKING subsystem, first tab.
  await expect(page.getByTestId('subsystem-code')).toHaveText('BOOKING');
  await expect(page.locator('[data-testid="subsystem-tab"][data-tab="explore"]')).toHaveAttribute('aria-selected', 'true');
  // No home grid / dashboard.
  await expect(page.getByTestId('home-grid')).toHaveCount(0);
});

test('a SOON service is present, tappable and opens a coming-soon panel — never a disabled control', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, {}));
  const access = page.locator('[data-testid="rail-nav-item"][data-service="access"]');
  await expect(access).toBeVisible();
  await expect(access).not.toBeDisabled();
  await access.click();
  await expect(page.getByTestId('coming-soon')).toBeVisible();
});

test('the coming-soon panel does NOT render inherits[] capability claims', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, { service: 'access', lang: 'en' }));
  const panel = page.getByTestId('coming-soon');
  await expect(panel).toBeVisible();
  const text = (await panel.innerText()).toLowerCase();
  // None of the UI-022 copy-claims class may reach a resident.
  for (const claim of ['qr pass component', 'payment gateway', 'idempotency', 'booking wizard', 'notification centre']) {
    expect(text, `coming-soon leaked an inherits[] capability claim: "${claim}"`).not.toContain(claim);
  }
});

test('the account menu is not rendered — deferred, not disabled, not coming-soon', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, {}));
  await expect(page.getByTestId('account-menu')).toHaveCount(0);
  // The notification bell IS present — INBOX is a live service.
  await expect(page.getByTestId('notification-bell')).toBeVisible();
});

test('the top bar carries no navigation links', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, {}));
  // The only anchor in the top bar is the brand home link; navigation is the sidebar.
  const topbarLinks = page.locator('[data-testid="topbar"] a');
  await expect(topbarLinks).toHaveCount(1);
});

test('bilingual: switching to 繁 sets the document language and renders Traditional Chinese', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, {}));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-HK');

  await page.locator('[data-testid="lang-switch"] [data-locale="zh-Hant"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-HK');
  // A known Traditional Chinese service label now shows.
  await expect(page.locator('[data-testid="rail-nav-item"][data-service="search"]')).toContainText('預訂設施');
});

test('badges reserve their space on badged tabs but render no count', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, { service: 'bookings', lang: 'en' }));
  // The Upcoming tab is badged in the export; the slot is reserved.
  const badged = page.locator('[data-testid="subsystem-tab"][data-tab="upcoming"] [data-testid="badge-slot"]');
  await expect(badged).toHaveCount(1);
  // It carries no digit — the count is data this PID does not render.
  await expect(badged).not.toContainText(/\d/);
});

test('the short code above a subsystem title is in the reader’s language: English keeps INVOICES, 繁 and 简 say 賬單 / 账单', async ({ page }) => {
  const base = await appOrigin();
  for (const [lang, code] of [['en', 'INVOICES'], ['zh-Hant', '賬單'], ['zh-Hans', '账单']] as const) {
    await page.goto(urlFor(base, { service: 'invoices', lang }), { waitUntil: 'load' });
    await expect(page.getByTestId('subsystem-code')).toHaveText(code);
  }
});
