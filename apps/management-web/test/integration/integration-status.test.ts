/**
 * Integration status (S05): the fixture is a contract response, its derived views follow the contract’s
 * rules, the source picks fixture or live the way the other clients do, and the words never carry an id.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTEGRATION_FIXTURE, INTEGRATION_VARIANTS, integrationDetail, integrationList,
} from '../../src/integration/integration-fixture.ts';
import {
  HUB_STATES, SYSTEM_STATES, UNKNOWN_REASONS, agoText, hubIsQuiet, summarise, systemOrder,
  type IntegrationSystem,
} from '../../src/integration/integration-status.ts';
import { createIntegrationSource } from '../../src/integration/integration-client.ts';
import { ApiError } from '../../src/data/sourced.ts';
import { deviceText, kindText, placeLabel, saidText } from '../../src/integration/integration-text.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { setLocationTree } from '../../src/data/host-label.ts';
import { CORPUS } from '../../src/data/corpus.g.ts';
import type { PropertyTreeResponse } from '../../src/data/types.ts';
import { LOCALES, t } from '../../src/i18n/locale.ts';

// Labels read the location tree the app states; the app's own is the corpus tree in fixture mode.
setLocationTree(CORPUS['mob-s3-properties/tree.json'] as unknown as PropertyTreeResponse);

const keys = (o: object) => Object.keys(o).sort();
const SYSTEM_KEYS = ['systemRef', 'kind', 'kindLabel', 'displayName', 'state', 'reportedState', 'unknownReason', 'needsAttention', 'needsMapping', 'expectedEnd', 'message', 'since', 'lastSeenAt', 'lastReportAt', 'lastSnapshotAt', 'devicesTotal', 'devicesOffline', 'devicesOnline', 'itDetails'].sort();
const SUMMARY_KEYS = ['hubState', 'hubMessage', 'systemsTotal', 'online', 'degraded', 'offline', 'unknown', 'maintenance', 'needsAttention', 'needsMapping', 'devicesTotal', 'devicesOffline', 'devicesOnline', 'lastHeartbeatAt', 'lastSnapshotAt'].sort();
const HUB_KEYS = ['state', 'message', 'needsAttention', 'lastHeartbeatAt', 'lastSnapshotAt', 'summary', 'itDetails'].sort();
const SYS_IT_KEYS = ['estateNodeId', 'placeNodeId', 'placeSource', 'hubPlaceNodeId', 'placeMismatch', 'source', 'detailCode', 'hubState'].sort();

test('the fixture has the shape of section 5.1, key for key', () => {
  const r = INTEGRATION_FIXTURE;
  assert.deepEqual(keys(r), ['hubs', 'meta', 'scope', 'summary', 'systems']);
  assert.deepEqual(keys(r.meta), ['contractVersion', 'correlationId', 'generatedAt']);
  assert.deepEqual(keys(r.summary), SUMMARY_KEYS);
  assert.deepEqual(keys(r.hubs[0]!), HUB_KEYS);
  assert.deepEqual(keys(r.hubs[0]!.summary), ['devicesOffline', 'devicesTotal', 'systemsOffline', 'systemsTotal']);
  assert.deepEqual(keys(r.hubs[0]!.itDetails), ['estateNodeId', 'hubInstance', 'outbox', 'uptimeS', 'version']);
  assert.deepEqual(keys(r.hubs[0]!.itDetails.outbox!), ['oldestOccurredAt', 'pending']);
  for (const s of r.systems) {
    assert.deepEqual(keys(s), SYSTEM_KEYS, s.systemRef);
    assert.deepEqual(keys(s.itDetails), SYS_IT_KEYS, s.systemRef);
    assert.deepEqual(keys(s.kindLabel), ['en', 'zh-Hans', 'zh-Hant']);
    assert.deepEqual(keys(s.displayName), ['en', 'zh-Hans', 'zh-Hant']); // v0.4.2: the name is localised too
    assert.deepEqual(keys(s.message), ['en', 'zh-Hant']);
  }
});

test('the fixture is the Wing Fu Garden Hub of section 6: 12 systems, 9 online, 1 degraded, 1 offline, 1 maintenance', () => {
  const s = INTEGRATION_FIXTURE.summary;
  assert.equal(s.systemsTotal, 12);
  assert.deepEqual([s.online, s.degraded, s.offline, s.unknown, s.maintenance], [9, 1, 1, 0, 1]);
  assert.equal(s.needsAttention, 2);
  assert.deepEqual([s.devicesTotal, s.devicesOffline, s.devicesOnline], [366, 53, 313]);
  assert.equal(INTEGRATION_FIXTURE.scope, 'estate');
  assert.equal(INTEGRATION_FIXTURE.systems.length, 12);
  // The summary is the sum of the rows, and the rows are in the contract’s order.
  assert.deepEqual(s, summarise(INTEGRATION_FIXTURE.systems, { state: s.hubState, message: s.hubMessage, lastHeartbeatAt: s.lastHeartbeatAt, lastSnapshotAt: s.lastSnapshotAt }));
  assert.deepEqual([...INTEGRATION_FIXTURE.systems].sort(systemOrder).map((x) => x.systemRef), INTEGRATION_FIXTURE.systems.map((x) => x.systemRef));
  assert.equal(INTEGRATION_FIXTURE.systems[0]!.state, 'offline');
  // Every system has devicesOnline + devicesOffline = devicesTotal; a maintenance system carries expectedEnd, no other does.
  for (const x of INTEGRATION_FIXTURE.systems) {
    assert.equal(x.devicesOnline + x.devicesOffline, x.devicesTotal, x.systemRef);
    assert.equal(x.expectedEnd !== null, x.state === 'maintenance', x.systemRef);
    assert.equal(x.needsAttention, ['degraded', 'offline', 'unknown'].includes(x.state), x.systemRef);
  }
  // Instants are Hong Kong time.
  assert.match(INTEGRATION_FIXTURE.meta.generatedAt, /\+08:00$/);
});

test('a silent Hub reads every system as unknown, with the reason, never as offline (section 2.2)', () => {
  const r = integrationList('hub-silent');
  assert.equal(r.summary.hubState, 'silent');
  assert.equal(r.hubs[0]!.state, 'silent');
  assert.ok(r.systems.every((s) => s.state === 'unknown' && s.unknownReason === 'hub_silent' && s.needsAttention));
  assert.equal(r.summary.unknown, 12);
  assert.equal(r.summary.offline, 0);
  assert.equal(r.summary.online, 0);
  assert.equal(r.summary.needsAttention, 12);
  assert.ok(hubIsQuiet(r.summary.hubState));
  assert.match(agoText(r.summary.lastHeartbeatAt!, r.meta.generatedAt, 'en'), /^4 min\.? ago$/);
});

test('a Hub never heard from reads every system as unknown for a different reason; a late Hub leaves the systems alone', () => {
  const never = integrationList('hub-never');
  assert.equal(never.hubs[0]!.state, 'never');
  assert.ok(never.systems.every((s) => s.unknownReason === 'hub_never_seen' && s.since === null));
  assert.equal(never.summary.lastHeartbeatAt, null);
  const late = integrationList('hub-late');
  assert.equal(late.hubs[0]!.state, 'late');
  assert.ok(!hubIsQuiet('late'));
  assert.deepEqual(late.systems.map((s) => s.state), INTEGRATION_FIXTURE.systems.map((s) => s.state));
  assert.ok(late.hubs[0]!.needsAttention);
});

test('a narrower reader sees scope “places”: no Hub rows, no Hub-derived fields, only their block (section 5.3)', () => {
  const r = integrationList('places');
  assert.equal(r.scope, 'places');
  assert.deepEqual(r.hubs, []);
  assert.deepEqual(r.systems.map((s) => s.displayName.en), ['Block A visitor intercom', 'Lifts, Block A']);
  for (const k of ['hubState', 'hubMessage', 'lastHeartbeatAt', 'lastSnapshotAt'] as const) assert.equal(r.summary[k], null, k);
  assert.equal(r.summary.systemsTotal, 2);
  assert.equal(r.summary.needsMapping, 0);
  for (const s of r.systems) {
    for (const k of ['source', 'hubState', 'hubPlaceNodeId', 'placeMismatch'] as const) assert.equal(s.itDetails[k], null, k);
    assert.notEqual(s.itDetails.placeNodeId, null);
  }
  const empty = integrationList('places-empty');
  assert.equal(empty.scope, 'places');
  assert.equal(empty.systems.length, 0);
  assert.equal(empty.summary.systemsTotal, 0);
  assert.equal(empty.summary.devicesTotal, 0);
});

test('a system with neither a PEMO entry nor a Hub hint is flagged and counted, and visible to the estate only', () => {
  const r = integrationList('needs-mapping');
  assert.equal(r.summary.needsMapping, 1);
  const s = r.systems.find((x) => x.needsMapping)!;
  assert.equal(s.itDetails.placeNodeId, null);
  assert.equal(s.itDetails.placeSource, null);
  assert.equal(integrationList('places').systems.some((x) => x.needsMapping), false);
});

test('every variant is a complete response and keeps the contract’s keys', () => {
  for (const v of INTEGRATION_VARIANTS) {
    const r = integrationList(v);
    assert.deepEqual(keys(r.summary), SUMMARY_KEYS, v);
    for (const s of r.systems) assert.deepEqual(keys(s), SYSTEM_KEYS, `${v} ${s.systemRef}`);
  }
});

test('the detail read has the shape of 5.2, history newest first, from null on the first entry', () => {
  const d = integrationDetail('sys_wfg_intercom')!;
  assert.deepEqual(keys(d), ['history', 'itDetails', 'meta', 'system']);
  assert.deepEqual(keys(d.itDetails), ['recentDeviceChanges']);
  assert.equal(d.system.state, 'offline');
  const times = d.history.map((h) => new Date(h.at).getTime());
  assert.deepEqual([...times].sort((a, b) => b - a), times);
  for (const h of d.history) assert.deepEqual(keys(h), ['at', 'cause', 'from', 'itDetails', 'message', 'reason', 'to']);
  assert.ok(d.history.some((h) => h.cause === 'derived' && h.reason === 'hub_silent'));
  assert.equal(integrationDetail('sys_wfg_bms')!.history.at(-1)!.from, null);
  assert.equal(integrationDetail('sys_wfg_intercom', 'list', 1)!.history.length, 1);
  assert.equal(integrationDetail('sys_does_not_exist'), undefined);
  // A system outside the reader’s scope is the same answer as one that does not exist.
  assert.equal(integrationDetail('sys_wfg_cctv', 'places'), undefined);
});

test('the words: places by name, never an id, and PEMO’s own sentence when it is the one that worked it out', () => {
  assert.equal(placeLabel('blk_wfg_a', 'en'), 'Block A');
  assert.equal(placeLabel(null, 'en'), 'Whole estate');
  assert.equal(placeLabel('est_wing_fu_garden', 'zh-Hant'), t(MESSAGES.integration.wholeEstate, 'zh-Hant'));
  assert.equal(placeLabel('loc_no_such_place', 'en'), 'Another place');
  // The car park and the clubhouse are Locations, not nodes of the residential tree: named, in all three languages.
  assert.deepEqual(['en', 'zh-Hant', 'zh-Hans'].map((l) => placeLabel('loc_wfg_carpark', l as 'en')), ['Resident car park', '住戶停車場', '住户停车场']);
  assert.deepEqual(['en', 'zh-Hant', 'zh-Hans'].map((l) => placeLabel('loc_wfg_clubhouse', l as 'en')), ['Wing Fu Clubhouse', '榮富會所', '荣富会所']);
  for (const s of INTEGRATION_FIXTURE.systems) {
    assert.notEqual(placeLabel(s.itDetails.placeNodeId, 'en'), 'Another place', s.systemRef); // every place in the fixture has a name
  }
  const intercom = INTEGRATION_FIXTURE.systems.find((s) => s.systemRef === 'sys_wfg_intercom')!;
  assert.equal(saidText(intercom, 'en'), 'Intercom is not responding.');
  assert.equal(saidText(intercom, 'zh-Hant'), '對講機沒有回應。');
  const silent = integrationList('hub-silent').systems[0]!;
  assert.equal(saidText(silent, 'en'), MESSAGES.integration.unknownReason.hub_silent.en);
  assert.equal(deviceText(intercom, false, 'en'), '0 of 52 online');
  // The kind is words in each language, from this client’s own list; a kind it has not seen keeps the Hub’s label.
  assert.equal(kindText(intercom, 'zh-Hans'), '对讲机');
  assert.equal(kindText(intercom, 'zh-Hant'), '對講機');
  assert.equal(kindText({ kind: 'new_kind', kindLabel: { en: 'Pool', 'zh-Hant': '泳池' } }, 'zh-Hans'), '泳池');
  assert.equal(deviceText(silent, true, 'en'), '—');
  for (const loc of LOCALES) for (const v of INTEGRATION_VARIANTS) {
    for (const s of integrationList(v).systems) {
      for (const text of [placeLabel(s.itDetails.placeNodeId, loc), saidText(s, loc)]) {
        assert.doesNotMatch(text, /\b(sys|blk|est|loc|unit)_/, `${v} ${s.systemRef} ${loc}`);
      }
    }
  }
});

test('every state, Hub state and reason has words in English, Traditional and Simplified, and none is a copy of the key', () => {
  for (const loc of LOCALES) {
    for (const st of SYSTEM_STATES) assert.ok(t(MESSAGES.integration.systemState[st], loc).length > 0 && t(MESSAGES.integration.systemState[st], loc) !== st);
    for (const h of HUB_STATES) {
      assert.ok(t(MESSAGES.integration.hubState[h], loc).length > 0);
      assert.ok(t(MESSAGES.integration.hubSentence[h], loc).length > 0);
    }
    for (const r of UNKNOWN_REASONS) assert.ok(t(MESSAGES.integration.unknownReason[r], loc).length > 0);
  }
  // 简 is its own text, not the 繁 text, wherever the two differ.
  assert.notEqual(MESSAGES.integration.hubSentence.silent['zh-Hans'], MESSAGES.integration.hubSentence.silent['zh-Hant']);
  assert.notEqual(MESSAGES.integration.systemState.offline['zh-Hans'], MESSAGES.integration.systemState.offline['zh-Hant']);
});

test('the boundary is stated: PEMO does not connect to building systems, the Hub does', () => {
  assert.match(MESSAGES.integration.hubIntro.en, /PEMO does not connect to building systems/);
  assert.match(MESSAGES.integration.hubIntro.en, /2IoT Hub/);
  // Nothing on this screen names a system PEMO would be talking to.
  const all = JSON.stringify(MESSAGES.integration);
  for (const word of [/ParkCore/i, /Octopus/i, /\bFM\b/, /facility management/i]) assert.doesNotMatch(all, word);
});

/* ----------------------------------------------------------------- source */

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const seen: string[] = [];
const stub = (answer: (url: string) => Response): typeof fetch => (async (input: RequestInfo | URL) => {
  const url = String(input);
  seen.push(url);
  return answer(url);
}) as typeof fetch;

