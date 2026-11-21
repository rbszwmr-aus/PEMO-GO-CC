/**
 * Scheduled generic invoice: PDF download, process due → outbox, schedule gate.
 */

import { readFileSync } from 'node:fs';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('invoice PDF download from charge detail is non-empty PDF bytes', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'chargesDetail', 'detail', 'en') + '&charge=chg_wfg_a1_202609', {
    waitUntil: 'load',
  });

  await expect(page.locator('[data-testid="charges-detail"]')).toHaveAttribute(
    'data-charge-id',
    'chg_wfg_a1_202609',
  );
  await expect(page.locator('[data-testid="charge-invoice-number"]')).toContainText('INV-WFG-A1-202609');
  await expect(page.locator('[data-testid="invoice-send-badge"]').first()).toContainText('Due to send');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="invoice-pdf-download"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('INV-WFG-A1-202609.pdf');
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.byteLength).toBeGreaterThan(400);
  expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  expect(bytes.toString('utf8')).toContain('INV-WFG-A1-202609');
});

test('process due invoice sends writes an outbox entry for a due charge', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'charges', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"]'))
    .toHaveAttribute('data-invoice-send', 'due');
  await expect(page.locator('[data-testid="outbox-row"][data-charge-id="chg_wfg_a1_202609"]'))
    .toHaveCount(0);

  await page.locator('[data-testid="process-due-invoice-sends"]').click();

  const dueRow = page.locator('[data-testid="outbox-row"][data-charge-id="chg_wfg_a1_202609"]');
  await expect(dueRow).toBeVisible();
  await expect(dueRow).toContainText('ho.meiyi@wingfu.example');
  await expect(dueRow).toContainText('Sept 2026');
  await expect(dueRow).not.toContainText('INV-WFG');
  await expect(page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"]'))
    .toHaveAttribute('data-invoice-send', 'sent');

  await page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_a1_202609"] [data-testid="charge-open"]').click();
  await page.locator('[data-testid="charge-pane-tab"][data-tab="emails"]').click();
  await expect(page.locator('[data-testid="charge-outbox"] [data-testid="outbox-row"]')).toBeVisible();
  await page.locator('[data-testid="charge-pane-tab"][data-tab="details"]').click();
  await expect(page.locator('[data-testid="charge-invoice-sent"]')).not.toHaveText('Not sent');
});

test('schedule gate leaves a future charge unsent after Run due invoice sends', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'charges', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_c3_202609"]'))
    .toHaveAttribute('data-invoice-send', 'scheduled');

  await page.locator('[data-testid="process-due-invoice-sends"]').click();

  await expect(page.locator('[data-testid="outbox-row"][data-charge-id="chg_wfg_a1_202609"]')).toBeVisible();
  await expect(page.locator('[data-testid="outbox-row"][data-charge-id="chg_wfg_c3_202609"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_c3_202609"]'))
    .toHaveAttribute('data-invoice-send', 'scheduled');

  await page.locator('[data-testid="charges-row"][data-charge-id="chg_wfg_c3_202609"] [data-testid="charge-open"]').click();
  await expect(page.locator('[data-testid="charges-detail"]')).toHaveAttribute(
    'data-charge-id',
    'chg_wfg_c3_202609',
  );
  await page.locator('[data-testid="charge-pane-tab"][data-tab="emails"]').click();
  await expect(page.locator('[data-testid="charge-outbox"] [data-testid="outbox-row"]')).toHaveCount(0);
  await page.locator('[data-testid="charge-pane-tab"][data-tab="details"]').click();
  await expect(page.locator('[data-testid="chain-dialog"] [data-testid="invoice-send-badge"]').first()).toContainText('Scheduled');
  await expect(page.locator('[data-testid="charge-invoice-sent"]')).toHaveText('Not sent');
});

test('Send goes review → confirm, and success shows only after the outbox entry', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'chargesDetail', 'detail', 'en') + '&charge=chg_wfg_a1_202609', { waitUntil: 'load' });
  await page.locator('[data-testid="charge-pane-tab"][data-tab="emails"]').click();
  await expect(page.locator('[data-testid="charge-outbox"] [data-testid="outbox-row"]')).toHaveCount(0);
  await page.locator('[data-testid="charge-pane-tab"][data-tab="details"]').click();
  await expect(page.locator('[data-testid="invoice-send-review"]')).toHaveCount(0);
  await page.locator('[data-testid="send-invoice-now"]').click();
  await expect(page.locator('[data-testid="invoice-send-review"]')).toBeVisible();
  await expect(page.locator('[data-testid="invoice-send-review-to"]')).toContainText('ho.meiyi@wingfu.example');
  await expect(page.locator('[data-testid="invoice-send-result"]')).toHaveCount(0);
  await page.locator('[data-testid="invoice-send-confirm"]').click();
  await expect(page.locator('[data-testid="invoice-send-result"]')).toContainText('recorded in the outbox');
  await page.locator('[data-testid="charge-pane-tab"][data-tab="emails"]').click();
  await expect(page.locator('[data-testid="charge-outbox"] [data-testid="outbox-row"]')).toHaveCount(1);
  await page.locator('[data-testid="charge-pane-tab"][data-tab="details"]').click();
  await expect(page.locator('[data-testid="send-invoice-now"]')).toBeDisabled();
});
