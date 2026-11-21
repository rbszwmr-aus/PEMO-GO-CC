/**
 * Nav items the API refuses (403) are left out of the nav; nothing else is.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_BACKING_ROUTES, deniedNavItems } from '../../src/shell/nav-access.ts';
import { NAV_IA } from '../../src/data/nav-ia.ts';

const answering = (status: Record<string, number | 'throw'>, seen: Array<{ url: string; auth: string | null }> = []): typeof fetch =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    seen.push({ url: u, auth: new Headers(init?.headers).get('authorization') });
    const key = Object.keys(status).find((k) => u.includes(k));
    const s = key ? status[key]! : 404;
    if (s === 'throw') throw new TypeError('network down');
    return new Response('{}', { status: s });
  }) as typeof fetch;

test('the nav items that have a read of their own are in the nav, and are the Audit log and Integration status', () => {
  const ids = new Set(NAV_IA.flatMap((g) => g.items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)])));
  assert.deepEqual(Object.keys(NAV_BACKING_ROUTES).sort(), ['adm-audit', 'integrations']);
  for (const id of Object.keys(NAV_BACKING_ROUTES)) assert.ok(ids.has(id as never), id);
});

test('a 403 on a nav item’s read leaves that item out, and only that item', async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const denied = await deniedNavItems({ mode: 'live', token: 'tok', fetchImpl: answering({ 'admin/audit-log': 403, 'integration-status': 200 }, seen) });
  assert.deepEqual([...denied], ['adm-audit']);
  assert.ok(seen.length === 2 && seen.every((s) => s.auth === 'Bearer tok'), 'the staff token goes with the ask');
  const both = await deniedNavItems({ mode: 'auto', enabled: true, fetchImpl: answering({ 'admin/audit-log': 403, 'integration-status': 403 }) });
  assert.deepEqual([...both].sort(), ['adm-audit', 'integrations']);
});

test('401, 404, a network error and a timeout are not a refusal: the item stays', async () => {
  for (const s of [200, 401, 404, 500, 'throw'] as const) {
    const denied = await deniedNavItems({ mode: 'live', fetchImpl: answering({ 'admin/audit-log': s, 'integration-status': s }) });
    assert.equal(denied.size, 0, String(s));
  }
  assert.equal((await deniedNavItems({ mode: 'live', timeoutMs: 20, fetchImpl: ((_u: string, init?: RequestInit) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch })).size, 0);
});

test('the fixture source asks nothing and hides nothing; auto does not ask when auto-live is off', async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const f = answering({ 'admin/audit-log': 403, 'integration-status': 403 }, seen);
  assert.equal((await deniedNavItems({ mode: 'fixture', fetchImpl: f })).size, 0);
  assert.equal((await deniedNavItems({ mode: 'auto', enabled: false, fetchImpl: f })).size, 0);
  assert.equal(seen.length, 0);
});
