/**
 * Sortable headers and the filter bar on the two visitor tables: the Visitor log (Today's visitors)
 * and the Front counter (Today at the front counter).
 */
import { appOrigin, expect, revealFilters, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const openLog = async (page: P, lang: 'en' | 'zh-Hant' = 'en') => {
  await page.goto(urlFor(await appOrigin(), 'visitorLog', 'default', lang), { waitUntil: 'load' });
  await expect(page.getByTestId('visitor-table')).toBeVisible();
};
const openCounter = async (page: P, lang: 'en' | 'zh-Hant' = 'en') => {
  await page.goto(urlFor(await appOrigin(), 'visitorCounter', 'pass', lang), { waitUntil: 'load' });
  await expect(page.getByTestId('desk-log-table')).toBeVisible();
};
const logNames = (page: P) => page.locator('[data-testid="visitor-table"] tbody tr td:first-child .pemo-cell--wrap__inner > span').allInnerTexts();
const deskNames = (page: P) => page.locator('[data-testid="desk-log-table"] tbody tr td:first-child .pemo-cell--wrap__inner > span').allInnerTexts();

test('Visitor log: headers are sort buttons, starting newest record first with no header marked, and a click cycles asc, desc, off', async ({ strictPage: page }) => {
  await openLog(page);
  const th = (key: string) => page.locator('[data-testid="visitor-table"] thead th').filter({ has: page.getByTestId(`sort-${key}`) });
  await expect(page.getByTestId('visitor-table').locator('thead th button')).toHaveCount(7);
  await expect(th('expected')).toHaveAttribute('aria-sort', 'none'); // All visits sorts by when the record was made, which is not a column
  await expect(page.getByTestId('visitor-table').locator('thead svg')).toHaveCount(0);
  await expect(th('visitor')).toHaveAttribute('aria-sort', 'none');
  await expect(th('visitor').locator('svg')).toHaveCount(0);

  await page.getByTestId('sort-visitor').click();
  await expect(th('visitor')).toHaveAttribute('aria-sort', 'ascending');
  await expect(th('visitor').locator('svg[data-icon="ChevronUp"]')).toHaveCount(1);
  await expect(th('expected')).toHaveAttribute('aria-sort', 'none');
  const asc = await logNames(page);
  expect(asc).toEqual([...asc].sort(collator.compare));

  await page.getByTestId('sort-visitor').click();
  await expect(th('visitor')).toHaveAttribute('aria-sort', 'descending');
  await expect(th('visitor').locator('svg[data-icon="ChevronDown"]')).toHaveCount(1);
  expect(await logNames(page)).toEqual([...asc].reverse());

  await page.getByTestId('sort-visitor').click();
  await expect(th('visitor')).toHaveAttribute('aria-sort', 'none');
  await expect(page.getByTestId('visitor-table').locator('thead svg')).toHaveCount(0);
});

test('Visitor log: an In time column after Expected shows the 24-hour arrival time, a dash until arrival, and sorts', async ({ strictPage: page }) => {
  await openLog(page);
  const heads = await page.locator('[data-testid="visitor-table"] thead th').allInnerTexts();
  const at = heads.findIndex((h) => /^Expected/.test(h.trim()));
  expect(at).toBeGreaterThan(0);
  expect(heads[at + 1]!.trim()).toMatch(/^In time/);
  const times = await page.locator('[data-testid="visitor-in-time"]').allInnerTexts();
  expect(times.length).toBeGreaterThan(2);
  for (const x of times) expect(x).toMatch(/^(\d{2}:\d{2}|–)$/);
  expect(times.some((x) => x === '–')).toBe(true);
  expect(times.some((x) => x !== '–')).toBe(true);
  await page.getByRole('button', { name: /In time/ }).click();
  await expect(page.locator('[data-testid="visitor-table"] thead th').filter({ has: page.getByTestId('sort-intime') })).toHaveAttribute('aria-sort', 'ascending');
  const sorted = await page.locator('[data-testid="visitor-in-time"]').allInnerTexts();
  const firstDash = sorted.indexOf('–');
  expect(firstDash).toBeGreaterThan(0);
  expect(sorted.slice(firstDash).every((x) => x === '–')).toBe(true); // not arrived sorts last
});

test('Visitor log: search over visitor and host unit, dropdown filters, and Clear filters only while one is active', async ({ strictPage: page }) => {
  await openLog(page);
  const clear = page.getByTestId('visitor-filters-clear');
  await expect(clear).toHaveCount(0); // hidden, not disabled, when nothing is filtered
  const all = (await logNames(page)).length;

  await page.getByTestId('visitor-filters-search').fill('fung');
  await expect(clear).toBeVisible();
  const fung = await logNames(page);
  expect(fung.length).toBeGreaterThan(0);
  expect(fung.every((n) => /fung/i.test(n))).toBe(true);
  await page.getByTestId('visitor-filters-search').fill('a1'); // a host unit, not a visitor
  expect((await logNames(page)).length).toBeGreaterThan(0);
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(page.getByTestId('visitor-filters-search')).toHaveValue('');
  expect((await logNames(page)).length).toBe(all);

  await revealFilters(page, 'visitor-filters');
  await page.getByTestId('visitor-filters-state').selectOption({ label: 'Expected' });
  await expect(clear).toBeVisible();
  const rows = page.locator('[data-testid="visitor-table"] tbody tr');
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(all);
  for (let i = 0; i < n; i += 1) await expect(rows.nth(i)).toContainText('Expected');

  await page.getByTestId('visitor-filters-registered').selectOption('walk_in');
  expect(await rows.count()).toBeLessThan(n);
  await page.getByTestId('visitor-filters-pass').selectOption('with');
  await page.getByTestId('visitor-filters-purpose').selectOption({ index: 1 });
  await clear.click();
  expect((await logNames(page)).length).toBe(all);
  await expect(page.getByTestId('visitor-filters-state')).toHaveValue('');
});

test('Visitor log: nothing matching shows an empty state with Clear filters, and clearing brings the table back', async ({ strictPage: page }) => {
  await openLog(page);
  await page.getByTestId('visitor-filters-search').fill('zzzz-no-such-visitor');
  await expect(page.getByTestId('visitor-no-matches')).toHaveText('No rows match the search and filters.');
  await expect(page.getByTestId('visitor-table')).toHaveCount(0);
  await page.getByTestId('visitor-filters-clear').click();
  await expect(page.getByTestId('visitor-table')).toBeVisible();
  await expect(page.getByTestId('visitor-no-matches')).toHaveCount(0);
});

test('Front counter log: the same header sorting and filter bar', async ({ strictPage: page }) => {
  await openCounter(page);
  const th = (key: string) => page.locator('[data-testid="desk-log-table"] thead th').filter({ has: page.getByTestId(`sort-${key}`) });
  await expect(th('in')).toHaveAttribute('aria-sort', 'descending');
  await page.getByTestId('sort-visitor').click();
  const asc = await deskNames(page);
  expect(asc).toEqual([...asc].sort(collator.compare));
  await expect(th('visitor').locator('svg[data-icon="ChevronUp"]')).toHaveCount(1);
  await page.getByTestId('sort-visitor').click();
  expect(await deskNames(page)).toEqual([...asc].reverse());
  await page.getByTestId('sort-visitor').click();
  await expect(th('visitor')).toHaveAttribute('aria-sort', 'none');

  const clear = page.getByTestId('desk-filters-clear');
  await expect(clear).toHaveCount(0);
  const all = (await deskNames(page)).length;
  await page.getByTestId('desk-filters-search').fill('chan');
  await expect(clear).toBeVisible();
  expect((await deskNames(page)).every((n) => /chan/i.test(n))).toBe(true);
  await clear.click();
  expect((await deskNames(page)).length).toBe(all);
  await revealFilters(page, 'desk-filters');
  await page.getByTestId('desk-filters-registered').selectOption('walk_in');
  await expect(page.locator('[data-testid="desk-log-row"]').filter({ hasText: 'Pre-registered' })).toHaveCount(0);
  await page.getByTestId('desk-filters-search').fill('zzzz-none');
  await expect(page.getByTestId('desk-log-no-matches')).toBeVisible();
  await clear.click();
  expect((await deskNames(page)).length).toBe(all);
});

test('zh-Hant: sort buttons, filter labels, Clear filters and the empty state are in Chinese', async ({ strictPage: page }) => {
  await openLog(page, 'zh-Hant');
  await expect(page.getByTestId('sort-visitor')).toHaveText('訪客');
  await expect(page.getByTestId('visitor-filters-search')).toHaveAttribute('placeholder', '搜尋訪客或接待單位');
  await revealFilters(page, 'visitor-filters');
  await expect(page.getByTestId('visitor-filters-purpose').locator('option').first()).toHaveText('所有目的');
  await page.getByTestId('visitor-filters-search').fill('zzzz-無');
  await expect(page.getByTestId('visitor-filters-clear')).toHaveText('清除篩選');
  await expect(page.getByTestId('visitor-no-matches')).toHaveText('沒有符合搜尋及篩選條件的項目。');
});

test('Visitor log: one row when there is room; when narrow the dropdowns sit behind a Filters button with a count, in EN, 繁 and 简', async ({ strictPage: page }) => {
  const names = { en: 'Filters', 'zh-Hant': '篩選', 'zh-Hans': '筛选' } as const;
  for (const lang of ['en', 'zh-Hant', 'zh-Hans'] as const) {
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto(urlFor(await appOrigin(), 'visitorLog', 'default', lang), { waitUntil: 'load' });
    const bar = page.getByTestId('visitor-filters');
    await expect(bar).toHaveAttribute('data-layout', 'row');
    await expect(page.getByTestId('visitor-filters-toggle')).toHaveCount(0);
    await expect(page.getByTestId('visitor-filters-state')).toBeVisible();

    await page.setViewportSize({ width: 860, height: 900 });
    await expect(bar).toHaveAttribute('data-layout', 'popover');
    const toggle = page.getByTestId('visitor-filters-toggle');
    await expect(toggle).toContainText(names[lang]);
    await expect(page.getByTestId('visitor-filters-search')).toBeVisible(); // search stays inline
    await expect(page.getByTestId('visitor-filters-state')).toHaveCount(0);
    await expect(page.getByTestId('visitor-filters-count')).toHaveCount(0);
    await expect(page.getByTestId('visitor-filters-clear')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const rows = page.locator('[data-testid="visitor-table"] tbody tr');
    const all = await rows.count();
    await page.getByTestId('visitor-filters-registered').selectOption('walk_in');
    await expect(page.getByTestId('visitor-filters-count')).toHaveText('1');
    expect(await rows.count()).toBeLessThan(all);
    await page.getByTestId('visitor-filters-pass').selectOption('with');
    await expect(page.getByTestId('visitor-filters-count')).toHaveText('2');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('visitor-filters-panel')).toHaveCount(0);
    await expect(page.getByTestId('visitor-filters-count')).toHaveText('2'); // still filtered when closed
    await toggle.click();
    await page.getByTestId('visitor-filters-clear').click();
    await expect(page.getByTestId('visitor-filters-count')).toHaveCount(0);
    expect(await rows.count()).toBe(all);
    await page.mouse.click(5, 5); // outside click closes
    await expect(page.getByTestId('visitor-filters-panel')).toHaveCount(0);

    await page.setViewportSize({ width: 1800, height: 900 });
    await expect(bar).toHaveAttribute('data-layout', 'row');
  }
});
