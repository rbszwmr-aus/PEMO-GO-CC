/**
 * Facility booking fixtures: list → detail, facilities, calendar, check-in,
 * rate cards, zh-Hant sample. Runs against dist/ via the harness.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('Bookings list opens that booking detail from the AMENITIES nav', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();

  await expect(page.locator('[data-testid="nav-item"][data-nav="clubhouse"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="nav-item"][data-nav="booking"]')).toBeVisible();
  await expect(page.locator('[data-testid="nav-item"][data-nav="booking"]')).toContainText('Facility booking');

  await page.locator('[data-testid="nav-item"][data-nav="booking"] .pemo-nav__chevron').click();
  await page.locator('[data-testid="nav-item"][data-nav="bk-bookings"]').click();

  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Bookings');
  await expect(page.locator('[data-testid="bookings-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('bookings');

  const row = page.locator('[data-testid="bookings-row"][data-booking-id="bk_wfg_1001"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('Ho Mei-yi 何美儀');
  await row.locator('[data-testid="booking-open"]').click();

  const detail = page.locator('[data-testid="bookings-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-booking-id', 'bk_wfg_1001');
  await expect(page.locator('[data-testid="booking-facts"]')).not.toContainText('bk_wfg_1001');
  await page.locator('[data-testid="booking-it-details"] summary').click();
  await expect(page.locator('[data-testid="booking-it-details"]')).toContainText('bk_wfg_1001');
  await expect(page.locator('[data-testid="booking-composition"]')).toContainText('3');
  await page.locator('[data-testid="booking-dialog-tab"][data-tab="payments"]').click();
  await expect(page.locator('[data-testid="booking-payment"]')).toContainText('Paid at counter');
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('bookingsDetail');
  await expect.poll(() => new URL(page.url()).searchParams.get('booking')).toBe('bk_wfg_1001');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);

  await page.locator('[data-testid="booking-back"]').click();
  await expect(page.locator('[data-testid="bookings-table"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('bookings');
  await expect.poll(() => new URL(page.url()).searchParams.get('booking')).toBe(null);
});

test('Facilities list opens that facility detail with zones', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'bookingFacilities', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="booking-facilities-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  const row = page.locator('[data-testid="facilities-row"][data-facility-id="fac_wfg_bbq"]');
  await expect(row).toBeVisible();
  await row.locator('[data-testid="facility-open"]').click();

  const detail = page.locator('[data-testid="booking-facilities-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-facility-id', 'fac_wfg_bbq');
  await expect(page.locator('[data-testid="chain-dialog"]')).toHaveAttribute('aria-label', /BBQ pits/);
  await expect(page.locator('[data-testid="facility-zones-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="facility-zone-row"]')).toHaveCount(3);
  await expect.poll(() => new URL(page.url()).searchParams.get('facility')).toBe('fac_wfg_bbq');
});

test('Calendar shows one facility by default and a chip opens the booking as a pop-up', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'bookingCalendar', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible();
  await expect(page.locator('[data-testid="booking-calendar-month"]')).toBeVisible();
  await expect(page.locator('[data-testid="calendar-facility"]')).toHaveValue('fac_wfg_clubhouse_mp');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  await page.locator('[data-testid="calendar-mode-day"]').click();
  await expect(page.locator('[data-testid="booking-calendar-day"]')).toBeVisible();
  await expect(page.locator('[data-testid="calendar-day-col"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="calendar-booking"][data-booking-id="bk_wfg_1001"]')).toBeVisible();

  await page.locator('[data-testid="calendar-booking"][data-booking-id="bk_wfg_1001"]').click();
  await expect(page.locator('[data-testid="booking-dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="bookings-detail"]')).toHaveAttribute('data-booking-id', 'bk_wfg_1001');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="booking-dialog"]')).toHaveCount(0);
});

test('Check-in lists today confirmed and toggles checked-in', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'bookingCheckin', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="booking-checkin-table"]')).toBeVisible();
  const row = page.locator('[data-testid="checkin-row"][data-booking-id="bk_wfg_1001"]');
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-status', 'confirmed');
  await row.locator('[data-testid="checkin-mark-in"]').click();
  await expect(row).toHaveAttribute('data-status', 'checked-in');
  await expect(row.locator('[data-testid="booking-status"]')).toContainText('Checked in');
  await row.locator('[data-testid="checkin-mark-noshow"]').click();
  await expect(row).toHaveAttribute('data-status', 'no-show');
});

test('Rate cards table is a read-only fixture', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'bookingRates', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="booking-rates-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="rates-row"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="rates-row"][data-facility-id="fac_wfg_function"]')).toContainText('Function room');
  await expect(page.locator('[data-testid="rates-row"][data-facility-id="fac_wfg_function"]')).toContainText('HKD 800');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
});

test('zh-Hant Bookings title and a facility name', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'bookings', 'default', 'zh-Hant'), { waitUntil: 'load' });

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-HK');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('預約');
  await expect(page.locator('[data-testid="bookings-row"][data-booking-id="bk_wfg_1001"]')).toContainText('會所多用途室');
  await expect(page.locator('[data-testid="bookings-fixture-label"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="bookings-table"]')).not.toContainText('bk_wfg');
});
