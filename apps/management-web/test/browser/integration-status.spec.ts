/**
 * Integration status (S05): what the 2IoT Hub has told PEMO about the building systems.
 *
 * The Hub is shown first, as the boundary, and the systems under it. A silent Hub turns every system into
 * Unknown, never Offline. A narrower reader gets no Hub card. No system id is on a main view and nothing on
 * the screen starts or stops a system. The fixture is the contract’s response (integration-status-v0
 * section 5); the Backend cases stub the route with its shapes.
 */

import type { Page } from '@playwright/test';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { INTEGRATION_FIXTURE, integrationDetail, integrationList } from '../../src/integration/integration-fixture.ts';

const I = MESSAGES.integration;
type Lang = 'en' | 'zh-Hant' | 'zh-Hans';
const rows = (page: Page) => page.locator('[data-testid="integration-row"]');
const row = (page: Page, ref: string) => page.locator(`[data-testid="integration-row"][data-system="${ref}"]`);

async function open(page: Page, state = 'list', lang: Lang = 'en'): Promise<void> {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'integrationStatus', state, lang), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="integration-status"]')).toBeVisible();
}

const LEAKS = [/\bsys_/, /\bblk_/, /\best_/, /\bloc_/, /\bunit_wfg/, /2iothub:/i, /GATEWAY_UNREACHABLE/, /LIFT_2_COMMS/, /0\.1\.0-fixture/, /\bhub_(silent|never_seen)\b/, /\bpemo_map\b/];

test('Integration status shows the Hub first, then the 12 systems, trouble first, with no system ids on the page', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  const nav = page.locator('[data-testid="nav-item"][data-nav="integrations"]');
  await expect(nav).toContainText('Integration status');
  await nav.click();

  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(I.title.en);
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);

  // The boundary is the first thing said.
  await expect(page.locator('[data-testid="integration-hub-title"]')).toContainText('2IoT Hub');
  await expect(page.locator('[data-testid="integration-hub-intro"]')).toHaveAttribute("aria-label", I.hubIntro.en);
  await expect(page.locator('[data-testid="integration-hub-state"]')).toContainText(I.hubState.online.en);
  await expect(page.locator('[data-testid="integration-hub-heartbeat"]')).toContainText(/Last heartbeat 40 sec\.? ago/);
  await expect(page.locator('[data-testid="integration-hub-hint"]')).toHaveCount(0);

  // The numbers of the contract’s summary.
  const kpi = (k: string) => page.locator(`[data-testid="stat-card"][data-stat="${k}"] [data-testid="stat-card-value"]`);
  await expect(kpi('connected')).toHaveText('12');
  await expect(kpi('online')).toHaveText('9');
  await expect(kpi('attention')).toHaveText('2');
  await expect(kpi('maintenance')).toHaveText('1');
  await expect(kpi('devices')).toHaveText('313 / 366');
  await expect(page.locator('[data-testid="stat-card"][data-stat="unknown"]')).toHaveCount(0);

  // 12 rows in the contract’s order: offline, degraded, maintenance, then online by name.
  await expect(rows(page)).toHaveCount(12);
  const order = await rows(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state));
  expect(order).toEqual(INTEGRATION_FIXTURE.systems.map((s) => s.state));
  await expect(rows(page).first()).toContainText('Block A visitor intercom');
  await expect(rows(page).first()).toContainText('Offline');
  await expect(rows(page).first()).toContainText('Intercom is not responding.');
  await expect(rows(page).first()).toContainText('0 of 52 online');
  await expect(rows(page).first()).toContainText('Block A');
  await expect(rows(page).first()).toContainText('18 Nov 2026');
  await expect(row(page, 'sys_wfg_lifts_a')).toContainText('Degraded');
  await expect(row(page, 'sys_wfg_lifts_a')).toContainText('Needs attention');
  await expect(row(page, 'sys_wfg_lifts_a')).toContainText('7 of 8 online');
  await expect(row(page, 'sys_wfg_ev')).toContainText('In maintenance');
  await expect(row(page, 'sys_wfg_ev')).toContainText('Expected back 18 Nov 2026');
  await expect(row(page, 'sys_wfg_cctv')).toContainText('Whole estate');
  await expect(row(page, 'sys_wfg_cctv')).toContainText('64 of 64 online');
  await expect(page.locator('[data-testid="integration-source"]')).toBeVisible();

  // No ids, no codes: not in the rows, and the IT details are closed.
  const main = await page.locator('main').innerText();
  for (const leak of LEAKS) expect(main, `${leak} on the main view`).not.toMatch(leak);
  await expect(page.locator('[data-testid="integration-hub-it-details"]')).not.toHaveAttribute('open', '');

  // PEMO only reads: nothing here starts, stops, resets or changes a system.
  await expect(page.locator('main button', { hasText: /start|stop|restart|reboot|reset|enable|disable|retry|fix|connect now/i })).toHaveCount(0);
  await expect(page.locator('main [data-act]')).toHaveCount(0);
});

