/**
 * EVERY STATE DISCRIMINATES (PID test 2).
 *
 * Each of the four states — loading, empty (the deliverable), error,
 * permission-denied — plus offline is addressable by URL and renders its OWN
 * distinct block. The discrimination is the point: an assertion for one state
 * must not pass because another rendered, and a blank page must not satisfy the
 * `empty` assertion. So each state asserts its own test id AND the absence of the
 * others. That each fails for its OWN reason is proven red by the mutation
 * battery (test/tools/mutation-harness.test.ts).
 */

import { test, expect, appOrigin, urlFor } from './support/harness.ts';

const STATES = ['empty', 'loading', 'error', 'denied', 'offline'] as const;
const TESTID: Record<(typeof STATES)[number], string> = {
  empty: 'state-empty',
  loading: 'state-loading',
  error: 'state-error',
  denied: 'state-denied',
  offline: 'state-offline',
};

for (const state of STATES) {
  test(`the ${state} state renders itself and nothing else`, async ({ strictPage: page }) => {
    const base = await appOrigin();
    await page.goto(urlFor(base, { service: 'bookings', tab: 'upcoming', state, lang: 'en' }));

    // Its own block is present and visible.
    await expect(page.getByTestId(TESTID[state])).toBeVisible();

    // No OTHER state's block is present — a broken page cannot pass another's assertion.
    for (const other of STATES) {
      if (other === state) continue;
      await expect(page.getByTestId(TESTID[other])).toHaveCount(0);
    }
  });
}

test('the default state is empty — the deliverable for a data-free pane', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, { service: 'bookings', tab: 'upcoming', lang: 'en' }));
  await expect(page.getByTestId('state-empty')).toBeVisible();
});

test('error and denied carry an assertive role; empty and offline are polite status', async ({ strictPage: page }) => {
  const base = await appOrigin();

  await page.goto(urlFor(base, { service: 'bookings', tab: 'upcoming', state: 'error', lang: 'en' }));
  await expect(page.getByTestId('state-error')).toHaveAttribute('role', 'alert');

  await page.goto(urlFor(base, { service: 'bookings', tab: 'upcoming', state: 'empty', lang: 'en' }));
  await expect(page.getByTestId('state-empty')).toHaveAttribute('role', 'status');
});
