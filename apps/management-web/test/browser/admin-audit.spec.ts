/**
 * Administration Audit log (S04): who did what, to what, where and when, in plain words, newest first.
 * Under ADMINISTRATION, SCOPE rail off. Filters, details, export and paging run against the contract-shaped
 * fixture; the Backend cases stub GET /admin/audit-log with the shapes of
 * docs/contracts/audit-log-v0-PROPOSED_v0.1.md.
 */

import type { Page } from '@playwright/test';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { AUDIT_FIXTURE } from '../../src/audit/audit-fixture.ts';
import { AUDIT_ACTIONS } from '../../src/audit/audit-log.ts';

const TOTAL = AUDIT_FIXTURE.events.length;
const rows = (page: Page) => page.locator('[data-testid="admin-audit-row"]');
const A = MESSAGES.audit;

async function open(page: Page, lang: 'en' | 'zh-Hant' | 'zh-Hans' = 'en'): Promise<void> {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'adminAudit', 'list', lang), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="admin-audit-table"]')).toBeVisible();
}

test('Administration Audit log lists the entries in plain words, newest first, with no system ids on the page', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  await page.locator('[data-testid="nav-item"][data-nav="admin"] .pemo-nav__chevron').click();
  const auditNav = page.locator('[data-testid="nav-item"][data-nav="adm-audit"]');
  await expect(auditNav).toContainText(MESSAGES.admin.auditListTitle.en);
  await auditNav.click();

  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.auditListTitle.en);
  await expect(page.locator('[data-testid="admin-audit-table"]')).toBeVisible();
  await expect(rows(page)).toHaveCount(TOTAL);
  await expect(page.locator('[data-testid="admin-audit-count"]')).toHaveAttribute('data-count', String(TOTAL));
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);

  // Newest first, in words.
  await expect(rows(page).first()).toContainText('Sent an invoice by email');
  await expect(rows(page).first()).toContainText('Chan Mei-ling 陳美玲');
  await expect(rows(page).first()).toContainText('Invoice');
  await expect(rows(page).first()).toContainText('Block A › 12/F › Flat A1');
  await expect(rows(page).last()).toContainText('Set up an organisation');
  await expect(rows(page).last()).toContainText('System (set-up)');
  await expect(page.locator('[data-testid="admin-audit-source"]')).toBeVisible();

  // No ids, no codes: not in the rows, and the IT details are not open.
  const main = await page.locator('main').innerText();
  for (const leak of [/\baud_/, /\bstf_/, /\bgrp_/, /\bntc_/, /\bunit_wfg/, /\bblk_wfg/, /\best_/, /_notice\b/, /_email\b/, /\bINV-/]) {
    expect(main, `${leak} on the main view`).not.toMatch(leak);
  }
  await expect(page.locator('[data-testid="admin-audit-it-details"]')).toHaveCount(0);
  // Nothing edits or deletes an entry.
  await expect(page.locator('[data-testid="admin-audit"] button', { hasText: /edit|delete|remove|undo/i })).toHaveCount(0);
});

test('Audit log filters by person, action, kind, place and day, and Clear brings everything back', async ({ strictPage: page }) => {
  await open(page);

  await page.locator('[data-testid="admin-audit-filter-actor"]').selectOption('stf_wfg_alex');
  await expect(rows(page).first()).toBeVisible();
  const mine = await rows(page).count();
  expect(mine).toBeGreaterThan(0);
  expect(mine).toBeLessThan(TOTAL);
  await expect(page.locator('[data-testid="admin-audit-row"]:not([data-actor="stf_wfg_alex"])')).toHaveCount(0);

  await page.locator('[data-testid="admin-audit-filter-action"]').selectOption('confer_grant');
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('[data-testid="admin-audit-row"]:not([data-action="confer_grant"])')).toHaveCount(0);

  await page.locator('[data-testid="admin-audit-clear"]').click();
  await expect(rows(page)).toHaveCount(TOTAL);
  await expect(page.locator('[data-testid="admin-audit-clear"]')).toHaveCount(0);

  await page.locator('[data-testid="admin-audit-filter-type"]').selectOption('notice');
  const notices = await rows(page).count();
  expect(notices).toBeGreaterThan(5);
  await expect(page.locator('[data-testid="admin-audit-row"]:not([data-action$="_notice"]):not([data-action="send_notice_email"])')).toHaveCount(0);

  // Place: a flat. The option reads as the flat’s name.
  await page.locator('[data-testid="admin-audit-clear"]').click();
  await page.locator('[data-testid="admin-audit-filter-place"]').selectOption({ label: 'Block A › 12/F › Flat A1' });
  await expect(rows(page).first()).toBeVisible();
  for (const r of await rows(page).all()) await expect(r).toContainText('Block A › 12/F › Flat A1');

  // Days are Hong Kong days; the last day shown is whole.
  await page.locator('[data-testid="admin-audit-clear"]').click();
  await page.locator('[data-testid="admin-audit-filter-from"]').fill('2026-09-19');
  await page.locator('[data-testid="admin-audit-filter-to"]').fill('2026-09-19');
  await expect(rows(page)).toHaveCount(AUDIT_FIXTURE.events.filter((e) => e.occurredAt.startsWith('2026-09-19')).length);
  await page.locator('[data-testid="admin-audit-filter-from"]').fill('2027-01-01');
  await page.locator('[data-testid="admin-audit-filter-to"]').fill('');
  await expect(page.locator('[data-testid="admin-audit-filter-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-audit-export"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-audit-table"]')).toHaveCount(0);
});

