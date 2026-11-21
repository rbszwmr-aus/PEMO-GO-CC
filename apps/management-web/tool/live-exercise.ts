/**
 * THE LIVE ACT EXERCISE — a REPORT tool, never a gate (UI-054 D4).
 *
 *     PEMO_LIVE_BASE_URL=http://127.0.0.1:18080 \
 *     PEMO_LIVE_TOKEN_COVERING=… PEMO_LIVE_TOKEN_NONCOVERING=… PEMO_LIVE_TOKEN_DUAL=… \
 *     node --experimental-strip-types tool/live-exercise.ts
 *
 * Drives the app's OWN live clients (the same classes the browser runs) against a
 * local API and the seeded world, for three seeded principals, and prints what
 * came back beside what the frozen fixtures say. No assertion here decides
 * anything: a mismatch is a G-finding for the backend track, reported verbatim.
 * No test imports this file.
 */

import { randomUUID } from 'node:crypto';
import { CORPUS } from '../src/data/corpus.g.ts';
import { LiveManagementClient } from '../src/data/live-client.ts';
import { LiveNoticeActClient, type ActResult } from '../src/data/notice-client.ts';
import type {
  ComposeNoticeRequest, NoticeTransition, NoticeTransitionRequest, Problem,
  StaffNoticeDetailResponse,
} from '../src/data/types.ts';

const base = process.env['PEMO_LIVE_BASE_URL'];
const tokens = {
  covering: process.env['PEMO_LIVE_TOKEN_COVERING'] ?? '',
  noncovering: process.env['PEMO_LIVE_TOKEN_NONCOVERING'] ?? '',
  dual: process.env['PEMO_LIVE_TOKEN_DUAL'] ?? '',
};
if (!base || !tokens.covering || !tokens.noncovering || !tokens.dual) {
  console.error('set PEMO_LIVE_BASE_URL and the three PEMO_LIVE_TOKEN_* variables');
  process.exit(2);
}

type Who = keyof typeof tokens;
const acts = (who: Who) => new LiveNoticeActClient({ baseUrl: base, token: tokens[who] });
const reads = (who: Who) => new LiveManagementClient({ baseUrl: base, token: tokens[who] });

const lines: string[] = [];
const say = (s: string) => { lines.push(s); console.log(s); };

function describe(r: ActResult): string {
  if (r.kind === 'recorded') return `recorded → ${r.data.noticeId} v${r.data.version}`;
  if (r.kind === 'problem') return `problem ${r.problem.status} ${r.problem.type.split('/').pop()} — "${r.problem.staffMessage?.en ?? r.problem.title}"`;
  return 'offline';
}

/** The fixture's recorded refusal for a type, for the side-by-side. */
function fixtureFor(slug: string): Problem | undefined {
  const file = `notices/refusal-${slug}.json`;
  return CORPUS[file] as Problem | undefined;
}

