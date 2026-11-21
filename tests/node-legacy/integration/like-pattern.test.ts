/**
 * `R5b`/`H1` — a `LIKE` pattern built by `likePattern` matches its input LITERALLY.
 *
 * The static check (`like-escape.sh`) can only see that a call site accounts for
 * its wildcards. Whether the escaping is CORRECT is a question about behaviour,
 * and only the database can answer it — so these run against real rows.
 *
 * The bug being tested is not hypothetical: `GEN-014` deleted rows a test did not
 * own, and `GEN-029` had `grp_w3_%` match `grp_w3g_admins`, because `_` is a
 * wildcard and every identifier here contains one.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  createModuleDb, loadConfig, likePattern, likePrefix, likeEscapeClause,
} from '../../modules/platform/dist/index.js';

let owner: ReturnType<typeof createModuleDb>;

/** The GEN-029 shape exactly: a prefix, and a neighbour a bare `_` would reach. */
const OWNED   = 'grp_h1_target';
const NEIGHBOUR = 'grp_h1x_neighbour';

test.before(async () => {
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ('org_h1', 'H1', 'H1', 'H1') ON CONFLICT (organization_id) DO NOTHING`);
  for (const g of [OWNED, NEIGHBOUR]) {
    await owner.query(
      `INSERT INTO user_group (group_id, organization_id, display_name)
       VALUES ($1, 'org_h1', $1) ON CONFLICT (group_id) DO NOTHING`, [g]);
  }
});

test.after(async () => {
  await owner.query(`DELETE FROM user_group WHERE organization_id = 'org_h1'`);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id = 'org_h1'`);
  await owner.close();
});

test('a built prefix reaches only what it names', async () => {
  const rows = await owner.query<{ group_id: string }>(
    `SELECT group_id FROM user_group WHERE group_id LIKE $1 ${likeEscapeClause} ORDER BY 1`,
    [likePrefix('grp_h1_')]);
  assert.deepEqual(rows.map((r) => r.group_id), [OWNED],
    'the neighbour must NOT be reached — this is the GEN-029 failure');
});

test('THE MUTATION THIS GUARDS: an unescaped prefix over-reaches', async () => {
  // Written out rather than described, so the test states the danger instead of
  // asserting only the safe case. A guard whose "before" is invisible is a guard
  // nobody can evaluate.
  // like-wildcard: UNESCAPED ON PURPOSE — this test's entire subject is what the
  // wildcard does. The marker is here rather than an exemption in the check,
  // because "deliberate" is a fact about this line that only this line knows.
  const rows = await owner.query<{ group_id: string }>(
    `SELECT group_id FROM user_group WHERE group_id LIKE 'grp_h1_%' ORDER BY 1`);
  // Compared as a SET. Collation is not this test's subject, and asserting an
  // order here would make the test fail for a reason that has nothing to do with
  // wildcards — it did exactly that on the first run, `_` (0x5F) sorting before
  // `x` (0x78).
  assert.deepEqual([...rows.map((r) => r.group_id)].sort(), [OWNED, NEIGHBOUR].sort(),
    'unescaped, `_` matches the `x` too — which is exactly why likePrefix exists');
});

test('likePattern escapes the backslash FIRST', () => {
  // Order matters and is easy to get wrong: escaping `_` before `\` would turn
  // `\_` into `\\_` — a literal backslash followed by ANY character. No test of
  // ordinary identifiers would ever notice.
  assert.equal(likePattern('a_b'), 'a\\_b');
  assert.equal(likePattern('50%'), '50\\%');
  assert.equal(likePattern('c:\\x'), 'c:\\\\x');
  assert.equal(likePattern('a\\_b'), 'a\\\\\\_b');
});

test('a literal underscore in input matches only itself', async () => {
  const one = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM user_group WHERE group_id LIKE $1 ${likeEscapeClause}`,
    [likePattern(OWNED)]);
  assert.equal(one[0]?.n, '1');

  // And a pattern for a name that does not exist finds nothing, even though a
  // wildcard reading of it would match the one that does.
  const none = await owner.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM user_group WHERE group_id LIKE $1 ${likeEscapeClause}`,
    [likePattern('grp?h1?target')]);
  assert.equal(none[0]?.n, '0');
});
