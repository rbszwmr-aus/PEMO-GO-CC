/**
 * Administration → Lists: add, rename, reorder, deactivate and delete managed types, and what that does to forms.
 */

import { appOrigin, expect, revealFilters, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

const fx = urlFor; // urlFor pins ?source=fixture: these tests are about the screen, whatever Backend is doing.

const rowOf = (page: import('@playwright/test').Page, name: string) => page.locator('[data-testid="lists-row"]').filter({ has: page.locator('[data-testid="lists-name"]', { hasText: new RegExp(`^${name}$`) }) });

test('Admin Lists adds, renames and reorders a type, with no system ids on the page', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(fx(base, 'adminLists', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.lookups.title.en);
  await expect(page.locator('[data-testid="lists-row"]')).toHaveCount(6);
  await expect(rowOf(page, 'Caregiver')).toContainText(/1 record(?!s)/);
  await expect(page.locator('[data-testid="lists-coming"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-lists"]')).not.toContainText('family_visit');

  await page.locator('[data-testid="lists-add"]').click();
  await page.locator('[data-testid="lists-label-en"]').fill('Inspection');
  await page.locator('[data-testid="lists-dialog-save"]').click();
  await expect(page.locator('[data-testid="lists-dialog-error"]')).toBeVisible();
  await page.locator('[data-testid="lists-label-zh-Hant"]').fill('巡查');
  await page.locator('[data-testid="lists-label-zh-Hans"]').fill('巡查');
  await page.locator('[data-testid="lists-dialog-save"]').click();
  await expect(page.locator('[data-testid="lists-row"]')).toHaveCount(7);

  await rowOf(page, 'Inspection').locator('[data-testid="lists-up"]').click();
  await expect(page.locator('[data-testid="lists-name"]').nth(4)).toHaveText('Inspection');
  // Other is the fallback: it stays last and offers no move, deactivate or delete.
  await expect(page.locator('[data-testid="lists-name"]').nth(6)).toHaveText('Other');
  const other = rowOf(page, 'Other');
  await expect(other.locator('[data-testid="lists-up"], [data-testid="lists-down"], [data-testid="lists-deactivate"], [data-testid="lists-delete"]')).toHaveCount(0);
  await expect(other.locator('[data-testid="lists-rename"]')).toHaveCount(1);

  await rowOf(page, 'Inspection').locator('[data-testid="lists-rename"]').click();
  await page.locator('[data-testid="lists-label-en"]').fill('Site inspection');
  await page.locator('[data-testid="lists-dialog-save"]').click();
  await expect(rowOf(page, 'Site inspection')).toHaveCount(1);

  // It survives a reload (kept in this browser).
  await page.goto(fx(base, 'adminLists', 'default', 'en'), { waitUntil: 'load' });
  await expect(rowOf(page, 'Site inspection')).toHaveCount(1);
});

test('Admin Lists hides Delete for a type in use and shows it for an unused one', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(fx(base, 'adminLists', 'default', 'en'), { waitUntil: 'load' });
  await expect(rowOf(page, 'Visit').locator('[data-testid="lists-delete"]')).toHaveCount(0);
  await expect(rowOf(page, 'Visit')).toHaveAttribute('data-used', 'true');
  await page.locator('[data-testid="lists-add"]').click();
  await page.locator('[data-testid="lists-label-en"]').fill('Inspection');
  await page.locator('[data-testid="lists-label-zh-Hant"]').fill('巡查');
  await page.locator('[data-testid="lists-label-zh-Hans"]').fill('巡查');
  await page.locator('[data-testid="lists-dialog-save"]').click();
  await expect(rowOf(page, 'Inspection').locator('[data-testid="lists-delete"]')).toHaveCount(1);
  await rowOf(page, 'Inspection').locator('[data-testid="lists-delete"]').click();
  await page.locator('[data-testid="lists-dialog-confirm"]').click();
  await expect(rowOf(page, 'Inspection')).toHaveCount(0);
});

