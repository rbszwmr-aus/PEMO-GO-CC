/**
 * Strata / management-fee Payments: charges → detail, payments, refunds,
 * zh-Hant sample. Runs against dist/ via the harness.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('Charges list opens that charge detail from the Payments & refunds nav', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();

  await page.locator('[data-testid="nav-item"][data-nav="finance"] .pemo-nav__chevron').click();
  await page.locator('[data-testid="nav-item"][data-nav="fin-charges"]').click();

  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Charges');
  await expect(page.locator('[data-testid="charges-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('charges');

  const row = page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('Ho Mei-yi 何美儀');
  await expect(row).toHaveAttribute('data-status', 'due');
  await row.locator('[data-testid="charge-open"]').click();

  const detail = page.locator('[data-testid="charges-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-charge-id', 'chg_wfg_a1_202609');
  await expect(page.locator('[data-testid="charge-facts"]')).not.toContainText('chg_wfg_a1_202609');
  const it = page.locator('[data-testid="charge-it-details"]');
  await expect(it).not.toHaveAttribute('open', '');
  await it.locator('summary').click();
  await expect(it).toContainText('chg_wfg_a1_202609');
  await expect(page.locator('[data-testid="charge-period"]')).toContainText('2026');
  await expect(page.locator('[data-testid="charge-period"]')).toContainText(/Sep/);
  await expect(page.locator('[data-testid="charge-amount"]')).toContainText('HKD 3,280');
  await expect(page.locator('[data-testid="charge-outstanding"]')).toContainText('HKD 3,280');
  await expect(page.locator('[data-testid="chain-dialog"] [data-testid="charge-facts"] [data-testid="charge-household-open"]')).toContainText('Ho Mei-yi 何美儀');
  await expect(page.locator('[data-testid="chain-dialog"] [data-testid="deferred-action"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="chain-dialog"] [data-testid="deferred-action"]').filter({ hasText: 'Send a reminder' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('chargesDetail');
  await expect.poll(() => new URL(page.url()).searchParams.get('charge')).toBe('chg_wfg_a1_202609');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);

  await page.locator('[data-testid="chain-dialog"] [data-testid="charge-facts"] [data-testid="charge-household-open"]').click();
  await expect(page.locator('[data-testid="households-detail"]')).toHaveAttribute('data-household-id', 'hh_wfg_a_12_a1');

  await page.goto(urlFor(base, 'chargesDetail', 'detail', 'en') + '&charge=chg_wfg_a1_202609', { waitUntil: 'load' });
  await page.locator('[data-testid="chain-dialog-close"]').click();
  await expect(page.locator('[data-testid="charges-table"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('charges');
  await expect.poll(() => new URL(page.url()).searchParams.get('charge')).toBe(null);
});

test('Payments list opens that receipt and its allocated charge', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'payments', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Payments');
  await expect(page.locator('[data-testid="payments-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  const row = page.locator('[data-testid="payments-row"][data-payment-id="pay_wfg_r1001"]');
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-method', 'fps');
  await expect(row).toContainText('FPS');
  await row.locator('[data-testid="payment-open"]').click();

  const detail = page.locator('[data-testid="payments-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-payment-id', 'pay_wfg_r1001');
  await expect(page.locator('[data-testid="payment-amount"]')).toContainText('HKD 3,280');
  await expect(page.locator('[data-testid="payment-reference"]')).toContainText('FPS stub');
  await expect(page.locator('[data-testid="payment-allocation-row"][data-charge-id="chg_wfg_a1_202608"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('payment')).toBe('pay_wfg_r1001');

  await page.locator('[data-testid="payment-charge-open"]').click();
  await expect(page.locator('[data-testid="charges-detail"]')).toHaveAttribute('data-charge-id', 'chg_wfg_a1_202608');
});

test('Refunds list opens that credit stub and keeps execute deferred', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'refunds', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Refunds');
  await expect(page.locator('[data-testid="refunds-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  const row = page.locator('[data-testid="refunds-row"][data-refund-id="ref_wfg_c2001"]');
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-status', 'pending');
  await row.locator('[data-testid="refund-open"]').click();

  const detail = page.locator('[data-testid="refunds-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-refund-id', 'ref_wfg_c2001');
  await expect(page.locator('[data-testid="refund-amount"]')).toContainText('HKD 80');
  await expect(page.locator('[data-testid="refund-reason"]')).toContainText('Overpayment credit');
  await expect(page.locator('[data-testid="chain-dialog"] [data-testid="deferred-action"]')).toContainText('Execute this refund');
  await expect(page.locator('main button', { hasText: 'Execute this refund' })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('refund')).toBe('ref_wfg_c2001');
});

test('zh-Hant Charges title and a management-fee kind', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'charges', 'default', 'zh-Hant'), { waitUntil: 'load' });

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-HK');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('管理費帳單');
  await expect(page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"]')).toContainText('何美儀');
  await expect(page.locator('[data-testid="charges-fixture-label"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="charges-table"]')).not.toContainText('chg_');
});