test('Integration status filters by words, by status and by place, and Clear brings all 12 back', async ({ strictPage: page }) => {
  await open(page);
  const filter = (k: string) => page.locator(`[data-testid="integration-filters-${k}"]`);
  await page.locator('[data-testid="integration-filters-search"]').fill('lift');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Lifts, Block A');
  await expect(page.locator('[data-testid="integration-count"]')).toHaveAttribute('data-count', '1');
  await page.locator('[data-testid="integration-filters-search"]').fill('zzz');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="integration-no-match"]')).toBeVisible();
  await page.locator('[data-testid="integration-filters-clear"]').click();
  await expect(rows(page)).toHaveCount(12);

  await filter('status').selectOption('offline');
  await expect(rows(page)).toHaveCount(1);
  await filter('status').selectOption('');
  await filter('place').selectOption('blk_wfg_a');
  await expect(rows(page)).toHaveCount(2);
  await filter('place').selectOption('est_wing_fu_garden');
  await expect(rows(page)).toHaveCount(6);
  // Status options are only the states that exist: nothing is Unknown on a healthy day.
  await expect(filter('status').locator('option[value="unknown"]')).toHaveCount(0);
  await page.locator('[data-testid="integration-filters-clear"]').click();
  await expect(rows(page)).toHaveCount(12);
});

test('A silent Hub makes every system Unknown, not Offline, says why, and tells staff to check the Hub first', async ({ strictPage: page }) => {
  await open(page, 'hub-silent');
  await expect(page.locator('[data-testid="integration-hub"]')).toHaveAttribute('data-hub-state', 'silent');
  await expect(page.locator('[data-testid="integration-hub-state"]')).toContainText('Silent');
  await expect(page.locator('[data-testid="integration-hub-sentence"]')).toHaveText(I.hubSentence.silent.en);
  await expect(page.locator('[data-testid="integration-hub-hint"]')).toHaveText(I.hubHint.en);
  await expect(page.locator('[data-testid="integration-hub-heartbeat"]')).toContainText(/4 min\.? ago/);
  await expect(rows(page)).toHaveCount(12);
  const states = await rows(page).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state));
  expect(new Set(states)).toEqual(new Set(['unknown']));
  await expect(rows(page).first()).toContainText('Unknown');
  await expect(rows(page).first()).toContainText(I.unknownReason.hub_silent.en);
  await expect(page.locator('[data-testid="integration-row-state"]', { hasText: /offline/i })).toHaveCount(0);
  // PEMO knows nothing about the devices now: a dash, never a count.
  await expect(page.locator('[data-testid="stat-card"][data-stat="online"] [data-testid="stat-card-value"]')).toHaveText('—');
  await expect(page.locator('[data-testid="stat-card"][data-stat="devices"] [data-testid="stat-card-value"]')).toHaveText('—');
  await expect(page.locator('[data-testid="stat-card"][data-stat="unknown"] [data-testid="stat-card-value"]')).toHaveText('12');
  await expect(rows(page).first()).not.toContainText('online');
});

test('A late Hub is a warning on the Hub only; a Hub never heard from says so', async ({ strictPage: page }) => {
  await open(page, 'hub-late');
  await expect(page.locator('[data-testid="integration-hub"]')).toHaveAttribute('data-hub-state', 'late');
  await expect(page.locator('[data-testid="integration-hub-sentence"]')).toHaveText(I.hubSentence.late.en);
  await expect(page.locator('[data-testid="integration-hub-hint"]')).toBeVisible();
  await expect(row(page, 'sys_wfg_intercom')).toContainText('Offline');
  await expect(row(page, 'sys_wfg_bms')).toContainText('Online');

  await open(page, 'hub-never');
  await expect(page.locator('[data-testid="integration-hub"]')).toHaveAttribute('data-hub-state', 'never');
  await expect(page.locator('[data-testid="integration-hub-sentence"]')).toHaveText(I.hubSentence.never.en);
  await expect(page.locator('[data-testid="integration-hub-heartbeat"]')).toHaveCount(0);
  await expect(rows(page).first()).toContainText(I.unknownReason.hub_never_seen.en);
});

