/**
 * The notices write flow (UI-051, part 2), against the FROZEN FIXTURES.
 *
 * Every expectation is read from the corpus or derived from the contract, never
 * transcribed — so a fixture change moves both sides together, and a RENDERING
 * change moves only one, which is the failure this suite exists to catch.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { CORPUS } from '../../src/data/corpus.g.ts';
import { ACT_OPERATION_IDS, type ActOperationId } from '../../src/data/types.ts';
import type {
  ComposeNoticeRequest, NoticeActResponse, NoticeTransitionRequest, Problem, PropertyTreeResponse,
  StaffNoticeDetailResponse, StaffNoticeListResponse,
} from '../../src/data/types.ts';
import { NOTICE_REASONS } from '../../src/data/notice-reasons.g.ts';
import { MGMT_CONTRACT_DIR } from '../../tool/corpus-source.ts';
import { appOrigin, expect, test } from './support/harness.ts';

const DETAIL = CORPUS['mob-s5-notices/detail.json'] as unknown as StaffNoticeDetailResponse;
const CYCLE = CORPUS['mob-s5-notices/lifecycle.json'] as unknown as StaffNoticeListResponse;
const COMPOSE_REQUEST = CORPUS['notices/compose-request.json'] as unknown as ComposeNoticeRequest;
const COMPOSE_RESPONSE = CORPUS['notices/compose.json'] as unknown as NoticeActResponse;
const VERBS = ['revise', 'submit', 'approve', 'decline', 'publish', 'correct', 'withdraw'] as const;

const url = (base: string, q: Record<string, string>) => `${base}/?${new URLSearchParams(q).toString()}`;
const acts = (page: import('@playwright/test').Page, within = 'main') =>
  page.locator(`${within} [data-act]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.act ?? ''));

test('the detail action bar is exactly the server’s permitted list, in contract order', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5detail', state: 'detail', lang: 'en' }), { waitUntil: 'load' });
  const rendered = await acts(page, '[data-testid="notice-actions"]');
  const expected = ACT_OPERATION_IDS.filter((op) => DETAIL.notice.permittedActions.includes(op));
  expect(expected.length, 'control: the detail fixture permits nothing — this test would be vacuous').toBeGreaterThan(0);
  expect(rendered).toEqual(expected);
  await expect(page.locator('[data-testid="notice-actions"] [data-testid="no-permitted-actions"]')).toHaveCount(0);
});

test('every row’s controls equal that row’s permitted list — a draft the caller may publish, a pending notice they may not approve', async ({ strictPage: page }) => {
  // The lifecycle fixture is where "derive it from the state" and "read what the
  // server said" DISAGREE: the draft lists publishNotice (an ungated type) and the
  // pending notice lists nothing. Asserted row by row, so a state-derived table
  // cannot pass by matching most rows.
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5', state: 'lifecycle', lang: 'en' }), { waitUntil: 'load' });
  const draft = CYCLE.notices.find((n) => n.lifecycleState === 'draft');
  const pending = CYCLE.notices.find((n) => n.lifecycleState === 'pending_approval');
  expect(draft?.permittedActions, 'control: the draft no longer lists publishNotice').toContain('publishNotice');
  expect(pending?.permittedActions, 'control: the pending notice now permits something').toEqual([]);
  for (const row of CYCLE.notices) {
    const bar = page.locator(`[data-testid="action-bar"][data-notice-id="${row.noticeId}"]`);
    const rendered = await bar.locator('[data-act]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.act ?? ''));
    expect(rendered, row.noticeId).toEqual(ACT_OPERATION_IDS.filter((op) => row.permittedActions.includes(op)));
    if (row.permittedActions.length === 0) await expect(bar.locator('[data-testid="no-permitted-actions"]')).toBeVisible();
  }
});

test('one Compose button sits in the Properties page header; it targets the SELECTED tree node (estate by default) and is hidden where the node does not list composeNotice', async ({ strictPage: page }) => {
  // UI-051 G6, ruled: the property tree is the node picker. PT (16:14 HKT): no compose button per node - one
  // Compose button on top, and the selected node is the audience. The control is drawn from the selected
  // node's own permittedActions (never from kind or depth) and hidden, not disabled, where it is not listed.
  const base = await appOrigin();
  const tree = CORPUS['mob-s3-properties/tree.json'] as unknown as PropertyTreeResponse;
  test.setTimeout(60_000);
  await page.goto(url(base, { screen: 's3', state: 'tree', lang: 'en' }), { waitUntil: 'load' });
  await page.locator('[data-testid="tree-expand-all"]').click();

  // Exactly one, in the header actions beside the title, and never on a tree row or in the rail.
  const control = page.locator('[data-testid="compose-on-node"]');
  await expect(control).toHaveCount(1);
  await expect(page.locator('#pemo-page-actions [data-testid="compose-on-node"]')).toHaveCount(1);
  // The visible label is the short one, with the icon; the full act name stays the accessible name.
  await expect(control).toHaveText('Compose');
  await expect(control).toHaveAttribute('aria-label', 'Compose a notice');
  await expect(control.locator('svg')).toHaveCount(1);
  await expect(page.locator('[data-testid="tree-node"] [data-testid="compose-on-node"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="scope-rail"] [data-act="composeNotice"]')).toHaveCount(0);
  const titleBox = (await page.locator('[data-testid="page-title"]').boundingBox())!;
  const buttonBox = (await control.boundingBox())!;
  expect(buttonBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
  expect(Math.abs((buttonBox.y + buttonBox.height / 2) - (titleBox.y + titleBox.height / 2))).toBeLessThan(24);

  // Nothing selected yet: the whole estate is the default target.
  const estate = tree.nodes.find((n) => n.node.kind === 'estate')!;
  await expect(control).toHaveAttribute('data-node-kind', 'estate');
  await expect(control).toHaveAttribute('data-node-id', estate.node.id);

  // Selecting another node retargets the same button; where the server lists composeNotice it is there.
  const pick = async (n: (typeof tree.nodes)[number]) => {
    await page.locator(`[data-testid="tree-node"][data-node-id="${n.node.id}"] [data-testid="tree-pick"]`).click();
  };
  const sample = [
    tree.nodes.find((n) => n.node.kind === 'building')!,
    tree.nodes.find((n) => n.node.kind === 'floor' && n.permittedActions.includes('composeNotice'))!,
    tree.nodes.find((n) => n.node.kind === 'unit')!,
  ];
  expect(sample[1]!.permittedActions.includes('composeNotice'), 'control: a floor must permit compose').toBe(true);
  for (const n of sample) {
    await pick(n);
    if (n.permittedActions.includes('composeNotice')) {
      await expect(control, `${n.node.kind}:${n.node.id} lists composeNotice`).toHaveCount(1);
      await expect(control).toHaveAttribute('data-node-id', n.node.id);
      await expect(control).toHaveAttribute('data-node-kind', n.node.kind);
      await expect(control).toBeEnabled();
    } else {
      await expect(control, `${n.node.kind}:${n.node.id} does not list composeNotice`).toHaveCount(0);
    }
  }

  // Pressing it with a floor selected opens the compose form AT that floor.
  const floor = sample[1]!;
  await pick(floor);
  await control.click();
  await expect(page).toHaveURL(/[?&]screen=s5compose(&|$)/); // the move is a transition: the address follows once the screen has arrived
  const q = new URL(page.url()).searchParams;
  expect(q.get('screen')).toBe('s5compose');
  expect(q.get('node')).toBe(`floor:${floor.node.id}`);
  await expect(page.locator('[data-testid="target-row"]').first().locator('[name="targets.nodeKind"]')).toHaveValue('floor');
  await expect(page.locator('[data-testid="target-row"]').first().locator('[name="targets.nodeId"]')).toHaveValue(floor.node.id);

  // With nothing picked, the default target is the estate.
  await page.goto(url(base, { screen: 's3', state: 'tree', lang: 'en' }), { waitUntil: 'load' });
  await page.locator('[data-testid="compose-on-node"]').click();
  await expect(page).toHaveURL(/[?&]screen=s5compose(&|$)/); // the move is a transition: the address follows once the screen has arrived
  expect(new URL(page.url()).searchParams.get('node')).toBe(`estate:${estate.node.id}`);

  // The notices list no longer draws the entry; it points at Properties.
  await page.goto(url(base, { screen: 's5', state: 'list', lang: 'en' }), { waitUntil: 'load' });
  await expect(page.locator('[data-act="composeNotice"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="compose-from-tree"]')).toBeVisible();
});

test('the compose form is ComposeNoticeRequest, field for field — nothing more, nothing less', async ({ strictPage: page }) => {
  const doc = parseYaml(readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8')) as any;
  const schemaFields = Object.keys(doc.components.schemas.ComposeNoticeRequest.properties as object).sort();
  expect(schemaFields.length).toBeGreaterThanOrEqual(10);

  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5compose', state: 'blank', lang: 'en', node: 'building:blk_wfg_a' }), { waitUntil: 'load' });
  const names = await page.locator('[data-testid="compose-form"] [name]').evaluateAll((els) =>
    els.map((e) => (e as HTMLInputElement).name.replace(/\..*$/, '')));
  expect([...new Set(names)].sort()).toEqual(schemaFields);
  // The entry node became the first target.
  await expect(page.locator('[data-testid="target-row"]').first().locator('[name="targets.nodeId"]')).toHaveValue('blk_wfg_a');
});

test('the prefilled compose form carries the recorded request byte for byte', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5compose', state: 'prefilled', lang: 'en' }), { waitUntil: 'load' });
  const f = page.locator('[data-testid="compose-form"]');
  await expect(f).toHaveAttribute('data-prefilled', 'true');
  await expect(f.locator('[name="noticeType"]')).toHaveValue(COMPOSE_REQUEST.noticeType);
  await expect(f.locator('[name="titleEn"]')).toHaveValue(COMPOSE_REQUEST.titleEn);
  await expect(f.locator('[name="titleZhHant"]')).toHaveValue(COMPOSE_REQUEST.titleZhHant);
  await expect(f.locator('[name="bodyEn"]')).toHaveValue(COMPOSE_REQUEST.bodyEn);
  await expect(f.locator('[name="bodyZhHant"]')).toHaveValue(COMPOSE_REQUEST.bodyZhHant);
  expect(await f.locator('[name="mandatoryAck"]').isChecked()).toBe(COMPOSE_REQUEST.mandatoryAck ?? false);
  await expect(f.locator('[name="responseOptions"]')).toHaveValue((COMPOSE_REQUEST.responseOptions ?? []).join('\n'));
  const rows = f.locator('[data-testid="target-row"]');
  await expect(rows).toHaveCount(COMPOSE_REQUEST.targets.length);
  await expect(rows.first().locator('[name="targets.nodeKind"]')).toHaveValue(COMPOSE_REQUEST.targets[0]?.nodeKind ?? '');
  await expect(rows.first().locator('[name="targets.nodeId"]')).toHaveValue(COMPOSE_REQUEST.targets[0]?.nodeId ?? '');
});

test('a missing language is a state of the form: blank flags both, prefilled flags none, clearing one flags one', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5compose', state: 'blank', lang: 'en' }), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="language-flag"][data-missing="true"]')).toHaveCount(2);

  await page.goto(url(base, { screen: 's5compose', state: 'prefilled', lang: 'zh-Hant' }), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="language-flag"][data-missing="true"]')).toHaveCount(0);
  // Both languages are on the page whatever the interface locale.
  await expect(page.locator('[data-testid="language-en"]')).toBeVisible();
  await expect(page.locator('[data-testid="language-zh"]')).toBeVisible();

  await page.locator('[name="titleZhHant"]').fill('');
  await expect(page.locator('[data-testid="language-zh"]')).toHaveAttribute('data-missing', 'true');
  await expect(page.locator('[data-testid="language-en"]')).toHaveAttribute('data-missing', 'false');

  // A language with a title and NO BODY is missing too. Added after mutation m17
  // (flag reads only the title) stayed green against the three lines above.
  await page.locator('[name="titleZhHant"]').fill(COMPOSE_REQUEST.titleZhHant);
  await expect(page.locator('[data-testid="language-zh"]')).toHaveAttribute('data-missing', 'false');
  await page.locator('[name="bodyZhHant"]').fill('');
  await expect(page.locator('[data-testid="language-zh"]')).toHaveAttribute('data-missing', 'true');
  await page.locator('[name="bodyEn"]').fill('');
  await expect(page.locator('[data-testid="language-flag"][data-missing="true"]')).toHaveCount(2);
});

test('composing in fixture mode returns the recorded response, then opens the notice', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5compose', state: 'prefilled', lang: 'en' }), { waitUntil: 'load' });
  await page.locator('[data-testid="compose-submit"]').click();
  const recorded = page.locator('[data-testid="act-recorded"]');
  await expect(recorded).toBeVisible();
  await expect(recorded).toHaveAttribute('data-act-recorded', 'composeNotice');
  await expect(page.locator('[data-testid="recorded-notice-id"]')).toHaveText(COMPOSE_RESPONSE.noticeId);
  await expect(page.locator('[data-testid="recorded-version"]')).toHaveText(String(COMPOSE_RESPONSE.version));
  // Fixture mode says so, on screen.
  await expect(page.locator('[data-testid="recorded-response-note"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('state')).toBe('created');

  await page.locator('[data-testid="open-notice"]').click();
  await expect(page).toHaveURL(/[?&]screen=s5detail(&|$)/); // the move is a transition: the address follows once the screen has arrived
  const q = new URL(page.url()).searchParams;
  expect(q.get('screen')).toBe('s5detail');
  expect(q.get('notice')).toBe(COMPOSE_RESPONSE.noticeId);
});

test('each transition confirm is prefilled from its recorded request and carries exactly its act', async ({ strictPage: page }) => {
  const base = await appOrigin();
  for (const verb of VERBS) {
    const op = `${verb}Notice` as ActOperationId;
    const req = CORPUS[`notices/${verb}-request.json`] as unknown as NoticeTransitionRequest;
    await page.goto(url(base, { screen: 's5act', state: verb, lang: 'en' }), { waitUntil: 'load' });
    const f = page.locator('[data-testid="act-confirm"]');
    await expect(f, verb).toHaveAttribute('data-form-act', op);
    await expect(f.locator('[name="fromVersion"]')).toHaveValue(String(req.fromVersion));
    // reasonCode is a SELECT over the act's own subset (UI-054 D2, 2.2.0), present
    // iff the act takes a reason; its options are the generated subset exactly and
    // the recorded request's code is selected.
    const reasons = NOTICE_REASONS[op];
    const select = f.locator('select[name="reasonCode"]');
    await expect(select).toHaveCount(reasons ? 1 : 0);
    if (reasons) {
      const options = await select.locator('option').evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      expect(options, verb).toEqual([...reasons.codes]);
      await expect(select).toHaveValue(req.reasonCode ?? '');
      await expect(select).toHaveAttribute('data-reason-required', String(reasons.required));
    } else {
      expect(req.reasonCode ?? null, `${verb} takes no reason but its recorded request carries one`).toBeNull();
    }
    // Content fields belong to revise and correct, per the contract's description of each act.
    const content = verb === 'revise' || verb === 'correct';
    await expect(f).toHaveAttribute('data-content-act', String(content));
    await expect(f.locator('[name="titleEn"]')).toHaveCount(content ? 1 : 0);
    if (content) await expect(f.locator('[name="titleEn"]')).toHaveValue(req.titleEn ?? '');
    if (content) await expect(f.locator('[name="bodyEn"]')).toHaveValue(req.bodyEn ?? '');
    expect(await acts(page), verb).toEqual([op]);
  }
});

test('confirming in fixture mode returns the recorded response for THAT act', async ({ strictPage: page }) => {
  const base = await appOrigin();
  for (const verb of ['submit', 'withdraw'] as const) {
    const res = CORPUS[`notices/${verb}.json`] as unknown as NoticeActResponse;
    await page.goto(url(base, { screen: 's5act', state: verb, lang: 'en', notice: res.noticeId }), { waitUntil: 'load' });
    await page.locator('[data-testid="act-confirm-submit"]').click();
    const recorded = page.locator('[data-testid="act-recorded"]');
    await expect(recorded).toBeVisible();
    await expect(recorded).toHaveAttribute('data-act-recorded', `${verb}Notice`);
    await expect(page.locator('[data-testid="recorded-version"]')).toHaveText(String(res.version));
    expect(new URL(page.url()).searchParams.get('state')).toBe(`${verb}-recorded`);
  }
});

test('an act starts from its control: a permitted act on the detail opens that act’s confirm for that notice', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5detail', state: 'detail', lang: 'en', notice: DETAIL.notice.noticeId }), { waitUntil: 'load' });
  const op = DETAIL.notice.permittedActions[0] as string;
  await page.locator(`[data-testid="notice-actions"] [data-act="${op}"]`).click();
  await expect(page).toHaveURL(/[?&]screen=s5act(&|$)/); // the move is a transition: the address follows once the screen has arrived
  const q = new URL(page.url()).searchParams;
  expect(q.get('screen')).toBe('s5act');
  expect(q.get('state')).toBe(op.replace(/Notice$/, ''));
  expect(q.get('notice')).toBe(DETAIL.notice.noticeId);
  await expect(page.locator('[data-testid="confirm-notice-id"]')).toHaveText(DETAIL.notice.noticeId);
  // Nothing was sent, nothing changed: the confirm is a page, not an act.
  await expect(page.locator('[data-testid="act-recorded"]')).toHaveCount(0);
});

test('a refusal is presented by TYPE: wrong-state and stale-version are distinct states, distinguished by type', async ({ strictPage: page }) => {
  // RE-POINTED AT UI-054 (2.2.0): GEN-052 relabelled the stale-version fixture and
  // recorded a real wrong-state, both 409. Same status, different type, different
  // presentation — the type is the discriminator, never the prose.
  const base = await appOrigin();
  const wrong = CORPUS['notices/refusal-wrong-state.json'] as unknown as Problem;
  const stale = CORPUS['notices/refusal-stale-version.json'] as unknown as Problem;
  expect(wrong.type).toBe('https://pemo.local/problems/notice-wrong-state');
  expect(stale.type).toBe('https://pemo.local/problems/notice-stale-version');
  expect(wrong.status, 'control: the two refusals now differ by status too, so this test would prove less').toBe(stale.status);

  const seen: Record<string, { kind: string | null; title: string | null }> = {};
  for (const [state, fixture] of [['wrong-state', wrong], ['stale-version', stale]] as const) {
    await page.goto(url(base, { screen: 's5act', state, lang: 'en' }), { waitUntil: 'load' });
    const panel = page.locator('[data-testid="state-problem"]');
    await expect(panel).toHaveAttribute('data-problem-kind', fixture.type.split('/').pop() as string);
    await expect(panel).toHaveAttribute('data-problem-status', String(fixture.status));
    seen[state] = { kind: await panel.getAttribute('data-problem-kind'), title: await panel.locator('h2').textContent() };
  }
  expect(seen['wrong-state']!.kind).not.toBe(seen['stale-version']!.kind);
  expect(seen['wrong-state']!.title).not.toBe(seen['stale-version']!.title);
});

test('every 2.2.0 refusal fixture is bound to a state and renders by its own type', async ({ strictPage: page }) => {
  const base = await appOrigin();
  const bound: Array<[string, string, string]> = [
    ['s5act', 'approval-required', 'notices/refusal-approval-required.json'],
    ['s5act', 'retargeting-forbidden', 'notices/refusal-retargeting-forbidden.json'],
    ['s5act', 'empty-audience', 'notices/refusal-empty-audience.json'],
    ['s5compose', 'schedule-inverted', 'notices/refusal-schedule-inverted.json'],
    ['s5detail', 'notice-not-found', 'notices/refusal-not-found.json'],
  ];
  for (const [screen, state, file] of bound) {
    const fixture = CORPUS[file] as unknown as Problem;
    await page.goto(url(base, { screen, state, lang: 'en' }), { waitUntil: 'load' });
    const panel = page.locator('[data-testid="state-problem"]');
    await expect(panel, `${screen}/${state}`).toHaveAttribute('data-problem-kind', fixture.type.split('/').pop() as string);
    await expect(panel).toHaveAttribute('data-problem-status', String(fixture.status));
  }
});

test('the incomplete-translation refusal renders by its own type — the post-act bilingual-missing state', async ({ strictPage: page }) => {
  // RE-POINTED AT GEN-052: UI-051 declared this state a gap because the corpus
  // carried no Problem of this type; GEN-052 recorded it. Bound, and presented
  // distinctly from the stale-version refusal — the D4 bite, now on a fixture.
  const base = await appOrigin();
  const fixture = CORPUS['notices/refusal-incomplete-translation.json'] as unknown as Problem;
  expect(fixture.type).toBe('https://pemo.local/problems/notice-incomplete-translation');
  await page.goto(url(base, { screen: 's5act', state: 'incomplete-translation', lang: 'en' }), { waitUntil: 'load' });
  await expect(page.locator('[data-testid="state-no-fixture"]')).toHaveCount(0);
  const panel = page.locator('[data-testid="state-problem"]');
  await expect(panel).toHaveAttribute('data-problem-kind', 'notice-incomplete-translation');
  await expect(panel).toHaveAttribute('data-problem-status', String(fixture.status));
  const title = await panel.locator('h2').textContent();
  await page.goto(url(base, { screen: 's5act', state: 'stale-version', lang: 'en' }), { waitUntil: 'load' });
  expect(await page.locator('[data-testid="state-problem"] h2').textContent()).not.toBe(title);
});

test('stateEnteredAt is shown beside the state as relative time from the response’s own clock', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(url(base, { screen: 's5', state: 'lifecycle', lang: 'en' }), { waitUntil: 'load' });
  const rtf = new Intl.RelativeTimeFormat('en-HK', { numeric: 'auto' });
  for (const n of CYCLE.notices) {
    const cell = page.locator(`[data-testid="s5-row"][data-notice-id="${n.noticeId}"] [data-testid="state-entered"]`);
    await expect(cell).toHaveAttribute('data-entered-at', n.stateEnteredAt);
    // 09:00 entered, 09:56 generated: 56 minutes ago, for every row in this fixture.
    const minutes = Math.round((new Date(n.stateEnteredAt).getTime() - new Date(CYCLE.meta.generatedAt).getTime()) / 60000);
    await expect(cell).toContainText(rtf.format(minutes, 'minute'));
    await expect(cell).toHaveAttribute('title', /2026/);
  }
});

test('the list title follows the locale: English on en, Traditional Chinese on zh-Hant', async ({ strictPage: page }) => {
  // UI-045 G2 closed at 2.1.0: the list carries titleZhHant.
  const base = await appOrigin();
  const first = CYCLE.notices[0]!;
  await page.goto(url(base, { screen: 's5', state: 'lifecycle', lang: 'zh-Hant' }), { waitUntil: 'load' });
  await expect(page.locator(`[data-testid="s5-row"][data-notice-id="${first.noticeId}"] [data-testid="s5-open"]`)).toHaveText(first.titleZhHant);
  await page.goto(url(base, { screen: 's5', state: 'lifecycle', lang: 'en' }), { waitUntil: 'load' });
  await expect(page.locator(`[data-testid="s5-row"][data-notice-id="${first.noticeId}"] [data-testid="s5-open"]`)).toHaveText(first.titleEn);
});

test('URL is the state: the write screens round-trip in both locales', async ({ strictPage: page }) => {
  const base = await appOrigin();
  for (const [screen, state] of [['s5compose', 'blank'], ['s5compose', 'prefilled'], ['s5act', 'revise'], ['s5act', 'withdraw-recorded']] as const) {
    for (const lang of ['en', 'zh-Hant'] as const) {
      await page.goto(url(base, { screen, state, lang }), { waitUntil: 'load' });
      const q = new URL(page.url()).searchParams;
      expect(q.get('screen'), `${screen} fell back`).toBe(screen);
      expect(q.get('state'), `${screen}/${state} fell back`).toBe(state);
      expect(q.get('lang')).toBe(lang);
    }
  }
});