test('a deactivated type leaves the register form and the Purpose filter, and reactivating brings it back', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(fx(base, 'adminLists', 'default', 'en'), { waitUntil: 'load' });
  await rowOf(page, 'Caregiver').locator('[data-testid="lists-deactivate"]').click();
  await expect(page.locator('[data-testid="lists-notice"]')).toContainText('Deactivated');
  await expect(rowOf(page, 'Caregiver').locator('[data-testid="lists-inactive-tag"]')).toBeVisible();
  await expect(rowOf(page, 'Caregiver').locator('[data-testid="lists-reactivate"]')).toBeVisible();

  await page.goto(fx(base, 'visitorRegister', 'blank', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="vis-purpose"] option')).toHaveText(['Delivery', 'Contractor', 'Visit', 'Family visit', 'Other']);

  await page.goto(fx(base, 'adminLists', 'default', 'en'), { waitUntil: 'load' });
  await rowOf(page, 'Caregiver').locator('[data-testid="lists-reactivate"]').click();
  await page.goto(fx(base, 'visitorRegister', 'blank', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="vis-purpose"] option')).toHaveCount(6);
});

test('the Visitor log Purpose filter has one option per type and no raw duplicates', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(fx(base, 'visitorLog', 'default', 'en'), { waitUntil: 'load' });
  await revealFilters(page, 'visitor-filters');
  const opts = page.locator('[data-testid="visitor-filters-purpose"] option');
  const texts = (await opts.allTextContents()).map((s) => s.trim());
  expect(texts[0]).toBe('All purposes');
  expect(new Set(texts).size).toBe(texts.length);
  expect(texts.slice(1)).toEqual(['Delivery', 'Contractor', 'Visit', 'Caregiver', 'Family visit', 'Other']);
  await page.goto(fx(base, 'visitorLog', 'default', 'zh-Hant'), { waitUntil: 'load' });
  await revealFilters(page, 'visitor-filters');
  expect((await page.locator('[data-testid="visitor-filters-purpose"] option').allTextContents()).slice(1, 4)).toEqual(['送貨', '承辦商', '探訪']);
});

test('Admin Lists against Backend: items load from /lookups, a refused delete points at Deactivate, and Other offers neither', async ({ page }) => {
  // A plain page: Backend's 409 is a real console line, not a defect.
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  const item = (code: string, en: string, hant: string, hans: string, sort: number, extra: Record<string, unknown> = {}) => ({
    id: `lki_${code}`, code, labels: { en, 'zh-Hant': hant, 'zh-Hans': hans }, sort_order: sort, active: true, scope: 'global', is_system: false, ...extra,
  });
  const items = [item('delivery', 'Delivery', '送貨', '送货', 10), item('visit', 'Visit', '探訪', '探访', 30), item('other', 'Other', '其他', '其他', 900, { is_system: true })];
  const seen: string[] = [];
  await page.route('**/api/management-web/v0/lookups/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ list_key: 'visitor_purpose', items }) }));
  await page.route('**/api/management-web/v0/front-counter/visits', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ visits: [] }) }));
  await page.route('**/api/management-web/v0/admin/lookups/**', (r) => {
    seen.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
    return r.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'https://pemo.example/problems/lookups/lookup-code-in-use', detail: 'in use', in_use_count: 4, recommendation: 'deactivate' }) });
  });
  await page.goto(urlFor(base, 'adminLists', 'default', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="lists-row"]')).toHaveCount(3);
  await expect(rowOf(page, 'Other').locator('[data-testid="lists-deactivate"], [data-testid="lists-delete"]')).toHaveCount(0);
  await rowOf(page, 'Delivery').locator('[data-testid="lists-delete"]').click();
  await page.locator('[data-testid="lists-dialog-confirm"]').click();
  await expect(page.locator('[data-testid="lists-notice"]')).toContainText('used by 4 records');
  await expect(page.locator('[data-testid="lists-notice"]')).toContainText('Deactivate it instead');
  expect(seen).toEqual(['DELETE /api/management-web/v0/admin/lookups/visitor_purpose/delivery']);
  await expect(rowOf(page, 'Delivery').locator('[data-testid="lists-delete"]')).toHaveCount(0);
  await expect(rowOf(page, 'Delivery').locator('[data-testid="lists-deactivate"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