test('A block supervisor gets no Hub card and only their block’s systems; a block with none gets an empty list, not a refusal', async ({ strictPage: page }) => {
  await open(page, 'places');
  await expect(page.locator('[data-testid="integration-status"]')).toHaveAttribute('data-scope', 'places');
  await expect(page.locator('[data-testid="integration-hub"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="integration-places-note"]')).toHaveAttribute("aria-label", I.placesNote.en);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('Block A visitor intercom');
  await expect(rows(page).first()).toContainText('Block A');
  await expect(rows(page).nth(1)).toContainText('Lifts, Block A');
  // They are not told about the Hub itself, even to say it is down.
  await expect(page.locator('main')).not.toContainText('2IoT Hub');
  await expect(page.locator('[data-testid="stat-card"][data-stat="connected"] [data-testid="stat-card-value"]')).toHaveText('2');

  await open(page, 'places-empty');
  await expect(page.locator('[data-testid="integration-empty"]')).toContainText(I.emptyPlacesTitle.en);
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="integration-filters"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-problem"]')).toHaveCount(0);
});

test('A system nobody placed is marked Not placed yet and counted', async ({ strictPage: page }) => {
  await open(page, 'needs-mapping');
  await expect(page.locator('[data-testid="stat-card"][data-stat="not-placed"] [data-testid="stat-card-value"]')).toHaveText('1');
  await expect(row(page, 'sys_wfg_cctv').locator('[data-testid="integration-not-placed"]')).toContainText(I.notPlaced.en);
  await expect(page.locator('[data-testid="integration-not-placed"]')).toHaveCount(1);
});

