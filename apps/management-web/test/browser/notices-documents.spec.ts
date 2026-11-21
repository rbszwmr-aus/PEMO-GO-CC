/**
 * COMMUNICATE → Notices (Wing Fu Garden) and Documents.
 * List (filters, SCOPE rail, status chips) → detail → outstanding →
 * Documents list+detail. Runs against dist/ via the harness.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { WFG_STORY_IDS } from '../../src/data/notices-wfg-corpus.ts';

test('COMMUNICATE Notices opens the Wing Fu Garden list with chips and SCOPE rail', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await page.locator('[data-testid="nav-item"][data-nav="notices"]').click();

  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.s5.listTitle.en);
  await expect(page.locator('[data-testid="s5-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="s5-wfg-fixture-label"]')).toBeVisible();
  await expect(page.locator('[data-testid="s5-stats"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('s5');
  await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBe('wfg');

  const fee = page.locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.feeReminder}"]`);
  const maint = page.locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.maintenance}"]`);
  const agm = page.locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.agm}"]`);
  await expect(fee).toBeVisible();
  await expect(maint).toBeVisible();
  await expect(agm).toBeVisible();
  await expect(fee.locator('[data-testid="s5-open"]')).toContainText('Q3 management fee reminder');
});

test('status chip filters the WFG list and SCOPE rail keeps Block A rows', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's5', 'wfg', 'en'), { waitUntil: 'load' });

  const before = await page.locator('[data-testid="s5-row"]').count();
  expect(before).toBeGreaterThan(3);

  await page.locator('[data-testid="s5-status-tab"][data-tab="draft"]').click();
  await expect(page.locator('[data-testid="s5-row"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="s5-row"]')).toHaveAttribute('data-lifecycle-state', 'draft');

  await page.locator('[data-testid="s5-status-tab"][data-tab="all"]').click();
  await expect(page.locator('[data-testid="s5-row"]')).toHaveCount(before);

  const blockA = page.locator('[data-testid="scope-rail-node"][data-kind="building"]').filter({ hasText: 'Block A' });
  await blockA.locator('[data-testid="scope-rail-pick"]').click();
  await expect(page.locator('[data-testid="scope-filter-note"][data-screen="s5"]')).toBeVisible();
  const ids = await page.locator('[data-testid="s5-row"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.noticeId ?? ''),
  );
  expect(ids).toContain(WFG_STORY_IDS.maintenance);
  expect(ids).not.toContain(WFG_STORY_IDS.feeReminder);
  expect(ids).not.toContain(WFG_STORY_IDS.agm);
});

test('fee reminder opens detail, outstanding, and the paired fee-schedule document', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=s5&state=wfg&lang=en`, { waitUntil: 'load' });

  const feeRow = page.locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.feeReminder}"]`);
  await feeRow.focus();
  await expect(feeRow).toBeFocused();
  await feeRow.press('Enter');
  await expect(page.locator('[data-testid="notice-title"]')).toContainText('Q3 management fee reminder');
  await expect(page.locator('[data-testid="body-zh"]')).toContainText('第三季管理費');
  await expect.poll(() => new URL(page.url()).searchParams.get('notice')).toBe(WFG_STORY_IDS.feeReminder);

  await page.locator('[data-testid="open-outstanding"]').click();
  await expect(page.locator('[data-testid="s5ack-table"]')).toBeVisible();
  // id-sweep: the page names the notice by its title; the id is in the collapsed IT details.
  await expect(page.locator('[data-testid="outstanding-notice-title"]')).not.toHaveText(WFG_STORY_IDS.feeReminder); // the notice's title, never its id
  await expect(page.locator('[data-testid="outstanding-it-details"]')).toContainText(WFG_STORY_IDS.feeReminder);
  await expect(page.locator('[data-testid="recipient-row"]')).toHaveCount(4);

  await page.goto(`${base}/?screen=s5detail&state=detail&lang=en&notice=${WFG_STORY_IDS.feeReminder}`, { waitUntil: 'load' });
  await page.locator('[data-testid="related-document"]').click();
  await expect(page.locator('[data-testid="documents-detail"]')).toHaveAttribute('data-document-id', 'doc_wfg_fee_schedule');
  await expect(page.locator('[data-testid="document-pdf-stub"]')).toBeVisible();
  await expect(page.locator('[data-testid="document-pdf-stub"]')).toContainText('WFG-fee-schedule-2026-27.pdf');
});

test('COMMUNICATE Documents opens the library and a circular detail in both locales', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="nav-item"][data-nav="documents"]').click();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.documents.listTitle.en);
  await expect(page.locator('[data-testid="documents-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('documents');

  const fee = page.locator('[data-testid="documents-row"][data-document-id="doc_wfg_fee_schedule"]');
  const rules = page.locator('[data-testid="documents-row"][data-document-id="doc_wfg_house_rules"]');
  const agm = page.locator('[data-testid="documents-row"][data-document-id="doc_wfg_agm_circular"]');
  await expect(fee).toBeVisible();
  await expect(rules).toBeVisible();
  await expect(agm).toBeVisible();

  await page.locator('[data-testid="documents-bar-status"]').selectOption('superseded');
  await expect(page.locator('[data-testid="documents-row"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="documents-row"]')).toHaveAttribute('data-document-id', 'doc_wfg_house_rules_2019');

  await page.locator('[data-testid="documents-bar-clear"]').click();
  await agm.locator('[data-testid="document-open"]').click();
  await expect(page.locator('[data-testid="documents-detail"]')).toHaveAttribute('data-document-id', 'doc_wfg_agm_circular');
  await expect(page.locator('[data-testid="document-pdf-stub"]')).toContainText('WFG-AGM-2026-circular.pdf');
  await expect.poll(() => new URL(page.url()).searchParams.get('document')).toBe('doc_wfg_agm_circular');

  await page.locator('[data-testid="related-notice"]').click();
  await expect(page.locator('[data-testid="notice-title"]')).toContainText('Annual general meeting');

  await page.goto(urlFor(base, 'documents', 'list', 'zh-Hant'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.documents.listTitle['zh-Hant']);
  await expect(page.locator('[data-testid="documents-row"][data-document-id="doc_wfg_house_rules"]')).toContainText('榮富花園屋苑守則');
});

test('WFG list compose pointer and a permitted act open write outcomes', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's5', 'wfg', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="compose-from-tree"]')).toBeVisible();
  await page.locator('[data-testid="compose-from-tree"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('s3');

  await page.goto(`${base}/?screen=s5&state=wfg&lang=en`, { waitUntil: 'load' });
  await page
    .locator(`[data-testid="s5-row"][data-notice-id="${WFG_STORY_IDS.feeReminder}"] [data-act="correctNotice"]`)
    .click();
  await expect(page.locator('[data-testid="act-confirm"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('s5act');
  await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBe('correct');
  await expect.poll(() => new URL(page.url()).searchParams.get('notice')).toBe(WFG_STORY_IDS.feeReminder);

  await page.goto(
    `${base}/?screen=s5act&state=correct-recorded&lang=en&notice=${WFG_STORY_IDS.feeReminder}`,
    { waitUntil: 'load' },
  );
  await expect(page.locator('[data-testid="act-recorded"]')).toBeVisible();
});
