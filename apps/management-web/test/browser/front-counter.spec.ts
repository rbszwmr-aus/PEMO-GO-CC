/**
 * The front counter, in a real browser: the walk-in path (a delivery) from form to
 * the day log and Check out; the pre-registered path (verify states, Check in that
 * uses one visit at a time); no ids on screen; hidden, not disabled, actions; the
 * camera scan button only where the browser can scan; and the live source against a
 * mocked Backend (Bearer sent, the log read from the API, a refused session said).
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

type P = import('@playwright/test').Page;
const open = async (page: P, state: 'walk-in' | 'pass', lang: 'en' | 'zh-Hant' = 'en', extra = '', source: string | null = 'fixture') => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'visitorCounter', state, lang, source) + extra, { waitUntil: 'load' });
  await expect(page.getByTestId('front-counter')).toBeVisible();
};
const rowOf = (page: P, name: string) => page.getByTestId('desk-log-row').filter({ hasText: name });

test('walk-in: name, purpose chip, host flat from the tree, Check in -> the day log -> Check out', async ({ strictPage: page }) => {
  await open(page, 'walk-in');
  // Check in with nothing filled in: said, not blocked silently.
  await page.getByTestId('walkin-checkin').click();
  await expect(page.getByTestId('walkin-error')).toBeVisible();

  await page.getByTestId('walkin-name').fill('SF Express courier');
  await page.getByTestId('walkin-purpose-delivery').check();
  await page.getByTestId('walkin-checkin').click();
  await expect(page.getByTestId('walkin-error')).toContainText('host flat'); // name given, host missing

  await page.getByTestId('host-search').fill('12/f a1');
  const options = page.getByTestId('host-option');
  await expect(options.first()).toHaveText('Block A · 12/F · Flat A1');
  await options.first().click();
  await expect(page.getByTestId('host-chosen-label')).toHaveText('Block A · 12/F · Flat A1');
  await page.getByTestId('walkin-phone').fill('9123 4567');
  await page.getByTestId('walkin-idstub').fill('A123456(7)');
  await page.getByTestId('walkin-checkin').click();

  await expect(page.getByTestId('counter-toast')).toHaveAttribute('data-tone', 'success');
  await expect(page.getByTestId('counter-toast')).toContainText('SF Express courier checked in to Block A · 12/F · Flat A1');
  const row = rowOf(page, 'SF Express courier');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Block A · 12/F · Flat A1'); // from the tree, not the Backend's "A · 12/F A1"
  await expect(row).toContainText('Delivery');
  await expect(row.getByTestId('desk-status')).toHaveAttribute('data-status', 'on_site');
  await expect(row).toHaveAttribute('data-source', 'walk_in');
  // The form is reset for the next visitor.
  await expect(page.getByTestId('walkin-name')).toHaveValue('');
  await expect(page.getByTestId('host-picker')).toBeVisible();

  await row.getByTestId('desk-checkout').click();
  await expect(row.getByTestId('desk-status')).toHaveAttribute('data-status', 'checked_out');
  await expect(row.getByTestId('desk-status')).toHaveText('Checked out');
  await expect(row.getByTestId('desk-checkout')).toHaveCount(0); // hidden once it no longer applies
  await expect(page.getByTestId('counter-toast')).toContainText('checked out');
});

test('a check-in at the counter appears in the Visitor log with Check out', async ({ strictPage: page }) => {
  await open(page, 'walk-in');
  await page.getByTestId('walkin-name').fill('Tam delivery');
  await page.getByTestId('host-search').fill('flat a2');
  await page.getByTestId('host-option').first().click();
  await page.getByTestId('walkin-checkin').click();
  await expect(rowOf(page, 'Tam delivery')).toHaveCount(1);
  // Client-side navigation keeps the in-memory log.
  await page.locator('[data-testid="nav-item"]').filter({ hasText: 'Visitor log' }).first().click();
  const vrow = page.getByTestId('visitor-desk-row').filter({ hasText: 'Tam delivery' });
  await expect(vrow).toHaveCount(1);
  await expect(page.getByTestId('visitor-desk-row').filter({ hasText: 'Chan Tai-man' }).getByTestId('visitor-desk-noshow')).toHaveCount(1); // expected rows are in the log, with No-show
  await vrow.getByTestId('visitor-desk-checkout').click();
  await expect(vrow.getByTestId('visitor-desk-checkout')).toHaveCount(0);
  await expect(vrow.getByTestId('visitor-desk-status')).toHaveAttribute('data-status', 'checked_out');
});

test('pre-registered: each verify status shows its card, and only a Valid pass offers Check in', async ({ strictPage: page }) => {
  await open(page, 'pass');
  const cases: Array<[string, string, string, string]> = [
    ['QP1:DEMO-VALID', 'valid', 'valid', 'Valid'],
    ['QP1:DEMO-EXPIRED', 'expired', 'expired', 'Expired'],
    ['QP1:DEMO-USED', 'used_up', 'used_up', 'Used up'],
    ['QP1:DEMO-REVOKED', 'revoked', 'revoked', 'Revoked'],
    ['qp_demo_later', 'unknown', 'not_yet_valid', 'Not yet valid'], // a pass id works as well as the payload
  ];
  for (const [code, group, status, label] of cases) {
    await page.getByTestId('pass-code').fill(code);
    await page.getByTestId('pass-verify').click();
    const card = page.getByTestId('verify-card');
    await expect(card).toHaveAttribute('data-state', group);
    await expect(card).toHaveAttribute('data-status', status);
    await expect(page.getByTestId('verify-state')).toHaveText(label);
    await expect(page.getByTestId('verify-visitor')).not.toBeEmpty();
    await expect(page.getByTestId('verify-host')).toContainText('·');
    await expect(page.getByTestId('verify-window')).toContainText('HKT');
    await expect(page.getByTestId('verify-uses')).toContainText('used');
    await expect(page.getByTestId('pass-checkin')).toHaveCount(status === 'valid' ? 1 : 0);
  }
  // Free-text purpose reads as the resident wrote it (the Backend sends other + purpose_text).
  await page.getByTestId('pass-code').fill('QP1:DEMO-USED');
  await page.getByTestId('pass-verify').click();
  await expect(page.getByTestId('verify-purpose')).toHaveText('Family visit');
  await page.getByTestId('pass-code').fill('NOT-A-REAL-CODE');
  await page.getByTestId('pass-verify').click();
  await expect(page.getByTestId('verify-card')).toHaveAttribute('data-state', 'unknown');
  await expect(page.getByTestId('verify-state')).toHaveText('Unknown');
  await expect(page.getByTestId('verify-facts')).toHaveCount(0);
  await expect(page.getByTestId('pass-checkin')).toHaveCount(0);
  // An empty code is said, not sent.
  await page.getByTestId('pass-code').fill('');
  await page.getByTestId('pass-verify').click();
  await expect(page.getByTestId('pass-error')).toBeVisible();
});

test('pre-registered: Check in uses one visit at a time until the pass is used up', async ({ strictPage: page }) => {
  await open(page, 'pass');
  const chan = rowOf(page, 'Chan Tai-man');
  await expect(chan.getByTestId('desk-status')).toHaveAttribute('data-status', 'expected');
  await expect(chan.getByTestId('desk-checkout')).toHaveCount(0); // not on site: no Check out offered
  await page.getByTestId('demo-code').filter({ hasText: 'QP1:DEMO-VALID' }).click();
  await expect(page.getByTestId('verify-uses')).toHaveText('0 of 2 used, 2 left');
  await page.getByTestId('pass-checkin').click();
  await expect(page.getByTestId('counter-toast')).toContainText('Chan Tai-man 陳大文 checked in. 1 left on this pass.');
  await expect(page.getByTestId('verify-card')).toHaveCount(0);
  await expect(chan.getByTestId('desk-status')).toHaveAttribute('data-status', 'on_site');
  await expect(chan).toHaveAttribute('data-source', 'pre_registered');
  await expect(chan.getByTestId('desk-checkout')).toHaveCount(1);

  await page.getByTestId('demo-code').filter({ hasText: 'QP1:DEMO-VALID' }).click();
  await expect(page.getByTestId('verify-uses')).toHaveText('1 of 2 used, 1 left');
  await page.getByTestId('pass-checkin').click();
  await expect(chan).toHaveCount(1); // the same visit, not a second row

  await page.getByTestId('demo-code').filter({ hasText: 'QP1:DEMO-VALID' }).click();
  await expect(page.getByTestId('verify-card')).toHaveAttribute('data-state', 'used_up');
  await expect(page.getByTestId('pass-checkin')).toHaveCount(0);
  // Check out closes it as a visit that happened.
  await chan.getByTestId('desk-checkout').click();
  await expect(chan.getByTestId('desk-status')).toHaveText('Checked out');
});

test('no system id on the main view, in either path', async ({ strictPage: page }) => {
  await open(page, 'pass');
  await page.getByTestId('demo-code').filter({ hasText: 'QP1:DEMO-VALID' }).click();
  await page.getByTestId('pass-checkin').click();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/unit_wfg|vis_fx|qp_|jti|idem-/);
  await open(page, 'walk-in');
  await page.getByTestId('host-search').fill('a1');
  expect(await page.locator('main').innerText()).not.toMatch(/unit_wfg|vis_fx/);
});

test('the camera scan button exists only where BarcodeDetector and the camera do', async ({ strictPage: page }) => {
  await page.addInitScript(() => { delete (window as any).BarcodeDetector; });
  await open(page, 'pass');
  await expect(page.getByTestId('pass-scan')).toHaveCount(0);
  await expect(page.getByTestId('pass-code')).toBeVisible(); // the manual path stays
  await page.close();
});

test('with BarcodeDetector and a camera, Scan is offered and a read code is verified', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-HK' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    (window as any).BarcodeDetector = class { async detect() { return [{ rawValue: 'QP1:DEMO-REVOKED' }]; } };
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; canvas.getContext('2d');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => canvas.captureStream(5) } });
  });
  await open(page, 'pass');
  await page.getByTestId('pass-scan').click();
  await expect(page.getByTestId('verify-card')).toHaveAttribute('data-state', 'revoked');
  await expect(page.getByTestId('pass-code')).toHaveValue('QP1:DEMO-REVOKED');
  await expect(page.getByTestId('pass-scan-stop')).toHaveCount(0); // scanning ended on a read
  await ctx.close();
});

test('zh-Hant: labels, states and the host flat', async ({ strictPage: page }) => {
  await open(page, 'pass', 'zh-Hant');
  await page.getByTestId('demo-code').filter({ hasText: 'QP1:DEMO-USED' }).click();
  await expect(page.getByTestId('verify-state')).toHaveText('已用完');
  await expect(page.getByTestId('verify-host')).toHaveText('A座 · 12樓 · A1室');
  await expect(page.getByTestId('verify-window')).toContainText('香港時間');
});

test('live source: the Bearer goes with every call, the log is read from the API, and a refused session is said', async ({ page }) => {
  const seen: string[] = [];
  const visits: any[] = [];
  const stamp = '2026-11-18T17:00:00+08:00';
  await page.route('**/api/management-web/v0/front-counter/**', async (route) => {
    const req = route.request();
    seen.push(`${req.method()} ${new URL(req.url()).pathname.split('/front-counter')[1]} ${req.headers()['authorization'] ?? '-'}`);
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const path = new URL(req.url()).pathname.split('/front-counter')[1]!;
    if (req.method() === 'GET') return json(200, { meta: {}, day: '2026-11-18', timezone: 'Asia/Hong_Kong', visits });
    if (path === '/visits') {
      const b = req.postDataJSON();
      const v = { visit_id: 'vis_live_1', name: b.name, purpose: b.purpose, purpose_text: null, source: 'walk_in', status: 'on_site', host: { unit_id: b.host_unit_id, unit_label: b.host_unit_id }, phone: null, id_stub: null, expected_from: stamp, expected_to: stamp, checked_in_at: stamp, checked_out_at: null, created_at: stamp, updated_at: stamp, resident_ref: null, pass_id: null, outcome: null, outcome_label: null };
      visits.push(v);
      return json(201, { meta: {}, visit: v });
    }
    if (path.endsWith('/check-out')) {
      Object.assign(visits[0], { status: 'checked_out', outcome: 'visited', outcome_label: 'visited', checked_out_at: stamp });
      return json(200, { meta: {}, replayed: false, visit: visits[0] });
    }
    return json(404, { type: 'https://pemo.example/problems/front-counter/not-found', title: 'nf', status: 404 });
  });
  // Everything else the live shell asks for is not under test.
  await page.route('**/api/management-web/v0/{scope,properties}**', (r) => r.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' }));
  await open(page, 'walk-in', 'en', '&token=demo', 'live');
  await expect(page.getByTestId('desk-log-empty')).toBeVisible(); // the log comes from the API, not the seeds
  await expect(page.getByTestId('desk-log-row')).toHaveCount(0);
  await page.getByTestId('walkin-name').fill('Live courier');
  await page.getByTestId('walkin-purpose-delivery').check();
  await page.getByTestId('host-search').fill('12/f a1');
  await page.getByTestId('host-option').first().click();
  await page.getByTestId('walkin-checkin').click();
  const row = rowOf(page, 'Live courier');
  await expect(row).toHaveCount(1);
  // The Backend answered with the raw id as the label (an id it does not know); the tree label is shown.
  await expect(row).toContainText('Block A · 12/F · Flat A1');
  await expect(row).not.toContainText('unit_wfg');
  await row.getByTestId('desk-checkout').click();
  await expect(row.getByTestId('desk-status')).toHaveText('Checked out');
  expect(seen.every((s) => s.endsWith('Bearer demo'))).toBe(true);
  expect(seen.some((s) => s.startsWith('POST /visits '))).toBe(true);
  expect(seen.some((s) => s.startsWith('POST /visits/vis_live_1/check-out '))).toBe(true);
  // No demo codes or seeds in live mode.
  await expect(page.getByTestId('walkin-form')).toBeVisible();
});

