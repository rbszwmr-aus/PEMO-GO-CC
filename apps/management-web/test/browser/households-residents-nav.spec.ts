/**
 * Households list → household detail → member → resident/tenant detail.
 * Also Residents list → the same tenant. Fixture-first; no live API.
 *
 * Runs against dist/ via the harness — the same artefact PT looks at on :5175
 * after `pnpm run dev` / build. Workbench Screen/State pickers stay absent.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('Households row opens that household detail and a member opens that resident', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();

  await page.locator('[data-testid="nav-item"][data-nav="properties"] .pemo-nav__chevron').click();
  await page.locator('[data-testid="nav-item"][data-nav="prop-households"]').click();

  await expect(page.locator('[data-testid="households-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);

  const row = page.locator('[data-testid="households-row"][data-household-id="hh_wfg_b_03_b2"]');
  await expect(row).toBeVisible();
  await row.click();

  const detail = page.locator('[data-testid="households-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-household-id', 'hh_wfg_b_03_b2');
  // id-sweep: the household id is in the collapsed IT details, not in the facts.
  await expect(page.locator('[data-testid="household-facts"]')).not.toContainText('hh_wfg_b_03_b2');
  await expect(page.locator('[data-testid="household-it-details"]')).toContainText('hh_wfg_b_03_b2');
  await expect(page.locator('[data-testid="household-it-details"]')).not.toHaveAttribute('open', /.*/);
  await expect(page.locator('[data-testid="household-facts"]')).toContainText('App inbox · phone call for urgent notices');
  await page.locator('[data-testid="household-pane-tab"][data-tab="members"]').click();
  await expect(page.locator('[data-testid="household-members-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="household-member-row"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="household-member-open"]')).toHaveCount(2);
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('householdsDetail');
  await expect.poll(() => new URL(page.url()).searchParams.get('household')).toBe('hh_wfg_b_03_b2');

  await page.locator('[data-testid="household-member-row"][data-resident-id="res_wfg_000512"] [data-testid="household-member-open"]').click();

  const resident = page.locator('[data-testid="residents-detail"]');
  await expect(resident).toBeVisible();
  await expect(resident).toHaveAttribute('data-resident-id', 'res_wfg_000512');
  await expect(page.locator('[data-testid="chain-dialog"]')).toHaveAttribute('aria-label', 'Tam Yee-man 譚綺雯');
  await expect(page.locator('[data-testid="resident-it-details"]')).toContainText('res_wfg_000512');
  await page.locator('[data-testid="resident-pane-tab"][data-tab="units"]').click();
  await expect(page.locator('[data-testid="occupancy-row"]')).toHaveCount(1);
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('residentsDetail');
  await expect.poll(() => new URL(page.url()).searchParams.get('residentId')).toBe('res_wfg_000512');
  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
});

test('Residents list opens the same tenant detail', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'residents', 'list', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="residents-table"]')).toBeVisible();
  const tenant = page.locator('[data-testid="residents-row"][data-resident-id="res_wfg_000512"]');
  await expect(tenant).toBeVisible();
  await tenant.locator('[data-testid="resident-open"]').click();

  const detail = page.locator('[data-testid="residents-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-resident-id', 'res_wfg_000512');
  await expect(page.locator('[data-testid="chain-dialog"]')).toHaveAttribute('aria-label', 'Tam Yee-man 譚綺雯');
  await expect(page.locator('[data-testid="resident-it-details"]')).toContainText('res_wfg_000512');
  await expect.poll(() => new URL(page.url()).searchParams.get('residentId')).toBe('res_wfg_000512');
});

test('back navigation returns list from household and resident detail', async ({ strictPage: page }) => {
  const base = await appOrigin();

  await page.goto(urlFor(base, 'households', 'list', 'en'), { waitUntil: 'load' });
  await page.locator('[data-testid="households-row"][data-household-id="hh_wfg_a_12_a1"] [data-testid="household-open"]').click();
  await expect(page.locator('[data-testid="households-detail"]')).toHaveAttribute('data-household-id', 'hh_wfg_a_12_a1');
  await page.locator('[data-testid="household-pane-tab"][data-tab="members"]').click();
  await expect(page.locator('[data-testid="household-member-row"]')).toHaveCount(3);
  await page.locator('[data-testid="chain-dialog-close"]').click();
  await expect(page.locator('[data-testid="households-table"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('households');
  await expect.poll(() => new URL(page.url()).searchParams.get('household')).toBe(null);

  await page.goto(urlFor(base, 'residents', 'list', 'en'), { waitUntil: 'load' });
  await page.locator('[data-testid="residents-row"][data-resident-id="res_wfg_000412"] [data-testid="resident-open"]').click();
  await expect(page.locator('[data-testid="residents-detail"]')).toHaveAttribute('data-resident-id', 'res_wfg_000412');
  await page.locator('[data-testid="chain-dialog-close"]').click();
  await expect(page.locator('[data-testid="residents-table"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('residents');
  await expect.poll(() => new URL(page.url()).searchParams.get('residentId')).toBe(null);
});
