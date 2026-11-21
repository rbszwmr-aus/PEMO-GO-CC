/**
 * The state matrix: every screen, every state, both locales.
 *
 * DOC-014-ST section 2.2 is the specification — the states the design export
 * does NOT show. The states it does show are the easy half. Design system
 * section 18 supplies the rest.
 *
 * The registry in src/data/states.ts is the single source; this suite reads it
 * rather than restating it, so a state added there cannot be silently untested.
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import { RESIDENTS_CORPUS } from '../../src/data/residents-corpus.ts';
import { HOUSEHOLDS_CORPUS } from '../../src/data/households-corpus.ts';
import { ADMIN_DIRECTORY_CORPUS } from '../../src/data/admin-directory-corpus.ts';
import { NOTICES_WFG_CORPUS } from '../../src/data/notices-wfg-corpus.ts';
import { SCREEN_IDS, statesFor, type ScreenId, type ScreenState } from '../../src/data/states.ts';
import { LOCALES, bcp47 } from '../../src/i18n/locale.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

/**
 * THE ACTS THE FIXTURE PERMITS ON THIS STATE (UI-051 D1) — computed from the
 * CORPUS, never from the page, so the check is not the page agreeing with itself.
 *
 * A `data-act` control may appear on a state only if its operationId is in this
 * set. The set is empty for every state that is not a notices write surface, so
 * the part-1 rule "no write control anywhere" is unchanged everywhere else and
 * merely REFINED on the notices screens: there, the server's list is the rule.
 */
function permittedActsFor(screen: ScreenId, state: ScreenState): Set<string> {
  const acts = new Set<string>();
  if (state.kind === 'problem' || state.kind === 'client-only' || state.kind === 'no-fixture') return acts;
  const body = state.file ? ((CORPUS[state.file] ?? RESIDENTS_CORPUS[state.file] ?? HOUSEHOLDS_CORPUS[state.file] ?? ADMIN_DIRECTORY_CORPUS[state.file] ?? NOTICES_WFG_CORPUS[state.file]) as any) : undefined;
  switch (screen) {
    case 's3':
      // UI-054 D1: the property tree is the node picker — compose appears iff some
      // node the tree renders lists it. (Default view collapses floors and units;
      // the estate and buildings are visible, and they list it in this fixture.)
      if (state.id === 'tree' && (body?.nodes ?? []).some((n: any) => (n.permittedActions ?? []).includes('composeNotice'))) acts.add('composeNotice');
      break;
    case 's5':
      for (const n of body?.notices ?? []) for (const a of n.permittedActions ?? []) acts.add(a);
      break;
    case 's5detail':
      for (const a of body?.notice?.permittedActions ?? []) acts.add(a);
      break;
    case 's5compose':
      if (state.id === 'blank' || state.id === 'prefilled') acts.add('composeNotice');
      break;
    case 's5act':
      if (!state.id.endsWith('-recorded')) acts.add(`${state.id}Notice`);
      break;
    default:
      break;
  }
  return acts;
}

/**
 * What each fixture state must put on screen to count as itself.
 *
 * The route resolving to the requested state is NOT evidence that the render
 * used it — the URL and the old state picker both reported the resolved ROUTE,
 * which for a valid id is the identity function. Only rendered structure
 * distinguishes one fixture state from another.
 *
 * Every entry is a marker the screen already emits. Nothing was added to the
 * product to make it testable.
 */
