/**
 * Administration → Email: settings form, session save, test outbox row.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

test('Administration Email form saves in session and sends a test outbox row', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'adminEmail', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.emailTitle.en);
  await expect(page.locator('[data-testid="admin-email-form"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-email-secrets-note"]')).toBeVisible();
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="admin-email-host"]')).toHaveValue('smtp.wingfu.example');
  await expect(page.locator('[data-testid="admin-email-smtp-pass"]')).toHaveClass(/pemo-field-masked/);

  await page.locator('[data-testid="admin-email-from-name"]').fill('Wing Fu Garden office');
  await page.locator('[data-testid="admin-email-save"]').click();
  await expect(page.locator('[data-testid="admin-email-saved"]')).toBeVisible();

  await page.locator('[data-testid="admin-email-send-test"]').click();
  const testRow = page.locator('[data-testid="admin-email-outbox"] [data-testid="outbox-row"][data-charge-id="admin_email_test"]');
  await expect(testRow).toBeVisible();
  await expect(testRow).toContainText('alex.chen@wingfu.example');
  await expect(page.locator('[data-testid="admin-email-test-result"]')).toBeVisible();
});

test('Administration Email title localises in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'adminEmail', 'default', 'zh-Hant'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.emailTitle['zh-Hant']);
  await expect(page.locator('[data-testid="admin-email-save"]')).toHaveText(MESSAGES.admin.emailSave['zh-Hant']);
  await expect(page.locator('[data-testid="admin-email-send-test"]')).toHaveText(MESSAGES.admin.emailSendTest['zh-Hant']);
});
