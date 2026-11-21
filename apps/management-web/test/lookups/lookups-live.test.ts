/**
 * The lookups adapter over fetch, against the shapes in lookup-lists-v0-PROPOSED_v0.1.md, and the auto rule
 * that picks live or the fixture.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { VISITOR_PURPOSE } from '../../src/lookups/lookup-lists.ts';
import { LookupError, createAutoLookupsClient, createLiveLookupsClient } from '../../src/lookups/lookups-client.ts';
import { memoryStorage } from '../../src/lookups/lookup-storage.ts';

const wire = (code: string, en: string, hant: string, hans: string, sort: number, extra: Record<string, unknown> = {}) => ({
  id: `lki_${code}`, list_key: VISITOR_PURPOSE, code, label_en: en, label_zh_hant: hant, label_zh_hans: hans,
  labels: { en, 'zh-Hant': hant, 'zh-Hans': hans }, sort_order: sort, active: true, scope: 'global', estate_id: null, is_system: false, ...extra,
});
const LIST = [
  wire('delivery', 'Delivery', '送貨', '送货', 10),
  wire('caregiver', 'Caregiver', '照顧者', '照顾者', 40, { active: false }),
  wire('other', 'Other', '其他', '其他', 900, { is_system: true }),
];

interface Call { method: string; url: string; headers: Record<string, string>; body: unknown }
function server(handler: (c: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const c: Call = { method: init?.method ?? 'GET', url, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(c);
    const r = handler(c);
    return { status: r.status, json: async () => r.body } as Response;
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const ok = (items: unknown[] = LIST) => ({ status: 200, body: { meta: { demo: true }, list_key: VISITOR_PURPOSE, items } });

test('live: GET /lookups/visitor_purpose?include_inactive=true with Bearer, items mapped from the wire shape', async () => {
  const s = server(() => ok());
  const c = createLiveLookupsClient({ token: 'demo', fetchImpl: s.fetchImpl });
  assert.equal(await c.ready, 'live');
  assert.equal(s.calls[0]!.url, '/api/management-web/v0/lookups/visitor_purpose?include_inactive=true');
  assert.equal(s.calls[0]!.headers['Authorization'], 'Bearer demo');
  const items = c.items(VISITOR_PURPOSE);
  assert.deepEqual(items.map((i) => [i.code, i.active, i.isSystem, i.sortOrder]), [['delivery', true, false, 10], ['caregiver', false, false, 40], ['other', true, true, 900]]);
  assert.deepEqual(items[1]!.labels, { en: 'Caregiver', 'zh-Hant': '照顧者', 'zh-Hans': '照顾者' });
});

test('live writes use the documented paths and bodies: POST create, PATCH rename and active, POST reorder, DELETE', async () => {
  const s = server((c) => {
    if (c.method === 'GET') return ok();
    if (c.method === 'DELETE') return { status: 200, body: { deleted: true, code: 'delivery' } };
    if (c.url.endsWith('/reorder')) return { status: 200, body: { items: LIST } };
    return { status: c.method === 'POST' ? 201 : 200, body: { item: wire('inspection', 'Inspection', '巡查', '巡查', 60) } };
  });
  const c = createLiveLookupsClient({ token: 'demo', fetchImpl: s.fetchImpl });
  await c.ready;
  s.calls.length = 0;
  await c.create(VISITOR_PURPOSE, { en: 'Inspection', 'zh-Hant': '巡查', 'zh-Hans': '巡查' });
  const post = s.calls[0]!;
  assert.deepEqual([post.method, post.url], ['POST', '/api/management-web/v0/admin/lookups/visitor_purpose']);
  assert.deepEqual(post.body, { code: 'inspection', label_en: 'Inspection', label_zh_hant: '巡查', label_zh_hans: '巡查' });
  assert.ok(post.headers['Idempotency-Key'], 'create carries an Idempotency-Key');
  s.calls.length = 0;
  await c.update(VISITOR_PURPOSE, 'caregiver', { active: true });
  assert.deepEqual([s.calls[0]!.method, s.calls[0]!.url, s.calls[0]!.body], ['PATCH', '/api/management-web/v0/admin/lookups/visitor_purpose/caregiver', { active: true }]);
  await c.update(VISITOR_PURPOSE, 'delivery', { labels: { en: 'Courier', 'zh-Hant': '速遞', 'zh-Hans': '快递' } });
  assert.deepEqual(s.calls.find((x) => x.method === 'PATCH' && (x.body as Record<string, unknown>)['label_en'])!.body, { label_en: 'Courier', label_zh_hant: '速遞', label_zh_hans: '快递' });
  s.calls.length = 0;
  await c.move(VISITOR_PURPOSE, 'caregiver', -1);
  assert.deepEqual([s.calls[0]!.method, s.calls[0]!.url, s.calls[0]!.body], ['POST', '/api/management-web/v0/admin/lookups/visitor_purpose/reorder', { codes: ['caregiver', 'delivery'] }]);
  s.calls.length = 0;
  await c.remove(VISITOR_PURPOSE, 'delivery');
  assert.deepEqual([s.calls[0]!.method, s.calls[0]!.url], ['DELETE', '/api/management-web/v0/admin/lookups/visitor_purpose/delivery']);
});

test('live: a 409 lookup-code-in-use becomes a LookupError carrying in_use_count, and a duplicate label is lookup-label-exists', async () => {
  const s = server((c) => {
    if (c.method === 'GET') return ok();
    if (c.method === 'DELETE') return { status: 409, body: { type: 'https://pemo.example/problems/lookups/lookup-code-in-use', detail: 'in use', in_use_count: 4, recommendation: 'deactivate' } };
    return { status: 409, body: { type: 'https://pemo.example/problems/lookups/lookup-label-exists', detail: 'label exists', conflicting_code: 'delivery' } };
  });
  const c = createLiveLookupsClient({ token: 'demo', fetchImpl: s.fetchImpl });
  await c.ready;
  await assert.rejects(() => c.remove(VISITOR_PURPOSE, 'delivery'), (e) => e instanceof LookupError && e.status === 409 && e.kind === 'lookup-code-in-use' && e.inUseCount === 4);
  await assert.rejects(() => c.create(VISITOR_PURPOSE, { en: 'Courier', 'zh-Hant': '速遞', 'zh-Hans': '快递' }), (e) => e instanceof LookupError && e.kind === 'lookup-label-exists');
});

test('auto: live when GET /lookups/visitor_purpose answers 200 with items, the fixture when it 404s, is refused, or times out', async () => {
  const live = createAutoLookupsClient({ fetchImpl: server(() => ok()).fetchImpl, enabled: true, storage: memoryStorage() });
  assert.equal(await live.ready, 'live');
  assert.equal(live.kind, 'live');
  assert.equal(live.items(VISITOR_PURPOSE).length, 3);

  const missing = createAutoLookupsClient({ fetchImpl: server(() => ({ status: 404, body: { type: 'x' } })).fetchImpl, enabled: true, storage: memoryStorage() });
  assert.equal(await missing.ready, 'fixture');
  assert.equal(missing.items(VISITOR_PURPOSE).length, 6, 'the seed');

  const refused = createAutoLookupsClient({ fetchImpl: (async () => { throw new TypeError('refused'); }) as typeof fetch, enabled: true, storage: memoryStorage() });
  assert.equal(await refused.ready, 'fixture');

  const slow = createAutoLookupsClient({ fetchImpl: (() => new Promise(() => undefined)) as typeof fetch, enabled: true, timeoutMs: 20, storage: memoryStorage() });
  assert.equal(await slow.ready, 'fixture');

  const off = createAutoLookupsClient({ fetchImpl: server(() => ok()).fetchImpl, enabled: false, storage: memoryStorage() });
  assert.equal(await off.ready, 'fixture', 'VITE_PEMO_AUTO_LIVE=0 keeps the fixture');
});
