/**
 * Visits page: stat cards and L2 tabs drive one status filter, search persists
 * across tabs, each tab has its own default sort, and the Invitation and the
 * visit detail are L3 pop-ups, never page changes and never one on another.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;

const open = async (page: P, screen = 'visitorLog', state = 'default', lang: 'en' | 'zh-Hant' | 'zh-Hans' = 'en') => {
  await page.goto(urlFor(await appOrigin(), screen, state, lang), { waitUntil: 'load' });
  await expect(page.getByTestId('visitor-stats')).toBeVisible();
};
const tabCount = async (page: P, id: string) =>
  Number(await page.locator(`[data-testid="visitor-status-tab"][data-tab="${id}"] [data-testid="visitor-status-tab-count"]`).innerText());
const cardCount = async (page: P, id: string) =>
  Number(await page.locator(`[data-testid="stat-card"][data-stat="${id}"] [data-testid="stat-card-value"]`).innerText());
const rowCount = (page: P) => page.locator('[data-testid="visitor-table"] tbody tr').count();

test('Visits: a stat card and the tab with the same set show the same number, light together, and list exactly that many rows', async ({ strictPage: page }) => {
  await open(page);
  expect(await cardCount(page, 'expected-today')).toBe(await tabCount(page, 'expected'));
  expect(await cardCount(page, 'on-site')).toBe(await tabCount(page, 'onsite'));
  expect(await cardCount(page, 'not-signed-out')).toBe(await tabCount(page, 'overdue'));
  expect(await tabCount(page, 'all')).toBe(await rowCount(page));
  await expect(page.getByTestId('filter-row')).toHaveCount(0);

  const card = page.locator('[data-testid="stat-card"][data-stat="on-site"]');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid="visitor-status-tab"][data-tab="onsite"]')).toHaveAttribute('aria-selected', 'true');
  expect(await rowCount(page)).toBe(await cardCount(page, 'on-site'));
  await expect(page.getByTestId('filter-chip')).toContainText('On site');
  await expect(page.getByTestId('filter-count')).toContainText(`Showing ${await rowCount(page)} of`);

  await page.getByTestId('filter-clear').click();
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-testid="visitor-status-tab"][data-tab="all"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('filter-row')).toHaveCount(0);
});

test('Visits: Enter on a focused card filters, a tab click filters the same way, and a second press of the lit card clears it', async ({ strictPage: page }) => {
  await open(page);
  const card = page.locator('[data-testid="stat-card"][data-stat="expected-today"]');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(await rowCount(page)).toBe(await cardCount(page, 'expected-today'));
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'false');

  await page.locator('[data-testid="visitor-status-tab"][data-tab="overdue"]').click();
  await expect(page.locator('[data-testid="stat-card"][data-stat="not-signed-out"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await rowCount(page)).toBe(await cardCount(page, 'not-signed-out'));
});

test('Visits: the Approval tab and the Walk-in card are not shown, because Backend has no field for either', async ({ strictPage: page }) => {
  await open(page);
  await expect(page.getByTestId('visitor-status-tab')).toHaveText([/All visits/, /Expected/, /On site/, /Overdue checkout/]);
  await expect(page.locator('[data-testid="stat-card"]')).toHaveCount(3);
  await expect(page.locator('[data-stat="walk-in"]')).toHaveCount(0);
});

test('Visits: search stays when the tab changes, and each tab starts in its own order', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('visitor-filters-search').fill('a');
  await page.locator('[data-testid="visitor-status-tab"][data-tab="expected"]').click();
  await expect(page.getByTestId('visitor-filters-search')).toHaveValue('a');
  const th = page.locator('[data-testid="visitor-table"] thead th').filter({ has: page.getByTestId('sort-expected') });
  await expect(th).toHaveAttribute('aria-sort', 'ascending'); // soonest arrival first
  await page.getByTestId('sort-visitor').click();
  await page.locator('[data-testid="visitor-status-tab"][data-tab="onsite"]').click();
  await expect(th).toHaveAttribute('aria-sort', 'ascending'); // earliest check-in first; the click on Visitor was reset
  await page.locator('[data-testid="visitor-status-tab"][data-tab="all"]').click();
  await expect(th).toHaveAttribute('aria-sort', 'none'); // newest record first
});

test('Visits: Invitation is an L3 pop-up on the page; Escape closes it; the Register route is a deep link to the same pop-up', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('visitor-register-cta').click();
  const dlg = page.getByTestId('visitor-invitation');
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute('aria-label', 'Visitor invitation');
  await expect(page.getByTestId('visitor-stats')).toBeVisible(); // the page is still there behind it
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.getByTestId('visitor-stats')).toBeVisible();

  await open(page, 'visitorRegister', 'blank', 'zh-Hant');
  await expect(page.getByTestId('visitor-invitation')).toHaveAttribute('aria-label', '訪客邀請');
});

test('Visits: a fixture visitor row opens its detail as a pop-up with Close, not as a new page', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('visitor-row').first().click();
  await expect(page.getByTestId('visitor-dialog')).toBeVisible();
  await expect(page.getByTestId('visitor-detail')).toBeVisible();
  await expect(page.getByTestId('visitor-table')).toBeVisible();
  await page.getByTestId('visitor-dialog-close').click();
  await expect(page.getByTestId('visitor-dialog')).toHaveCount(0);
});