test('auto reads live when the route answers, and the fixture when it does not', async () => {
  seen.length = 0;
  const live = createIntegrationSource({
    mode: 'auto', enabled: true,
    fetchImpl: stub((u) => (u.includes('/integration-status') ? json(200, { ...INTEGRATION_FIXTURE, scope: 'places' }) : json(404, {}))),
  });
  const a = await live.read();
  assert.equal(a.source, 'live');
  assert.equal(a.response.scope, 'places');
  assert.ok(seen.every((u) => u.startsWith('/api/management-web/v0/integration-status')));

  const none = createIntegrationSource({ mode: 'auto', enabled: true, fetchImpl: stub(() => json(404, {})) });
  const b = await none.read();
  assert.equal(b.source, 'fixture');
  assert.equal(b.response.systems.length, 12);
});

test('a 403 from the route still means the route is there: live, and the refusal reaches the screen as a problem', async () => {
  const refuse = createIntegrationSource({
    mode: 'auto', enabled: true,
    fetchImpl: stub(() => json(403, { type: 'https://pemo.local/problems/insufficient-scope', title: 'Insufficient scope', status: 403, correlationId: 'c1' })),
  });
  await assert.rejects(refuse.read(), (e: unknown) => e instanceof ApiError && e.status === 403 && e.problem.type.endsWith('/insufficient-scope'));
});

