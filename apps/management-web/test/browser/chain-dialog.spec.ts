/**
 * The Payments chain, Households and Residents open their details in ONE pop-up over the list.
 * A link inside the pop-up swaps its content (never a second pop-up), a back arrow returns to the
 * previous view, Escape closes to the list, and a detail URL opens the pop-up over its list.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const dialog = '[data-testid="chain-dialog"]';

test('A charge opens in one pop-up; its links swap the content, back returns, Escape closes to the list', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'charges', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.locator(dialog)).toHaveCount(0);
  await page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"] [data-testid="charge-open"]').click();
  await expect(page.locator(dialog)).toHaveCount(1);
  await expect(page.locator(`${dialog} [data-testid="charges-detail"]`)).toBeVisible();
  await expect(page.locator('[data-testid="charges-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="chain-dialog-back"]')).toHaveCount(0);

  await page.locator(`${dialog} [data-testid="charge-facts"] [data-testid="charge-household-open"]`).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('householdsDetail');
  await expect(page.locator(dialog)).toHaveCount(1);
  await expect(page.locator(`${dialog} [data-testid="households-detail"]`)).toBeVisible();
  await expect(page.locator('[data-testid="chain-dialog-back"]')).toBeVisible();

  await page.locator('[data-testid="chain-dialog-back"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('chargesDetail');
  await expect(page.locator(`${dialog} [data-testid="charges-detail"]`)).toBeVisible();
  await expect(page.locator(dialog)).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator(dialog)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('charges');
  await expect(page.locator('[data-testid="charges-table"]')).toBeVisible();
});

test('A detail URL opens the pop-up over its list', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'paymentsDetail', 'detail', 'en') + '&payment=pay_wfg_r1001', { waitUntil: 'load' });
  await expect(page.locator(`${dialog} [data-testid="payments-detail"]`)).toBeVisible();
  await expect(page.locator('[data-testid="payments-table"]')).toBeVisible();
});
