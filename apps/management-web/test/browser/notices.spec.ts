/**
 * The notices read surface (UI-045, part 1).
 *
 * Everything here is asserted against the FROZEN FIXTURES, read through the same
 * generated corpus the app renders, so a fixture change moves the expectation and
 * the assertion together — and a RENDERING change moves only one of them, which is
 * the failure this suite is for.
 */
import { expect } from '@playwright/test';
import { test } from './support/harness.ts';
import { appOrigin } from './support/harness.ts';

import { CORPUS } from '../../src/data/corpus.g.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import type { NoticeOutstandingResponse, StaffNoticeDetailResponse, StaffNoticeListResponse } from '../../src/data/types.ts';

const LIST = CORPUS['mob-s5-notices/list.json'] as unknown as StaffNoticeListResponse;
const CYCLE = CORPUS['mob-s5-notices/lifecycle.json'] as unknown as StaffNoticeListResponse;
const DETAIL = CORPUS['mob-s5-notices/detail.json'] as unknown as StaffNoticeDetailResponse;

const url = (base: string, screen: string, state: string, lang: string) =>
  `${base}/?screen=${screen}&state=${state}&lang=${lang}&scope=default`;

test('the list renders every notice the fixture carries, and its own values', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5', 'list', 'en'), { waitUntil: 'load' });

  const rows = page.locator('[data-testid="s5-row"]');
  await expect(rows).toHaveCount(LIST.notices.length);

  // Byte-faithful: the titles on screen are the fixture's own strings, and the
  // ids are the fixture's ids. Compared as SETS against the source, never against
  // a list typed into this file.
  const titles = await rows.locator('[data-testid="s5-open"]').allTextContents();
  expect(titles.map((s) => s.trim()).sort()).toEqual(LIST.notices.map((n) => n.titleEn).sort());

  const ids = await rows.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.noticeId ?? ''),
  );
  expect(ids.sort()).toEqual(LIST.notices.map((n) => n.noticeId).sort());

  // mandatoryAck is rendered from the payload, not inferred from the type.
  const required = await page
    .locator('[data-testid="mandatory-ack"][data-required="true"]')
    .count();
  expect(required).toBe(LIST.notices.filter((n) => n.mandatoryAck).length);
});

test('the default order is publish time newest first, with unscheduled notices last', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5', 'list', 'en'), { waitUntil: 'load' });

  const ids = await page
    .locator('[data-testid="s5-row"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.noticeId ?? ''));

  // The expectation is DERIVED from the fixture by the same rule the screen
  // states, not transcribed: anything else would let a wrong order agree with a
  // wrong expectation.
  const expected = [...LIST.notices]
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      const pa = a.n.publishAt;
      const pb = b.n.publishAt;
      if (pa && pb && pa !== pb) return pa < pb ? 1 : -1;
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return a.i - b.i;
    })
    .map((x) => x.n.noticeId);
  expect(ids).toEqual(expected);
});

test('the filter narrows the list, and when nothing matches it says FILTER, not "no notices"', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5', 'lifecycle', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="s5-row"]')).toHaveCount(CYCLE.notices.length);

  // Every lifecycle state in this fixture appears exactly once, so filtering to one
  // must leave exactly the rows carrying it — checked against the fixture.
  await page.locator('[data-testid="s5-status-tab"][data-tab="draft"]').click();
  const drafts = CYCLE.notices.filter((n) => n.lifecycleState === 'draft');
  await expect(page.locator('[data-testid="s5-row"]')).toHaveCount(drafts.length);

  // A combination the fixture cannot satisfy: draft + a type no draft has.
  const draftTypes = new Set(drafts.map((n) => n.noticeType));
  const otherType = CYCLE.notices.map((n) => n.noticeType).find((ty) => !draftTypes.has(ty));
  expect(otherType, 'the fixture cannot produce an empty filtered set').toBeTruthy();
  await page.locator('[data-testid="s5-filters-type"]').selectOption(otherType as string);

  await expect(page.locator('[data-testid="s5-row"]')).toHaveCount(0);
  const msg = page.locator('[data-testid="filter-no-match"]');
  await expect(msg).toBeVisible();
  await expect(msg).toHaveText(MESSAGES.s5.filterNoMatch.en);
  // The distinction this claim exists to keep: the server returned notices.
  expect(MESSAGES.s5.filterNoMatch.en.toLowerCase()).toContain('filter');
});

test('J and K walk the list and Enter opens the notice; A and D are not bound', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5', 'lifecycle', 'en'), { waitUntil: 'load' });

  const rows = page.locator('[data-testid="s5-row"]');
  await rows.first().focus();
  await expect(rows.first()).toBeFocused();

  await page.keyboard.press('j');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('j');
  await expect(rows.nth(2)).toBeFocused();
  await page.keyboard.press('k');
  await expect(rows.nth(1)).toBeFocused();

  // A and D are approve/decline in A-05 and MUST do nothing here: there is no act
  // to perform and no authority to perform it with.
  const before = page.url();
  await page.keyboard.press('a');
  await page.keyboard.press('d');
  expect(page.url(), 'A or D acted on a read-only surface').toBe(before);

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.s5.detailTitle.en);
  await expect(page).toHaveURL(/[?&]screen=s5detail(&|$)/); // the move is a transition: the address follows the screen
  expect(new URL(page.url()).searchParams.get('screen')).toBe('s5detail');
});