test('live source without a token: the refusal is said, nothing is invented', async ({ page }) => {
  await page.route('**/api/management-web/v0/front-counter/**', (r) =>
    r.fulfill({ status: 401, contentType: 'application/problem+json', body: JSON.stringify({ type: 'https://pemo.example/problems/front-counter/unauthorized', title: 'Unauthorized', status: 401 }) }));
  await page.route('**/api/management-web/v0/{scope,properties}**', (r) => r.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' }));
  await open(page, 'pass', 'en', '', 'live');
  await expect(page.getByTestId('desk-log-failed')).toContainText('Sign in again');
  await expect(page.getByTestId('demo-codes')).toHaveCount(0);
  await page.getByTestId('pass-code').fill('QP1:ANY');
  await page.getByTestId('pass-verify').click();
  await expect(page.getByTestId('pass-error')).toContainText('Sign in again');
  await expect(page.getByTestId('verify-card')).toHaveCount(0);
});

test('fixture: No-show is offered on an Expected row only, and closes it as "No-show / closed"', async ({ strictPage: page }) => {
  await open(page, 'pass');
  const chan = rowOf(page, 'Chan Tai-man');
  await expect(chan.getByTestId('desk-status')).toHaveAttribute('data-status', 'expected');
  await expect(chan.getByTestId('desk-noshow')).toHaveText('No-show');
  await expect(chan.getByTestId('desk-checkout')).toHaveCount(0); // one action at a time
  const onSite = rowOf(page, 'Wong Suk-fan');
  await expect(onSite.getByTestId('desk-noshow')).toHaveCount(0); // on site: Check out, not No-show
  await expect(onSite.getByTestId('desk-checkout')).toHaveCount(1);
  await chan.getByTestId('desk-noshow').click();
  await expect(page.getByTestId('counter-toast')).toContainText('Chan Tai-man 陳大文 closed as a no-show.');
  await expect(chan.getByTestId('desk-status')).toHaveAttribute('data-status', 'checked_out');
  await expect(chan.getByTestId('desk-status')).toHaveText('No-show / closed');
  await expect(chan.getByTestId('desk-noshow')).toHaveCount(0);
  await expect(chan.getByTestId('desk-checkout')).toHaveCount(0);
  // A visitor who did arrive and left reads "Checked out", not no-show.
  await onSite.getByTestId('desk-checkout').click();
  await expect(onSite.getByTestId('desk-status')).toHaveText('Checked out');
});

test('Visitor log: the use-consuming verify panel is gone; its place points at the Front counter', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'visitorLog', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.getByTestId('visitor-front-counter-panel')).toBeVisible();
  await expect(page.getByTestId('visitor-verify')).toHaveCount(0);
  await expect(page.getByTestId('visitor-verify-submit')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Verify & record entry');
  await page.getByTestId('visitor-front-counter-cta').click();
  await expect(page.getByTestId('front-counter')).toBeVisible();
  await expect(page.getByTestId('pass-panel')).toBeVisible(); // lands on the pre-registered tab
});

