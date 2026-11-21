/**
 * Every stat card carries a decorative icon chip, and the Properties cards drill down to exactly the rows they count.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const SCREENS = ['s2', 's3', 's1', 's4', 's5', 'helpdesk', 'visitorLog', 'residents', 'households', 'documents', 'charges', 'payments', 'refunds', 'bookings', 'bookingCheckin', 'adminUsers', 'integrationStatus'];

for (const screen of SCREENS) {
  test(`Stat cards on ${screen} each carry a decorative icon chip with a glyph, and no two cards on the page share one`, async ({ strictPage: page }) => {
    await page.goto(urlFor(await appOrigin(), screen, 'default', 'en'), { waitUntil: 'load' });
    const cards = page.getByTestId('stat-card');
    await expect(cards.first()).toBeVisible();
    const n = await cards.count();
    const icons: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const chip = cards.nth(i).getByTestId('stat-card-icon');
      await expect(chip).toHaveCount(1);
      await expect(chip).toHaveAttribute('aria-hidden', 'true');
      await expect(chip.locator('svg')).toHaveCount(1);
      icons.push((await chip.getAttribute('data-icon')) ?? '');
    }
    expect(new Set(icons).size, icons.join(',')).toBe(n);
  });
}

test('Reports: every report card heading and every metric row has an icon chip, and a card keeps its metrics distinct', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'reports', 'default', 'en'), { waitUntil: 'load' });
  const cards = page.getByTestId('report-card');
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < (await cards.count()); i += 1) {
    const card = cards.nth(i);
    await expect(card.getByTestId('report-card-icon')).toHaveAttribute('aria-hidden', 'true');
    const metrics = card.getByTestId('report-metric');
    const icons: string[] = [];
    for (let j = 0; j < (await metrics.count()); j += 1) {
      const chip = metrics.nth(j).getByTestId('report-metric-icon');
      await expect(chip).toHaveAttribute('aria-hidden', 'true');
      icons.push((await chip.getAttribute('data-icon')) ?? '');
    }
    expect(new Set(icons).size).toBe(icons.length);
  }
});

const props = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="stat-card"][data-stat="${id}"]`);

for (const id of ['locations', 'spaces', 'shared']) {
  test(`Properties card ${id} is a button that lists exactly its number of locations, lights, shows Clear, takes Enter, and clears`, async ({ strictPage: page }) => {
    await page.goto(urlFor(await appOrigin(), 's3', 'default', 'en'), { waitUntil: 'load' });
    const target = props(page, id);
    expect(await target.evaluate((el) => el.tagName)).toBe('BUTTON');
    await expect(target).toHaveAttribute('aria-pressed', 'false');
    const n = Number(await target.getByTestId('stat-card-value').innerText());
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-row')).toBeVisible();
    await expect(page.getByTestId('s3-pager')).toContainText(`/ ${n}`);
    const rows = await page.locator('[data-testid="s3-children-table"] tbody tr').count();
    expect(rows).toBe(Math.min(n, 25));
    await page.getByTestId('filter-clear').click();
    await expect(page.getByTestId('filter-row')).toHaveCount(0);
    await expect(target).toHaveAttribute('aria-pressed', 'false');
  });
}

test('Properties: a row in a card list opens that location in the tree and leaves the filter; a second press of a card clears it', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 's3', 'default', 'en'), { waitUntil: 'load' });
  await props(page, 'shared').click();
  await expect(page.getByTestId('s3-child-path').first()).not.toBeEmpty();
  const name = (await page.locator('[data-testid="s3-children-table"] tbody tr').first().locator('strong').innerText()).trim();
  await page.locator('[data-testid="s3-children-table"] tbody tr').first().locator('button').click();
  await expect(page.getByTestId('filter-row')).toHaveCount(0);
  await expect(page.getByTestId('s3-pane-title')).toHaveText(name);
  await expect(page.locator('[data-testid="tree-node"][data-chosen="true"]')).toHaveCount(1);
  await props(page, 'spaces').click();
  await props(page, 'spaces').click();
  await expect(page.getByTestId('filter-row')).toHaveCount(0);
});
