/**
 * Reports page: L1 tabs, one CSV/PDF row next to Apply, clickable metrics, in-page drill-down,
 * L3 row pop-up, and exports that match the view on screen.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { readFile } from 'node:fs/promises';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;

const open = async (page: P, state: 'default' | 'drill' = 'default', lang: 'en' | 'zh-Hant' | 'zh-Hans' = 'en') => {
  await page.goto(urlFor(await appOrigin(), 'reports', state, lang), { waitUntil: 'load' });
  await expect(page.getByTestId('reports')).toBeVisible();
};
const read = async (page: P, testId: string) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  return { name: dl.suggestedFilename(), bytes: await readFile((await dl.path()) as string) };
};

test('Reports: twelve cards under two L1 tabs, every metric a button, one CSV and PDF row beside Apply, and no Print anywhere', async ({ strictPage: page }) => {
  await open(page);
  await expect(page.getByTestId('reports-tab')).toHaveText(['Daily operations', 'Management report']);
  await expect(page.getByTestId('report-card')).toHaveCount(12);
  expect(await page.getByTestId('report-metric').count()).toBeGreaterThanOrEqual(20);
  await expect(page.getByTestId('report-actions').getByRole('button')).toHaveText([/^\s*CSV$/, /^\s*PDF$/]);
  await expect(page.getByTestId('reports-bar').getByTestId('report-apply')).toBeVisible();
  await expect(page.getByText(/^Print$/i)).toHaveCount(0);
  await expect(page.getByTestId('report-actions')).toHaveCount(1);
  await page.getByTestId('reports-tab').nth(1).click();
  await expect(page.getByTestId('report-from')).toHaveValue(/-01$/);
});

test('Reports: a metric opens the rows behind it in the same page, with trail, chip and Back, and the card figure is the row count', async ({ strictPage: page }) => {
  await open(page);
  await page.getByTestId('reports-tab').nth(1).click();
  const metric = page.locator('[data-testid="report-metric"][data-metric="tenancies-active"]');
  const figure = Number((await metric.getByTestId('report-metric-value').innerText()).replace(/,/g, ''));
  await metric.click();
  await expect(page.getByTestId('report-drill')).toBeVisible();
  await expect(page.getByTestId('report-crumbs')).toContainText('Reports');
  await expect(page.getByTestId('report-crumbs')).toContainText('Management report');
  await expect(page.getByTestId('report-crumb-current')).toHaveText('Active tenancies');
  await expect(page.getByTestId('filter-chip')).toContainText('Active tenancies');
  await expect(page.getByTestId('filter-count')).toContainText(`Showing ${figure} of ${figure}`);
  await expect(page.getByTestId('report-range')).toContainText(`1–25 / ${figure}`);
  await expect(page.getByTestId('report-row')).toHaveCount(25);
  await expect(page.getByTestId('report-csv')).toHaveText(new RegExp(`CSV \\(${figure} rows\\)`));
  await expect(page.getByTestId('report-pdf')).toHaveText(new RegExp(`PDF \\(${figure} rows\\)`));
  await expect(page.getByTestId('report-actions')).toHaveCount(1);

  await page.getByTestId('report-back').click();
  await expect(page.getByTestId('reports-cards')).toBeVisible();
  await metric.click();
  await page.getByTestId('filter-chip-remove').click();
  await expect(page.getByTestId('reports-cards')).toBeVisible();
  await expect(page.getByTestId('report-csv')).toHaveText(/^\s*CSV$/);
});

test('Reports: CSV and PDF export the current view: whole report on the cards, the filtered rows on a drill-down', async ({ strictPage: page }) => {
  await open(page);
  const whole = await read(page, 'report-csv');
  const wholeText = whole.bytes.toString('utf8');
  expect(wholeText.split('\r\n').filter(Boolean).length).toBe(1 + (await page.getByTestId('report-metric').count()));
  expect(whole.name).toMatch(/^report-daily-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);

  await page.locator('[data-testid="report-metric"][data-metric="households"]').click();
  await page.getByTestId('report-filters-search').fill('chan');
  const shown = await page.getByTestId('report-range').innerText();
  const n = Number(/\/ (\d+)$/.exec(shown)?.[1]);
  expect(n).toBeGreaterThan(0);
  const csv = await read(page, 'report-csv');
  const lines = csv.bytes.toString('utf8').split('\r\n').filter(Boolean);
  expect(lines.length).toBe(1 + n);
  expect(lines[0]).toContain('Home');
  for (const l of lines.slice(1)) expect(l.toLowerCase()).toContain('chan');
  const pdf = await read(page, 'report-pdf');
  expect(pdf.bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  expect(pdf.bytes.toString('latin1')).toContain('Wing Fu Garden');
  expect(pdf.bytes.toString('latin1')).toContain('Metric: Household records');
  expect(pdf.name).toMatch(/\.pdf$/);
});

test('Reports: a row opens an L3 pop-up with the row details; Escape closes it and the drill-down is still there', async ({ strictPage: page }) => {
  await open(page, 'drill');
  await expect(page.getByTestId('report-table')).toBeVisible();
  await page.getByTestId('report-row').first().click();
  const dlg = page.getByTestId('report-dialog');
  await expect(dlg).toBeVisible();
  await expect(page.getByTestId('report-detail')).toContainText('Home');
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.getByTestId('report-table')).toBeVisible();
});

test('Reports: Apply uses the From and To dates, and a start after the end is refused', async ({ strictPage: page }) => {
  await open(page);
  const before = Number((await page.locator('[data-testid="report-metric"][data-metric="bookings-confirmed"] [data-testid="report-metric-value"]').innerText()).replace(/,/g, ''));
  const first = await page.getByTestId('report-to').inputValue();
  await page.getByTestId('report-from').fill(`${first.slice(0, 8)}01`);
  await page.getByTestId('report-apply').click();
  const after = Number((await page.locator('[data-testid="report-metric"][data-metric="bookings-confirmed"] [data-testid="report-metric-value"]').innerText()).replace(/,/g, ''));
  expect(after).toBeGreaterThan(before);
  await page.getByTestId('report-to').fill(`${first.slice(0, 8)}01`);
  await page.getByTestId('report-from').fill(`${first.slice(0, 8)}05`);
  await expect(page.getByTestId('report-range-error')).toBeVisible();
  await expect(page.getByTestId('report-apply')).toBeDisabled();
});

test('Reports in 繁體: tabs, labels and the flat in the rows stay in Chinese', async ({ strictPage: page }) => {
  await open(page, 'drill', 'zh-Hant');
  await expect(page.getByTestId('reports-tab').first()).toHaveText('每日運作');
  await expect(page.getByTestId('report-row').first()).toContainText(/A座3樓A1/);
  await expect(page.getByTestId('report-csv')).toHaveText(/CSV \(\d+ 行\)/);
});
