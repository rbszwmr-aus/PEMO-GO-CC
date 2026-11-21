/**
 * THE HAND-AUTHORED NOTICE FIXTURES AGREE WITH THE REGISTRY (GEN-052 D4).
 *
 * UI-051 found list.json listing publishNotice on a DRAFT. Investigated: the row
 * is `event_community`, seeded UNGATED, so publish-from-draft is CORRECT by
 * ADR-019 — but the same row also listed submitNotice, which only a gated type
 * has, and the fixture was not recorded against anything: at GEN-047 it was
 * patched by a hand rule to satisfy ruling (b), and operation parity checks
 * presence, never values. This test is the missing check: every mob-s5 item's
 * list must equal what `noticeActRegistry.permitted` returns for a covering
 * estate_staff caller under the seeded approval policy. A hand rule cannot drift
 * from the registry again without going red.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleScope } from '../../modules/access/dist/index.js';
import { noticeActRegistry, type NoticeActSubject } from '../../apps/api/dist/management/notice-permissions.js';
import type { NoticeLifecycleState } from '../../modules/notices/dist/index.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// The seeded approval policy (database/seeds/60-notices-lift-interruption.sql).
const GATED: Record<string, boolean> = { emergency: true, planned_interruption: true, general: false, event_community: false };
const FIX = ['mob-s5-notices/list.json', 'mob-s5-notices/lifecycle.json', 'mob-s5-notices/detail.json'];

test('every mob-s5 permittedActions equals the registry verdict for a covering staff caller', async () => {
  const node = 'building:blk_wfg_a';
  const caller = {
    estate_staff: await roleScope('estate_staff',
      [{ grantId: 'g', groupId: 'grp', role: 'estate_staff', node: { kind: 'building', id: 'blk_wfg_a' },
         effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null }],
      async (ns) => ns.map((n) => `${n.kind}:${n.id}`)),
    approver: await roleScope('approver', [], async () => []),
  };
  let checked = 0;
  for (const file of FIX) {
    const doc = JSON.parse(readFileSync(resolve(REPO, 'tests/fixtures/management-web', file), 'utf8')) as
      { notices?: Record<string, unknown>[]; notice?: Record<string, unknown> };
    for (const it of doc.notices ?? [doc.notice!]) {
      const subject: NoticeActSubject = {
        state: it['lifecycleState'] as NoticeLifecycleState,
        gated: GATED[it['noticeType'] as string]!, addressedNodeKeys: [node],
      };
      const expected = await noticeActRegistry.permitted({ kind: 'notice', notice: subject }, caller);
      assert.deepEqual([...(it['permittedActions'] as string[])].sort(), [...expected].sort(),
        `${file} ${it['noticeId']} (${it['noticeType']}, ${it['lifecycleState']})`);
      checked++;
    }
  }
  assert.ok(checked >= 4, `only ${checked} items checked`);
});
