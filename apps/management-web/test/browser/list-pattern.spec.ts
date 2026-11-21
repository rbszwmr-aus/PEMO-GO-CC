/**
 * The Visits pattern on every status-based list page: L2 tabs with counts that equal the rows shown,
 * one search that persists across tabs, Clear filters only while something is active, sortable headers.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New. Home Safety events first; each migrated list adds a row.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const LIST_PAGES: Array<{ screen: string; table: string; tabs: string; filters: string; second: string }> = [
  { screen: 's1', table: 's1-table', tabs: 's1-status', filters: 's1-filters', second: 'action' },
  { screen: 'bookings', table: 'bookings-table', tabs: 'booking-status', filters: 'bookings-bar', second: 'confirmed' },
  { screen: 'charges', table: 'charges-table', tabs: 'charge-status', filters: 'charges-bar', second: 'overdue' },
  { screen: 'payments', table: 'payments-table', tabs: 'payment-status', filters: 'payments-bar', second: 'cheque' },
  { screen: 'refunds', table: 'refunds-table', tabs: 'refund-status', filters: 'refunds-bar', second: 'issued' },
  { screen: 's4', table: 's4-table', tabs: 's4-status', filters: 's4-filters', second: 'open' },
  { screen: 'documents', table: 'documents-table', tabs: 'document-status', filters: 'documents-bar', second: 'circular' },
  { screen: 'residents', table: 'residents-table', tabs: 'resident-status', filters: 'residents-filters', second: 'invited' },
  { screen: 'households', table: 'households-table', tabs: 'household-status', filters: 'households-filters', second: 'multiMember' },
  { screen: 's5', table: 's5-table', tabs: 's5-status', filters: 's5-filters', second: 'live' },
  { screen: 'bookingCheckin', table: 'booking-checkin-table', tabs: 'checkin-status', filters: 'checkin-filters', second: 'confirmed' },
  { screen: 'adminUsers', table: 'admin-users-table', tabs: 'admin-user-status', filters: 'admin-users', second: 'inactive' },
  { screen: 'helpdesk', table: 'helpdesk-queue', tabs: 'helpdesk-status', filters: 'helpdesk-bar', second: 'waiting' },
];

for (const p of LIST_PAGES) {
  test(`List pattern on ${p.screen}: tab counts equal rows, search persists across tabs, Clear only while active, headers sort`, async ({ strictPage: page }) => {
    // The help desk asks the portal-ticket API for its desk counts; a static host answers 404, so answer it empty.
    if (p.screen === 'helpdesk') await page.route('**/helpdesk/portal-tickets*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tickets: [] }) }));
    await page.goto(urlFor(await appOrigin(), p.screen, 'default', 'en'), { waitUntil: 'load' });
    const tab = (id: string) => page.locator(`[data-testid="${p.tabs}-tab"][data-tab="${id}"]`);
    const rows = page.locator(`[data-testid="${p.table}"] tbody tr`);
    await expect(page.getByTestId(`${p.filters}-clear`)).toHaveCount(0);

    const n = Number(await tab(p.second).getByTestId(`${p.tabs}-tab-count`).innerText());
    await tab(p.second).click();
    await expect(tab(p.second)).toHaveAttribute('aria-selected', 'true');
    await expect(rows).toHaveCount(n);

    await page.getByTestId(`${p.filters}-search`).fill('zzzz');
    await expect(page.getByTestId(`${p.filters}-clear`)).toBeVisible();
    await tab('all').click();
    await expect(page.getByTestId(`${p.filters}-search`)).toHaveValue('zzzz');
    await page.getByTestId(`${p.filters}-clear`).click();
    await expect(page.getByTestId(`${p.filters}-search`)).toHaveValue('');
    await expect(page.getByTestId(`${p.filters}-clear`)).toHaveCount(0);

    const first = page.locator(`[data-testid="${p.table}"] thead th[aria-sort="none"] button`).first();
    await first.click();
    await expect(page.locator(`[data-testid="${p.table}"] thead th[aria-sort="ascending"]`)).toHaveCount(1);
  });
}
