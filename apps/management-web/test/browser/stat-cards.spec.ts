/**
 * Stat cards on the list pages: a card that has a target filters the table to exactly the number it shows,
 * lights up, shows a Clear chip, and clears; a card with no target is not a button.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;

const PAGES: Array<{ screen: string; table: string; press: string; plain?: string }> = [
  { screen: 'bookings', table: 'bookings-table', press: 'confirmed' },
  { screen: 'charges', table: 'charges-table', press: 'overdue' },
  { screen: 'payments', table: 'payments-table', press: 'cheque' },
  { screen: 'refunds', table: 'refunds-table', press: 'issued' },
  { screen: 'residents', table: 'residents-table', press: 'verified' },
  { screen: 'households', table: 'households-table', press: 'multiMember', plain: 'withCaregiver' },
  { screen: 's4', table: 's4-table', press: 'open', plain: 'assignedToMe' },
  { screen: 'documents', table: 'documents-table', press: 'circular' },
  { screen: 'adminUsers', table: 'admin-users-table', press: 'active' },
  { screen: 's1', table: 's1-table', press: 'action' },
  { screen: 's5', table: 's5-table', press: 'live' },
  { screen: 'bookingCheckin', table: 'booking-checkin-table', press: 'confirmed' },
];

const card = (page: P, id: string) => page.locator(`[data-testid="stat-card"][data-stat="${id}"]`);

for (const p of PAGES) {
  test(`Stat cards on ${p.screen}: the pressed card shows exactly its number of rows, lights, shows Clear, and a target-less card is plain`, async ({ strictPage: page }) => {
    await page.goto(urlFor(await appOrigin(), p.screen, 'default', 'en'), { waitUntil: 'load' });
    const target = card(page, p.press);
    await expect(target).toBeVisible();
    const n = Number(await target.getByTestId('stat-card-value').innerText());
    await target.click();
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-row')).toBeVisible();
    await expect(page.locator(`[data-testid="${p.table}"] tbody tr`)).toHaveCount(n);
    await page.getByTestId('filter-clear').click();
    await expect(page.getByTestId('filter-row')).toHaveCount(0);
    await expect(target).toHaveAttribute('aria-pressed', 'false');
    if (p.plain) {
      const plain = card(page, p.plain);
      await expect(plain).toBeVisible();
      expect(await plain.evaluate((el) => el.tagName)).toBe('DIV');
    }
  });
}

test('Overview cards go to their page without a pressed state, including the fourth, units in an unknown state', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  const cards = page.getByTestId('stat-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(4);
  expect(await page.locator('[data-testid="stat-card"][aria-pressed]').count()).toBe(0);
  for (const id of ['open-cases', 'safety-events-window', 'notices-active', 'units-unknown-state']) {
    expect(await card(page, id).evaluate((el) => el.tagName)).toBe('BUTTON');
  }
  await card(page, 'units-unknown-state').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('s3');
});