const stamp = '2026-11-18T17:00:00+08:00';
const visitRow = (id: string, name: string, status: string, source = 'pre_registered', extra: Record<string, unknown> = {}) => ({
  visit_id: id, name, purpose: 'visit', purpose_text: null, source, status,
  host: { unit_id: 'unit_wfg_a_12_a1', unit_label: 'A · 12/F A1' }, phone: null, id_stub: null,
  expected_from: stamp, expected_to: stamp, checked_in_at: status === 'expected' ? null : stamp, checked_out_at: null,
  created_at: stamp, updated_at: stamp, resident_ref: null, pass_id: null, outcome: null, outcome_label: null, ...extra,
});

test('no URL params, API answers: live is the default with the demo Bearer, and a no-show closes an Expected row', async ({ page }) => {
  const seen: string[] = [];
  const visits = [visitRow('vis_live_e1', 'Expected Guest', 'expected')];
  await page.route('**/api/management-web/v0/front-counter/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.split('/front-counter')[1]!;
    seen.push(`${req.method()} ${path} ${req.headers()['authorization'] ?? '-'}`);
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'GET') return json(200, { meta: {}, day: '2026-11-18', timezone: 'Asia/Hong_Kong', visits });
    if (path === '/visits') {
      const b = req.postDataJSON();
      const v = visitRow('vis_live_w1', b.name, 'on_site', 'walk_in', { purpose: b.purpose, host: { unit_id: b.host_unit_id, unit_label: b.host_unit_id } });
      visits.unshift(v);
      return json(201, { meta: {}, visit: v });
    }
    const v = visits.find((x) => path.includes(x.visit_id))!;
    Object.assign(v, v.checked_in_at ? { status: 'checked_out', outcome: 'visited', outcome_label: 'visited' } : { status: 'checked_out', outcome: 'no_show', outcome_label: 'no-show / closed' }, { checked_out_at: stamp });
    return json(200, { meta: {}, replayed: false, visit: v });
  });
  await page.route('**/api/management-web/v0/{scope,properties}**', (r) => r.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' }));
  const url = urlFor(await appOrigin(), 'visitorCounter', 'walk-in', 'en', null);
  expect(url).not.toMatch(/source|token/);
  await page.goto(url, { waitUntil: 'load' });
  await expect(rowOf(page, 'Expected Guest')).toHaveCount(1); // read from the API, not the seeds
  await expect(page.getByTestId('sample-data-note')).toHaveCount(0);
  await expect(rowOf(page, 'Chan Tai-man')).toHaveCount(0);

  await page.getByTestId('walkin-name').fill('Live courier');
  await page.getByTestId('host-search').fill('12/f a1');
  await page.getByTestId('host-option').first().click();
  await page.getByTestId('walkin-checkin').click();
  await expect(rowOf(page, 'Live courier')).toHaveCount(1);

  const expected = rowOf(page, 'Expected Guest');
  await expected.getByTestId('desk-noshow').click();
  await expect(expected.getByTestId('desk-status')).toHaveText('No-show / closed');
  await expect(expected.getByTestId('desk-noshow')).toHaveCount(0);
  await rowOf(page, 'Live courier').getByTestId('desk-checkout').click();
  await expect(rowOf(page, 'Live courier').getByTestId('desk-status')).toHaveText('Checked out');
  expect(seen.length).toBeGreaterThan(4);
  expect(seen.every((s) => s.endsWith('Bearer demo'))).toBe(true);
  expect(seen.some((s) => s.startsWith('POST /visits/vis_live_e1/check-out'))).toBe(true);
});

