/**
 * Facility calendar: one facility by default and remembered, "+N more" and count pills on busy days,
 * the arrows and the four views, and no system ID on a chip.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;

const open = async (page: P, lang: 'en' | 'zh-Hant' | 'zh-Hans' = 'en') => {
  await page.goto(urlFor(await appOrigin(), 'bookingCalendar', 'default', lang), { waitUntil: 'load' });
  await expect(page.getByTestId('booking-calendar-month')).toBeVisible();
};
const busyDay = (page: P) => page.locator('[data-testid="calendar-cell"][data-date$="-13"]:not([data-outside])');

test('Calendar: the facility select defaults to the first facility, offers All, and remembers the last choice', async ({ strictPage: page }) => {
  await open(page);
  await expect(page.getByTestId('calendar-facility')).toHaveValue('fac_wfg_clubhouse_mp');
  await expect(page.getByTestId('calendar-legend')).toHaveCount(0);
  await page.getByTestId('calendar-facility').selectOption('all');
  await expect(page.getByTestId('calendar-legend')).toBeVisible();
  await expect(page.getByTestId('calendar-legend').locator('li')).toHaveCount(5);
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('calendar-facility')).toHaveValue('all');
  await page.getByTestId('calendar-facility').selectOption('fac_wfg_bbq');
  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('calendar-facility')).toHaveValue('fac_wfg_bbq');
});

test('Calendar: a busy single-facility day shows three chips and "+N more" that opens Day, and chips carry flat not IDs', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('calendar-facility').selectOption('fac_wfg_bbq');
  const cell = busyDay(page);
  await expect(cell.getByTestId('calendar-booking')).toHaveCount(3);
  await expect(cell.getByTestId('calendar-more')).toContainText(/^\+\d+ more$/);
  const chip = cell.getByTestId('calendar-booking').first();
  expect(await chip.innerText()).toMatch(/^\d\d:\d\d · [ABC] · \d+\/F [ABC]\d$/);
  expect(`${await chip.innerText()} ${await chip.getAttribute('title')}`).not.toMatch(/bk_wfg|hh_wfg|res_wfg/);
  await cell.getByTestId('calendar-more').click();
  await expect(page.getByTestId('booking-calendar-day')).toBeVisible();
  await expect(page.getByTestId('calendar-day-col')).toHaveCount(1);
  await expect(page.getByTestId('calendar-crumb')).toContainText('13');
});

test('Calendar: All mode swaps a busy day for count pills and a pill opens Day for that facility', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('calendar-facility').selectOption('all');
  const cell = busyDay(page);
  await expect(cell.getByTestId('calendar-pills')).toBeVisible();
  await expect(cell.getByTestId('calendar-booking')).toHaveCount(0);
  const bbq = cell.locator('[data-testid="calendar-pill"][data-facility-id="fac_wfg_bbq"]');
  await expect(bbq).toHaveAttribute('data-count', /^[4-9]$/);
  await expect(bbq).toContainText('BBQ');
  await bbq.click();
  await expect(page.getByTestId('booking-calendar-day')).toBeVisible();
  await expect(page.getByTestId('calendar-facility')).toHaveValue('fac_wfg_bbq');
  await page.getByTestId('calendar-facility').selectOption('all');
  await expect(page.getByTestId('calendar-day-col')).toHaveCount(5);
});

test('Calendar: the arrows and the four views move through time and a year tile returns to its month', async ({ strictPage: page }) => {
  await open(page);
  const crumb = page.getByTestId('calendar-crumb');
  const now = await crumb.innerText();
  await page.getByTestId('calendar-next').click();
  expect(await crumb.innerText()).not.toBe(now);
  await page.getByTestId('calendar-today').click();
  await expect(crumb).toHaveText(now);
  await page.getByTestId('calendar-mode-week').click();
  await expect(page.getByTestId('booking-calendar-week')).toBeVisible();
  await expect(page.locator('[data-testid="booking-calendar-week"] th')).toHaveCount(7);
  await page.getByTestId('calendar-mode-year').click();
  await expect(page.getByTestId('calendar-year-month')).toHaveCount(12);
  await page.getByTestId('calendar-year-month').nth(5).click();
  await expect(page.getByTestId('booking-calendar-month')).toBeVisible();
  await expect(page.getByTestId('calendar-mode-month')).toHaveAttribute('aria-pressed', 'true');
});

test('Calendar: List and Calendar tabs switch pages and the zh-Hans chip flat stays localised', async ({ strictPage: page }) => {
  await open(page, 'zh-Hans');
  await expect(page.getByTestId('calendar-facility')).toHaveValue('fac_wfg_clubhouse_mp');
  await page.getByTestId('calendar-facility').selectOption('fac_wfg_bbq');
  expect(await busyDay(page).getByTestId('calendar-booking').first().innerText()).toMatch(/^\d\d:\d\d · [ABC]座\d+楼[ABC]\d$/);
  await page.locator('[data-testid="booking-page-tab"][data-tab="list"]').click();
  await expect(page.getByTestId('bookings-table')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('bookings');
  await page.locator('[data-testid="booking-page-tab"][data-tab="calendar"]').click();
  await expect(page.getByTestId('booking-calendar')).toBeVisible();
});