test('the detail carries BOTH languages and the toggle switches which is shown', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5detail', 'detail', 'en'), { waitUntil: 'load' });
  const n = DETAIL.notice;

  const en = page.locator('[data-testid="body-en"]');
  const zh = page.locator('[data-testid="body-zh"]');

  // Both are in the document — a reviewer must be able to reach both — and the
  // text is the fixture's own, byte for byte.
  await expect(en).toHaveText(n.bodyEn);
  await expect(zh).toHaveText(n.bodyZhHant);

  // Both stay VISIBLE — the toggle changes which leads. Asserted as order, because
  // that is what changes; asserting visibility would pass trivially and forever.
  await expect(en).toBeVisible();
  await expect(zh).toBeVisible();
  await expect(en).toHaveAttribute('data-leading', 'true');
  await expect(zh).toHaveAttribute('data-leading', 'false');
  await expect(page.locator('[data-testid="notice-title"]')).toHaveText(n.titleEn);

  const orderOf = () =>
    page.locator('[data-leading] > dd, dl[data-leading] dd').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.testid ?? (e as HTMLElement).getAttribute('data-testid') ?? ''),
    );
  expect(await orderOf()).toEqual(['body-en', 'body-zh']);

  await page.locator('[data-testid="toggle-language"]').click();
  await expect(zh).toHaveAttribute('data-leading', 'true');
  await expect(en).toHaveAttribute('data-leading', 'false');
  await expect(en).toBeVisible();
  await expect(zh).toBeVisible();
  await expect(page.locator('[data-testid="notice-title"]')).toHaveText(n.titleZhHant);
  expect(await orderOf()).toEqual(['body-zh', 'body-en']);
});

test('the disposition history is the fixture chain, in order, by disposition', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5detail', 'detail', 'en'), { waitUntil: 'load' });

  // Structural and ORDERED. "the word appears somewhere on the page" once survived
  // a corrupted entry on this very screen, so the comparison is the whole sequence.
  const rendered = await page
    .locator('[data-testid="history-entry"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.disposition ?? ''));
  expect(rendered).toEqual(DETAIL.notice.history.map((h) => h.disposition));

  const versions = await page
    .locator('[data-testid="history-entry"]')
    .evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.version)));
  expect(versions).toEqual(DETAIL.notice.history.map((h) => h.version));
});

test('the draft preview is GATED: the live notice does not claim to be a preview', async ({
  strictPage: page,
}) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5detail', 'detail', 'en'), { waitUntil: 'load' });

  // The only detail fixture is `live`, so the gate must be closed here. The OPEN
  // case has no fixture and is declared as a gap in states.ts — asserting it would
  // mean inventing a draft notice, which is the thing this surface refuses.
  expect(DETAIL.notice.lifecycleState).not.toBe('draft');
  await expect(page.locator('[data-testid="draft-preview"]')).toHaveCount(0);
});

test('the outstanding screen renders the fixture’s recipients, in the server’s order', async ({
  strictPage: page,
}) => {
  // RE-POINTED AT UI-051: GEN-047 gave getNoticeOutstanding its fixture (UI-045
  // G1 closed), so the part-1 gap panel is a renderer. Rows are the fixture's own,
  // in the ORDER the server sent them — the contract puts unacknowledged first and
  // the client does not re-sort.
  const base = await appOrigin();
  await page.goto(url(base, 's5ack', 'outstanding', 'en'), { waitUntil: 'load' });
  const ack = CORPUS['notices/outstanding.json'] as unknown as NoticeOutstandingResponse;

  await expect(page.locator('[data-testid="state-no-fixture"]')).toHaveCount(0);
  const rows = page.locator('[data-testid="recipient-row"]');
  await expect(rows).toHaveCount(ack.recipients.length);
  const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.residentId ?? ''));
  expect(ids).toEqual(ack.recipients.map((r) => r.residentId));
  // id-sweep: ids and resident ids sit in the collapsed IT details, not on the page body.
  await expect(page.locator('[data-testid="outstanding-it-details"]')).toContainText(ack.noticeId);
  await expect(page.locator('[data-testid="s5ack-table"]')).not.toContainText(ack.recipients[0]!.residentId);

  const summary = page.locator('[data-testid="ack-summary"]');
  await expect(summary).toHaveAttribute('data-total', String(ack.recipients.length));
  await expect(summary).toHaveAttribute('data-acknowledged', String(ack.recipients.filter((r) => r.acknowledged).length));
  // The identity column is a NAMED deferral, on screen.
  await expect(page.locator('[data-testid="identity-deferral"]')).toContainText('G7');
});

test('URL is the state: all three notices screens round-trip', async ({ strictPage: page }) => {
  const base = await appOrigin();
  for (const [screen, state] of [
    ['s5', 'list'],
    ['s5detail', 'detail'],
    ['s5ack', 'outstanding'],
  ] as const) {
    for (const lang of ['en', 'zh-Hant'] as const) {
      await page.goto(url(base, screen, state, lang), { waitUntil: 'load' });
      const q = new URL(page.url()).searchParams;
      expect(q.get('screen'), `${screen} fell back`).toBe(screen);
      expect(q.get('state'), `${screen}/${state} fell back`).toBe(state);
      expect(q.get('lang')).toBe(lang);
    }
  }
});

test('Notices is in the nav, once, and the nav stayed flat', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, 's5', 'list', 'en'), { waitUntil: 'load' });

  const items = page.locator('[data-testid="nav-item"]');
  await expect(items).toHaveCount(5);
  const screens = await items.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.screen ?? ''),
  );
  expect(screens.filter((s) => s === 's5')).toHaveLength(1);
  // Detail and outstanding are reached FROM the list, so they must not add rows.
  expect(screens).not.toContain('s5detail');
  expect(screens).not.toContain('s5ack');
});