test('no URL params, API unreachable: the contract fixture, with a small "Sample data" note', async ({ page }) => {
  await page.route('**/api/management-web/v0/front-counter/**', (r) => r.abort());
  await page.route('**/api/management-web/v0/{scope,properties}**', (r) => r.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' }));
  await page.goto(urlFor(await appOrigin(), 'visitorCounter', 'pass', 'en', null), { waitUntil: 'load' });
  await expect(page.getByTestId('sample-data-note')).toHaveAttribute('aria-label', 'Sample data');
  await expect(rowOf(page, 'Chan Tai-man')).toHaveCount(1); // the fixture seeds
  await expect(page.getByTestId('demo-codes')).toBeVisible();
});

test('?source=fixture forces the fixture even when the API would answer, and never calls it', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/management-web/v0/front-counter/**', (r) => { calls += 1; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ visits: [] }) }); });
  await page.route('**/api/management-web/v0/{scope,properties}**', (r) => r.fulfill({ status: 401, contentType: 'application/problem+json', body: '{}' }));
  await page.goto(urlFor(await appOrigin(), 'visitorCounter', 'pass', 'en', 'fixture'), { waitUntil: 'load' });
  await expect(page.getByTestId('sample-data-note')).toBeVisible();
  await expect(rowOf(page, 'Chan Tai-man')).toHaveCount(1);
  expect(calls).toBe(0);
});

test('Visitor log: No-show on an Expected row closes it as "No-show / closed"; other rows have no No-show', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'visitorLog', 'default', 'en'), { waitUntil: 'load' });
  const row = (name: string) => page.getByTestId('visitor-desk-row').filter({ hasText: name });
  await expect(row('Chan Tai-man').getByTestId('visitor-desk-noshow')).toHaveText('No-show');
  await expect(row('Wong Suk-fan').getByTestId('visitor-desk-noshow')).toHaveCount(0);
  await expect(row('Wong Suk-fan').getByTestId('visitor-desk-checkout')).toHaveCount(1);
  await row('Chan Tai-man').getByTestId('visitor-desk-noshow').click();
  await expect(row('Chan Tai-man').getByTestId('visitor-desk-status')).toHaveText('No-show / closed');
  await expect(row('Chan Tai-man').getByTestId('visitor-desk-noshow')).toHaveCount(0);
});