test('a sample view is always the fixture, and live detail names the system in the path and asks for 50 entries', async () => {
  seen.length = 0;
  const src = createIntegrationSource({ mode: 'live', token: 'tok', fetchImpl: stub((u) => (u.includes('?limit=') ? json(200, integrationDetail('sys_wfg_ev')) : json(200, INTEGRATION_FIXTURE))) });
  assert.equal((await src.read('hub-silent')).source, 'fixture');
  assert.equal(seen.length, 0, 'a sample view makes no request');
  const d = await src.readDetail('sys_wfg_ev');
  assert.equal(d.source, 'live');
  assert.deepEqual(seen, ['/api/management-web/v0/integration-status/sys_wfg_ev?limit=50']);
});

test('the fixture answers an unknown system with the record-not-found problem', async () => {
  const src = createIntegrationSource({ mode: 'fixture' });
  await assert.rejects(src.readDetail('sys_nope'), (e: unknown) => e instanceof ApiError && e.status === 404 && e.problem.type.endsWith('/record-not-found'));
  const ok = await src.readDetail('sys_wfg_lifts_a');
  assert.equal(ok.response.system.state, 'degraded');
});

test('the system order is trouble first, then by name', () => {
  const mk = (displayName: string, state: IntegrationSystem['state']) => ({ displayName: { en: displayName, 'zh-Hant': displayName }, state }) as IntegrationSystem;
  const sorted = [mk('b', 'online'), mk('a', 'online'), mk('z', 'offline'), mk('y', 'unknown'), mk('x', 'degraded'), mk('m', 'maintenance')].sort(systemOrder);
  assert.deepEqual(sorted.map((s) => s.state), ['offline', 'degraded', 'unknown', 'maintenance', 'online', 'online']);
});
