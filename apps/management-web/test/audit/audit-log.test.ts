/**
 * Audit log (S04): the contract’s rules, as code. Shapes and rules are from
 * docs/contracts/audit-log-v0-PROPOSED_v0.1.md; the fixture is held to the same shape the route returns.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AUDIT_FIXTURE } from '../../src/audit/audit-fixture.ts';
import {
  AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_SOURCES, CSV_COLUMNS, CSV_ROW_CAP,
  csvCell, csvFilename, matches, nextDay, newestFirst, pageOf, toCsv, toSearchParams,
  type AuditEvent,
} from '../../src/audit/audit-log.ts';
import { createAuditSource, createFixtureAuditClient, createLiveAuditClient } from '../../src/audit/audit-client.ts';
import { ApiError } from '../../src/data/sourced.ts';
import { resetAuditSession } from '../../src/data/audit-session.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

const EVENT_FIELDS = ['eventId', 'occurredAt', 'recordedAt', 'source', 'actor', 'authority', 'action', 'entity', 'place', 'reasonCode', 'requestId', 'clientIp', 'userAgent'];

const ev = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  eventId: 'aud_1', occurredAt: '2026-09-20T10:00:00.000+08:00', recordedAt: '2026-09-20T10:00:00.010+08:00', source: 'principal',
  actor: { principalId: 'stf_a', displayName: 'A' }, authority: { groupId: 'grp_a', role: 'estate_staff' },
  action: 'publish_notice', entity: { type: 'notice', id: 'ntc_1' }, place: { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
  reasonCode: null, requestId: 'req-1', clientIp: null, userAgent: null, ...over,
});

test('the fixture is a contract response: every field, an actor exactly when a person acted, newest first', () => {
  const { meta, events, page } = AUDIT_FIXTURE;
  assert.ok(meta.correlationId && meta.contractVersion && meta.generatedAt);
  assert.deepEqual(Object.keys(page).sort(), ['hasMore', 'limit', 'nextCursor']);
  assert.ok(events.length >= 20, 'enough rows to page and filter');
  for (const e of events) {
    assert.deepEqual(Object.keys(e).sort(), [...EVENT_FIELDS].sort(), `${e.eventId} fields`);
    assert.ok((AUDIT_SOURCES as readonly string[]).includes(e.source));
    assert.equal(e.actor === null, e.source !== 'principal', `${e.eventId}: actor iff a person acted`);
    assert.equal(e.authority === null, e.source !== 'principal', `${e.eventId}: authority iff a person acted`);
    assert.ok(Date.parse(e.recordedAt) >= Date.parse(e.occurredAt), `${e.eventId}: recorded is not before occurred`);
    assert.match(e.occurredAt, /\+08:00$/);
    assert.ok((AUDIT_ACTIONS as readonly string[]).includes(e.action), `${e.eventId}: ${e.action} is in the vocabulary`);
    assert.ok((AUDIT_ENTITY_TYPES as readonly string[]).includes(e.entity.type), `${e.eventId}: entity type ${e.entity.type}`);
  }
  assert.deepEqual([...events].sort(newestFirst).map((e) => e.eventId), events.map((e) => e.eventId), 'newest first');
});

test('the fixture shows the vocabulary’s range: a refusal reason, a system actor, and several kinds of place', () => {
  const { events } = AUDIT_FIXTURE;
  assert.ok(events.some((e) => e.reasonCode !== null));
  assert.ok(events.some((e) => e.source === 'provisioning' && e.actor === null));
  assert.ok(new Set(events.map((e) => e.place.nodeKind)).size >= 3);
  assert.ok(new Set(events.map((e) => e.action)).size >= 15);
});

test('every action and entity type in the vocabulary has a sentence in all three languages', () => {
  for (const a of AUDIT_ACTIONS) {
    const m = MESSAGES.audit.action[a];
    assert.ok(m.en && m['zh-Hant'] && m['zh-Hans'], a);
  }
  for (const x of AUDIT_ENTITY_TYPES) {
    const m = MESSAGES.audit.entityType[x];
    assert.ok(m.en && m['zh-Hant'] && m['zh-Hans'], x);
  }
});

test('the query string uses the contract’s names, dates as days, and a `to` that is the day after the last day shown', () => {
  const p = toSearchParams({ actor: 'stf_a', action: 'publish_notice', entityType: 'notice', nodeKind: 'building', nodeId: 'blk_wfg_a', fromDay: '2026-09-01', toDay: '2026-09-30', limit: 25, cursor: 'abc' });
  assert.equal(p.get('actor'), 'stf_a');
  assert.equal(p.get('action'), 'publish_notice');
  assert.equal(p.get('entity_type'), 'notice');
  assert.equal(p.get('node_kind'), 'building');
  assert.equal(p.get('node_id'), 'blk_wfg_a');
  assert.equal(p.get('from'), '2026-09-01');
  assert.equal(p.get('to'), '2026-10-01');
  assert.equal(p.get('limit'), '25');
  assert.equal(p.get('cursor'), 'abc');
  assert.equal(toSearchParams({}).get('limit'), '50', 'default page of 50');
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
  assert.equal(nextDay('2026-02-28'), '2026-03-01');
  const csv = toSearchParams({ actor: 'stf_a', limit: 5, cursor: 'x' }, 'csv');
  assert.equal(csv.get('format'), 'csv');
  assert.equal(csv.get('limit'), null, 'limit and paging do not apply to the export');
  assert.equal(csv.get('cursor'), null);
  assert.equal(toSearchParams({ nodeKind: 'estate' }).has('node_kind'), false, 'a place is a kind and an id together');
});

test('filters combine with AND; `from` is inclusive and `to` is exclusive, on Hong Kong days', () => {
  const e = ev({ occurredAt: '2026-09-20T00:00:00.000+08:00' });
  assert.equal(matches(e, { fromDay: '2026-09-20' }), true, 'from is inclusive: the first instant of the day');
  assert.equal(matches(e, { toDay: '2026-09-19' }), false, 'a day before the last day shown is out');
  assert.equal(matches(ev({ occurredAt: '2026-09-19T23:59:59.999+08:00' }), { fromDay: '2026-09-20' }), false);
  assert.equal(matches(ev({ occurredAt: '2026-09-20T23:59:59.999+08:00' }), { toDay: '2026-09-20' }), true, 'the last day shown is whole');
  assert.equal(matches(ev({ occurredAt: '2026-09-21T00:00:00.000+08:00' }), { toDay: '2026-09-20' }), false, 'the day after is the exclusive bound');
  assert.equal(matches(ev(), { actor: 'stf_a', action: 'publish_notice', entityType: 'notice' }), true);
  assert.equal(matches(ev(), { actor: 'stf_a', action: 'revise_notice' }), false);
  assert.equal(matches(ev(), { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' }), true);
  assert.equal(matches(ev(), { nodeKind: 'estate', nodeId: 'est_other' }), false);
  assert.equal(matches(ev({ actor: null, source: 'provisioning', authority: null }), { actor: 'stf_a' }), false);
});

test('keyset paging walks the whole list once, never repeating a row, and a bad cursor starts over', () => {
  const sorted = Array.from({ length: 23 }, (_, i) => ev({ eventId: `aud_${String(100 - i).padStart(3, '0')}`, occurredAt: `2026-09-20T10:${String(59 - i).padStart(2, '0')}:00.000+08:00` }));
  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  for (;;) {
    const p = pageOf(sorted, 10, cursor);
    seen.push(...p.events.map((e) => e.eventId));
    pages += 1;
    assert.equal(p.hasMore, p.nextCursor !== null);
    if (!p.hasMore) break;
    cursor = p.nextCursor!;
  }
  assert.equal(pages, 3);
  assert.deepEqual(seen, sorted.map((e) => e.eventId));
  assert.equal(pageOf(sorted, 10, '%%%not-a-cursor').events[0]?.eventId, sorted[0]?.eventId);
});

test('CSV: BOM, the 17 columns in order, CRLF records, empty for null, RFC 4180 quoting', () => {
  assert.equal(CSV_COLUMNS.length, 17);
  assert.deepEqual([...CSV_COLUMNS], ['occurred_at', 'recorded_at', 'actor_id', 'actor_name', 'action', 'entity_type', 'entity_id', 'place_kind', 'place_id', 'source', 'role', 'group_id', 'reason_code', 'request_id', 'client_ip', 'user_agent', 'event_id']);
  const { text, truncated } = toCsv([ev({ actor: { principalId: 'stf_a', displayName: 'Chan, "Mei" ling' } }), ev({ eventId: 'aud_2', actor: null, source: 'provisioning', authority: null })]);
  assert.equal(text.charCodeAt(0), 0xfeff, 'a byte-order mark so Excel opens it as UTF-8');
  assert.equal(truncated, false);
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines.length, 4, 'header, two records, and the final CRLF');
  assert.equal(lines[3], '');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.ok(lines[1]!.includes('"Chan, ""Mei"" ling"'), 'comma and quotes: quoted, quotes doubled');
  assert.ok(lines[2]!.startsWith('2026-09-20T10:00:00.000+08:00,2026-09-20T10:00:00.010+08:00,,,'), 'no actor: empty cells');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
});

test('CSV: a cell that a spreadsheet would read as a formula gets a leading apostrophe', () => {
  for (const bad of ['=1+1', '+SUM(A1)', '-2', '@x', '\tx', '\rx']) {
    assert.ok(csvCell(bad).replace(/^"/, '').startsWith("'"), JSON.stringify(bad));
  }
  assert.equal(csvCell('safe'), 'safe');
  assert.equal(csvCell(null), '');
  const { text } = toCsv([ev({ userAgent: '=HYPERLINK("http://x")' })]);
  assert.ok(text.includes(`"'=HYPERLINK(""http://x"")"`));
});

test('CSV: capped at 10,000 rows and says so', () => {
  const many = Array.from({ length: CSV_ROW_CAP + 5 }, (_, i) => ev({ eventId: `aud_${i}` }));
  const { text, truncated } = toCsv(many);
  assert.equal(truncated, true);
  assert.equal(text.slice(1).split('\r\n').length, CSV_ROW_CAP + 2);
  assert.equal(csvFilename(new Date('2026-09-20T17:00:00Z')), 'audit-log-20260921.csv', 'the Hong Kong date, not UTC');
});

test('the fixture client filters and pages like the route, and its export is the same filter', async () => {
  resetAuditSession();
  const c = createFixtureAuditClient();
  const all = await c.list({ limit: 200 });
  assert.equal(all.events.length, AUDIT_FIXTURE.events.length);
  assert.equal(all.page.hasMore, false);
  const first = await c.list({ limit: 10 });
  assert.equal(first.events.length, 10);
  assert.equal(first.page.hasMore, true);
  const second = await c.list({ limit: 10, cursor: first.page.nextCursor! });
  assert.notEqual(second.events[0]?.eventId, first.events[0]?.eventId);
  const mine = await c.list({ actor: 'stf_wfg_manager', limit: 200 });
  assert.ok(mine.events.length > 0 && mine.events.every((e) => e.actor?.principalId === 'stf_wfg_manager'));
  const file = await c.exportCsv({ actor: 'stf_wfg_manager' });
  assert.equal(file.text.slice(1).split('\r\n').length, mine.events.length + 2);
  assert.match(file.filename, /^audit-log-\d{8}\.csv$/);
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers } });

test('live: GET /admin/audit-log with Bearer and the contract’s query, the response passed through', async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get('Authorization') });
    return json(200, AUDIT_FIXTURE);
  }) as unknown as typeof fetch;
  const c = createLiveAuditClient({ base: 'http://api.test', token: 't0k', fetchImpl });
  const r = await c.list({ actor: 'stf_a', fromDay: '2026-09-01', toDay: '2026-09-02' });
  assert.equal(r.events.length, AUDIT_FIXTURE.events.length);
  assert.equal(seen[0]?.auth, 'Bearer t0k');
  const u = new URL(seen[0]!.url);
  assert.equal(u.origin + u.pathname, 'http://api.test/api/management-web/v0/admin/audit-log');
  assert.equal(u.searchParams.get('actor'), 'stf_a');
  assert.equal(u.searchParams.get('to'), '2026-09-03');
  assert.equal(u.searchParams.get('limit'), '50');
});

test('live: a 403 insufficient-scope is the API refusing, carried as a problem the screen can show', async () => {
  const problem = { type: 'https://pemo.local/problems/insufficient-scope', title: 'Not permitted', status: 403, correlationId: 'c-1', staffMessage: { en: 'No access', 'zh-Hant': '沒有權限' }, retryable: false };
  const c = createLiveAuditClient({ fetchImpl: (async () => json(403, problem)) as unknown as typeof fetch });
  await assert.rejects(c.list({}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 403);
    assert.equal(e.problem.type, problem.type);
    assert.equal(e.problem.correlationId, 'c-1');
    assert.deepEqual(e.problem.staffMessage, problem.staffMessage);
    return true;
  });
  const offline = createLiveAuditClient({ fetchImpl: (async () => { throw new TypeError('network'); }) as unknown as typeof fetch });
  await assert.rejects(offline.list({}), (e: unknown) => e instanceof ApiError && e.status === 0 && e.problem.type.endsWith('/internal-error'));
});

test('live: the export is ?format=csv, takes its name from Content-Disposition and reports truncation from the header', async () => {
  let url = '';
  const fetchImpl = (async (u: string) => {
    url = u;
    return new Response('\uFEFFoccurred_at\r\n', { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="audit-log-20260920.csv"', 'X-Audit-Export-Truncated': 'true' } });
  }) as unknown as typeof fetch;
  const file = await createLiveAuditClient({ fetchImpl, token: 'x' }).exportCsv({ action: 'publish_notice', limit: 5 });
  assert.equal(new URL(url, 'http://x').searchParams.get('format'), 'csv');
  assert.equal(new URL(url, 'http://x').searchParams.get('limit'), null);
  assert.equal(file.filename, 'audit-log-20260920.csv');
  assert.equal(file.truncated, true);
  assert.equal(file.text.charCodeAt(0), 0xfeff);
});

test('auto: live when the route answers 200, 401 or 403; the fixture when it 404s, fails or is switched off', async () => {
  const refusal = { type: 'https://pemo.local/problems/insufficient-scope', title: 'Not permitted', status: 403, correlationId: 'c' };
  const make = (answer: () => Response | Promise<Response>, opts: { enabled?: boolean; mode?: 'auto' | 'fixture' } = {}) => {
    const calls: string[] = [];
    const src = createAuditSource({ mode: opts.mode ?? 'auto', enabled: opts.enabled ?? true, fetchImpl: (async (u: string) => { calls.push(u); return answer(); }) as unknown as typeof fetch });
    return { src, calls };
  };
  const live = make(() => json(200, AUDIT_FIXTURE));
  assert.equal((await live.src.read({})).source, 'live');
  assert.ok(live.calls.every((u) => u.includes('/api/management-web/v0/admin/audit-log')));

  const refused = make(() => json(403, refusal));
  await assert.rejects(refused.src.read({}), (e: unknown) => e instanceof ApiError && e.status === 403, 'a 403 means the route is there: the screen shows the refusal, not sample data');

  resetAuditSession();
  for (const answer of [() => json(404, { title: 'nope' }), () => { throw new TypeError('network'); }, () => json(500, {})] as const) {
    const f = make(answer);
    const r = await f.src.read({});
    assert.equal(r.source, 'fixture');
    assert.equal(r.response.events.length, AUDIT_FIXTURE.events.length);
  }
  const off = make(() => json(200, AUDIT_FIXTURE), { enabled: false });
  assert.equal((await off.src.read({})).source, 'fixture');
  assert.equal(off.calls.length, 0, 'switched off: nothing is asked');
  const pinned = make(() => json(200, AUDIT_FIXTURE), { mode: 'fixture' });
  assert.equal((await pinned.src.read({})).source, 'fixture');
  assert.equal(pinned.calls.length, 0, '?source=fixture asks nothing');
});