const DISCRIMINATOR: Record<string, string> = {
  's1/default': 's1-table',
  's1/empty': 'state-empty',
  's1/partial': 'state-partial',
  's1/detail': 'resident-projection',
  's1/delivery': 's1-recipients',
  's1/source': 's1-source',
  's1/source-unmapped': 'quarantine-note',
  's1/resolved': 's1-table',
  's2/default': 'stat-card',
  's2/integration-down': 'feed',
  's3/tree': 's3-tree',
  's3/unit': 's3-household',
  's4/default': 's4-table',
  's4/empty': 'state-empty',
  's5/wfg': 's5-table',
  's5/list': 's5-table',
  's5/lifecycle': 's5-table',
  's5detail/detail': 'notice-history',
  's5ack/outstanding': 's5ack-table',
  'residents/list': 'residents-table',
  'residents/empty': 'state-empty',
  'residentsDetail/detail': 'residents-detail',
  'households/list': 'households-table',
  'households/empty': 'state-empty',
  'householdsDetail/detail': 'households-detail',
  'adminUsers/list': 'admin-users-table',
  'adminUsers/empty': 'state-empty',
  'adminUsersDetail/detail': 'admin-users-detail',
  'adminGroups/list': 'admin-groups-table',
  'adminGroups/empty': 'state-empty',
  'adminGroupsDetail/detail': 'admin-groups-detail',
  'adminRoles/matrix': 'admin-roles-matrix',
  'adminEmail/default': 'admin-email-form',
  'adminLists/default': 'admin-lists',
  'adminAudit/list': 'admin-audit-table',
  'integrationStatus/list': 'integration-hub-is-online',
  'integrationStatus/hub-late': 'integration-hub-is-late',
  'integrationStatus/hub-silent': 'integration-hub-is-silent',
  'integrationStatus/hub-never': 'integration-hub-is-never',
  'integrationStatus/needs-mapping': 'integration-not-placed',
  'integrationStatus/places': 'integration-places-note',
  'integrationStatus/places-empty': 'integration-empty',
  'integrationStatusDetail/detail': 'integration-detail',
  'helpdesk/queue': 'helpdesk-queue',
  'helpdesk/empty': 'state-empty',
  'helpdesk/partial': 'state-partial',
  'helpdeskDetail/detail': 'helpdesk-detail',
  'visitorLog/default': 'visitor-stats',
  'visitorLog/detail': 'visitor-detail',
  'visitorRegister/blank': 'visitor-register-form',
  'visitorCounter/walk-in': 'walkin-form',
  'visitorCounter/pass': 'pass-panel',
  'bookings/default': 'bookings-table',
  'bookingsDetail/detail': 'bookings-detail',
  'bookingCalendar/default': 'booking-calendar',
  'bookingCheckin/default': 'booking-checkin-table',
  'bookingFacilities/default': 'booking-facilities-table',
  'bookingFacilitiesDetail/detail': 'booking-facilities-detail',
  'bookingRates/default': 'booking-rates-table',
  'reports/default': 'reports-cards',
  'reports/drill': 'report-table',
  'charges/default': 'charges-table',
  'chargesDetail/detail': 'charges-detail',
  'payments/default': 'payments-table',
  'paymentsDetail/detail': 'payments-detail',
  'refunds/default': 'refunds-table',
  'refundsDetail/detail': 'refunds-detail',
  'documents/list': 'documents-table',
  'documents/empty': 'state-empty',
  'documentsDetail/detail': 'documents-detail',
  'carPark/default': 'parkcore-connector',
  's5compose/prefilled': 'compose-form',
  's5compose/created': 'act-recorded',
  // Every s5act fixture state: a confirm form, or a recorded response.
  ...Object.fromEntries(
    ['revise', 'submit', 'approve', 'decline', 'publish', 'correct', 'withdraw'].flatMap((v) => [
      [`s5act/${v}`, 'act-confirm'],
      [`s5act/${v}-recorded`, 'act-recorded'],
    ]),
  ),
};

