/**
 * R5: bounded paging with a stable tie-break key, and no silent holes/dupes.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { CursorExpiredError, DEFAULT_PAGE_SIZE, InvalidPageLimitError, MAX_PAGE_SIZE, parsePageParams, slicePage } from '../../apps/api/src/management/paging.ts';

test('parsePageParams: default, cap, and after', () => {
  assert.equal(parsePageParams({}).limit, DEFAULT_PAGE_SIZE);
  assert.equal(parsePageParams({}).after, null);
  assert.equal(parsePageParams({ limit: '3' }).limit, 3);
  assert.equal(parsePageParams({ limit: String(MAX_PAGE_SIZE + 10) }).limit, MAX_PAGE_SIZE);
  assert.equal(parsePageParams({ after: 'location:loc_r5_0100' }).after, 'location:loc_r5_0100');
  assert.throws(() => parsePageParams({ limit: '0' }), InvalidPageLimitError);
  assert.throws(() => parsePageParams({ limit: '1.5' }), InvalidPageLimitError);
  assert.throws(() => parsePageParams({ limit: 'abc' }), InvalidPageLimitError);
  assert.throws(() => parsePageParams({ limit: '-1' }), InvalidPageLimitError);
});

test('parsePageParams: scientific, hex, signed, and whitespace limits are rejected (P3-4)', () => {
  for (const limit of ['1e3', '0x10', '2e0', '+5', ' 5 ', '5 ', ' 5', '1.0'] as const) {
    assert.throws(() => parsePageParams({ limit }), InvalidPageLimitError, limit);
  }
  assert.equal(parsePageParams({ limit: '5' }).limit, 5);
  assert.equal(parsePageParams({}).limit, DEFAULT_PAGE_SIZE);
});

test('slicePage: walks every key once, in order, with a stable tie-break', () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({
    key: `location:loc_r5_${String(i + 1).padStart(4, '0')}`,
  }));
  const seen: string[] = [];
  let after: string | null = null;
  let pages = 0;
  for (;;) {
    const { rows: page, page: meta } = slicePage(rows, (r) => r.key, { limit: 100, after });
    pages += 1;
    seen.push(...page.map((r) => r.key));
    if (meta.next === null) break;
    after = meta.next;
  }
  assert.equal(pages, 3);
  assert.equal(seen.length, 250);
  assert.equal(new Set(seen).size, 250);
  assert.deepEqual(seen, rows.map((r) => r.key));
});

import {
  authorizationFingerprint,
  clearTreeWalks,
  rememberTreeWalk,
  takeTreeWalk,
  treeWalkFingerprint,
} from '../../apps/api/src/management/tree-page-cache.ts';
import { compareTicketsByOpenedAt } from '../../apps/api/src/management/helpdesk-order.ts';
import { staffProblems } from '../../apps/api/src/management/staff-problems.ts';

const staffGrant = (role: string, nodeId = 'est_wing_fu_garden') => ({
  role,
  node: { kind: 'estate' as const, id: nodeId },
  effectiveFrom: '2020-01-01T00:00:00.000Z',
  effectiveTo: null,
  grantId: `gr_${role}`,
});

test('slicePage: an unknown cursor is expired, not a silent empty last page', () => {
  const rows = [{ key: 'location:loc_a' }, { key: 'location:loc_b' }];
  assert.throws(() => slicePage(rows, (r) => r.key, { limit: 100, after: 'location:deleted' }), CursorExpiredError);
  const { rows: last, page } = slicePage(rows, (r) => r.key, { limit: 100, after: 'location:loc_b' });
  assert.deepEqual(last, []);
  assert.equal(page.next, null);
});

test('tree walk cache: first page stores, later pages reuse, a new walk misses', () => {
  clearTreeWalks();
  const fp = treeWalkFingerprint(
    'stf_wfg_manager', 'org_wingfu_holdings',
    authorizationFingerprint([staffGrant('estate_staff')]),
    undefined,
  );
  const nodes = [{ key: 'estate:est_wing_fu_garden' }, { key: 'building:blk_wfg_a' }];
  assert.equal(takeTreeWalk(fp), null);
  rememberTreeWalk(fp, nodes);
  assert.equal(takeTreeWalk(fp), nodes);
  const other = treeWalkFingerprint(
    'stf_hbv_manager', 'org_harbour_property',
    authorizationFingerprint([staffGrant('estate_staff', 'est_harbour_view')]),
    undefined,
  );
  assert.equal(takeTreeWalk(other), null);
  clearTreeWalks();
  assert.equal(takeTreeWalk(fp), null);
});

test('tree walk cache: a role change misses the previous walk (P2-4)', () => {
  clearTreeWalks();
  const staff = treeWalkFingerprint(
    'stf_wfg_manager', 'org_wingfu_holdings',
    authorizationFingerprint([staffGrant('estate_staff')]),
    undefined,
  );
  const approver = treeWalkFingerprint(
    'stf_wfg_manager', 'org_wingfu_holdings',
    authorizationFingerprint([staffGrant('approver')]),
    undefined,
  );
  rememberTreeWalk(staff, [{ action: 'composeNotice' }]);
  assert.equal(takeTreeWalk(approver), null);
  assert.ok(takeTreeWalk(staff));
  clearTreeWalks();
});

test('tree walk cache: remember evicts expired entries (P3-1)', () => {
  clearTreeWalks();
  const fp = treeWalkFingerprint('p', 'o', 'auth', undefined);
  const realNow = Date.now;
  try {
    Date.now = () => 1_000;
    rememberTreeWalk(fp, [{ k: 1 }]);
    Date.now = () => 1_000 + 16_000;
    rememberTreeWalk('other', [{ k: 2 }]);
    Date.now = () => 1_000 + 16_000;
    assert.equal(takeTreeWalk(fp), null);
  } finally {
    Date.now = realNow;
    clearTreeWalks();
  }
});

test('helpdesk queue sorts by opened_at then ticket id (P3-5)', () => {
  const a = { ticketId: 'tkt_b', openedAt: new Date('2026-01-02T00:00:00Z') };
  const b = { ticketId: 'tkt_a', openedAt: new Date('2026-01-01T00:00:00Z') };
  const c = { ticketId: 'tkt_c', openedAt: new Date('2026-01-01T00:00:00Z') };
  const ordered = [a, b, c].sort(compareTicketsByOpenedAt);
  assert.deepEqual(ordered.map((t) => t.ticketId), ['tkt_a', 'tkt_c', 'tkt_b']);
});

test('paging errors map to 400 and 410, not 500 (P2-2, P2-3)', () => {
  const invalid = new InvalidPageLimitError();
  const expired = new CursorExpiredError('location:gone');
  assert.equal(invalid.name, 'InvalidPageLimitError');
  assert.equal(expired.name, 'CursorExpiredError');
  const bad = staffProblems.badRequest({ en: 'limit must be a positive integer.', 'zh-Hant': 'limit 必須為正整數。' });
  const gone = staffProblems.cursorExpired();
  assert.equal(bad.status, 400);
  assert.equal(bad.type.endsWith('invalid-request'), true);
  assert.equal(gone.status, 410);
  assert.equal(gone.type.endsWith('cursor-expired'), true);
});