test('Audit log Details shows who they acted as, the reason and when it was recorded; ids are behind IT details', async ({ strictPage: page }) => {
  await open(page);
  const declined = page.locator('[data-testid="admin-audit-row"][data-action="decline_notice"]');
  await declined.locator('[data-testid="admin-audit-toggle"]').click();
  const detail = page.locator('[data-testid="admin-audit-detail"]');
  await expect(detail).toHaveCount(1);
  await expect(detail).toContainText('Acted as');
  await expect(detail).toContainText('Approver');
  await expect(detail).toContainText('Reason');
  await expect(detail).toContainText('Poor timing');
  await expect(detail).toContainText('Recorded');
  const it = detail.locator('[data-testid="admin-audit-it-details"]');
  await expect(it).toBeVisible();
  await expect(it).not.toHaveAttribute('open', '');
  await expect(it.locator('.pemo-identifier', { hasText: /^aud_/ })).toHaveCount(1);
  await expect(it.locator('.pemo-identifier', { hasText: /^ntc_/ })).toHaveCount(1);
  await expect(declined.locator('[data-testid="admin-audit-toggle"]')).toHaveText('Hide details');
  await declined.locator('[data-testid="admin-audit-toggle"]').click();
  await expect(detail).toHaveCount(0);

  // A system entry has no person, no group and no browser to show.
  const setup = page.locator('[data-testid="admin-audit-row"][data-action="provision_organization"]');
  await setup.locator('[data-testid="admin-audit-toggle"]').click();
  await expect(page.locator('[data-testid="admin-audit-detail"]')).not.toContainText('Acted as');
  await expect(page.locator('[data-testid="admin-audit-detail"]')).toContainText('None given');
});

test('Audit log Export CSV downloads the filtered entries with the contract’s 17 columns and a byte-order mark', async ({ strictPage: page }) => {
  await open(page);
  await page.locator('[data-testid="admin-audit-filter-actor"]').selectOption('stf_wfg_manager');
  const count = await rows(page).count();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="admin-audit-export"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^audit-log-\d{8}\.csv$/);
  const path = await download.path();
  const fs = await import('node:fs');
  const bytes = fs.readFileSync(path);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.toString('utf8').slice(1).split('\r\n');
  expect(lines[0]!.split(',')).toHaveLength(17);
  expect(lines[0]).toMatch(/^occurred_at,recorded_at,actor_id,actor_name,/);
  expect(lines.filter(Boolean)).toHaveLength(count + 1);
  expect(lines[1]).toContain('stf_wfg_manager');
});

for (const lang of ['zh-Hant', 'zh-Hans'] as const) {
  test(`Audit log reads in ${lang}: every action and kind is a sentence, none is a code`, async ({ strictPage: page }) => {
    await open(page, lang);
    await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.auditListTitle[lang]);
    const body = await page.locator('main').innerText();
    for (const a of AUDIT_ACTIONS) expect(body, a).not.toContain(a);
    const first = AUDIT_FIXTURE.events[0]!;
    await expect(rows(page).first()).toContainText(MESSAGES.audit.action[first.action as (typeof AUDIT_ACTIONS)[number]][lang]);
    await expect(rows(page).first()).toContainText(MESSAGES.audit.entityType.invoice[lang]);
    await expect(page.locator('[data-testid="admin-audit-filter-action"] option').nth(1)).toHaveText(MESSAGES.audit.action.confer_grant[lang]);
    await expect(page.locator('[data-testid="admin-audit-export"]')).toHaveText(A.exportCsv[lang]);
  });
}

