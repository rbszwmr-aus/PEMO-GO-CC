/**
 * S3 tree collapse against the production build in dist/.
 *
 * Default: estate + buildings visible; floors and units collapsed.
 * Expand all / Collapse all are header actions. Nested preorder from 055 stays.
 * Expand all missing fails this suite rather than skipping.
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import type { PropertyTreeResponse, ScopeTreeResponse } from '../../src/data/types.ts';
import { buildRailNodes } from '../../src/shell/scope-focus.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const corpusTree = CORPUS['mob-s3-properties/tree.json'] as PropertyTreeResponse;
// One data source (reference pass): the page tree and the left rail read the property tree merged
// with the granted-scope tree, so the clubhouse under Block C is a row here too.
const mergedNodes = buildRailNodes(corpusTree, CORPUS['scope/default.json'] as ScopeTreeResponse);
const CORPUS_SUMMARY = '3 blocks · 812 units';

test('default fixture S3 tree shows estate and buildings, not floors or units', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's3', 'tree', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="s3-tree"]')).toBeVisible();
  await expect(page.getByText(CORPUS_SUMMARY)).toBeVisible();
  await expect(page.locator('[data-testid="tree-expand-all"]')).toHaveText('Expand all');
  await expect(page.locator('[data-testid="tree-collapse-all"]')).toHaveText('Collapse all');

  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="estate"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="tree-node"][data-kind="building"]')).toHaveCount(3);
  const labels = await page.locator('[data-testid="tree-node"][data-kind="building"] span').evaluateAll((els) =>
    els.map((e) => e.textContent?.trim() ?? '').filter((s) => /^Block [ABC]$/.test(s)),
  );
  expect(labels).toEqual(['Block A', 'Block B', 'Block C']);
});

test('Expand all shows the nested walk including units', async ({ strictPage: page }) => {
  test.setTimeout(60_000);
  const base = await appOrigin();
  await page.goto(urlFor(base, 's3', 'tree', 'en'), { waitUntil: 'load' });
  await page.locator('[data-testid="tree-expand-all"]').click();

  const units = mergedNodes.filter((n) => n.node.kind === 'unit').length;
  const floors = mergedNodes.filter((n) => n.node.kind === 'floor').length;
  await expect(page.locator('[data-testid="tree-node"]')).toHaveCount(mergedNodes.length);
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(units);
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(floors);

  const kinds = await page.locator('[data-testid="tree-node"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.kind ?? ''),
  );
  expect(kinds).toEqual(mergedNodes.map((n) => n.node.kind));
  const firstFloor = kinds.indexOf('floor');
  const blockB = kinds.indexOf('building', kinds.indexOf('building') + 1);
  expect(firstFloor).toBeGreaterThan(0);
  expect(blockB).toBeGreaterThan(firstFloor);
});

test('Collapse all hides units and floors', async ({ strictPage: page }) => {
  test.setTimeout(60_000);
  const base = await appOrigin();
  await page.goto(urlFor(base, 's3', 'tree', 'en'), { waitUntil: 'load' });
  await page.locator('[data-testid="tree-expand-all"]').click();
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]').first()).toBeVisible();

  await page.locator('[data-testid="tree-collapse-all"]').click();
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="building"]')).toHaveCount(3);
});

test('a node with children can collapse and expand', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's3', 'tree', 'en'), { waitUntil: 'load' });

  const blockA = page.locator('[data-testid="tree-node"][data-kind="building"]').filter({ hasText: 'Block A' });
  await expect(blockA).toBeVisible();
  const toggle = blockA.locator('[data-testid="tree-toggle"]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(35);
  await expect(page.locator('[data-testid="tree-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]').filter({ hasText: '12/F' })).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-testid="tree-node"][data-kind="floor"]')).toHaveCount(0);
});