test.describe('state matrix', () => {
  for (const screen of SCREEN_IDS) {
    for (const state of statesFor(screen)) {
      for (const lang of LOCALES) {
        test(`${screen} · ${state.id} · ${lang}`, async ({ strictPage: page }) => {
          const base = await appOrigin();
          await page.goto(urlFor(base, screen, state.id, lang), { waitUntil: 'load' });

          // Rendered at all, in the requested locale.
          await expect(page.locator('[data-testid="page-title"]')).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute(
            'lang',
            bcp47(lang),
          );

          // The state actually reached is the state requested — not a fallback.
          //
          // Read from the URL rather than from a control. The state picker is a
          // development affordance and is EXCLUDED from the production build
          // that this suite runs against, so asserting on it would have meant
          // either shipping it or testing something that is not shipped.
          //
          // app.tsx writes the RESOLVED route back to the URL, so a fallback
          // would rewrite it. This is the app's own behaviour, not a seam added
          // for the test.
          const resolved = new URL(page.url()).searchParams;
          expect(resolved.get('state'), 'the app fell back to a different state').toBe(state.id);
          expect(resolved.get('screen'), 'the app fell back to a different screen').toBe(screen);

          // Each state must render its OWN discriminator.
          //
          // This started as a per-KIND marker with `fixture: null`, which meant
          // fixture states asserted nothing about what they rendered. A probe —
          // making the app ignore the requested state and always render the
          // screen's first — proved that s1/empty, s1/partial and s4/empty
          // passed while rendering `default`. Six renders were counted as
          // proven and were not. Per-kind is not per-state.
          const marker = DISCRIMINATOR[`${screen}/${state.id}`] ?? {
            'client-only': state.id === 'loading' ? 'state-loading' : 'state-offline',
            problem: 'state-problem',
            'no-fixture': 'state-no-fixture',
            'client-form': 'compose-form',
            fixture: null,
          }[state.kind];

          expect(
            marker,
            `no discriminator for ${screen}/${state.id}: this state would pass while rendering something else`,
          ).toBeTruthy();
          // .first(): some discriminators are repeated markers (S2 renders four
          // counters). Presence is the claim, not cardinality.
          await expect(page.locator(`[data-testid="${marker}"]`).first()).toBeVisible();

          // NO CONTROL WITHOUT A REASON TO EXIST — and since UI-051 the reason may
          // be the server's permitted list.
          //
          // Part 1's rule was "every control in main carries a read-affordance
          // marker, and no control is named after a deferred act". Part 2 keeps
          // both and adds the write rule in its strongest form:
          //
          //   1. every control in main is marked as one of: a read affordance, tree
          //      chrome, a form field inside a write form, or an ACT CONTROL
          //      carrying `data-act=<operationId>`;
          //   2. every act control's operationId is in the set the FIXTURE permits
          //      for this state (computed above from the corpus, never from the
          //      page) — a control the server did not list is a lie about the
          //      viewer's authority, and it fails here;
          //   3. on the notices list, EACH ROW's act controls equal that row's own
          //      permitted list exactly — so a control derived from the lifecycle
          //      state rather than from the list fails on the lifecycle fixture,
          //      where a draft may be published and a pending notice may not be
          //      approved;
          //   4. a form field appears only inside a write form.
          const SELECTOR = 'main button, main input, main select, main textarea, main [type=submit], main a[href]';
          const unmarked = page
            .locator(SELECTOR)
            .and(page.locator('main :not([data-read-affordance]):not([data-tree-chrome]):not([data-act]):not([data-form-field])'));
          expect(
            await unmarked.count(),
            'an unmarked control appeared in main; a control needs a read affordance, a permitted act, or a form',
          ).toBe(0);

          const permitted = permittedActsFor(screen, state);
          const onScreen = await page.locator('main [data-act]').evaluateAll((els) =>
            els.map((e) => (e as HTMLElement).dataset.act ?? ''),
          );
          const unpermitted = onScreen.filter((a) => !permitted.has(a));
          expect(
            unpermitted,
            `an act control appeared that the fixture does not permit on ${screen}/${state.id}`,
          ).toEqual([]);

          if (screen === 's5' && state.kind === 'fixture' && state.file) {
            const rows = ((CORPUS[state.file] ?? NOTICES_WFG_CORPUS[state.file]) as any).notices as Array<{ noticeId: string; permittedActions: string[] }>;
            for (const row of rows) {
              const bar = page.locator(`[data-testid="action-bar"][data-notice-id="${row.noticeId}"]`);
              const acts = (await bar.locator('[data-act]').evaluateAll((els) =>
                els.map((e) => (e as HTMLElement).dataset.act ?? ''))).sort();
              const expected = [...row.permittedActions].filter((a) => a !== 'composeNotice').sort();
              expect(acts, `row ${row.noticeId}: controls must equal the server's list exactly`).toEqual(expected);
            }
          }
          if (screen === 's3' && state.id === 'tree' && state.file) {
            // Reference layout: ONE compose control in the page header, targeted at the
            // selected node. No tree row carries one; the header control exists only when
            // the selected node's own list says composeNotice.
            const nodes = (CORPUS[state.file] as any).nodes as Array<{ node: { kind: string; id: string }; permittedActions: string[] }>;
            expect(await page.locator('[data-testid="tree-node"] [data-act="composeNotice"]').count(), 'a tree row carries a compose control').toBe(0);
            const header = page.locator('#pemo-page-actions [data-act="composeNotice"]');
            expect(await header.count(), 'exactly one header compose control, or none').toBeLessThanOrEqual(1);
            const id = await header.getAttribute('data-node-id', { timeout: 1000 }).catch(() => null);
            if (id) {
              const node = nodes.find((n) => n.node.id === id);
              if (node) expect(node.permittedActions, `header compose targets ${id} but the fixture does not list it`).toContain('composeNotice');
            }
          }
          if (screen === 's5detail' && state.kind === 'fixture' && state.file) {
            const n = (CORPUS[state.file] as any).notice as { permittedActions: string[] };
            const acts = (await page.locator('[data-testid="notice-actions"] [data-act]').evaluateAll((els) =>
              els.map((e) => (e as HTMLElement).dataset.act ?? ''))).sort();
            expect(acts, 'the detail action bar must equal the server\'s list exactly').toEqual([...n.permittedActions].sort());
          }

          const fieldsAnywhere = await page.locator('main [data-form-field]').count();
          const fieldsInForms = await page.locator('main form[data-form-act] [data-form-field]').count();
          expect(fieldsAnywhere, 'a form field appeared outside a write form').toBe(fieldsInForms);

          const actNames = (await page.locator('[data-testid="deferred-action"]').allTextContents())
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
          const controlNames = (await page.locator(SELECTOR).allTextContents())
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
          expect(
            controlNames.filter((c) => actNames.includes(c)),
            'a control is named after a deferred act',
          ).toEqual([]);
        });
      }
    }
  }
});

