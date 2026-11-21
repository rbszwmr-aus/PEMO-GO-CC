/**
 * Live path for S3 tree and shell scope, against the production build in dist/.
 *
 * Fixture default stays URL-constructed and is proven here as a control: without
 * source=live the corpus tree still renders. Live tests skip when no API origin
 * is configured so the existing browser suite stays green.
 *
 * Same-origin fetches from the artefact are fulfilled from Node against the
 * real API, for the two allowed paths only. A mutation of source on disk is
 * not what this suite runs — dist/ is.
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import type { PropertyTreeResponse } from '../../src/data/types.ts';
import { LIVE_SCOPE_PATH, LIVE_TREE_PATH } from '../../src/data/live-client.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const apiBase = process.env['PEMO_LIVE_BASE_URL'] ?? '';
const staffToken = process.env['PEMO_LIVE_STAFF_TOKEN'] ?? '';
const residentToken = process.env['PEMO_LIVE_RESIDENT_TOKEN'] ?? '';

const corpusTree = CORPUS['mob-s3-properties/tree.json'] as PropertyTreeResponse;
const CORPUS_SUMMARY = '3 blocks · 812 units';

async function fulfillLiveReads(page: import('@playwright/test').Page): Promise<void> {
  const allow = new Set([LIVE_SCOPE_PATH, LIVE_TREE_PATH]);
  await page.route('**/api/management-web/v0/**', async (route) => {
    const url = new URL(route.request().url());
    if (!allow.has(url.pathname)) {
      await route.fulfill({ status: 404, body: 'not found' });
      return;
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    const incoming = route.request().headers();
    if (incoming['authorization']) headers['authorization'] = incoming['authorization'];
    const res = await fetch(`${apiBase}${url.pathname}${url.search}`, { headers });
    await route.fulfill({
      status: res.status,
      contentType: res.headers.get('content-type') || 'application/json',
      body: await res.text(),
    });
  });
}

test('fixture default S3 tree is the corpus, not a live API tree', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's3', 'tree', 'en'), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="s3-tree"]')).toBeVisible();
  await expect(page.getByText(CORPUS_SUMMARY)).toBeVisible();
  await expect(page.locator('[data-testid="tree-node"][data-kind="estate"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="tree-node"][data-kind="building"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="building"]').filter({ hasText: 'Block B' })).toBeVisible();
  await expect(page.locator('[data-testid="tree-node"]').filter({ hasText: 'G/F' })).toHaveCount(0);
});

test('live staff token: S3 tree is Wing Fu Garden from the API, not corpus.g.ts', async ({ strictPage: page }) => {
  test.skip(!apiBase || !staffToken, 'no live server configured');
  const base = await appOrigin();
  await fulfillLiveReads(page);
  const q = new URLSearchParams({ screen: 's3', state: 'tree', lang: 'en', source: 'live', token: staffToken });
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="s3-tree"]')).toBeVisible();
  await expect(page.locator('[data-testid="tree-node"]').filter({ hasText: 'Wing Fu Garden' })).toBeVisible();
  await expect(page.locator('[data-testid="tree-node"]').filter({ hasText: 'Block B' }).first()).toBeVisible();
  await expect(page.getByText(CORPUS_SUMMARY)).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
});


test('live staff token: default hides units; Expand all shows the nested walk', async ({ strictPage: page }) => {
  test.skip(!apiBase || !staffToken, 'no live server configured');
  const base = await appOrigin();
  await fulfillLiveReads(page);
  const q = new URLSearchParams({ screen: 's3', state: 'tree', lang: 'en', source: 'live', token: staffToken });
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="s3-tree"]')).toBeVisible();
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-expand-all"]')).toHaveText('Expand all');

  await page.locator('[data-testid="tree-expand-all"]').click();
  expect(await page.locator('[data-testid="tree-node"][data-kind="unit"]').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="tree-node"]').count()).toBeGreaterThan(corpusTree.nodes.length);

  const kinds = await page.locator('[data-testid="tree-node"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.kind ?? ''),
  );
  const firstBuilding = kinds.indexOf('building');
  const secondBuilding = kinds.indexOf('building', firstBuilding + 1);
  expect(secondBuilding).toBeGreaterThan(firstBuilding);
  const between = kinds.slice(firstBuilding, secondBuilding);
  expect(between).toContain('floor');
  expect(between).toContain('unit');

  await page.locator('[data-testid="tree-collapse-all"]').click();
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"]').filter({ hasText: 'Block B' }).first()).toBeVisible();
});
test('live missing credential is a problem state, not a 200-looking empty tree', async ({ page }) => {
  test.skip(!apiBase, 'no live server configured');
  const base = await appOrigin();
  await fulfillLiveReads(page);
  const q = new URLSearchParams({ screen: 's3', state: 'tree', lang: 'en', source: 'live' });
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toBeVisible();
  await expect(page.locator('[data-testid="s3-tree"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-problem"]')).toHaveAttribute('data-problem-status', '401');
});

test('live resident token is a problem state, not a staff tree', async ({ page }) => {
  test.skip(!apiBase || !residentToken, 'no live server configured');
  const base = await appOrigin();
  await fulfillLiveReads(page);
  const q = new URLSearchParams({ screen: 's3', state: 'tree', lang: 'en', source: 'live', token: residentToken });
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-problem"]')).toBeVisible();
  await expect(page.locator('[data-testid="s3-tree"]')).toHaveCount(0);
});

test('live mode leaves S2 on the fixture', async ({ strictPage: page }) => {
  test.skip(!apiBase || !staffToken, 'no live server configured');
  const base = await appOrigin();
  await fulfillLiveReads(page);
  const q = new URLSearchParams({ screen: 's2', state: 'default', lang: 'en', source: 'live', token: staffToken });
  await page.goto(`${base}/?${q.toString()}`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="s3-tree"]')).toHaveCount(0);
});
