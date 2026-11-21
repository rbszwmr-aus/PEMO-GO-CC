/**
 * Help desk ticket→UI enum map (option a) and live client mapping.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapDomainChannel,
  mapDomainStatus,
  mapHelpdeskContact,
  mapHelpdeskQueue,
  mapUiTone,
  normalizeHelpdeskContact,
  normalizeHelpdeskQueue,
  type HelpdeskContactDetailResponse,
  type HelpdeskQueueResponse,
} from '../../src/data/helpdesk-live.ts';
import { LiveManagementClient, withDemoHelpdeskQuery } from '../../src/data/live-client.ts';
import type { Problem } from '../../src/data/types.ts';

test('domain channel maps to UI chrome channel', () => {
  assert.equal(mapDomainChannel('resident_app'), 'app');
  assert.equal(mapDomainChannel('phone'), 'phone');
  assert.equal(mapDomainChannel('kiosk'), 'counter');
  assert.equal(mapDomainChannel('staff_manual'), 'counter');
  assert.equal(mapDomainChannel('email'), 'app');
});

test('domain status maps to waiting / in_progress / overdue / closed', () => {
  assert.equal(mapDomainStatus('open'), 'waiting');
  assert.equal(mapDomainStatus('triaged'), 'waiting');
  assert.equal(mapDomainStatus('awaiting_resident'), 'waiting');
  assert.equal(mapDomainStatus('in_progress'), 'in_progress');
  assert.equal(mapDomainStatus('resolved'), 'closed');
  assert.equal(mapDomainStatus('closed'), 'closed');
  assert.equal(mapDomainStatus('open', { overdue: true }), 'overdue');
  assert.equal(mapDomainStatus('open', { waitingMinutes: 26 }), 'overdue');
  assert.equal(mapDomainStatus('open', { waitingMinutes: 5 }), 'waiting');
});

test('UI tone follows mapped contact state', () => {
  assert.equal(mapUiTone('overdue'), 'critical');
  assert.equal(mapUiTone('waiting'), 'warning');
  assert.equal(mapUiTone('in_progress'), 'info');
  assert.equal(mapUiTone('closed'), 'normal');
});

test('mapHelpdeskQueue produces chrome rows and stats', () => {
  const payload: HelpdeskQueueResponse = {
    meta: { correlationId: 'c', contractVersion: '0.0.0', generatedAt: '2026-09-07T00:00:00+08:00' },
    stats: {
      waiting: 2,
      answeredToday: 10,
      raisedAsCases: 1,
      officeHours: { start: '08:00', end: '20:00' },
      longestWaitMinutes: 26,
      medianFirstReplyMinutes: 6,
    },
    rows: [
      {
        contactId: 'hd_1',
        channel: 'resident_app',
        residentDisplayName: 'A',
        unitLabel: 'A · 1/F A1',
        subject: { en: 'Q', 'zh-Hant': '問' },
        waitingMinutes: 26,
        status: 'open',
      },
      {
        contactId: 'hd_2',
        channel: 'phone',
        residentDisplayName: 'B',
        unitLabel: 'B · 2/F B1',
        subject: { en: 'Call', 'zh-Hant': '電' },
        waitingMinutes: 4,
        status: 'in_progress',
      },
    ],
  };
  const view = mapHelpdeskQueue(payload);
  assert.equal(view.stats[0]?.value, '2');
  assert.equal(view.rows[0]?.state, 'overdue');
  assert.equal(view.rows[0]?.channel, 'app');
  assert.equal(view.rows[0]?.tone, 'critical');
  assert.equal(view.rows[1]?.state, 'in_progress');
  assert.equal(view.rows[1]?.channel, 'phone');
});

test('mapHelpdeskContact maps timeline system channel', () => {
  const payload: HelpdeskContactDetailResponse = {
    meta: { correlationId: 'c', contractVersion: '0.0.0', generatedAt: '2026-09-07T00:00:00+08:00' },
    contact: {
      contactId: 'hd_1',
      channel: 'kiosk',
      residentDisplayName: 'C',
      unitLabel: 'C · 3/F C1',
      subject: { en: 'Mail', 'zh-Hant': '郵' },
      waitingMinutes: 1,
      status: 'in_progress',
      openedAt: '2026-09-07T09:00:00+08:00',
      linkedCaseRef: null,
      dispositionNote: { en: 'At desk', 'zh-Hant': '在櫃台' },
      timeline: [
        {
          at: '2026-09-07T09:00:00+08:00',
          who: { en: 'System', 'zh-Hant': '系統' },
          channel: 'system',
          body: { en: 'Queued', 'zh-Hant': '已排隊' },
        },
      ],
    },
  };
  const detail = mapHelpdeskContact(payload);
  assert.equal(detail.channel, 'counter');
  assert.equal(detail.timeline[0]?.channel, 'system');
  assert.equal(detail.linkedCaseRef, null);
});

test('listHelpdeskQueue never invents an empty queue on 401', async () => {
  const problem401: Problem = {
    type: 'https://pemo.local/problems/invalid-credential',
    title: 'Invalid credential',
    status: 401,
    correlationId: '00000000-0000-4000-8000-000000000001',
    staffMessage: { en: 'No', 'zh-Hant': '否' },
    retryable: false,
  };
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: '',
    fetch: async () => new Response(JSON.stringify(problem401), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  });
  const result = await client.listHelpdeskQueue();
  assert.equal(result.kind, 'problem');
  assert.notEqual(result.kind, 'loaded');
});

test('listHelpdeskQueue network failure is offline, not empty rows', async () => {
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: 'staff',
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  const result = await client.listHelpdeskQueue();
  assert.equal(result.kind, 'offline');
});

test('normalizeHelpdeskQueue passthrough for Backend chrome wire', () => {
  const chrome = {
    meta: { correlationId: 'c', contractVersion: '2.4.0', generatedAt: '2026-09-07T00:00:00+08:00' },
    stats: [
      {
        id: 'waiting',
        label: { en: 'WAITING', 'zh-Hant': '等候中' },
        value: '2',
        note: { en: 'n', 'zh-Hant': 'n' },
        tone: 'warning' as const,
      },
    ],
    rows: [
      {
        id: 'tkt_seed_a',
        channel: 'app' as const,
        who: 'res_wfg_chan',
        unit: 'Block A · 12/F A1',
        subject: { en: 'Leak', 'zh-Hant': '漏' },
        wait: { en: '28h', 'zh-Hant': '28 小時' },
        state: 'waiting' as const,
        tone: 'warning' as const,
      },
    ],
  };
  const view = normalizeHelpdeskQueue(chrome);
  assert.equal(view.stats[0]?.value, '2');
  assert.equal(view.rows[0]?.id, 'tkt_seed_a');
  assert.equal(view.rows[0]?.channel, 'app');
  assert.equal(view.rows[0]?.state, 'waiting');
});

test('normalizeHelpdeskContact passthrough for Backend chrome wire', () => {
  const chrome = {
    meta: { correlationId: 'c', contractVersion: '2.4.0', generatedAt: '2026-09-07T00:00:00+08:00' },
    contact: {
      id: 'tkt_seed_a',
      channel: 'app' as const,
      who: 'res_wfg_chan',
      unit: 'Block A · 12/F A1',
      subject: { en: 'Leak', 'zh-Hant': '漏' },
      wait: { en: '28h', 'zh-Hant': '28 小時' },
      state: 'waiting' as const,
      tone: 'warning' as const,
      openedAt: '2026-09-06T17:08:08.401+08:00',
      linkedCaseRef: 'cse_seed_leak',
      disposition: { en: 'Waiting', 'zh-Hant': '等候中' },
      timeline: [],
    },
  };
  const detail = normalizeHelpdeskContact(chrome);
  assert.equal(detail.id, 'tkt_seed_a');
  assert.equal(detail.linkedCaseRef, 'cse_seed_leak');
  assert.equal(detail.who, 'res_wfg_chan');
});

test('demo bearer appends demo=1 to Help desk reads; real tokens are unchanged', async () => {
  // Path merge: no query, existing query, existing demo param, hash.
  assert.equal(withDemoHelpdeskQuery('/api/management-web/v0/helpdesk/queue', 'demo'), '/api/management-web/v0/helpdesk/queue?demo=1');
  assert.equal(withDemoHelpdeskQuery('/q?page=2', 'demo'), '/q?page=2&demo=1');
  assert.equal(withDemoHelpdeskQuery('/q?demo=0&page=2', 'demo'), '/q?demo=1&page=2');
  assert.equal(withDemoHelpdeskQuery('/q?page=2#top', 'demo'), '/q?page=2&demo=1#top');
  assert.equal(withDemoHelpdeskQuery('/q?page=2', 'staff-token'), '/q?page=2');
  assert.equal(withDemoHelpdeskQuery('/q', ''), '/q');
  assert.equal(withDemoHelpdeskQuery('/q', 'Demo'), '/q');

  const chromeQueue = { meta: { correlationId: 'c', contractVersion: '2.6.0', generatedAt: '2026-09-25T00:00:00+08:00' }, stats: [], rows: [] };
  const chromeContact = {
    meta: chromeQueue.meta,
    contact: { id: 'tkt_seed_a', channel: 'app', who: 'w', unit: 'u', subject: { en: 's', 'zh-Hant': 's' }, wait: { en: '1h', 'zh-Hant': '1h' }, state: 'waiting', tone: 'warning', openedAt: '2026-09-25T00:00:00+08:00', disposition: { en: 'd', 'zh-Hant': 'd' }, timeline: [] },
  };
  const calls = async (token: string): Promise<string[]> => {
    const seen: string[] = [];
    const client = new LiveManagementClient({
      baseUrl: 'http://api.test',
      token,
      fetch: async (input) => {
        const url = String(input);
        seen.push(url);
        const body = url.includes('/helpdesk/contacts/') ? chromeContact : chromeQueue;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    assert.equal((await client.listHelpdeskQueue()).kind, 'loaded');
    assert.equal((await client.getHelpdeskContact('tkt_seed_a')).kind, 'loaded');
    return seen;
  };
  assert.deepEqual(await calls('demo'), [
    'http://api.test/api/management-web/v0/helpdesk/queue?demo=1',
    'http://api.test/api/management-web/v0/helpdesk/contacts/tkt_seed_a?demo=1',
  ]);
  assert.deepEqual(await calls('staff-token'), [
    'http://api.test/api/management-web/v0/helpdesk/queue',
    'http://api.test/api/management-web/v0/helpdesk/contacts/tkt_seed_a',
  ]);
});