test.describe('the states that had to be got right', () => {
  test('the notice nobody can approve is ON SCREEN, and nothing offers to approve it', async ({
    strictPage: page,
  }) => {
    // Both halves, as before. An assertion on only the stuck notice would still
    // pass if somebody later added an approve button.
    //
    // RE-POINTED AT UI-051. Part 1 rendered a panel of deferred act names because
    // the client could not say who may press. At 2.1.0 the server says: the
    // pending row's permittedActions is EMPTY for this caller, and the row renders
    // exactly that — the server's sentence, and no control. The evidence is the
    // same (a notice at pending_approval that this caller cannot approve); it is
    // now carried by the server's list rather than by the client's silence.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's5', 'lifecycle', 'en'), { waitUntil: 'load' });

    const stuck = page.locator('[data-testid="s5-row"][data-lifecycle-state="pending_approval"]');
    await expect(stuck).toHaveCount(1);
    await expect(stuck.locator('[data-testid="lifecycle-state"]')).toContainText('Pending approval');

    // The fixture says nothing is permitted on it; the screen says so in words.
    const cycle = CORPUS['mob-s5-notices/lifecycle.json'] as any;
    const pending = cycle.notices.find((n: any) => n.lifecycleState === 'pending_approval');
    expect(pending.permittedActions, 'control: the fixture permits something on the pending notice').toEqual([]);
    await expect(stuck.locator('[data-testid="no-permitted-actions"]')).toBeVisible();
    await expect(stuck.locator('[data-act]')).toHaveCount(0);

    // And nothing anywhere on the page offers to approve THIS notice.
    await expect(page.locator(`[data-act="approveNotice"][data-notice-id="${pending.noticeId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="action-bar"][data-notice-id="${pending.noticeId}"] [data-act="approveNotice"]`)).toHaveCount(0);
  });

  test('S1 renders the window count, and it agrees with the rows it is over', async ({ strictPage: page }) => {
    // F1, inverted. The count was WITHHELD while the fixture declared six and
    // carried five. API-020-ST closed that, so the assertion flips from "render
    // neither reading" to "render the contract's own numbers, and check they
    // still describe what is on screen".
    //
    // It asserts the DECLARED count against the RENDERED rows. That is the
    // relationship F1 was: if they ever disagree again, this goes red rather
    // than the UI quietly stating a figure that is not true.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'default', 'en'), { waitUntil: 'load' });

    const line = await page.locator('[data-testid="window-count"]').textContent();
    expect(line, 'the window count is not rendered').toBeTruthy();

    const [, returned, total] = /(\d+) of (\d+) shown/.exec(line ?? '') ?? [];
    expect(returned, 'the window count is not in the expected shape').toBeTruthy();

    const rows = await page.locator('[data-testid="s1-row"]').count();
    expect(Number(returned), `the window says ${returned} returned but ${rows} rows are rendered`).toBe(rows);
    expect(Number(total)).toBeGreaterThanOrEqual(Number(returned));

    // Nothing claims truncation when there is none.
    expect(await page.locator('[data-testid="window-truncated"]').count()).toBe(0);
  });

  test('S1 partial says so: returned is below total, and the shortfall is stated', async ({ strictPage: page }) => {
    // partial.json is the ONLY truncated-window case in the corpus, and the
    // constraint attached to F1's repair was that it must survive. This is what
    // notices if it stops.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'partial', 'en'), { waitUntil: 'load' });

    const line = (await page.locator('[data-testid="window-count"]').textContent()) ?? '';
    const [, returned, total] = /(\d+) of (\d+) shown/.exec(line) ?? [];
    expect(Number(returned), 'partial.json no longer exercises returned < total').toBeLessThan(Number(total));
    expect(Number(returned)).toBe(await page.locator('[data-testid="s1-row"]').count());
    await expect(page.locator('[data-testid="window-truncated"]')).toBeVisible();
  });

  test('a Portfolio-level grant renders — the form a scope check descends from', async ({ strictPage: page }) => {
    const base = await appOrigin();
    await page.goto(`${base}/?screen=s2&state=default&lang=en&scope=portfolio-grant`, { waitUntil: 'load' });
    const grant = page.locator('[data-testid="grant"]').first();
    await expect(grant).toHaveAttribute('data-kind', 'portfolio');
    await expect(grant).toContainText('Portfolio');
  });

  test('the quarantined event is visible and unassigned, and its device reference is a FIELD in the IT details', async ({ strictPage: page }) => {
    // ADR-006 C4: visible, unassigned, never defaulted, never dropped. The
    // export buried this device reference in prose, where it reached the
    // dashboard three screens away and the boundary scan could not see it.
    // id-sweep: the reference is a system node ref, so it sits in the collapsed IT details of the
    // event's source page, not on the list. The row stays visible and says Unassigned.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'default', 'en'), { waitUntil: 'load' });

    await expect(page.locator('[data-testid="unassigned-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="unmapped-source-ref"]')).toHaveCount(0); // not on the list
    expect((await page.textContent('main')) ?? '').not.toContain('C-903');

    await page.goto(urlFor(base, 's1', 'source-unmapped', 'en'), { waitUntil: 'load' });
    const ref = page.locator('[data-testid="source-node-ref"]');
    await expect(ref).toHaveText('site 8829 / node C-903');
    await expect(page.locator('[data-testid="s1-source-it-details"]')).not.toHaveAttribute('open', /.*/); // collapsed
    // It is its own element, not a substring of a sentence.
    const own = await ref.evaluate((el) => el.textContent?.trim() === 'site 8829 / node C-903');
    expect(own, 'the device reference is embedded in prose rather than carried as a field').toBe(true);
  });

  test('the name is 2IoThub, and the retired spelling appears nowhere', async ({ strictPage: page }) => {
    const base = await appOrigin();
    for (const lang of LOCALES) {
      await page.goto(urlFor(base, 's2', 'default', lang), { waitUntil: 'load' });
      await expect(page.locator('[data-testid="feed-name"]').first()).toHaveText('2IoThub');
      expect((await page.textContent('body')) ?? '').not.toContain('IoT2Hub');
    }
  });

  test('severity renders as icon AND label, never colour alone', async ({ strictPage: page }) => {
    // severity.json consumerObligations: severity must never be encoded by
    // colour alone; every rendering carries icon, visible text label and meaning.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'default', 'zh-Hant'), { waitUntil: 'load' });

    const chips = page.locator('[data-testid="s1-row"] .pemo-chip[data-severity]');
    expect(await chips.count()).toBeGreaterThan(0);

    for (const chip of await chips.all()) {
      const glyph = await chip.locator('.pemo-chip__glyph').textContent();
      const text = (await chip.textContent()) ?? '';
      expect(glyph?.trim().length ?? 0, 'a severity chip has no glyph').toBeGreaterThan(0);
      expect(text.replace(glyph ?? '', '').trim().length, 'a severity chip has no visible label').toBeGreaterThan(0);
      await expect(chip).toHaveAttribute('title', /.+/);
    }
  });

  test('a no-fixture state states what is missing rather than showing nothing', async ({ strictPage: page }) => {
    const base = await appOrigin();
    // Repointed from `severity-coverage` to `communication-coverage`: API-020-ST
    // closed the severity gap, so that panel no longer exists. The assertion is
    // about how a gap RENDERS, so it has to name a gap that is still real.
    await page.goto(urlFor(base, 's1', 'communication-coverage', 'en'), { waitUntil: 'load' });
    const panel = page.locator('[data-testid="state-no-fixture"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('seven communication states');
    await expect(panel).toContainText('update-overdue');
  });
});