test('A system opens to what the Hub said, when, and its history; ids are behind IT details; back returns to the list', async ({ strictPage: page }) => {
  await open(page);
  await row(page, 'sys_wfg_intercom').locator('[data-testid="integration-open"]').click();
  await expect(page.locator('[data-testid="integration-detail"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('screen')).toBe('integrationStatusDetail');
  expect(new URL(page.url()).searchParams.get('system')).toBe('sys_wfg_intercom');
  await expect(page.locator('[data-testid="nav-item"][data-nav="integrations"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-testid="integration-detail-title"]')).toContainText('Block A visitor intercom');
  await expect(page.locator('[data-testid="integration-detail-state"]')).toContainText('Offline');
  await expect(page.locator('[data-testid="integration-detail-said"]')).toHaveText('Intercom is not responding.');
  await expect(page.locator('[data-testid="integration-detail-type"]')).toHaveText('Intercom');
  await expect(page.locator('[data-testid="integration-detail-where"]')).toHaveText('Block A');
  await expect(page.locator('[data-testid="integration-detail-devices"]')).toHaveText('0 of 52 online');
  await expect(page.locator('[data-testid="integration-detail-since"]')).toContainText('18 Nov 2026');

  const history = page.locator('[data-testid="integration-history-row"]');
  await expect(history).toHaveCount(3);
  await expect(history.first()).toContainText('Online');
  await expect(history.first()).toContainText('Offline');
  await expect(history.first()).toContainText('Reported by the Hub.');
  await expect(history.last()).toHaveAttribute('data-cause', 'derived');
  await expect(history.last()).toContainText('Worked out by PEMO');
  await expect(history.last()).toContainText(I.unknownReason.hub_silent.en);

  const main = await page.locator('main').innerText();
  for (const leak of LEAKS) expect(main, `${leak} on the detail`).not.toMatch(leak);
  const it = page.locator('[data-testid="integration-it-details"]');
  await expect(it).not.toHaveAttribute('open', '');
  await it.locator('summary').click();
  await expect(it).toContainText('sys_wfg_intercom');
  await expect(it).toContainText('GATEWAY_UNREACHABLE');
  await expect(it).toContainText('blk_wfg_a');

  await page.locator('[data-testid="integration-back"]').click();
  await expect(page.locator('[data-testid="integration-status"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('screen')).toBe('integrationStatus');
  expect(new URL(page.url()).searchParams.has('system')).toBe(false);
});

test('A system in maintenance says when it is expected back; a system that does not exist is the not-found state', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${urlFor(base, 'integrationStatusDetail', 'detail', 'en')}&system=sys_wfg_ev`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="integration-detail-state"]')).toContainText('In maintenance');
  await expect(page.locator('[data-testid="integration-detail-expected"]')).toContainText('18 Nov 2026');

  await page.goto(`${urlFor(base, 'integrationStatusDetail', 'detail', 'en')}&system=sys_nope`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toHaveAttribute('data-problem-kind', 'record-not-found');
  await expect(page.locator('[data-testid="integration-detail"]')).toHaveCount(0);
});

for (const lang of ['zh-Hant', 'zh-Hans'] as const) {
  test(`Integration status reads in ${lang}: the boundary, every state and every reason are words, none is a code`, async ({ strictPage: page }) => {
    await open(page, 'list', lang);
    await expect(page.locator('[data-testid="integration-hub-intro"]')).toHaveAttribute("aria-label", I.hubIntro[lang]);
    await expect(page.locator('[data-testid="integration-hub-state"]')).toContainText(I.hubState.online[lang]);
    await expect(row(page, 'sys_wfg_intercom')).toContainText(I.systemState.offline[lang]);
    await expect(row(page, 'sys_wfg_intercom')).toContainText(I.systemKind.intercom[lang]);
    await expect(row(page, 'sys_wfg_lifts_a')).toContainText(I.systemState.degraded[lang]);
    await expect(row(page, 'sys_wfg_ev')).toContainText(I.systemState.maintenance[lang]);
    await expect(row(page, 'sys_wfg_cctv')).toContainText(I.wholeEstate[lang]);
    for (const leak of LEAKS) expect(await page.locator('main').innerText(), `${leak} (${lang})`).not.toMatch(leak);

    await open(page, 'hub-silent', lang);
    await expect(page.locator('[data-testid="integration-hub-sentence"]')).toHaveText(I.hubSentence.silent[lang]);
    await expect(rows(page).first()).toContainText(I.unknownReason.hub_silent[lang]);
    await expect(page.locator('[data-testid="integration-hub-hint"]')).toHaveText(I.hubHint[lang]);
    // No English word of the state left on a Chinese page.
    const body = await page.locator('main').innerText();
    for (const word of ['Silent', 'Unknown', 'Offline', 'Degraded', 'Whole estate', 'Systems']) expect(body, `${word} on the ${lang} page`).not.toContain(word);
  });
}

/* ------------------------------------------------ against Backend (stubbed) */

const detailOf = (ref: string) => integrationDetail(ref)!;

test('Integration status against Backend: the list and a system are read from the route, and the source says live', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  const asked: string[] = [];
  await page.route('**/api/management-web/v0/integration-status**', (r) => {
    const u = new URL(r.request().url());
    asked.push(`${u.pathname}${u.search}`);
    const tail = u.pathname.split('/integration-status')[1] ?? '';
    const body = tail.length > 1 ? detailOf(decodeURIComponent(tail.slice(1))) : { ...INTEGRATION_FIXTURE, systems: INTEGRATION_FIXTURE.systems.slice(0, 3) };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(urlFor(base, 'integrationStatus', 'list', 'en', null), { waitUntil: 'load' });
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator('.pemo-source').first()).toHaveAttribute('data-source', 'live');
  await row(page, 'sys_wfg_intercom').locator('[data-testid="integration-open"]').click();
  await expect(page.locator('[data-testid="integration-detail-title"]')).toContainText('Block A visitor intercom');
  await expect(page.locator('.pemo-source').first()).toHaveAttribute('data-source', 'live');
  expect(asked).toContain('/api/management-web/v0/integration-status/sys_wfg_intercom?limit=50');
  expect(pageErrors).toEqual([]);
});

test('Integration status against Backend: a 403 is a denied state, not a table; a narrower scope and a 404 system are what the route says', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = await appOrigin();
  const problem = { type: 'https://pemo.local/problems/insufficient-scope', title: 'Not permitted', status: 403, correlationId: 'c-403', staffMessage: { en: 'Your role cannot read integration status.', 'zh-Hant': '你的角色不能讀取整合狀態。' }, retryable: false };
  await page.route('**/api/management-web/v0/integration-status**', (r) => r.fulfill({ status: 403, contentType: 'application/problem+json', body: JSON.stringify(problem) }));
  await page.goto(urlFor(base, 'integrationStatus', 'list', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toHaveAttribute('data-problem-kind', 'insufficient-scope');
  await expect(page.locator('[data-testid="state-problem"]')).toContainText('Your role cannot read integration status.');
  await expect(page.locator('[data-testid="integration-systems-table"], [data-testid="integration-hub"]')).toHaveCount(0);

  await page.unroute('**/api/management-web/v0/integration-status**');
  await page.route('**/api/management-web/v0/integration-status**', (r) => {
    if (r.request().url().includes('/integration-status/')) {
      return r.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ type: 'https://pemo.local/problems/record-not-found', title: 'Not found', status: 404, correlationId: 'c-404' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(integrationList('places')) });
  });
  await page.goto(urlFor(base, 'integrationStatus', 'list', 'en', null), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="integration-status"]')).toHaveAttribute('data-scope', 'places');
  await expect(page.locator('[data-testid="integration-hub"]')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
  await page.goto(`${urlFor(base, 'integrationStatusDetail', 'detail', 'en', null)}&system=sys_wfg_cctv`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toHaveAttribute('data-problem-kind', 'record-not-found');
  expect(pageErrors).toEqual([]);
});
