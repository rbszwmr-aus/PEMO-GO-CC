/**
 * PRESENCE GATES — the copy must appear iff the data it describes is there.
 *
 * This is the direction that was caught by looking at screenshots. It cannot be
 * checked by reading source: the S1 note appears twice on one screen, once
 * gated and once not, and only rendering tells them apart.
 *
 * NON-CIRCULAR BY CONSTRUCTION. The predicate is computed from the FIXTURE and
 * the observation is taken from the SCREEN. A check that derived both from the
 * page would only prove the page agrees with itself — the defect the state
 * matrix had before per-state discriminators.
 */

import { CORPUS } from '../../src/data/corpus.g.ts';
import { RESIDENTS_CORPUS } from '../../src/data/residents-corpus.ts';
import { HOUSEHOLDS_CORPUS } from '../../src/data/households-corpus.ts';
import { ADMIN_DIRECTORY_CORPUS } from '../../src/data/admin-directory-corpus.ts';
import { SCREEN_IDS, statesFor } from '../../src/data/states.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

/** For each presence claim: the copy, and when the data says it may appear. */
const PRESENCE: Array<{
  key: string;
  copy: string;
  /** Given the fixture body for the state being rendered, may the copy appear? */
  predicate: (body: any) => boolean;
  /** Only meaningful on states whose fixture has this shape. */
  applies: (body: any) => boolean;
}> = [
  {
    key: 's1.unassignedNote',
    copy: MESSAGES.s1.unassignedNote.en,
    applies: (b) => Array.isArray(b?.events),
    predicate: (b) => b.events.some((e: any) => e?.scope?.unassigned === true),
  },
  {
    key: 'state.emptyBody',
    copy: MESSAGES.state.emptyBody.en,
    applies: (b) => Array.isArray(b?.events) || Array.isArray(b?.cases),
    predicate: (b) => (b.events ?? b.cases).length === 0,
  },
  {
    key: 'state.partialBody',
    copy: MESSAGES.state.partialBody.en,
    applies: (b) => b?.meta !== undefined,
    predicate: (b) => b.meta.partial === true,
  },
  {
    key: 's5.targetNone',
    copy: MESSAGES.s5.targetNone.en,
    applies: (b) => Array.isArray(b?.notice?.targets),
    predicate: (b) => b.notice.targets.length === 0,
  },
  {
    key: 's5.responseOptionsNone',
    copy: MESSAGES.s5.responseOptionsNone.en,
    applies: (b) => b?.notice !== undefined && 'responseOptions' in b.notice,
    predicate: (b) => !b.notice.responseOptions || b.notice.responseOptions.length === 0,
  },
  {
    // UI-051: the server's empty permitted list, rendered as a sentence. Appears iff
    // some notice on the page has permittedActions === [] — lifecycle.json's pending
    // row — and never on list.json, where every row permits something.
    key: 's5.noPermittedActions',
    copy: MESSAGES.s5.noPermittedActions.en,
    applies: (b) => Array.isArray(b?.notices) || (b?.notice !== undefined && Array.isArray(b.notice.permittedActions)),
    predicate: (b) => (b.notices ?? [b.notice]).some((n: any) => Array.isArray(n?.permittedActions) && n.permittedActions.length === 0),
  },
  {
    key: 's3.attentionDot',
    copy: MESSAGES.s3.attentionDot.en,
    applies: (b) => Array.isArray(b?.nodes),
    predicate: (b) => b.nodes.some((n: any) => n?.attention === true),
  },
  {
    key: 'state.retryable',
    copy: MESSAGES.state.retryable.en,
    applies: (b) => b?.status !== undefined && b?.type !== undefined,
    predicate: (b) => b.retryable === true,
  },
  {
    key: 'state.notRetryable',
    copy: MESSAGES.state.notRetryable.en,
    applies: (b) => b?.status !== undefined && b?.type !== undefined,
    predicate: (b) => b.retryable === false,
  },
];

test('the presence table is not empty and names live copy', () => {
  // An empty oracle agrees with everything.
  expect(PRESENCE.length).toBeGreaterThanOrEqual(7);
  for (const p of PRESENCE) expect(p.copy.length, `${p.key} has no copy`).toBeGreaterThan(3);
});

test.describe('presence gates', () => {
  for (const screen of SCREEN_IDS) {
    for (const state of statesFor(screen)) {
      if (!state.file) continue;                       // client-only states have no fixture
      const body = (CORPUS[state.file] ?? RESIDENTS_CORPUS[state.file] ?? HOUSEHOLDS_CORPUS[state.file] ?? ADMIN_DIRECTORY_CORPUS[state.file]) as any;
      const relevant = PRESENCE.filter((p) => p.applies(body));
      if (relevant.length === 0) continue;

      test(`${screen}/${state.id}`, async ({ strictPage: page }) => {
        const base = await appOrigin();
        await page.goto(urlFor(base, screen, state.id, 'en'), { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="page-title"]');
        // A claim moved into an (i) tip is still on the page: its text is the button's accessible name.
        const tips = await page.locator('button.pemo-infotip').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
        const text = `${await page.innerText('body')} ${tips.join(' ')}`.replace(/\s+/g, ' ');

        for (const p of relevant) {
          const mayAppear = p.predicate(body);
          const doesAppear = text.includes(p.copy.replace(/\s+/g, ' ').slice(0, 60));
          expect(
            doesAppear,
            mayAppear
              ? `${p.key} should appear here — the data satisfies its gate — and does not`
              : `${p.key} APPEARS but the data does not satisfy it: the screen is describing something that is not there`,
          ).toBe(mayAppear);
        }
      });
    }
  }
});
