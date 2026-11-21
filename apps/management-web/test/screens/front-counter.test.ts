/**
 * Front counter: the fixture client mirrors the Backend contract (0.1.1-proposed) -
 * fine and coarse verify statuses, dry-run verify, redeem with a required key and a
 * replay, 409/422-style rejections, walk-in and check-out with outcome, and the
 * LIVE client's mapping of the real HTTP answers. Plus the host-flat choices, the
 * host label rule and the camera-scan gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FrontCounterError,
  codeBody,
  createAutoClient,
  createFixtureClient,
  createLiveClient,
  selectFrontCounterClient,
  hkIso,
  maskIdStub,
  newIdempotencyKey,
  PASS_STATES,
  statusGroup,
} from '../../src/data/front-counter-client.ts';
import { searchUnits, unitChoices } from '../../src/data/unit-choices.ts';
import { hostDisplay, setLocationTree } from '../../src/data/host-label.ts';
import { scanSupported } from '../../src/data/qr-scan.ts';
import { hktStamp } from '../../src/format/datetime.ts';
import { CORPUS } from '../../src/data/corpus.g.ts';
import { buildRailNodes } from '../../src/shell/scope-focus.ts';
import type { PropertyTreeResponse } from '../../src/data/types.ts';

// Labels read the location tree the app states; the app's own is the corpus tree in fixture mode.
setLocationTree(CORPUS['mob-s3-properties/tree.json'] as unknown as PropertyTreeResponse);

const NOW = new Date('2026-09-23T06:00:00Z'); // 14:00 HKT
const fresh = () => createFixtureClient(() => NOW);
const VALID = 'QP1:DEMO-VALID';
const A1 = { unit_id: 'unit_wfg_a_12_a1', unit_label: 'A · 12/F A1' };

test('the vocabulary matches the Backend: statuses (purposes are lookup codes, not an enum)', () => {
  assert.deepEqual([...PASS_STATES], ['valid', 'expired', 'used_up', 'revoked', 'unknown']);
  for (const s of ['not_yet_valid', 'invalid_signature', 'unknown_key', 'not_found'] as const) {
    assert.equal(statusGroup(s), 'unknown', s);
  }
});

test('a code is sent as pass_id for qp_ and as payload otherwise', () => {
  assert.deepEqual(codeBody(' qp_demo_valid '), { pass_id: 'qp_demo_valid' });
  assert.deepEqual(codeBody('QP1:ABC'), { payload: 'QP1:ABC' });
});

test('verify answers every status, carries the contract fields, and never consumes a use', async () => {
  const c = fresh();
  const want: Record<string, [string, string]> = {
    'QP1:DEMO-VALID': ['valid', 'valid'], 'QP1:DEMO-EXPIRED': ['expired', 'expired'],
    'QP1:DEMO-USED': ['used_up', 'used_up'], 'QP1:DEMO-REVOKED': ['revoked', 'revoked'],
    'QP1:DEMO-LATER': ['not_yet_valid', 'unknown'], 'qp_nope': ['not_found', 'unknown'], 'QP1:FORGED': ['invalid_signature', 'unknown'],
  };
  for (const [code, [status, group]] of Object.entries(want)) {
    const card = await c.verify(code);
    assert.equal(card.status, status, code);
    assert.equal(card.status_group, group, code);
  }
  const before = await c.verify(VALID);
  await c.verify(VALID); await c.verify('qp_demo_valid');
  const after = await c.verify(VALID);
  assert.equal(after.uses_seen, before.uses_seen, 'verify is a dry run');
  assert.equal(after.uses_remaining, 2);
  assert.deepEqual(after.window && Object.keys(after.window), ['not_before', 'expires_at']);
  assert.match(after.window!.expires_at, /Z$/, 'pass window is UTC Z');
  assert.equal(after.visitor?.name, 'Chan Tai-man 陳大文');
  assert.equal(after.host?.unit_id, 'unit_wfg_a_12_a1');
  const bad = await c.verify('qp_nope');
  assert.equal(bad.visitor, null);
  assert.equal(bad.window, null);
  assert.equal(bad.uses_seen, null);
  assert.equal((await c.listToday()).filter((v) => v.status === 'on_site').length, 1, 'verify moved no one in (one seeded on-site visitor)');
});

test('redeem needs a key; one use per key; the same key replays; a new key takes the next use; then used up', async () => {
  const c = fresh();
  await assert.rejects(() => c.redeem(VALID, '  '), (e: unknown) => e instanceof FrontCounterError && e.status === 400);
  const a = await c.redeem(VALID, 'key-1');
  assert.ok(a.outcome === 'checked_in');
  assert.equal(a.replayed, false);
  assert.equal(a.uses_seen, 1);
  assert.equal(a.uses_remaining, 1);
  assert.equal(a.visit.status, 'on_site');
  assert.ok(a.visit.checked_in_at?.endsWith('+08:00'), 'visit times are +08:00');

  const replay = await c.redeem(VALID, 'key-1');
  assert.ok(replay.outcome === 'checked_in' && replay.replayed === true);
  assert.equal(replay.uses_seen, 1, 'a replay consumes nothing');
  assert.equal((await c.verify(VALID)).uses_seen, 1);

  const conflict = await c.redeem('QP1:DEMO-USED', 'key-1');
  assert.deepEqual(conflict, { outcome: 'rejected', reason: 'key-conflict' }, 'same key, different body');

  const b = await c.redeem(VALID, 'key-2');
  assert.ok(b.outcome === 'checked_in' && b.uses_remaining === 0);
  assert.equal((await c.verify(VALID)).status, 'used_up');
  const third = await c.redeem(VALID, 'key-3');
  assert.deepEqual(third, { outcome: 'rejected', reason: 'pass', status: 'used_up', status_group: 'used_up' });
});

test('a pass that is not valid is rejected with its own status; a visit that is closed is refused', async () => {
  const c = fresh();
  for (const [code, status] of [['QP1:DEMO-EXPIRED', 'expired'], ['QP1:DEMO-USED', 'used_up'], ['QP1:DEMO-REVOKED', 'revoked'], ['QP1:DEMO-LATER', 'not_yet_valid'], ['qp_nope', 'not_found']] as const) {
    const r = await c.redeem(code, `k-${code}`);
    assert.ok(r.outcome === 'rejected' && r.reason === 'pass' && r.status === status, code);
  }
  const ok = await c.redeem(VALID, 'k-in');
  assert.ok(ok.outcome === 'checked_in');
  await c.checkOut(ok.outcome === 'checked_in' ? ok.visit.visit_id : '');
  assert.deepEqual(await c.redeem(VALID, 'k-after'), { outcome: 'rejected', reason: 'visit-already-checked-out' });
});

test('walk-in: on site, source walk_in, masked id stub, no pass; check-out sets outcome visited, a no-show closes as no_show', async () => {
  const c = fresh();
  let heard = 0;
  const off = c.subscribe(() => { heard += 1; });
  const v = await c.createWalkIn({ name: '  SF Express courier ', purpose: 'delivery', host_unit_id: 'unit_wfg_a_12_a1', phone: '9123 4567', id_stub: 'A123456(7)' });
  assert.equal(v.name, 'SF Express courier');
  assert.equal(v.status, 'on_site');
  assert.equal(v.source, 'walk_in');
  assert.equal(v.pass_id, null);
  assert.equal(v.id_stub, '****4567');
  assert.deepEqual(v.host, A1);
  assert.equal(v.outcome, null);
  assert.ok(v.expected_to > v.expected_from);
  const out = await c.checkOut(v.visit_id);
  assert.equal(out?.status, 'checked_out');
  assert.equal(out?.outcome, 'visited');
  assert.ok(out?.checked_out_at?.endsWith('+08:00'));
  const noShow = await c.checkOut('vis_fx_1'); // seeded, never arrived
  assert.equal(noShow?.status, 'checked_out');
  assert.equal(noShow?.outcome, 'no_show');
  assert.equal(noShow?.outcome_label, 'no-show / closed');
  assert.equal(await c.checkOut('nope'), null);
  assert.equal(heard, 3);
  off();
  await assert.rejects(() => c.createWalkIn({ name: ' ', purpose: 'visit', host_unit_id: 'x' }), /required/);
});

test('an unknown unit is accepted and its label is the raw id; the screen never shows that id', async () => {
  const c = fresh();
  const v = await c.createWalkIn({ name: 'Tam', purpose: 'visit', host_unit_id: 'unit_wfg_b_18_b4' });
  assert.equal(v.host.unit_label, 'unit_wfg_b_18_b4');
  assert.equal(hostDisplay(v.host, 'en'), 'Block B · 18/F · Flat B4', 'the tree knows it');
  assert.equal(hostDisplay({ unit_id: 'unt_demo_a_12f_a1', unit_label: 'A · 12/F A1' }, 'en'), 'Block A · 12/F · Flat A1', 'the portal demo unit is the same flat as the tree unit');
  assert.equal(hostDisplay({ unit_id: 'unt_other', unit_label: 'Podium shop 3' }, 'en'), 'Podium shop 3', 'not in the tree: the Backend label is a label');
  assert.equal(hostDisplay({ unit_id: 'unt_zzz', unit_label: 'unt_zzz' }, 'en'), null, 'only an id: show nothing');
  assert.equal(hostDisplay(null, 'en'), null);
  assert.equal(hostDisplay(A1, 'zh-Hant'), 'A座 · 12樓 · A1室');
});

test('idempotency keys are non-empty and distinct; the id stub is masked like the Backend does', () => {
  assert.notEqual(newIdempotencyKey(), newIdempotencyKey());
  assert.ok(newIdempotencyKey().length >= 8);
  assert.equal(maskIdStub('A123456(7)'), '****4567');
  assert.equal(maskIdStub('****1234'), '****1234');
  assert.equal(maskIdStub('1234'), '1234');
  assert.equal(maskIdStub('  '), null);
  assert.equal(hkIso(NOW), '2026-09-23T14:00:00+08:00');
});

/* ------------------------------------------------------- the live client */

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function fakeFetch(answer: (c: Call) => { status: number; body: unknown }): { f: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const call: Call = { url, method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    const a = answer(call);
    return { status: a.status, ok: a.status < 400, json: async () => a.body } as Response;
  }) as unknown as typeof fetch;
  return { f, calls };
}
const problem = (status: number, suffix: string, extra: Record<string, unknown> = {}) => ({
  status, body: { type: `https://pemo.example/problems/front-counter/${suffix}`, title: suffix, status, ...extra },
});

