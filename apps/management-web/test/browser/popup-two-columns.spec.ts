/**
 * Pop-up layout rule (PT, 2026-11-19): a read-only info pop-up is ONE column of label / value rows; only pop-ups and
 * forms with inputs use two columns (paired fields side by side, long fields on the whole row, one column when narrow).
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Info pop-ups (booking, charge, payment) assert ONE column; the forms (visitor invitation, Admin Lists, Admin email) keep the paired layout.
 *   0.1.0 (2026-11-19) New: booking pop-up, visitor invitation form.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;
const box = async (page: P, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, selector).not.toBeNull();
  return b!;
};
const sameRow = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y) < 6;
const FIRST_ROW = (page: P) => page.locator('tbody tr').first().locator('a, button').first();

/** Every value in the pop-up's detail list sits in one column: same left edge, each on its own row. */
async function expectOneColumn(page: P, dlSelector: string) {
  const xs = await page.locator(`${dlSelector} > dd, ${dlSelector} > div > dd`).evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; }));
  expect(xs.length).toBeGreaterThan(2);
  for (const v of xs) expect(Math.abs(v.x - xs[0]!.x)).toBeLessThan(2);
  const ys = xs.map((v) => v.y);
  expect(new Set(ys).size).toBe(ys.length);
}

for (const lang of ['en', 'zh-Hant', 'zh-Hans'] as const) {
  test(`Booking info pop-up in ${lang}: one column of label / value rows, start above end with the time zone under start, not oversized`, async ({ strictPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlFor(await appOrigin(), 'bookingsDetail', 'detail', lang), { waitUntil: 'load' });
    await expect(page.getByTestId('booking-facts')).toBeVisible();
    await expectOneColumn(page, '[data-testid="booking-facts"]');
    const start = await box(page, '[data-testid="booking-start"]');
    const end = await box(page, '[data-testid="booking-end"]');
    expect(end.y).toBeGreaterThan(start.y + start.height - 2);
    const tz = await box(page, '[data-testid="booking-timezone"]');
    expect(tz.y).toBeGreaterThan(start.y);
    expect(tz.y).toBeLessThan(end.y);
    const dialog = await box(page, '[data-testid="booking-dialog"]');
    expect(dialog.width).toBeLessThanOrEqual(762);
  });

  test(`Visitor invitation in ${lang}: name | host unit, expected from | until share rows; every field stacks when narrow`, async ({ strictPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlFor(await appOrigin(), 'visitorRegister', 'default', lang), { waitUntil: 'load' });
    await expect(page.getByTestId('vis-name')).toBeVisible();
    const name = await box(page, '[data-testid="vis-name"]');
    const unit = await box(page, '[data-testid="vis-host-unit"]');
    expect(sameRow(name, unit)).toBe(true);
    const from = await box(page, '[data-testid="vis-window-start"]');
    const until = await box(page, '[data-testid="vis-window-end"]');
    expect(sameRow(from, until)).toBe(true);
    expect(until.x).toBeGreaterThan(from.x + 150);
    await page.setViewportSize({ width: 640, height: 900 });
    const n2 = await box(page, '[data-testid="vis-name"]');
    const u2 = await box(page, '[data-testid="vis-host-unit"]');
    expect(u2.y).toBeGreaterThan(n2.y + 30);
    expect(Math.abs(u2.x - n2.x)).toBeLessThan(2);
  });
}

test('Payment info pop-up: one column of label / value rows', async ({ strictPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor(await appOrigin(), 'payments', 'default', 'en'), { waitUntil: 'load' });
  await FIRST_ROW(page).click();
  await expect(page.getByTestId('payment-facts')).toBeVisible();
  await expectOneColumn(page, '[data-testid="payment-facts"]');
  expect((await box(page, '[data-testid="payment-dialog"], [role=dialog]')).width).toBeLessThanOrEqual(762);
});

test('Charge info pop-up: one column of label / value rows', async ({ strictPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor(await appOrigin(), 'chargesDetail', 'detail', 'en') + '&charge=chg_wfg_a1_202609', { waitUntil: 'load' });
  await expect(page.getByTestId('charge-facts')).toBeVisible();
  await expectOneColumn(page, '[data-testid="charge-facts"]');
  expect((await box(page, '[role=dialog]')).width).toBeLessThanOrEqual(762);
});

for (const lang of ['en', 'zh-Hant'] as const) {
  test(`Admin Lists add pop-up in ${lang}: English | Traditional Chinese side by side, narrow window stacks them`, async ({ strictPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlFor(await appOrigin(), 'adminLists', 'default', lang), { waitUntil: 'load' });
    await page.getByTestId('lists-add').click();
    await expect(page.getByTestId('lists-dialog')).toBeVisible();
    const en = await box(page, '[data-testid="lists-label-en"]');
    const hant = await box(page, '[data-testid="lists-label-zh-Hant"]');
    expect(sameRow(en, hant)).toBe(true);
    await page.setViewportSize({ width: 640, height: 900 });
    const e2 = await box(page, '[data-testid="lists-label-en"]');
    const h2 = await box(page, '[data-testid="lists-label-zh-Hant"]');
    expect(h2.y).toBeGreaterThan(e2.y + 30);
  });
}

test('Admin email form: host | port and from name | from address share rows on a wide window, stack on a narrow one', async ({ strictPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor(await appOrigin(), 'adminEmail', 'default', 'en'), { waitUntil: 'load' });
  const host = await box(page, '[data-testid="admin-email-host"]');
  const port = await box(page, '[data-testid="admin-email-port"]');
  const fromName = await box(page, '[data-testid="admin-email-from-name"]');
  const fromAddress = await box(page, '[data-testid="admin-email-from-address"]');
  expect(sameRow(host, port)).toBe(true);
  expect(sameRow(fromName, fromAddress)).toBe(true);
  await page.setViewportSize({ width: 800, height: 900 });
  const h2 = await box(page, '[data-testid="admin-email-host"]');
  const p2 = await box(page, '[data-testid="admin-email-port"]');
  expect(p2.y).toBeGreaterThan(h2.y + 30);
});
