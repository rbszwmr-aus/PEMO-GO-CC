/**
 * The three booking screens, rendered from fixtures — and the three contract
 * behaviours proven visible. Runs against the PRODUCTION build.
 */

import { test, expect, appOrigin, urlFor } from './support/harness.ts';

const go = (page: import('@playwright/test').Page, base: string, tab: string, state: string) =>
  page.goto(urlFor(base, { service: 'search', tab, state, lang: 'en' }));

test('Explore renders every result INCLUDING the ineligible one, with its reason (test 5, visible)', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'explore', 'default');
  await expect(page.getByTestId('facility-card')).toHaveCount(13);

  const gym = page.locator('[data-testid="facility-card"][data-facility="fac_wfg_gym"]');
  await expect(gym).toHaveCount(1); // present, NOT filtered
  await expect(gym).toHaveAttribute('data-eligible', 'false');
  await expect(gym.getByTestId('eligibility-reason')).toContainText('Membership is required');
});

test('Facet counts are world-scoped — non-zero on the ZERO-results fixture (test 7, the oracle)', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'explore', 'empty');
  await expect(page.getByTestId('facility-card')).toHaveCount(0);
  await expect(page.getByTestId('explore-empty')).toBeVisible();
  // The count came from the response, not the (empty) rows.
  const cat = page.locator('[data-testid="facet-category"][data-key="function-and-event"] [data-testid="facet-count"]');
  await expect(cat).toHaveText('3');
  await expect(page.getByTestId('facets')).toHaveAttribute('data-scope', 'world');
});

test('null policy and 0 policy render DIFFERENTLY (test 6, visible)', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'detail', 'policy-absent'); // function-room: null quota
  const absentQuota = page.locator('[data-testid="rule-quota"]');
  await expect(absentQuota).toHaveAttribute('data-absent', 'true');
  await expect(absentQuota).toContainText('no booking quota');

  await go(page, base, 'detail', 'policy-zero'); // party-room: 0 quota
  const zeroQuota = page.locator('[data-testid="rule-quota"]');
  await expect(zeroQuota).toHaveAttribute('data-absent', 'false');
  await expect(zeroQuota).toContainText('0');
  await expect(zeroQuota).not.toContainText('no booking quota');
});

test('a CLOSED facility shows its state and NO date — not an empty grid, not "25 Aug"', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'detail', 'facility-closed'); // sauna
  await expect(page.getByTestId('facility-state').first()).toHaveAttribute('data-state', 'closed');
  await expect(page.getByTestId('expected-return').first()).toContainText('Reopening date not set');
  // expectedReturn: null carries no date — the export's "25 Aug" appears nowhere.
  await expect(page.locator('body')).not.toContainText('25 Aug');
  // A closed facility is not fifteen blocked slots: no slot grid is rendered here.
  await expect(page.getByTestId('slot-grid')).toHaveCount(0);
});

test('the availability grid renders slots; unavailable reveals NOTHING about a holder', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'detail', 'policy-absent'); // function-room has the availability fixture
  await expect(page.getByTestId('slot-grid')).toBeVisible();
  await expect(page.getByTestId('slot')).toHaveCount(13);
  await expect(page.getByTestId('slot-list')).toBeVisible(); // the a11y list alternative

  const unavailable = page.locator('[data-testid="slot"][data-state="unavailable"]');
  await expect(unavailable).toHaveCount(2);
  // No holder is revealed: no title, no aria-label, and the text is only time + state.
  for (const attr of ['title', 'aria-label']) {
    expect(await unavailable.first().getAttribute(attr), `unavailable slot leaked a ${attr}`).toBeNull();
  }
  const txt = (await unavailable.first().innerText()).toLowerCase();
  for (const leak of ['held', 'booked by', 'reserved', 'resident', 'member']) {
    expect(txt, `unavailable slot text leaked "${leak}"`).not.toContain(leak);
  }
});

test('an ineligible facility detail shows its reason; there is no functional Book control', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'detail', 'ineligible-present'); // gym
  await expect(page.getByTestId('eligibility').first()).toHaveAttribute('data-eligible', 'false');
  await expect(page.getByTestId('book-deferred')).toBeVisible();
  // Deferred with reason, never a dead button: the detail itself carries no controls.
  await expect(page.getByTestId('facility-detail').getByRole('button')).toHaveCount(0);
});

test('a problem state renders the contract residentMessage, role=alert', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await go(page, base, 'detail', 'record-not-found');
  const problem = page.getByTestId('problem');
  await expect(problem).toHaveAttribute('role', 'alert');
  await expect(problem).toContainText("couldn't find that facility");
});
