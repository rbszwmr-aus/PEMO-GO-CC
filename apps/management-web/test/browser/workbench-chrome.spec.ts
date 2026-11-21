/**
 * The fixture Screen/State workbench is not product chrome.
 * Navigation is the left nav. Playwright still constructs states via the URL.
 *
 * Runs against dist/ via the harness — the same artefact PT looks at after
 * build. The serve default is separately proven off in
 * test/artefact/dev-affordance-excluded.test.ts.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('workbench screen and state combos are absent; left nav switches screens', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="screen-select"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-select"]')).toHaveCount(0);
  await expect(page.locator('.pemo-field', { hasText: /^Screen$/ })).toHaveCount(0);

  await expect(page.locator('[data-testid="nav-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Overview');

  await page.locator('[data-testid="nav-item"][data-nav="cases"]').click();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Cases');
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('s4');
  await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBe('default');
  await expect(page.locator('[data-testid="s4-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="s4-row"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="screen-select"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-select"]')).toHaveCount(0);

  await page.locator('[data-testid="nav-item"][data-nav="helpdesk"]').click();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Help desk');
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('helpdesk');
  await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBe('queue');

  // Playwright still reaches a non-default fixture from the URL. The empty
  // presentation is in-page content, not a global State dropdown.
  await page.goto(urlFor(base, 's4', 'empty', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Cases');
  await expect.poll(() => new URL(page.url()).searchParams.get('state')).toBe('empty');
  await expect(page.locator('[data-testid="state-empty"]')).toBeVisible();
  await expect(page.locator('[data-testid="s4-table"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="screen-select"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-select"]')).toHaveCount(0);
});