function compare(label: string, r: ActResult, expectSlug: string | null): void {
  // Fixture files are named without the `notice-` prefix their types carry.
  const got = r.kind === 'problem' ? (r.problem.type.split('/').pop() ?? '').replace(/^notice-/, '') : r.kind;
  const want = expectSlug ?? 'recorded';
  const mark = got === want ? 'MATCH   ' : 'MISMATCH';
  const fx = expectSlug ? fixtureFor(expectSlug) : undefined;
  say(`${mark} ${label}`);
  say(`           got:     ${describe(r)}`);
  say(`           fixture: ${fx ? `${fx.status} ${fx.type.split('/').pop()} — "${fx.staffMessage?.en ?? fx.title}"` : want}`);
  if (fx && r.kind === 'problem') {
    if (fx.status !== r.problem.status) say(`           NOTE status differs: fixture ${fx.status}, live ${r.problem.status}`);
    if (fx.retryable !== r.problem.retryable) say(`           NOTE retryable differs: fixture ${fx.retryable}, live ${r.problem.retryable}`);
    if ((fx.staffMessage?.en ?? '') !== (r.problem.staffMessage?.en ?? '')) say(`           NOTE staffMessage.en differs`);
  }
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const bilingual = (type: ComposeNoticeRequest['noticeType'], nodeKind: 'building' | 'estate' | 'floor' | 'unit', nodeId: string, tag: string): ComposeNoticeRequest => ({
  noticeType: type,
  titleEn: `UI-054 live exercise ${tag} ${stamp}`,
  titleZhHant: `UI-054 實地測試 ${tag} ${stamp}`,
  bodyEn: `Exercise body (${tag}). Not a real notice.`,
  bodyZhHant: `測試內文（${tag}）。並非真實通告。`,
  mandatoryAck: false,
  targets: [{ nodeKind, nodeId, locationId: null }],
});

async function detail(who: Who, id: string): Promise<StaffNoticeDetailResponse | null> {
  const r = await reads(who).getNotice(id);
  return r.kind === 'loaded' ? r.data : null;
}

async function transition(who: Who, op: NoticeTransition, id: string, body: NoticeTransitionRequest): Promise<ActResult> {
  return acts(who).transition(op, id, body);
}

async function main(): Promise<void> {
  say(`# UI-054 D4 live exercise — ${new Date().toISOString()} against ${base}`);
  say('');

  // ---- 1. gated type, full path: covering staff composes and submits; the approver approves; covering publishes
  say('## 1. Gated type (planned_interruption at Block A): compose → submit → approve → publish');
  const c1 = await acts('covering').compose(bilingual('planned_interruption', 'building', 'blk_wfg_a', 'gated'), randomUUID());
  compare('covering composes a gated notice at Block A', c1, null);
  if (c1.kind === 'recorded') {
    const id = c1.data.noticeId;
    const d0 = await detail('covering', id);
    say(`           detail after compose: state=${d0?.notice.lifecycleState} permitted=${JSON.stringify(d0?.notice.permittedActions)}`);
    const pubEarly = await transition('covering', 'publishNotice', id, { fromVersion: c1.data.version });
    compare('covering publishes from draft (gated) — expected approval-required', pubEarly, 'approval-required');
    const sub = await transition('covering', 'submitNotice', id, { fromVersion: c1.data.version });
    compare('covering submits', sub, null);
    const v = sub.kind === 'recorded' ? sub.data.version : c1.data.version;
    const d1 = await detail('dual', id);
    say(`           approver's detail: state=${d1?.notice.lifecycleState} permitted=${JSON.stringify(d1?.notice.permittedActions)}`);
    const nonApprove = await transition('covering', 'approveNotice', id, { fromVersion: v, reasonCode: 'approved_as_submitted' });
    compare('covering (estate_staff, not an approver) approves — expected a refusal', nonApprove, 'out-of-scope');
    const app = await transition('dual', 'approveNotice', id, { fromVersion: v, reasonCode: 'approved_as_submitted' });
    compare('dual-role approves', app, null);
    const v2 = app.kind === 'recorded' ? app.data.version : v;
    const stale = await transition('covering', 'publishNotice', id, { fromVersion: c1.data.version });
    compare('covering publishes naming the ORIGINAL version — expected stale-version', stale, 'stale-version');
    const pub = await transition('covering', 'publishNotice', id, { fromVersion: v2 });
    compare('covering publishes from approved', pub, null);
    const v3 = pub.kind === 'recorded' ? pub.data.version : v2;
    const d2 = await detail('covering', id);
    say(`           detail after publish: state=${d2?.notice.lifecycleState} permitted=${JSON.stringify(d2?.notice.permittedActions)}`);
    const retarget = await transition('covering', 'correctNotice', id, { fromVersion: v3, reasonCode: 'factual_error', targets: [{ nodeKind: 'building', nodeId: 'blk_wfg_c', locationId: null }] });
    compare('covering corrects WITH new targets — expected retargeting-forbidden', retarget, 'retargeting-forbidden');
    const revisePublished = await transition('covering', 'reviseNotice', id, { fromVersion: v3, titleEn: 'x' });
    compare('covering revises a LIVE notice — expected wrong-state', revisePublished, 'wrong-state');
    const badReason = await transition('covering', 'withdrawNotice', id, { fromVersion: v3, reasonCode: 'factual_error' });
    say(`INFO     withdraw with a code outside the act's subset: ${describe(badReason)}`);
    const wd = await transition('covering', 'withdrawNotice', id, { fromVersion: v3, reasonCode: 'superseded' });
    compare('covering withdraws', wd, null);
    const ack = await reads('covering').getNoticeOutstanding(id);
    say(`           outstanding after withdraw: ${ack.kind === 'loaded' ? `${ack.data.recipients.length} recipients` : ack.kind}`);
  }
  say('');

  // ---- 2. ungated type: compose → publish
  say('## 2. Ungated type (event_community at Block A): compose → publish');
  const c2 = await acts('covering').compose(bilingual('event_community', 'building', 'blk_wfg_a', 'ungated'), randomUUID());
  compare('covering composes an ungated notice', c2, null);
  if (c2.kind === 'recorded') {
    const id = c2.data.noticeId;
    const d = await detail('covering', id);
    say(`           detail after compose: state=${d?.notice.lifecycleState} permitted=${JSON.stringify(d?.notice.permittedActions)}`);
    const sub = await transition('covering', 'submitNotice', id, { fromVersion: c2.data.version });
    say(`INFO     submit on an ungated type: ${describe(sub)}`);
    const pub = await transition('covering', 'publishNotice', id, { fromVersion: c2.data.version });
    compare('covering publishes an ungated draft directly', pub, null);
  }
  say('');

  // ---- 3. the content refusals on publish
  say('## 3. Content refusals');
  const half = await acts('covering').compose({ ...bilingual('general', 'building', 'blk_wfg_a', 'half'), bodyZhHant: '', titleZhHant: '' }, randomUUID());
  compare('covering composes a half-translated draft (allowed for a draft)', half, null);
  if (half.kind === 'recorded') {
    const pub = await transition('covering', 'publishNotice', half.data.noticeId, { fromVersion: half.data.version });
    compare('publish the half-translated draft — expected incomplete-translation', pub, 'incomplete-translation');
  }
  const inverted = await acts('covering').compose({ ...bilingual('general', 'building', 'blk_wfg_a', 'inverted'), publishAt: '2026-09-10T09:00:00+08:00', expireAt: '2026-09-09T09:00:00+08:00' }, randomUUID());
  compare('compose with expiry before publish — expected schedule-inverted', inverted, 'schedule-inverted');
  const nobody = await acts('covering').compose(bilingual('general', 'unit', 'unit_wfg_a_12_a1', 'nobody'), randomUUID());
  compare('compose at one unit (audience may be empty)', nobody, null);
  if (nobody.kind === 'recorded') {
    const pub = await transition('covering', 'publishNotice', nobody.data.noticeId, { fromVersion: nobody.data.version });
    say(`INFO     publish at a single unit: ${describe(pub)}  (empty-audience if that unit has no occupant)`);
  }
  say('');

  // ---- 4. scope
  say('## 4. Scope: non-covering staff (Block A) addresses Block C');
  const oos = await acts('noncovering').compose(bilingual('general', 'building', 'blk_wfg_c', 'oos'), randomUUID());
  compare('Block A staff composes at Block C — expected out-of-scope', oos, 'out-of-scope');
  const nf = await reads('noncovering').getNotice('ntc_does_not_exist');
  say(`${nf.kind === 'problem' && nf.problem.type.endsWith('notice-not-found') ? 'MATCH   ' : 'MISMATCH'} getNotice on an unknown id — expected notice-not-found`);
  say(`           got:     ${nf.kind === 'problem' ? `${nf.problem.status} ${nf.problem.type.split('/').pop()}` : nf.kind}`);
  const fxnf = fixtureFor('not-found');
  say(`           fixture: ${fxnf?.status} ${fxnf?.type.split('/').pop()}`);
  say('');

  // ---- 5. what each principal SEES on the list
  say('## 5. permittedActions as each principal sees the list');
  for (const who of ['covering', 'noncovering', 'dual'] as Who[]) {
    const l = await reads(who).listNotices();
    if (l.kind !== 'loaded') { say(`${who}: ${l.kind}`); continue; }
    const visible = l.data.notices;
    const mine = visible.filter((n) => n.titleEn.startsWith('UI-054 live exercise'));
    say(`${who}: ${visible.length} notices visible, ${mine.length} from this run`);
    for (const n of mine) say(`           ${n.noticeType} ${n.lifecycleState} permitted=${JSON.stringify(n.permittedActions)}`);
  }
  console.log('\n---- end');
}

main().catch((e) => { console.error(e); process.exit(1); });