test('membership change and notice send append Audit log rows without a reload', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_security&source=fixture`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="admin-groups-detail"]')).toBeVisible();
  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="members"]').click();
  await page.locator('[data-testid="admin-group-add-member"]').selectOption('stf_wfg_alex');
  await page.locator('[data-testid="admin-group-add-member-submit"]').click();
  await expect(page.locator('[data-testid="admin-group-member-row"][data-staff-id="stf_wfg_alex"]')).toBeVisible();

  await page.locator('[data-testid="chain-dialog-close"]').click();
  await page.locator('[data-testid="nav-item"][data-nav="notices"]').click();
  await expect(page.locator('[data-testid="s5-row"][data-notice-id="ntc_wfg_fee_q3"]')).toBeVisible();
  await page.locator('[data-testid="s5-row"][data-notice-id="ntc_wfg_fee_q3"] [data-testid="s5-open"]').click();
  await expect(page.locator('[data-testid="notice-delivery"]')).toHaveAttribute('data-notice-id', 'ntc_wfg_fee_q3');
  await page.locator('[data-testid="send-notice-now"]').click();
  await expect(page.locator('[data-testid="notice-delivery-status"]')).toContainText(MESSAGES.s5.noticeDeliveryStatus.sent_displaying.en);

  const auditNav = page.locator('[data-testid="nav-item"][data-nav="adm-audit"]');
  if (await auditNav.count() === 0) {
    await page.locator('[data-testid="nav-item"][data-nav="admin"] .pemo-nav__chevron').click();
  }
  await auditNav.click();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.auditListTitle.en);
  await expect(page.locator('[data-testid="admin-audit-row"][data-session="true"]')).not.toHaveCount(0);
  const added = page.locator('[data-testid="admin-audit-row"][data-session="true"][data-action="add_membership"]');
  await expect(added).toBeVisible();
  await expect(added).toHaveAttribute('data-actor', 'stf_wfg_alex');
  await expect(added).toContainText('Alex Chen');
  await expect(added).toContainText('Added someone to a group');
  await expect(added).not.toContainText('grp_wfg_security');
  const sent = page.locator('[data-testid="admin-audit-row"][data-session="true"][data-action="publish_notice"], [data-testid="admin-audit-row"][data-session="true"][data-action="send_notice_email"]');
  await expect(sent.first()).toBeVisible();
  await expect(sent.first()).toHaveAttribute('data-actor', 'stf_wfg_alex');
  await expect(sent.first()).not.toContainText('ntc_wfg_fee_q3');
  await expect.poll(() => rows(page).count()).toBeGreaterThan(TOTAL);
});

/* ------------------------------------------------------------------ Backend */

const event = (n: number, over: Record<string, unknown> = {}) => ({
  eventId: `aud_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`,
  occurredAt: `2026-11-18T10:${String(59 - n).padStart(2, '0')}:00.000+08:00`,
  recordedAt: `2026-11-18T10:${String(59 - n).padStart(2, '0')}:00.010+08:00`,
  source: 'principal',
  actor: { principalId: 'stf_wfg_manager', displayName: 'Chan Mei-ling 陳美玲' },
  authority: { groupId: 'grp_of_one_stf_wfg_manager', role: 'estate_staff' },
  action: 'add_estate_contact',
  entity: { type: 'estate_contact', id: `ctc_${n}` },
  place: { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
  reasonCode: null,
  requestId: `f29dbc27-6aa5-440f-b8a7-${String(n).padStart(12, '0')}`,
  clientIp: '127.0.0.1',
  userAgent: 'curl/8.18.0',
  ...over,
});
const meta = { correlationId: '11111111-2222-4333-8444-555555555555', contractVersion: '2.6.0', generatedAt: '2026-11-18T19:21:00+08:00' };
const problem403 = { type: 'https://pemo.local/problems/insufficient-scope', title: 'Not permitted', status: 403, correlationId: 'c-403', staffMessage: { en: 'Your role cannot read the audit log.', 'zh-Hant': '你的角色不能讀取審計紀錄。' }, retryable: false };

test('Audit log against Backend: filters go to the route as the contract names them, pages follow the cursor, export asks for csv', async ({ page }) => {
  // A plain page: Backend stubs answer non-fixture routes the strict page would flag.
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  const asked: URLSearchParams[] = [];
  await page.route('**/api/management-web/v0/admin/audit-log**', (r) => {
    const q = new URL(r.request().url()).searchParams;
    asked.push(q);
    if (q.get('format') === 'csv') {
      return r.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="audit-log-20261118.csv"', 'X-Audit-Export-Truncated': 'true' }, body: '\uFEFFoccurred_at,recorded_at\r\n' });
    }
    if (q.get('limit') === '1') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta, events: [], page: { limit: 1, hasMore: false, nextCursor: null } }) });
    if (q.get('cursor') === 'page-2') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta, events: [event(3), event(4)], page: { limit: 50, hasMore: false, nextCursor: null } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta, events: [event(1), event(2)], page: { limit: 50, hasMore: true, nextCursor: 'page-2' } }) });
  });
  await page.goto(urlFor(base, 'adminAudit', 'list', 'en', null), { waitUntil: 'load' });
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('.pemo-source')).toHaveAttribute('data-source', 'live');
  // The estate is in the tree, so the place reads as its name, not est_wing_fu_garden.
  await expect(rows(page).first()).toContainText('Wing Fu Garden');
  await expect(rows(page).first()).not.toContainText('est_wing_fu_garden');

  await page.locator('[data-testid="admin-audit-more"]').click();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.locator('[data-testid="admin-audit-more"]')).toHaveCount(0);
  expect(asked.some((q) => q.get('cursor') === 'page-2')).toBe(true);

  await page.locator('[data-testid="admin-audit-filter-actor"]').selectOption('stf_wfg_manager');
  await page.locator('[data-testid="admin-audit-filter-to"]').fill('2026-11-18');
  await expect.poll(() => asked.some((q) => q.get('actor') === 'stf_wfg_manager' && q.get('to') === '2026-11-19')).toBe(true);

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="admin-audit-export"]').click()]);
  expect(download.suggestedFilename()).toBe('audit-log-20261118.csv');
  await expect(page.locator('[data-testid="admin-audit-export-truncated"]')).toBeVisible();
  const csv = asked.find((q) => q.get('format') === 'csv')!;
  expect(csv.get('actor')).toBe('stf_wfg_manager');
  expect(csv.get('to')).toBe('2026-11-19');
  expect(csv.has('limit')).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('Audit log against Backend: a 403 is a denied state, not a table, and an empty log says nothing is recorded yet', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  await page.route('**/api/management-web/v0/admin/audit-log**', (r) => r.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify(problem403) }));
  await page.goto(urlFor(base, 'adminAudit', 'list', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toHaveAttribute('data-problem-kind', 'insufficient-scope');
  await expect(page.locator('[data-testid="state-problem"]')).toContainText('Your role cannot read the audit log.');
  await expect(page.locator('[data-testid="admin-audit-table"], [data-testid="admin-audit-export"], [data-testid="admin-audit-filters"]')).toHaveCount(0);

  await page.unroute('**/api/management-web/v0/admin/audit-log**');
  await page.route('**/api/management-web/v0/admin/audit-log**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta, events: [], page: { limit: 50, hasMore: false, nextCursor: null } }) }));
  await page.goto(urlFor(base, 'adminAudit', 'list', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="admin-audit-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-audit-export"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-audit-filter-empty"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Nav: a 403 on the Audit log or Integration status leaves that item out of the nav; the rest stay', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  const nav = (id: string) => page.locator(`[data-testid="nav-item"][data-nav="${id}"]`);
  const refuse = (r: import('@playwright/test').Route) => r.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify(problem403) });
  await page.route('**/api/management-web/v0/admin/audit-log**', refuse);
  await page.route('**/api/management-web/v0/integration-status**', refuse);
  await page.goto(urlFor(base, 'adminAudit', 'list', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toBeVisible();
  await expect(nav('adm-lists')).toBeVisible(); // its neighbours in Administration stay
  await expect(nav('adm-audit')).toHaveCount(0);
  await expect(nav('integrations')).toHaveCount(0);
  await expect(nav('reports')).toBeVisible();

  await page.unroute('**/api/management-web/v0/admin/audit-log**');
  await page.unroute('**/api/management-web/v0/integration-status**');
  await page.route('**/api/management-web/v0/admin/audit-log**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta, events: [], page: { limit: 50, hasMore: false, nextCursor: null } }) }));
  await page.route('**/api/management-web/v0/integration-status**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(urlFor(base, 'adminAudit', 'list', 'en', null), { waitUntil: 'load' });
  await expect(nav('adm-audit')).toBeVisible();
  await expect(nav('integrations')).toBeVisible(); // a 404 is “not there”, not a refusal
  expect(pageErrors).toEqual([]);
});
