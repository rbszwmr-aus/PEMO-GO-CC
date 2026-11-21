/**
 * BUILDING SYSTEMS → Car Park opens the thin ParkCore connector.
 * Primary CTA leaves PEMO and names :5177. Isolation is a new tab, not an embed.
 */

import { MESSAGES } from '../../src/i18n/messages.ts';
import { parkcoreHref, parkcoreSsoStubHref } from '../../src/data/parkcore-link.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('Car Park connector page opens ParkCore on :5177 in a new tab', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="nav-item"][data-nav="bs-carpark"]').click();
  await expect(page.locator('[data-testid="parkcore-connector"]')).toBeVisible();
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.carPark.title.en);
  await expect(page.locator('[data-testid="parkcore-isolation"]')).toHaveAttribute('aria-label', MESSAGES.carPark.isolationNote.en);
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'false');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('carPark');

  const cta = page.locator('[data-testid="parkcore-open-console"]');
  await expect(cta).toHaveText(MESSAGES.carPark.openConsole.en);
  await expect(cta).toHaveAttribute('href', parkcoreHref());
  await expect(cta).toHaveAttribute('target', '_blank');
  await expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
  const href = new URL(await cta.getAttribute('href') ?? '');
  expect(href.hostname).toBe('localhost');
  expect(href.port).toBe('5177');
  expect(href.pathname).toBe('/');

  await expect(page.locator('[data-testid="parkcore-open-counter"]')).toHaveAttribute(
    'href',
    'http://localhost:5177/counter',
  );
  await expect(page.locator('[data-testid="parkcore-open-lists"]')).toHaveAttribute(
    'href',
    'http://localhost:5177/lists',
  );
  await expect(page.locator('[data-testid="parkcore-lan-placeholder"]')).toHaveText(
    'http://<lan-host>:5177/',
  );
  await expect(page.locator('iframe')).toHaveCount(0);

  const sso = page.locator('[data-testid="parkcore-sso-stub"]');
  await expect(sso).toHaveText(MESSAGES.carPark.ssoStub.en);
  await expect(sso).toHaveAttribute('href', parkcoreSsoStubHref());
  await expect(sso).toHaveAttribute('target', '_blank');
  await expect(sso).toHaveAttribute('rel', 'noopener noreferrer');
  const ssoHref = new URL(await sso.getAttribute('href') ?? '');
  expect(ssoHref.hostname).toBe('localhost');
  expect(ssoHref.port).toBe('5177');
  expect(ssoHref.pathname).toBe('/sso/callback');
  expect(ssoHref.searchParams.get('code')).toBe('fixture-otc');
  expect(ssoHref.searchParams.get('aud')).toBe('parkcore');
  await expect(page.locator('[data-testid="parkcore-sso-note"]')).toHaveAttribute('aria-label', MESSAGES.carPark.ssoStubNote.en);
});

test('Car Park connector localises in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'carPark', 'default', 'zh-Hant'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.carPark.title['zh-Hant']);
  await expect(page.locator('[data-testid="parkcore-open-console"]')).toHaveText(
    MESSAGES.carPark.openConsole['zh-Hant'],
  );
  await expect(page.locator('[data-testid="parkcore-open-console"]')).toHaveAttribute(
    'href',
    'http://localhost:5177/',
  );
  await expect(page.locator('[data-testid="parkcore-isolation"]')).toHaveAttribute('aria-label', MESSAGES.carPark.isolationNote['zh-Hant'],
  );
  await expect(page.locator('[data-testid="parkcore-sso-stub"]')).toHaveText(
    MESSAGES.carPark.ssoStub['zh-Hant'],
  );
  await expect(page.locator('[data-testid="parkcore-sso-stub"]')).toHaveAttribute(
    'href',
    parkcoreSsoStubHref(),
  );
});