test('live: routes, Bearer, Idempotency-Key and snake_case bodies are the contract\'s', async () => {
  const { f, calls } = fakeFetch((c) => {
    if (c.url.endsWith('/visits') && c.method === 'POST') return { status: 201, body: { visit: { visit_id: 'vis_1', status: 'on_site' } } };
    if (c.url.endsWith('/passes/verify')) return { status: 200, body: { status: 'valid', status_group: 'valid' } };
    if (c.url.endsWith('/passes/redeem')) return { status: 200, body: { status: 'valid', replayed: true, visit: { visit_id: 'vis_2', status: 'on_site', source: 'pre_registered', checked_in_at: null, host: A1 }, uses_seen: 1, use_limit: 2, uses_remaining: 1 } };
    if (c.url.endsWith('/check-out')) return { status: 200, body: { replayed: false, visit: { visit_id: 'vis_1', status: 'checked_out' } } };
    return { status: 200, body: { visits: [{ visit_id: 'vis_1' }] } };
  });
  const live = createLiveClient({ base: 'http://x:3200/', token: 'demo', fetchImpl: f });
  await live.createWalkIn({ name: ' Lee ', purpose: 'delivery', host_unit_id: 'unit_wfg_a_12_a1', phone: '9' });
  await live.verify('QP1:ABC');
  await live.verify('qp_9');
  const r = await live.redeem('QP1:ABC', 'k1');
  await live.checkOut('vis 1');
  assert.equal((await live.listToday()).length, 1);
  const base = 'http://x:3200/api/management-web/v0/front-counter';
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url.replace(base, '')}`), [
    'POST /visits', 'POST /passes/verify', 'POST /passes/verify', 'POST /passes/redeem', 'POST /visits/vis%201/check-out', 'GET /visits',
  ]);
  assert.ok(calls.every((c) => c.headers['Authorization'] === 'Bearer demo'));
  assert.deepEqual(calls[0]!.body, { name: 'Lee', purpose: 'delivery', host_unit_id: 'unit_wfg_a_12_a1', phone: '9' });
  assert.deepEqual(calls[1]!.body, { payload: 'QP1:ABC' });
  assert.deepEqual(calls[2]!.body, { pass_id: 'qp_9' });
  assert.equal(calls[3]!.headers['Idempotency-Key'], 'k1');
  assert.ok(r.outcome === 'checked_in' && r.replayed === true && r.uses_remaining === 1);
  assert.equal(calls[1]!.headers['Idempotency-Key'], undefined, 'verify sends no key');
});

test('live: every redeem answer maps to a UI outcome (409 used_up, 422 expired/revoked, 404, visit-level 409s, key conflict)', async () => {
  const answers: Record<string, { status: number; body: unknown }> = {
    used: problem(409, 'pass-used-up', { pass_status: 'used_up', status_group: 'used_up' }),
    expired: problem(422, 'pass-expired', { pass_status: 'expired', status_group: 'expired' }),
    revoked: problem(422, 'pass-revoked', { pass_status: 'revoked', status_group: 'revoked' }),
    later: problem(422, 'pass-not-yet-valid', { pass_status: 'not_yet_valid', status_group: 'unknown' }),
    gone: problem(404, 'pass-not-found', { pass_status: 'not_found', status_group: 'unknown' }),
    nolink: problem(409, 'visit-not-linked'),
    cancelled: problem(409, 'visit-cancelled'),
    out: problem(409, 'visit-already-checked-out'),
    conflict: problem(409, 'idempotency-conflict'),
    bad: problem(400, 'validation'),
    anon: problem(401, 'unauthorized'),
  };
  const live = (k: string) => createLiveClient({ token: 'demo', fetchImpl: fakeFetch(() => answers[k]!).f });
  const r = async (k: string) => live(k).redeem('QP1:X', 'key');
  assert.deepEqual(await r('used'), { outcome: 'rejected', reason: 'pass', status: 'used_up', status_group: 'used_up' });
  assert.deepEqual(await r('expired'), { outcome: 'rejected', reason: 'pass', status: 'expired', status_group: 'expired' });
  assert.deepEqual(await r('revoked'), { outcome: 'rejected', reason: 'pass', status: 'revoked', status_group: 'revoked' });
  assert.deepEqual(await r('later'), { outcome: 'rejected', reason: 'pass', status: 'not_yet_valid', status_group: 'unknown' });
  assert.deepEqual(await r('gone'), { outcome: 'rejected', reason: 'pass', status: 'not_found', status_group: 'unknown' });
  assert.deepEqual(await r('nolink'), { outcome: 'rejected', reason: 'visit-not-linked' });
  assert.deepEqual(await r('cancelled'), { outcome: 'rejected', reason: 'visit-cancelled' });
  assert.deepEqual(await r('out'), { outcome: 'rejected', reason: 'visit-already-checked-out' });
  assert.deepEqual(await r('conflict'), { outcome: 'rejected', reason: 'key-conflict' });
  await assert.rejects(() => r('bad'), (e: unknown) => e instanceof FrontCounterError && e.status === 400);
  await assert.rejects(() => r('anon'), (e: unknown) => e instanceof FrontCounterError && e.status === 401);
  await assert.rejects(() => live('anon').redeem('QP1:X', ' '), (e: unknown) => e instanceof FrontCounterError && e.status === 400, 'no key: refused before it is sent');
});

test('live: no token sends no Authorization, a refused call is a 401 error, a dead API is status 0, check-out of nothing is null', async () => {
  const anon = fakeFetch(() => problem(401, 'unauthorized'));
  const c = createLiveClient({ fetchImpl: anon.f });
  await assert.rejects(() => c.listToday(), (e: unknown) => e instanceof FrontCounterError && e.status === 401);
  assert.equal(anon.calls[0]!.headers['Authorization'], undefined);
  const dead = createLiveClient({ token: 'demo', fetchImpl: (async () => { throw new TypeError('network'); }) as unknown as typeof fetch });
  await assert.rejects(() => dead.verify('QP1:X'), (e: unknown) => e instanceof FrontCounterError && e.status === 0);
  const nf = createLiveClient({ token: 'demo', fetchImpl: fakeFetch(() => problem(404, 'visit-not-found')).f });
  assert.equal(await nf.checkOut('vis_x'), null);
});

/* ------------------------------------------------------ the auto source */

test('auto: live when the API answers with a visits list, using the demo Bearer; nothing is fetched until a screen asks', async () => {
  const { f, calls } = fakeFetch(() => ({ status: 200, body: { visits: [] } }));
  const auto = createAutoClient({ base: 'http://x:3200', fetchImpl: f });
  assert.equal(calls.length, 0, 'lazy');
  assert.equal(await auto.ready, 'live');
  assert.equal(auto.kind, 'live');
  assert.equal(auto.demoCodes.length, 0);
  assert.equal(calls[0]!.url, 'http://x:3200/api/management-web/v0/front-counter/visits');
  assert.equal(calls[0]!.headers['Authorization'], 'Bearer demo');
  await auto.listToday();
  assert.equal(calls.length, 2, 'later calls go to the live client, the probe is not repeated');
  assert.equal(calls[1]!.headers['Authorization'], 'Bearer demo');
});

test('auto: the contract fixture when the API does not answer (404 host, a problem, a bad body, a refused connection, a timeout)', async () => {
  const cases: Array<[string, typeof fetch]> = [
    ['404', fakeFetch(() => ({ status: 404, body: 'nf' })).f],
    ['401', fakeFetch(() => ({ status: 401, body: {} })).f],
    ['no visits list', fakeFetch(() => ({ status: 200, body: { hello: 1 } })).f],
    ['refused', (async () => { throw new TypeError('refused'); }) as unknown as typeof fetch],
    ['timeout', (() => new Promise(() => {})) as unknown as typeof fetch],
  ];
  for (const [name, f] of cases) {
    const auto = createAutoClient({ fetchImpl: f, timeoutMs: 20 });
    assert.equal(await auto.ready, 'fixture', name);
    assert.equal(auto.kind, 'fixture', name);
    assert.ok(auto.demoCodes.length > 0, name);
    assert.equal((await auto.verify('QP1:DEMO-VALID')).status, 'valid', name);
  }
});

test('auto: switched off (a real deployment), it never fetches and stays on the fixture', async () => {
  const { f, calls } = fakeFetch(() => ({ status: 200, body: { visits: [] } }));
  const auto = createAutoClient({ fetchImpl: f, enabled: false });
  assert.equal(await auto.ready, 'fixture');
  assert.equal(calls.length, 0);
});

test('auto: listeners hear when the source is known, and a change the live client makes', async () => {
  const { f } = fakeFetch((c) => (c.method === 'GET' ? { status: 200, body: { visits: [] } } : { status: 201, body: { visit: { visit_id: 'v' } } }));
  const auto = createAutoClient({ fetchImpl: f });
  let heard = 0;
  auto.subscribe(() => { heard += 1; });
  await auto.ready;
  assert.equal(heard, 1);
  await auto.createWalkIn({ name: 'x', purpose: 'visit', host_unit_id: 'u' });
  assert.equal(heard, 2);
});

test('select: no params is auto; ?source=fixture and ?source=live pick theirs; the same choice keeps the same client', () => {
  const base = 'http://h';
  const a = selectFrontCounterClient({ mode: 'auto', base, token: '' });
  assert.equal(selectFrontCounterClient({ mode: 'auto', base, token: 'ignored' }), a);
  const fx = selectFrontCounterClient({ mode: 'fixture', base, token: '' });
  assert.notEqual(fx, a);
  assert.equal(fx.kind, 'fixture');
  assert.equal(selectFrontCounterClient({ mode: 'fixture', base, token: '' }), fx, 'the fixture log survives navigation');
  const lv = selectFrontCounterClient({ mode: 'live', base, token: 'demo' });
  assert.equal(lv.kind, 'live');
  assert.notEqual(selectFrontCounterClient({ mode: 'live', base, token: 'other' }), lv, 'a new token is a new client');
});

/* ---------------------------------------------------------- host and scan */

test('host flats come from the location tree as "Block A · 12/F · Flat A1", never as ids', () => {
  const nodes = buildRailNodes(CORPUS['mob-s3-properties/tree.json'] as unknown as PropertyTreeResponse, null);
  const en = unitChoices(nodes, 'en');
  assert.ok(en.length > 100, 'the whole estate is offered');
  const a1 = en.find((c) => c.unit_id === 'unit_wfg_a_12_a1');
  assert.equal(a1?.unit_label, 'Block A · 12/F · Flat A1');
  assert.equal(a1?.building, 'Block A');
  assert.equal(unitChoices(nodes, 'zh-Hant').find((c) => c.unit_id === 'unit_wfg_a_12_a1')?.unit_label, 'A座 · 12樓 · A1室');
  assert.ok(en.every((c) => !/^unit_/.test(c.unit_label)), 'no label is an id');
  assert.ok(searchUnits(en, '12/f a1', null).some((c) => c.unit_label === 'Block A · 12/F · Flat A1'));
  assert.ok(searchUnits(en, 'A座', null).length > 0, 'the Chinese label finds it too');
  assert.ok(searchUnits(en, 'flat', 'Block B').every((c) => c.building === 'Block B'));
  assert.equal(searchUnits(en, 'zzzz', null).length, 0);
  assert.equal(searchUnits(en, '', null, 5).length, 5);
});

test('the camera scan button needs BarcodeDetector, a secure context and getUserMedia', () => {
  const ok = { BarcodeDetector: function () {}, isSecureContext: true, mediaDevices: { getUserMedia: () => {} } };
  assert.equal(scanSupported(ok), true);
  assert.equal(scanSupported({ ...ok, BarcodeDetector: undefined }), false);
  assert.equal(scanSupported({ ...ok, isSecureContext: false }), false);
  assert.equal(scanSupported({ ...ok, mediaDevices: undefined }), false);
  assert.equal(scanSupported({}), false);
});

test('validity windows read "23 Sep 2026, 14:00 HKT" and the zh-Hant equivalent', () => {
  assert.equal(hktStamp('2026-09-23T06:00:00Z', 'en'), '23 Sep 2026, 14:00 HKT');
  assert.equal(hktStamp('2026-09-23T06:00:00+08:00', 'en'), '23 Sep 2026, 06:00 HKT', 'a visit time carries +08:00');
  assert.equal(hktStamp('2026-09-23T06:00:00Z', 'zh-Hant'), '2026年9月23日 14:00（香港時間）');
  assert.equal(hktStamp('2026-09-02T16:05:00Z', 'en'), '3 Sep 2026, 00:05 HKT', 'no zero-padded day; midnight is 00');
});
