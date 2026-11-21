/**
 * Facilities and shared areas (e.g. Wing Fu Clubhouse) are the top children under their parent, in the scope
 * rail AND the Properties tree, in ?source=live as well as the fixture. The live reads are fulfilled from the
 * corpus plus two shared areas listed AFTER the blocks, so the order shown can only come from the sort.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import type { PropertyTreeResponse, ScopeTreeNode, ScopeTreeResponse } from '../../src/data/types.ts';
import { LIVE_SCOPE_PATH, LIVE_TREE_PATH } from '../../src/data/live-client.ts';
import { appOrigin, expect, test } from './support/harness.ts';


const corpusTree = CORPUS['mob-s3-properties/tree.json'] as PropertyTreeResponse;
const corpusScope = CORPUS['scope/default.json'] as ScopeTreeResponse;
const estate = { kind: 'estate' as const, id: 'est_wing_fu_garden' };

const shared = (id: string, en: string, hant: string, sequence: number, parent: { kind: 'estate' | 'location'; id: string }, depth: number): ScopeTreeNode => ({
  node: { kind: 'location', id },
  parent,
  label: { en, 'zh-Hant': hant },
  depth,
  sequence,
  permittedActions: [],
});

const withFacilities: PropertyTreeResponse = {
  ...corpusTree,
  nodes: [
    ...corpusTree.nodes,
    shared('loc_wfg_pool', 'Swimming pool', '游泳池', 8, estate, 1),
    shared('loc_wfg_clubhouse', 'Wing Fu Clubhouse', '榮富會所', 9, estate, 1),
    shared('loc_wfg_function_room', 'Function room', '多用途室', 1, { kind: 'location', id: 'loc_wfg_clubhouse' }, 2),
  ],
};

async function liveReads(page: import('@playwright/test').Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/management-web/v0/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === LIVE_TREE_PATH) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withFacilities) });
    if (path === LIVE_SCOPE_PATH) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpusScope) });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  return errors;
}

const under = async (page: import('@playwright/test').Page, rows: string, kindAttr: string): Promise<string[]> =>
  page.locator(rows).evaluateAll((els, attr) => els.map((e) => `${e.getAttribute(attr) ?? ''}`), kindAttr);

test('live: the Properties tree lists the clubhouse and pool before Block A, and search and Expand all still work', async ({ page }) => {
  const base = await appOrigin();
  const errors = await liveReads(page);
  await page.goto(`${base}/?screen=s3&state=tree&lang=en&source=live&token=t`, { waitUntil: 'load' });
  const rows = page.locator('[data-testid="s3-tree"] [data-testid="tree-node"]');
  await expect(rows.filter({ hasText: 'Wing Fu Clubhouse' })).toBeVisible();
  const order = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind') + ':' + (e.textContent ?? '')));
  const idx = (needle: string) => order.findIndex((s) => s.includes(needle));
  expect(idx('Swimming pool')).toBeGreaterThan(idx('Wing Fu Garden'));
  expect(idx('Swimming pool')).toBeLessThan(idx('Wing Fu Clubhouse'));
  expect(idx('Wing Fu Clubhouse')).toBeLessThan(idx('Block A'));
  expect(idx('Block A')).toBeLessThan(idx('Block B'));
  expect(idx('Block B')).toBeLessThan(idx('Block C'));
  await page.locator('[data-testid="tree-expand-all"]').click();
  const all = await rows.evaluateAll((els) => els.map((e) => (e.textContent ?? '')));
  const at = (needle: string) => all.findIndex((s) => s.includes(needle));
  expect(at('Function room')).toBe(at('Wing Fu Clubhouse') + 1);
  expect(at('Function room')).toBeLessThan(at('Block A'));
  expect(errors).toEqual([]);
});

test('live: the scope rail lists the clubhouse and pool before the blocks', async ({ page }) => {
  const base = await appOrigin();
  const errors = await liveReads(page);
  await page.goto(`${base}/?screen=s2&state=default&lang=en&source=live&token=t`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="location"]').first()).toBeVisible();
  const keys = await under(page, '[data-testid="scope-rail-node"]', 'data-node-key');
  expect(keys, 'rail keys').toContain('location:loc_wfg_pool');
  const i = (k: string) => keys.indexOf(k);
  expect(i('location:loc_wfg_pool')).toBeGreaterThan(i('estate:est_wing_fu_garden'));
  expect(i('location:loc_wfg_pool')).toBeLessThan(i('location:loc_wfg_clubhouse'));
  expect(i('location:loc_wfg_clubhouse')).toBeLessThan(i('building:blk_wfg_a'));
  expect(i('building:blk_wfg_a')).toBeLessThan(i('building:blk_wfg_b'));
  // Search for a block still filters, then clearing brings the tree back in the same order.
  await page.locator('[data-testid="scope-rail-search"]').fill('Block B');
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"]')).toHaveCount(1);
  await page.locator('[data-testid="scope-rail-search-clear"]').click();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="location"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
