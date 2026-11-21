/**
 * Screens load on demand (initial-bundle work): what the reader sees while a chunk is on its way, when it does not
 * arrive, and which chunks a live-mode page asks for.
 *
 * @version 0.3.0
 * @changelog
 *   0.3.0 (2026-11-20) Log out from live routes; corrected reason s3/s5 still load corpora (comment).
 *   0.2.0 (2026-11-20) R9 R&T round 2: Try again is a reload and the test reads the screen's own content; live no-corpus covers every fixed route; live rail states; live compose label.
 *   0.1.0 (2026-11-20) New (R&T P2-1, P2-2, P2-3 of the R9 review).
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import { LIVE_SCOPE_PATH, LIVE_TREE_PATH } from '../../src/data/live-client.ts';
import type { PropertyTreeResponse } from '../../src/data/types.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const REPORTS_CHUNK = '**/assets/Reports-*.js';
const navItem = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-testid="nav-item"][data-nav="${id}"]`);

test('a screen chunk that fails to load keeps the nav and says so in each language; Try again reloads and shows the screen itself', async ({ page }) => {
  const base = await appOrigin();
  const failed = { en: 'This screen could not be loaded', 'zh-Hant': '無法載入此畫面', 'zh-Hans': '无法加载此页面' } as const;

  for (const lang of ['zh-Hant', 'zh-Hans'] as const) {
    await page.goto(urlFor(base, 's2', 'default', lang), { waitUntil: 'load' });
    await expect(page.getByTestId('page-title')).toBeVisible();
    await page.route(REPORTS_CHUNK, (r) => r.abort());
    await navItem(page, 'reports').click();
    await expect(page.getByTestId('screen-load-error')).toContainText(failed[lang]);
    await expect(page.getByTestId('nav-rail')).toBeVisible();
    await expect(navItem(page, 'reports')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('reports')).toHaveCount(0);
    if (lang === 'zh-Hant') {
      // The page title already says 報告 while the error shows, so recovery is the Reports screen's own content.
      await page.unroute(REPORTS_CHUNK);
      await page.getByTestId('screen-load-retry').click();
      await expect(page.getByTestId('reports')).toBeVisible();
      await expect(page.getByTestId('screen-load-error')).toHaveCount(0);
    } else {
      await page.unroute(REPORTS_CHUNK);
    }
  }

  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.getByTestId('page-title')).toBeVisible();
  await page.route(REPORTS_CHUNK, (r) => r.abort());
  await navItem(page, 'reports').click();
  await expect(page.getByTestId('screen-load-error')).toContainText(failed.en);
  await navItem(page, 'documents').click();
  await expect(page.getByTestId('page-title')).toContainText('Documents');
  await expect(page.getByTestId('screen-load-error')).toHaveCount(0);
});

test('a deep link whose corpus chunk fails to load shows the message and Try again, not a white page', async ({ page }) => {
  const base = await appOrigin();
  await page.route('**/assets/fixture-boot-*.js', (r) => r.abort());
  await page.goto(urlFor(base, 's2', 'default', 'zh-Hans'), { waitUntil: 'load' });
  await expect(page.getByTestId('screen-load-error')).toContainText('无法加载此页面');
  await page.unroute('**/assets/fixture-boot-*.js');
  await page.getByTestId('screen-load-retry').click();
  await expect(page.getByTestId('page-title')).toBeVisible();
  await expect(page.getByTestId('screen-load-error')).toHaveCount(0);
});

test('after a click the content area is never empty: the screen on show stays until the next one has arrived', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.getByTestId('page-title')).toBeVisible();
  await page.route(REPORTS_CHUNK, async (r) => { await new Promise((done) => setTimeout(done, 700)); await r.continue(); });
  await page.evaluate(() => {
    const w = window as unknown as { __emptyFrames: number; __sampling: boolean };
    w.__emptyFrames = 0; w.__sampling = true;
    const sample = () => {
      if (!w.__sampling) return;
      if (!(document.querySelector('#main')?.textContent ?? '').trim()) w.__emptyFrames += 1;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const before = (await page.getByTestId('page-title').textContent()) ?? '';
  await navItem(page, 'reports').click();
  await page.waitForTimeout(350);
  await expect(page.getByTestId('page-title')).toHaveText(before);
  await expect(page.getByTestId('page-title')).toContainText('Reports');
  const empty = await page.evaluate(() => { const w = window as unknown as { __emptyFrames: number; __sampling: boolean }; w.__sampling = false; return w.__emptyFrames; });
  expect(empty, 'frames in which the content area had no text').toBe(0);
});

test('live-mode first routes request no corpus chunk (a fixture-mode one does)', async ({ page }) => {
  const base = await appOrigin();
  const corpus = /\/assets\/(fixture-boot|corpus\.g|residents-corpus|households-corpus|admin-directory-corpus|notices-wfg-corpus)-[\w-]+\.js/;
  // The live API is not needed to start: every API call is answered here, nothing reaches a server.
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'stub', status: 503, correlationId: 'stub' }) }));
  const seen: string[] = [];
  page.on('request', (req) => { if (corpus.test(req.url())) seen.push(req.url()); });

  // Not in this list: s2 and s1 (fixtures, no live source), and s3 and s5 (they have live data, but their chunks still import
  // fixture helpers: S3Properties -> households-corpus; S5Notices -> notices-wfg-corpus, admin-directory-session, notice-delivery
  // -> households-corpus, host-label; notice-title -> corpus.g). Splitting those is a behaviour change, deferred.
  for (const screen of ['helpdesk', 'visitorLog', 'visitorCounter', 'adminAudit', 'integrationStatus']) {
    await page.goto(urlFor(base, screen, 'default', 'en', 'live'), { waitUntil: 'load' });
    await expect(page.getByTestId('page-title')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(seen, `corpus chunks requested by the live ${screen} route`).toEqual([]);
  }

  await page.goto(urlFor(base, 'helpdesk', 'default', 'en'), { waitUntil: 'load' });
  await expect(page.getByTestId('page-title')).toBeVisible();
  expect(seen.length, 'the pattern must catch the corpus chunks a fixture-mode route loads').toBeGreaterThan(0);
});

const liveTree = CORPUS['mob-s3-properties/tree.json'] as unknown as PropertyTreeResponse;
const liveScope = CORPUS['scope/default.json'];
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const problem503 = { status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'stub', status: 503, correlationId: 'stub' }) };

test('the live rail shows loading, then an error with Try again (never a fixture tree), then the tree', async ({ page }) => {
  const base = await appOrigin();
  let treeAnswer: 'slow' | 'down' | 'up' = 'slow';
  await page.route('**/api/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === LIVE_SCOPE_PATH) return r.fulfill(json(liveScope));
    if (path !== LIVE_TREE_PATH) return r.fulfill(problem503);
    if (treeAnswer === 'slow') { await new Promise((done) => setTimeout(done, 1200)); treeAnswer = 'down'; }
    return r.fulfill(treeAnswer === 'down' ? problem503 : json(liveTree));
  });
  await page.goto(urlFor(base, 'helpdesk', 'default', 'en', 'live'), { waitUntil: 'load' });
  await expect(page.getByTestId('scope-rail-loading')).toContainText('Loading properties');
  await expect(page.getByTestId('scope-rail-error')).toContainText('The property tree could not be loaded.');
  await expect(page.getByTestId('scope-rail-empty')).toHaveCount(0);
  await expect(page.getByTestId('scope-rail-node')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail"]')).not.toContainText('fixture');
  treeAnswer = 'up';
  await page.getByTestId('scope-rail-retry').click();
  await expect(page.getByTestId('scope-rail-node').first()).toBeVisible();
  await expect(page.getByTestId('scope-rail-error')).toHaveCount(0);
  await expect(page.getByTestId('scope-rail-retry')).toHaveCount(0);
});

test('live compose at a floor names it by its label, not its id', async ({ page }) => {
  const base = await appOrigin();
  const floor = liveTree.nodes.find((n) => n.node.kind === 'floor')!;
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === LIVE_SCOPE_PATH) return r.fulfill(json(liveScope));
    if (path === LIVE_TREE_PATH) return r.fulfill(json(liveTree));
    return r.fulfill(problem503);
  });
  await page.goto(`${urlFor(base, 's5compose', 'blank', 'en', 'live')}&node=floor:${floor.node.id}`, { waitUntil: 'load' });
  await expect(page.getByTestId('compose-form')).toContainText(`Floor: ${floor.label.en}`);
  await expect(page.getByTestId('compose-form')).not.toContainText(`Floor: ${floor.node.id}`);
});

test('logging out of a live session reaches the sign-in screen from every live route', async ({ page }) => {
  const base = await appOrigin();
  await page.route('**/api/**', (r) => r.fulfill(problem503));
  for (const screen of ['helpdesk', 'visitorLog', 'visitorCounter', 'adminAudit', 'integrationStatus', 's3']) {
    await page.goto(urlFor(base, screen, 'default', 'en', 'live'), { waitUntil: 'load' });
    await expect(page.getByTestId('page-title')).toBeVisible();
    await page.getByTestId('account-button').click();
    await page.getByTestId('account-logout').click();
    await expect(page.getByTestId('signed-out'), `sign-in screen after logging out from live ${screen}`).toBeVisible();
  }
});
