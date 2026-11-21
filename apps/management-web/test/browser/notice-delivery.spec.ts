/**
 * COMMUNICATE → Notices → Delivery: schedule → due job → email outbox,
 * print PDF, lobby / portal status. Runs against dist/ via the harness.
 */

import { readFileSync } from 'node:fs';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { NOTICE_DELIVERY_FIXTURES } from '../../src/communicate/notice-delivery.ts';
import { WFG_STORY_IDS } from '../../src/data/notices-wfg-corpus.ts';

const DUE = NOTICE_DELIVERY_FIXTURES.due;
const LATER = NOTICE_DELIVERY_FIXTURES.later;
const DRAFT = 'ntc_0820_bbq';

test('schedule a draft notice then Run due writes an email outbox row', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=s5detail&state=detail&lang=en&notice=${DRAFT}`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="notice-delivery"]')).toHaveAttribute('data-notice-id', DRAFT);
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.draft.en);
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  await page.locator('[data-testid="delivery-channel-email"]').check();
  await page.locator('[data-testid="delivery-channel-print"]').check();
  await page.locator('[data-testid="delivery-channel-lobby"]').check();
  await page.locator('[data-testid="delivery-channel-portal"]').check();
  await page.locator('[data-testid="delivery-scheduled-at"]').fill('2026-09-19T09:00:00+08:00');
  await page.locator('[data-testid="schedule-notice-delivery"]').click();

  await expect(page.locator('[data-testid="notice-delivery-saved"]')).toBeVisible();
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.scheduled.en);
  await expect(page.locator('[data-testid="notice-delivery-due"]')).toBeVisible();
  await expect(page.locator('[data-testid="lobby-playlist-status"]')).toHaveAttribute('data-display', 'queued');
  await expect(page.locator('[data-testid="portal-publish-status"]')).toHaveAttribute('data-portal', 'pending');

  await page.locator('[data-testid="notice-delivery"] [data-testid="process-due-notice-deliveries"]').click();

  const emailRow = page.locator('[data-testid="notice-delivery-row"][data-channel="email"]').first();
  await expect(emailRow).toBeVisible();
  await expect(emailRow).toContainText('ho.meiyi@wingfu.example');
  await expect(page.locator('[data-testid="notice-delivery-row"][data-channel="print"]')).toBeVisible();
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.sent_displaying.en);
  await expect(page.locator('[data-testid="lobby-playlist-status"]')).toHaveAttribute('data-display', 'displaying');
  await expect(page.locator('[data-testid="portal-publish-status"]')).toHaveAttribute('data-portal', 'published');
});

test('print PDF download from notice delivery is non-empty PDF bytes', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=s5detail&state=detail&lang=en&notice=${DUE}`, {
    waitUntil: 'load',
  });

  await expect(page.locator('[data-testid="notice-delivery"]')).toHaveAttribute('data-notice-id', DUE);
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.scheduled.en);
  await expect(page.locator('[data-testid="notice-delivery-due"]')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="notice-poster-pdf-download"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe(`notice-${DUE}-poster.pdf`);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.byteLength).toBeGreaterThan(400);
  expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
  expect(bytes.toString('utf8')).toContain('ESTATE NOTICE');
  expect(bytes.toString('utf8')).toContain(DUE);
});

test('Run due deliveries sends the due fee reminder and leaves the later AGM unsent', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's5', 'wfg', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="s5-wfg-fixture-label"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.feeReminder}"]`)).toBeVisible();

  await page.locator('[data-testid="notice-delivery-actions"] [data-testid="process-due-notice-deliveries"]').click();

  // The send job settles asynchronously and re-renders the list; a click that lands mid-render opens nothing, so retry it.
  await expect(async () => {
    await page.locator(`[data-testid="s5-row"][data-notice-id="${DUE}"] [data-testid="s5-open"]`).click();
    await expect(page.locator('[data-testid="notice-delivery"]')).toHaveAttribute('data-notice-id', DUE, { timeout: 1500 });
  }).toPass({ timeout: 8000 });
  await expect(page.locator('[data-testid="notice-delivery-row"][data-channel="email"]').first()).toContainText('ho.meiyi@wingfu.example');
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.sent_displaying.en);
  await expect(page.locator('[data-testid="lobby-playlist-status"]')).toHaveAttribute('data-display', 'displaying');
  await expect(page.locator('[data-testid="portal-publish-status"]')).toHaveAttribute('data-portal', 'published');

  await page.locator('[data-testid="nav-item"][data-nav="notices"]').click();
  await page.locator(`[data-testid="s5-row"][data-notice-id="${LATER}"] [data-testid="s5-open"]`).click();
  await expect(page.locator('[data-testid="notice-delivery"]')).toHaveAttribute('data-notice-id', LATER);
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.scheduled.en);
  await expect(page.locator('[data-testid="notice-delivery-outbox-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="lobby-playlist-status"]')).toHaveAttribute('data-display', 'queued');
  await expect(page.locator('[data-testid="portal-publish-status"]')).toHaveAttribute('data-portal', 'pending');
});

test('Delivery panel localises in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=s5detail&state=detail&lang=zh-Hant&notice=${DUE}`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="notice-delivery-heading"]')).toHaveText(MESSAGES.s5.deliveryHeading['zh-Hant']);
  await expect(page.locator('[data-testid="schedule-notice-delivery"]')).toHaveText(MESSAGES.s5.scheduleDelivery['zh-Hant']);
  await expect(page.locator('[data-testid="delivery-channels"]')).toContainText(MESSAGES.s5.deliveryChannel.email['zh-Hant']);
  await expect(page.locator('[data-testid="delivery-channels"]')).toContainText(MESSAGES.s5.deliveryChannel.print['zh-Hant']);
});
