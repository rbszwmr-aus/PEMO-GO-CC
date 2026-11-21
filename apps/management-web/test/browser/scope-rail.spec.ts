/**
 * Staff rails: main nav collapse-to-icons, properties tree pick + filter.
 * Runs against the production build. Fixture default (no source=live).
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

test('both rails are expanded on first visit; nav chevron shares the brand title row', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  const nav = page.locator('[data-testid="nav-rail"]');
  const scope = page.locator('[data-testid="scope-rail"]');
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
  await expect(scope).toHaveAttribute('data-collapsed', 'false');
  await expect(nav.locator(':scope > .pemo-rail-cap')).toHaveCount(0);
  await expect(nav.locator(':scope > .pemo-sidebar__brandRow [data-testid="nav-rail-toggle"]')).toBeVisible();
  await expect(page.locator('[data-testid="nav-rail-toggle"]')).toHaveAttribute('aria-controls', 'pemo-main-nav');
  await expect(page.locator('[data-testid="nav-rail-toggle"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(scope.locator(':scope > .pemo-rail-cap [data-testid="scope-rail-toggle"]')).toBeVisible();
  const navToggle = await page.locator('[data-testid="nav-rail-toggle"]').boundingBox();
  const brandName = await nav.locator('.pemo-sidebar__brandName').boundingBox();
  expect(navToggle && brandName && Math.abs(navToggle.y - brandName.y) < 10).toBeTruthy();
  expect(navToggle && brandName && navToggle.x > brandName.x).toBeTruthy();
  const firstNav = await page.locator('[data-testid="nav-item"]').first().boundingBox();
  expect(navToggle && firstNav && navToggle.y < firstNav.y).toBeTruthy();
  const scopeToggle = await page.locator('[data-testid="scope-rail-toggle"]').boundingBox();
  const tree = await page.locator('[data-testid="scope-rail-tree"]').boundingBox();
  expect(scopeToggle && tree && scopeToggle.y < tree.y).toBeTruthy();
  await expect(page.locator('[data-testid="nav-item"]').first()).toContainText('Overview');
  await expect(page.locator('[data-testid="scope-rail-tree"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-pick-prompt"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toHaveAttribute('data-empty', 'true');
});

test('nav chevron collapses to icons-only and persists independently of the tree', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="nav-rail-toggle"]').click();
  await expect(page.locator('[data-testid="nav-rail"]')).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('collapsed');
  await expect(page.locator('[data-testid="nav-rail"] .pemo-nav__label')).toHaveCount(0);
  await expect(page.locator('[data-testid="nav-rail"] .pemo-sidebar__brandText')).toHaveCount(0);
  const collapsedMark = await page.locator('[data-testid="nav-rail"] .pemo-sidebar__mark').boundingBox();
  const collapsedToggle = await page.locator('[data-testid="nav-rail-toggle"]').boundingBox();
  expect(collapsedMark && collapsedToggle && collapsedToggle.y >= collapsedMark.y + collapsedMark.height - 2).toBeTruthy();
  if (collapsedMark && collapsedToggle) {
    const markMid = collapsedMark.x + collapsedMark.width / 2;
    const toggleMid = collapsedToggle.x + collapsedToggle.width / 2;
    expect(Math.abs(markMid - toggleMid)).toBeLessThan(8);
  }
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveAttribute('data-collapsed', 'false');

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('[data-testid="nav-rail"]')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveAttribute('data-collapsed', 'false');

  await page.locator('[data-testid="nav-rail-toggle"]').click();
  await expect(page.locator('[data-testid="nav-rail"]')).toHaveAttribute('data-collapsed', 'false');
  await expect(page.locator('[data-testid="nav-rail"] .pemo-nav__label').first()).toBeVisible();
});

test('scope chevron collapses to a thin strip and picking a node sets the path', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="scope-rail-toggle"]').click();
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.locator('[data-testid="scope-rail-tree"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="nav-rail"]')).toHaveAttribute('data-collapsed', 'false');

  await page.locator('[data-testid="scope-rail-toggle"]').click();
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveAttribute('data-collapsed', 'false');

  const blockA = page.locator('[data-testid="scope-rail-node"][data-kind="building"]').filter({ hasText: 'Block A' });
  await expect(blockA).toBeVisible();
  await blockA.locator('[data-testid="scope-rail-pick"]').click();

  await expect.poll(() => new URL(page.url()).searchParams.get('at')).toBe('building:blk_wfg_a');
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toContainText('Wing Fu Garden');
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toContainText('Block A');
  await expect(page.locator('[data-testid="scope-filter-note"]')).toBeVisible();
});

test('picked Block A filters households and help-desk fixture rows', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=households&state=list&lang=en&at=building:blk_wfg_a`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="households-row"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="households-row"][data-household-id="hh_wfg_a_12_a1"]')).toBeVisible();
  await expect(page.locator('[data-testid="households-row"][data-household-id="hh_wfg_b_03_b2"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-filter-note"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toContainText('Block A');

  await page.goto(`${base}/?screen=helpdesk&state=queue&lang=en&at=building:blk_wfg_a`, { waitUntil: 'load' });
  const units = await page.locator('[data-testid="helpdesk-row"] .pemo-meta').allTextContents();
  expect(units.length).toBeGreaterThan(0);
  for (const u of units) expect(u.trim().startsWith('A')).toBeTruthy();
});

test('properties rail is present on Households and Car Park, absent on Properties and Administration', async ({ strictPage: page }) => {
  const base = await appOrigin();

  await page.goto(`${base}/?screen=households&state=list&lang=en`, { waitUntil: 'load' });
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'false');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  // The reference has no second tree beside Properties: the page carries its own Locations panel.
  await page.goto(`${base}/?screen=s3&state=tree&lang=en`, { waitUntil: 'load' });
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="s3-tree"]')).toBeVisible();

  await page.goto(`${base}/?screen=bs-carpark&lang=en`, { waitUntil: 'load' });
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'false');
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();

  await page.goto(`${base}/?screen=admin&lang=en`, { waitUntil: 'load' });
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);
  const navBox = await page.locator('[data-testid="nav-rail"]').boundingBox();
  const mainBox = await page.locator('#main').boundingBox();
  expect(navBox && mainBox && mainBox.x < navBox.x + navBox.width + 24).toBeTruthy();
});

test('scope tree is A then B then C; expanding Block B shows floors and flats', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'households', 'list', 'en'), { waitUntil: 'load' });

  const buildings = await page.locator('[data-testid="scope-rail-node"][data-kind="building"] [data-testid="scope-rail-pick"]').allTextContents();
  expect(buildings).toEqual(['Block A', 'Block B', 'Block C']);

  const blockB = page.locator('[data-testid="scope-rail-node"][data-kind="building"]').filter({ hasText: 'Block B' });
  await expect(blockB).toBeVisible();
  await blockB.locator('[data-testid="scope-rail-disclosure"]').click();

  const floor1 = page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_01"]');
  await expect(floor1).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_04"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]')).toHaveCount(0);

  await floor1.locator('[data-testid="scope-rail-disclosure"]').click();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="unit:unit_wfg_b_01_b1"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]').filter({ hasText: 'Flat B1' })).toBeVisible();
});

test('Block B expand-all opens its floors and flats without changing A or C', async ({ strictPage: page }) => {
  test.setTimeout(60_000);
  const base = await appOrigin();
  await page.goto(urlFor(base, 'households', 'list', 'en'), { waitUntil: 'load' });

  const expandB = page.locator('[data-testid="scope-block-expand-all"][data-block-id="blk_wfg_b"]');
  const collapseB = page.locator('[data-testid="scope-block-collapse-all"][data-block-id="blk_wfg_b"]');
  await expect(expandB).toHaveAttribute('aria-label', 'Expand all floors and units in Block B');
  await expect(collapseB).toHaveAttribute('aria-label', 'Collapse all floors and units in Block B');
  await expect(page.locator('[data-testid="scope-block-expand-all"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="scope-block-collapse-all"]')).toHaveCount(3);

  const blockA = page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_a"]');
  await blockA.locator('[data-testid="scope-rail-disclosure"]').click();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_a_01"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]')).toHaveCount(0);

  await expandB.click();

  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_01"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="unit:unit_wfg_b_01_b1"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_04"]')).toHaveCount(0);

  const bFloors = await page.locator('[data-testid="scope-rail-node"][data-kind="floor"]').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).dataset.nodeKey?.startsWith('floor:fl_wfg_b_')).length,
  );
  const aFloors = await page.locator('[data-testid="scope-rail-node"][data-kind="floor"]').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).dataset.nodeKey?.startsWith('floor:fl_wfg_a_')).length,
  );
  const cFloors = await page.locator('[data-testid="scope-rail-node"][data-kind="floor"]').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).dataset.nodeKey?.startsWith('floor:fl_wfg_c_')).length,
  );
  expect(bFloors).toBe(22);
  expect(aFloors).toBe(35);
  expect(cFloors).toBe(0);

  const bUnits = await page.locator('[data-testid="scope-rail-node"][data-kind="unit"]').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).dataset.nodeKey?.startsWith('unit:unit_wfg_b_')).length,
  );
  const aUnits = await page.locator('[data-testid="scope-rail-node"][data-kind="unit"]').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).dataset.nodeKey?.startsWith('unit:unit_wfg_a_')).length,
  );
  expect(bUnits).toBe(154);
  expect(aUnits).toBe(0);
});

test('Block B collapse-all hides its floors and flats while leaving A expanded', async ({ strictPage: page }) => {
  test.setTimeout(60_000);
  const base = await appOrigin();
  await page.goto(urlFor(base, 'households', 'list', 'en'), { waitUntil: 'load' });

  const blockA = page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_a"]');
  await blockA.locator('[data-testid="scope-rail-disclosure"]').click();
  await page.locator('[data-testid="scope-block-expand-all"][data-block-id="blk_wfg_b"]').click();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="unit:unit_wfg_b_01_b1"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_a_01"]')).toBeVisible();

  await page.locator('[data-testid="scope-block-collapse-all"][data-block-id="blk_wfg_b"]').click();

  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_01"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_a_01"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"]')).toHaveCount(3);
  await expect(blockA.locator('[data-testid="scope-rail-disclosure"]')).toHaveAttribute('aria-expanded', 'true');
});

test('hiding the rail keeps at= and restores the tree on a place-scoped return', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=households&state=list&lang=en&at=building:blk_wfg_a`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toContainText('Block A');

  await page.locator('[data-testid="nav-item"][data-nav="admin"]').click();
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('at')).toBe('building:blk_wfg_a');
  await expect.poll(() => new URL(page.url()).searchParams.get('screen')).toBe('admin');

  await page.locator('[data-testid="nav-item"][data-nav="prop-households"]').click();
  await expect(page.locator('[data-testid="scope-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-path-crumb"]')).toContainText('Block A');
  await expect.poll(() => new URL(page.url()).searchParams.get('at')).toBe('building:blk_wfg_a');
});

test('typing in the rail search shows a matching flat and clear restores expand', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'households', 'list', 'en'), { waitUntil: 'load' });

  const search = page.locator('[data-testid="scope-rail-search"]');
  await expect(search).toBeVisible();
  await expect(search).toHaveAttribute('placeholder', 'Location');
  await expect(page.locator('[data-testid="scope-rail-search-clear"]')).toHaveCount(0);

  const blockA = page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_a"]');
  await blockA.locator('[data-testid="scope-rail-disclosure"]').click();
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_a_01"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]')).toHaveCount(0);

  await search.fill('Flat B1');
  const flatB1 = page.locator('[data-testid="scope-rail-node"][data-node-key="unit:unit_wfg_b_01_b1"]');
  await expect(flatB1).toBeVisible();
  await expect(flatB1).toContainText('Flat B1');
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_01"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_b"]')).toBeVisible();
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_a"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"][data-node-key="building:blk_wfg_c"]')).toHaveCount(0);

  await page.locator('[data-testid="scope-rail-search-clear"]').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('[data-testid="scope-rail-search-clear"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="unit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_b_01"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail-node"][data-kind="building"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="scope-rail-node"][data-node-key="floor:fl_wfg_a_01"]')).toBeVisible();
});
