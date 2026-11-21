/**
 * The visitor pass on the portal: the QR is a real PNG <img>; Copy QR image where
 * the clipboard can take it, Download QR where it cannot (plain-http LAN, or a
 * refused write); one toast for success or failure; readable dates and host unit;
 * the pass id hidden under a collapsed section. The API is mocked so no :3200 is needed.
 */
import type { Page } from '@playwright/test';
import { test, expect, appOrigin, urlFor } from './support/harness.ts';

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const payload = 'QP1:' + Array.from({ length: 266 }, (_, i) => ALNUM[(i * 7) % 45]).join('');

const visitor = {
  visitorId: 'vis_pass_1',
  name: 'Chan Tai-man',
  purpose: 'Family visit',
  expectedFrom: '2026-09-23T14:00:00+08:00',
  expectedTo: '2026-09-23T18:00:00+08:00',
  hostUnitId: 'unt_demo_a_12f_a1',
  idStub: null,
  residentRef: 'res_demo_ho_mei_yi',
  status: 'expected',
  createdAt: '2026-09-23T10:00:00+08:00',
  updatedAt: '2026-09-23T10:00:00+08:00',
  checkedOutAt: null,
  pass: {
    pass_id: 'qp_demo_secret_1', jti: 'j1', kid: 'k1', purpose: 'VISITOR_ACCESS',
    not_before: '2026-09-23T06:00:00Z', expires_at: '2026-09-23T10:00:00Z', use_limit: 2,
    qr: { payload, mode: 'alphanumeric', ecc: 'M', min_version: 10 },
    module: 'pemo', subject_ref: 'vsr_1', module_ref: 'vis_pass_1', status: 'active',
    issued_at: '2026-09-23T02:00:00Z', uses_seen: 0, uses_remaining: 2, revoked_at: null, revocation_reason: null,
  },
};

async function mockApi(page: Page) {
  await page.route('**/api/resident-portal/v0/visitors**', async (route) => {
    const url = route.request().url();
    const body = url.endsWith('/visitors') ? { visitors: [visitor] } : { visitor };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function open(page: Page, lang: 'en' | 'zh-Hant' = 'en') {
  const base = await appOrigin();
  await page.goto(urlFor(base, { service: 'visitor', tab: 'detail', lang }) + `&visitor=${visitor.visitorId}`);
  await expect(page.getByTestId('portal-visitor-pass')).toBeVisible();
}

test('the QR is a real PNG image, and the page reads dates and unit the way a person would', async ({ strictPage: page }) => {
  await mockApi(page);
  await open(page);
  const qr = page.getByTestId('portal-pass-qr');
  await expect(qr).toHaveJSProperty('tagName', 'IMG');
  expect(await qr.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByTestId('portal-visitor-from')).toHaveText('23 Sep 2026, 14:00 HKT');
  await expect(page.getByTestId('portal-visitor-to')).toHaveText('23 Sep 2026, 18:00 HKT');
  await expect(page.getByTestId('portal-visitor-host-unit')).toHaveText('Block A · 12/F · Flat A1');
  await expect(page.getByTestId('portal-pass-valid-from')).toHaveText('23 Sep 2026, 14:00 HKT');
  // No system id on the page body; the pass id is under a collapsed section.
  const main = page.locator('main');
  await expect(main).not.toContainText('unt_demo_a_12f_a1');
  await expect(page.getByTestId('portal-pass-id')).toBeHidden();
  await page.getByTestId('portal-pass-details').locator('summary').click();
  await expect(page.getByTestId('portal-pass-id')).toHaveText('qp_demo_secret_1');
});

test('zh-Hant dates and unit', async ({ strictPage: page }) => {
  await mockApi(page);
  await open(page, 'zh-Hant');
  await expect(page.getByTestId('portal-visitor-from')).toHaveText('2026年9月23日 14:00（香港時間）');
  await expect(page.getByTestId('portal-visitor-host-unit')).toHaveText('A座 · 12樓 · A1室');
  await expect(page.getByTestId('portal-pass-copy-image').or(page.getByTestId('portal-pass-download'))).toBeVisible();
});

test('secure context: Copy QR image writes a PNG ClipboardItem, shows a success toast, offers no Download', async ({ strictPage: page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    (window as any).__clip = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: async (items: ClipboardItem[]) => { (window as any).__clip.push(items[0]!.types); }, writeText: async () => {} },
    });
  });
  await open(page);
  await expect(page.getByTestId('portal-pass-download')).toHaveCount(0);
  await page.getByTestId('portal-pass-copy-image').click();
  await expect(page.getByTestId('portal-pass-toast')).toHaveAttribute('data-tone', 'success');
  await expect(page.getByTestId('portal-pass-toast')).toHaveText('QR image copied.');
  expect(await page.evaluate(() => (window as any).__clip)).toEqual([['image/png']]);
  // Link and code stay.
  await expect(page.getByTestId('portal-pass-copy-link')).toBeVisible();
  await expect(page.getByTestId('portal-pass-copy-code')).toBeVisible();
});

test('plain-http LAN (not a secure context): only Download QR is offered, and it saves visitor-pass-<date>.png', async ({ strictPage: page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
  });
  await open(page);
  await expect(page.getByTestId('portal-pass-copy-image')).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('portal-pass-download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^visitor-pass-\d{4}-\d{2}-\d{2}\.png$/);
  await expect(page.getByTestId('portal-pass-toast')).toHaveAttribute('data-tone', 'success');
  await expect(page.getByTestId('portal-pass-toast')).toContainText('visitor-pass-');
  await expect(page.getByTestId('portal-pass-hold-hint')).toBeVisible();
});

test('a refused clipboard write says so and swaps the button for Download', async ({ strictPage: page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: async () => { throw new DOMException('blocked', 'NotAllowedError'); }, writeText: async () => {} },
    });
  });
  await open(page);
  await page.getByTestId('portal-pass-copy-image').click();
  await expect(page.getByTestId('portal-pass-toast')).toHaveAttribute('data-tone', 'error');
  await expect(page.getByTestId('portal-pass-copy-image')).toHaveCount(0);
  await expect(page.getByTestId('portal-pass-download')).toBeVisible();
});
