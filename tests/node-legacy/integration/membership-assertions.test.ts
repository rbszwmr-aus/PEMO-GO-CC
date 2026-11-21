/**
 * W3 batch 2 -- `group_membership` under ADR-013, and the dedup its removal
 * silently justified.
 *
 * WHAT THIS EXISTS TO PROVE. Before 0123, REMOVING a member was not expressible
 * by the runtime at all: shortening `effective_to` is an UPDATE `pemo_app` does
 * not hold, and appending a closing row was refused by
 * `group_membership_no_overlapping_periods`, because the row it supersedes still
 * asserts a period running to infinity. Both halves were measured at GEN-029.
 *
 * AND ONE THING scope_grant DID NOT NEED. This table is on the JOIN side of
 * grant resolution, so a duplicate membership returns the SAME GRANT TWICE.
 * GEN-024 removed `findGrantsAsAt`'s `SELECT DISTINCT` on a premise this
 * constraint supplied; 0123 removes the constraint and restores the clause, and
 * the set-ness of `scope.grants` gets a LIVE ORACLE here rather than a comment.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import {
  createMembershipCommands, createHistoricalScopeQueries,
} from '../../modules/access/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { administratorScopeAt } from '../../apps/api/dist/testing/administrator-scope.js';

const ORG = 'org_wingfu_holdings';
const GROUP = 'grp_of_one_stf_wfg_manager';
const PRINCIPAL = 'stf_wfg_manager';

let harness: Harness;
let owner: ReturnType<typeof createModuleDb>;
let app: ReturnType<typeof createModuleDb>;
let second: ReturnType<typeof createModuleDb>;

const G_ORG = 'org_w3g';
const G_ADMIN_GROUP = 'grp_w3g_admins';
const G_OTHER_GROUP = 'grp_w3g_other';
const G_EMPTY_GROUP = 'grp_w3g_empty';
const G_ADMIN = 'stf_w3g_admin';
const G_SECOND = 'stf_w3g_second';
const G_ESTATE = 'est_w3g_e';
const G_FAR = 'est_w3g_far';

const buildOrg = async (): Promise<void> => {
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'W3G', 'W3 guard', 'W3 守衛') ON CONFLICT (organization_id) DO NOTHING`, [G_ORG]);
  await owner.query(
    `INSERT INTO property.estate (estate_id, organization_id, name_en, name_zh_hant)
     VALUES ($1, $3, 'E', 'E'), ($2, $3, 'Far', '遠') ON CONFLICT (estate_id) DO NOTHING`,
    [G_ESTATE, G_FAR, G_ORG]);
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $4, 'admins'), ($2, $4, 'other'), ($3, $4, 'empty')
     ON CONFLICT (group_id) DO NOTHING`,
    [G_ADMIN_GROUP, G_OTHER_GROUP, G_EMPTY_GROUP, G_ORG]);
  await owner.query(
    `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1, $3, 'Admin', 'recorded_seed'), ($2, $3, 'Second', 'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`,
    [G_ADMIN, G_SECOND, G_ORG]);
};

/** A live grant, written through the owner handle: the grant surface is W2's, not this file's subject. */
const grantTo = async (id: string, group: string, role: string, node: string): Promise<void> => {
  await owner.query(
    `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('sgra_' || $1, 1, $1, $2, $3, 'estate', $4, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`, [id, group, role, node]);
};

const seat = (membershipId: string, group: string, principal: string,
              reach: readonly string[]) =>
  app.transaction(async (tx) => commands().add(tx, {
    membershipId, groupId: group, principalId: principal,
    effectiveFrom: new Date(Date.now() - 60_000), organizationId: G_ORG,
  }, await administratorScopeAt(...reach)));

const ORG_WIDE: readonly string[] = [`organization:${G_ORG}`, `estate:${G_ESTATE}`, `estate:${G_FAR}`];
/** The same reach as a `GrantAdministratorScope` (ADR-018), built by its one constructor. */
const orgWide = () => administratorScopeAt(...ORG_WIDE);

// ------------------------------------------- the defect the old guard carried


test.before(async () => {
  harness = await startHarness();
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  app = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  second = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  // The batch-3a world. One `before` hook, not two: node:test does not compose
  // file-level hooks the way two separate registrations suggest, and the second
  // ran before `owner` existed.
  await buildOrg();
});

test.after(async () => {
  /**
   * ONE ORDERED TEARDOWN, AND THE PATTERNS ARE ESCAPED.
   *
   * TWO THINGS BIT HERE, both worth the comment.
   *
   * ORDER: `scope_grant` and `group_membership` both reference `user_group`, so
   * the groups cannot go first. The original order deleted groups while grants
   * still pointed at them and failed on the foreign key.
   *
   * `_` IS A WILDCARD IN `LIKE`. `'grp_w3_%'` matches `grp_w3g_admins` — the
   * underscore matched the `g` — so batch 2's teardown was silently reaching
   * into batch 3a's world. Escaped with `LIKE ... ESCAPE`, so the prefixes mean
   * what they look like. This is the `[anchor-the-discriminator]` shape in SQL:
   * a pattern that matches more than it appears to.
   */
  const P = (prefix: string) => `${prefix.replace(/_/g, '\\_')}%`;

  // GEN-057 (F7): the delete-set must cover EXACTLY what setup created. It created
  // gr_w3r AND gr_w3g grants, est_w3r AND est_w3g estates, org_w3r AND org_w3g orgs;
  // the old teardown deleted only the `_w3g` half of each, so the `_w3r` grant
  // survived and its FK choked the (broad) grp_w3% group-delete — the F7 failure.
  // Every prefix is now the family (`_w3%`), matching the group delete's breadth.
  await owner.query(`DELETE FROM scope_grant WHERE grant_id LIKE $1 ESCAPE '\\'`, [P('gr_w3')]);
  await owner.query(`DELETE FROM group_membership WHERE membership_id LIKE $1 ESCAPE '\\'`, [P('mem_w3')]);
  await owner.query(`DELETE FROM user_group WHERE group_id LIKE $1 ESCAPE '\\'`, [P('grp_w3')]);
  await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`, [P('stf_w3')]);
  await owner.query(`DELETE FROM property.estate WHERE estate_id LIKE $1 ESCAPE '\\'`, [P('est_w3')]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id LIKE $1 ESCAPE '\\'`, [P('org_w3')]);

  await owner.close();
  await app.close();
  await second.close();
  await harness.close();
});

const commands = () => createMembershipCommands(app);

/**
 * The actor's expanded administrator reach, for the tests whose subject is the
 * ASSERTION MODEL rather than the gate. `organization:<org>` covers every node in
 * the organization, so G-2 admits and the model is what is being measured. The
 * gate has its own proofs below, including that it REFUSES.
 */
const ANY_NODE: readonly string[] = [`organization:${ORG}`];
const anyNode = () => administratorScopeAt(...ANY_NODE);

/** A group nothing else touches, so a test's subject is the only thing that can refuse it. */
const freshGroup = async (tag: string): Promise<string> => {
  const id = `grp_w3_${tag}`;
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [id, ORG, `W3 ${tag}`]);
  return id;
};

// ------------------------------------------------------------ the capability

test('PRECONDITION -- the runtime cannot UPDATE or DELETE group_membership', async () => {
  // The reason the assertion model was needed. If this becomes true, the design
  // rests on a premise that has silently moved.
  const [row] = await app.query<{ can_update: boolean; can_delete: boolean }>(
    `SELECT has_table_privilege(current_user, 'access.group_membership', 'UPDATE') AS can_update,
            has_table_privilege(current_user, 'access.group_membership', 'DELETE') AS can_delete`);
  assert.equal(row?.can_update, false);
  assert.equal(row?.can_delete, false);
});

test('REMOVAL works: version + 1 is appended, and the resolver answers not-current', async () => {
  const group = await freshGroup('removal');
  const added = await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3_removal', groupId: group, principalId: PRINCIPAL,
    effectiveFrom: new Date('2024-01-01T00:00:00+08:00'), organizationId: ORG,
  }, await anyNode()));
  assert.equal(added.kind, 'added');

  const removed = await app.transaction(async (tx) => commands().remove(tx, {
    membershipId: 'mem_w3_removal', effectiveTo: new Date(Date.now() - 1000),
  }, await anyNode()));
  assert.equal(removed.kind, 'removed');
  assert.equal(removed.kind === 'removed' ? removed.version : 0, 2, 'the removal is version 2');

  // NOTHING WAS UPDATED. The prior assertion is still there, exactly as written.
  const [chain] = await app.query<{ versions: string; open: string }>(
    `SELECT string_agg(version::text, ',' ORDER BY version) AS versions,
            count(*) FILTER (WHERE effective_to IS NULL)::text AS open
       FROM group_membership WHERE membership_id = 'mem_w3_removal'`);
  assert.equal(chain?.versions, '1,2', 'both assertions retained -- the history IS the table');
  assert.equal(chain?.open, '1', 'version 1 still asserts an open period, untouched');

  const current = await commands().findCurrentMembership('mem_w3_removal');
  assert.ok(current?.effectiveTo !== null, 'the current assertion carries an end');
});

test('THE HISTORICAL QUESTION STILL ANSWERS after a removal (ADR-012 D6)', async () => {
  /**
   * The property a removal must not destroy. ADR-007 D4 asks what a person was
   * permitted to see THEN, and with groups that depends on the grant AND the
   * membership as each stood at that instant -- which is why 0115 made
   * membership effective-dated in the first place.
   */
  const history = createHistoricalScopeQueries(app);
  const now = await history.resolveAsAt(PRINCIPAL, new Date());
  const then = await history.resolveAsAt(PRINCIPAL, new Date('2025-01-01T00:00:00+08:00'));
  assert.ok(now, 'the principal resolves now');
  assert.ok(then, 'and resolved then');
  // The seeded membership is untouched by this file, so the manager still has
  // their own grants; the assertion is that BOTH questions answer at all after a
  // removal exists in the table.
  assert.ok(then.grants.length > 0, 'the historical answer is not empty');
});

test('RE-JOINING after removal works -- a NEW instance at version 1', async () => {
  /**
   * THE CASE THE EXCLUSION MADE IMPOSSIBLE. The removed instance's version 1
   * still ASSERTS [t0, infinity), so a new membership at [t2, infinity) overlapped
   * it and was refused -- and adding `version` to the key would not have helped,
   * because a re-join's first assertion is also version 1.
   */
  const again = await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3_rejoin', groupId: 'grp_w3_removal', principalId: PRINCIPAL,
    effectiveFrom: new Date(), organizationId: ORG,
  }, await anyNode()));
  assert.equal(again.kind, 'added', 're-joining the same group after removal is accepted');
  assert.equal(again.kind === 'added' ? again.version : 0, 1, 'a NEW instance, at version 1');
});

test('removing twice is refused, and appends nothing the second time', async () => {
  const group = await freshGroup('twice');
  await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3_twice', groupId: group, principalId: PRINCIPAL,
    effectiveFrom: new Date('2024-01-01T00:00:00+08:00'), organizationId: ORG,
  }, await anyNode()));
  const once = await app.transaction(async (tx) => commands().remove(tx, {
    membershipId: 'mem_w3_twice', effectiveTo: new Date(Date.now() - 1000),
  }, await anyNode()));
  assert.equal(once.kind, 'removed');
  const twice = await app.transaction(async (tx) => commands().remove(tx, {
    membershipId: 'mem_w3_twice', effectiveTo: new Date(Date.now() - 500),
  }, await anyNode()));
  assert.equal(twice.kind, 'not-live');

  const rows = await app.query(`SELECT 1 FROM group_membership WHERE membership_id = 'mem_w3_twice'`);
  assert.equal(rows.length, 2, 'a failed precondition leaves no no-op row in the version chain');
});

test('removing an unknown instance is refused by name', async () => {
  const missing = await app.transaction(async (tx) => commands().remove(tx, {
    membershipId: 'mem_w3_does_not_exist', effectiveTo: new Date(),
  }, await anyNode()));
  assert.equal(missing.kind, 'no-such-membership');
});

// ------------------------------------------- scope.grants IS A SET (the dedup)

/**
 * THE LIVE ORACLE FOR THE RESTORED `DISTINCT`.
 *
 * GEN-029 measured, with the exclusion dropped and one duplicate membership
 * inserted, that the reader returned 3 ROWS FOR 2 DISTINCT GRANTS. 0123 makes
 * that state writable for the first time, so the clause GEN-024 removed is back
 * -- and it needs an assertion that fails when it is removed again, not a comment
 * saying it matters.
 */
const duplicateMembership = async (): Promise<void> => {
  await owner.query(
    `INSERT INTO group_membership
       (assertion_id, version, membership_id, group_id, principal_id, effective_from)
     VALUES ('gma_mem_w3_dupe', 1, 'mem_w3_dupe', $1, $2, '2024-01-01T00:00:00+08:00')`,
    [GROUP, PRINCIPAL]);
};

test('THE DUPLICATE IS NOW WRITABLE -- which is exactly what 0123 changed', async () => {
  // The premise of the next test, asserted rather than assumed: before 0123 this
  // insert was refused by group_membership_no_overlapping_periods.
  await duplicateMembership();
  const rows = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM group_membership
      WHERE group_id = $1 AND principal_id = $2
        AND (effective_to IS NULL OR effective_to > now())`, [GROUP, PRINCIPAL]);
  assert.equal(rows[0]?.n, '2', 'two live memberships of one group for one principal');
});

test('scope.grants IS A SET -- the reader returns each grant once', async () => {
  const resolved = await createHistoricalScopeQueries(app).resolveAsAt(PRINCIPAL, new Date());
  assert.ok(resolved);
  const ids = resolved.grants.map((g) => g.grantId);
  assert.equal(
    ids.length, new Set(ids).size,
    `the reader returned ${ids.length} rows for ${new Set(ids).size} distinct grants -- ` +
    'the duplicate membership multiplied a grant, which is what the restored DISTINCT prevents',
  );
  assert.ok(ids.length > 0, 'and it is not vacuous: the principal holds grants');
  await owner.query(`DELETE FROM group_membership WHERE membership_id = 'mem_w3_dupe'`);
});

// ------------------------------------------------------ the write-path guard

test('the guard refuses a second LIVE membership for one (group, principal)', async () => {
  const group = await freshGroup('conflict');
  const first = await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3_conflict_a', groupId: group, principalId: PRINCIPAL,
    effectiveFrom: new Date(), organizationId: ORG,
  }, await anyNode()));
  assert.equal(first.kind, 'added');

  const dup = await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3_conflict_b', groupId: group, principalId: PRINCIPAL,
    effectiveFrom: new Date(), organizationId: ORG,
  }, await anyNode()));
  assert.equal(dup.kind, 'conflict', 'refused -- and NOT by a constraint, which no longer exists');

  const [n] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM group_membership WHERE membership_id = 'mem_w3_conflict_b'`);
  assert.equal(n?.n, '0', 'the refused act wrote nothing');
});

test('CONCURRENT adds for one (group, principal): exactly one wins', async () => {
  /**
   * A GENUINE RACE -- two pools, two connections. The transaction is HELD OPEN
   * inside the callback, and that line is load-bearing: without it the first
   * commits before the second reads, the two never overlap, and this test passes
   * with the advisory lock deleted (GEN-024's lesson, GEN-025's second half).
   *
   * The membership ids DIFFER, so the act cannot serialise itself on its own
   * primary key -- only the mechanism under test can hold this.
   */
  const group = await freshGroup('race');
  const attempt = (db: ReturnType<typeof createModuleDb>, id: string) =>
    db.transaction(async (tx) => {
      const r = await createMembershipCommands(db).add(tx, {
        membershipId: id, groupId: group, principalId: PRINCIPAL,
        effectiveFrom: new Date(), organizationId: ORG,
      }, await anyNode());
      await new Promise((done) => setTimeout(done, 150)); // LOAD-BEARING: widen the window
      return r;
    });

  const results = await Promise.all([
    attempt(app, 'mem_w3_race_a'),
    attempt(second, 'mem_w3_race_b'),
  ]);
  assert.equal(
    results.filter((r) => r.kind === 'added').length, 1,
    `exactly one add wins, got ${JSON.stringify(results)}`,
  );
  assert.equal(results.filter((r) => r.kind === 'conflict').length, 1, 'the loser is refused, not crashed');

  const [n] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM group_membership WHERE group_id = $1`, [group]);
  assert.equal(n?.n, '1', 'one row landed, not two');
});

// ═══════════════════════════════════════════════════════════════════════════
// W3 BATCH 3a — THE UNIFIED GUARD, AND addMembership's G-2 RULE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A whole organization built for these tests, because the guard's subject is an
 * ORGANIZATION and the seeded one is shared. The principal and group are fixture
 * setup through the OWNER handle (`[fixtures-are-owner-work]`); every act under
 * test runs through the app credential.
 */
test('THE SHIPPED GUARD COUNTED ADMINISTRATORS THAT DO NOT EXIST -- and this one does not', async () => {
  /**
   * GEN-028's measurement, made permanent. An organization whose only
   * `grant_administrator` grant is held by a group with NO MEMBERS:
   *
   *   the old guard (grants only)         reported 1
   *   effective administrators (this one) reports  0
   *
   * The old one would have refused a revocation to protect an administrator who
   * does not exist, while the organization was already unrecoverable.
   */
  await grantTo('gr_w3g_empty_admin', G_EMPTY_GROUP, 'grant_administrator', G_ESTATE);

  // The OLD predicate, spelled out here so the comparison is a measurement and
  // not a memory of one.
  const [oldCount] = await app.query<{ n: string }>(
    `WITH current_assertion AS (
       SELECT DISTINCT ON (g.grant_id) g.*, ug.organization_id FROM scope_grant g
         JOIN user_group ug ON ug.group_id = g.group_id
        WHERE ug.organization_id = $1 ORDER BY g.grant_id, g.version DESC)
     SELECT count(*)::text AS n FROM current_assertion
      WHERE role = 'grant_administrator'
        AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())`, [G_ORG]);
  assert.equal(oldCount?.n, '1', 'the grants-only predicate sees one');

  const witnesses = await harness.modules.grants.effectiveAdministrators(G_ORG);
  assert.equal(witnesses.length, 0, 'and nobody can actually administer anything');

  await owner.query(`DELETE FROM scope_grant WHERE grant_id = 'gr_w3g_empty_admin'`);
});

// ------------------------------------------------- addMembership's G-2 rule

test("addMembership REFUSES when the actor holds no administrator grant anywhere -- the floor", async () => {
  const res = await seat('mem_w3g_floor', G_OTHER_GROUP, G_ADMIN, []);
  assert.equal(res.kind, 'not-an-administrator');
});

test('addMembership REFUSES on ANY unreachable live grant -- never a subset', async () => {
  /**
   * The group holds two live grants: one at an estate the actor administers and
   * one at an estate they do not. Admitting the member would confer the second,
   * which the actor could not have conferred directly -- so the whole act is
   * refused, not the reachable half of it.
   */
  await grantTo('gr_w3g_near', G_OTHER_GROUP, 'estate_staff', G_ESTATE);
  await grantTo('gr_w3g_far', G_OTHER_GROUP, 'estate_staff', G_FAR);

  const partial = await seat('mem_w3g_partial', G_OTHER_GROUP, G_ADMIN, [`estate:${G_ESTATE}`]);
  assert.equal(partial.kind, 'out-of-reach', 'one unreachable grant refuses the whole act');

  const [n] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM group_membership WHERE membership_id = 'mem_w3g_partial'`);
  assert.equal(n?.n, '0', 'and nothing was written');

  const full = await seat('mem_w3g_full', G_OTHER_GROUP, G_ADMIN, ORG_WIDE);
  assert.equal(full.kind, 'added', 'reaching every grant admits the act');
  assert.equal(full.kind === 'added' ? full.liveGrants : -1, 2, 'and it discloses what was conferred');
  assert.equal(full.kind === 'added' ? full.liveMembers : -1, 1, 'and how many now hold it');
});

test('the EMPTY-GROUP case behaves as ruled: admitted with the floor, refused without it', async () => {
  // A group conferring nothing is admissible to an actor who IS an administrator
  // somewhere; the residual pre-positioning risk is named, not guarded.
  const ok = await seat('mem_w3g_empty', G_EMPTY_GROUP, G_SECOND, ORG_WIDE);
  assert.equal(ok.kind, 'added');
  assert.equal(ok.kind === 'added' ? ok.liveGrants : -1, 0, 'the group confers nothing yet');
  await owner.query(`DELETE FROM group_membership WHERE membership_id = 'mem_w3g_empty'`);

  const refused = await seat('mem_w3g_empty2', G_EMPTY_GROUP, G_SECOND, []);
  assert.equal(refused.kind, 'not-an-administrator', 'and never to a non-administrator');
});

test('cross-organization addMembership is refused', async () => {
  const res = await app.transaction(async (tx) => commands().add(tx, {
    membershipId: 'mem_w3g_cross', groupId: GROUP, principalId: G_ADMIN,
    effectiveFrom: new Date(), organizationId: G_ORG,
  }, await orgWide()));
  assert.equal(res.kind, 'no-such-membership', 'a group in another organization is not reachable');
});

// ------------------------------------------------------- the unified guard

test('THE GUARD, ROUTE 1 -- revoking the last effective administrator is refused', async () => {
  await grantTo('gr_w3g_admin', G_ADMIN_GROUP, 'grant_administrator', G_ESTATE);
  const seated = await seat('mem_w3g_admin', G_ADMIN_GROUP, G_ADMIN, ORG_WIDE);
  assert.equal(seated.kind, 'added');

  const witnesses = await harness.modules.grants.effectiveAdministrators(G_ORG);
  assert.equal(witnesses.length, 1, 'exactly one effective administrator');

  const res = await app.transaction(async (tx) => harness.modules.grants.revoke(
    tx, { grantId: 'gr_w3g_admin', effectiveTo: new Date() }, await administratorScopeAt(`estate:${G_ESTATE}`)));
  assert.equal(res.kind, 'last-administrator');
});

test('THE GUARD, ROUTE 2 -- removing the last effective administrator is refused', async () => {
  // THE DOOR THE SHIPPED GUARD DID NOT COVER: no grant is revoked at all, and the
  // organization is equally unadministrable.
  const res = await app.transaction(async (tx) => commands().remove(tx, { membershipId: 'mem_w3g_admin', effectiveTo: new Date() }, await orgWide()));
  assert.equal(res.kind, 'last-administrator');

  const rows = await app.query(
    `SELECT 1 FROM group_membership WHERE membership_id = 'mem_w3g_admin'`);
  assert.equal(rows.length, 1, 'and nothing was appended');
});

test('A NON-LAST administrator may be removed by EITHER route', async () => {
  await grantTo('gr_w3g_admin2', G_OTHER_GROUP, 'grant_administrator', G_ESTATE);
  await seat('mem_w3g_admin2', G_OTHER_GROUP, G_SECOND, ORG_WIDE);
  // THE WITNESS IS PER (principal x grant), not per principal: G_OTHER_GROUP now
  // holds an administrator grant and has TWO members, so it contributes two rows.
  // That is the shape the guard needs — "would this act remove the last REASON
  // anyone can administer" — and asserting a bare count here was my error, not
  // the code's.
  const before = await harness.modules.grants.effectiveAdministrators(G_ORG);
  assert.ok(before.length > 1, `expected more than one witness, got ${before.length}`);
  assert.ok(
    new Set(before.map((w) => w.principalId)).size > 1,
    'and more than one PERSON, or removing one is still the last administrator',
  );

  const removed = await app.transaction(async (tx) => commands().remove(tx, { membershipId: 'mem_w3g_admin2', effectiveTo: new Date() }, await orgWide()));
  assert.equal(removed.kind, 'removed', 'route 2 allows a non-last removal');

  await seat('mem_w3g_admin3', G_OTHER_GROUP, G_SECOND, ORG_WIDE);
  const revoked = await app.transaction(async (tx) => harness.modules.grants.revoke(
    tx, { grantId: 'gr_w3g_admin2', effectiveTo: new Date() }, await administratorScopeAt(`estate:${G_ESTATE}`)));
  assert.equal(revoked.kind, 'revoked', 'route 1 allows a non-last revocation');
});

test('NO OVER-REACH -- a non-administrator act elsewhere in the tree is unaffected', async () => {
  await grantTo('gr_w3g_staff', G_OTHER_GROUP, 'approver', G_FAR);
  const res = await app.transaction(async (tx) => harness.modules.grants.revoke(
    tx, { grantId: 'gr_w3g_staff', effectiveTo: new Date() }, await administratorScopeAt(`estate:${G_FAR}`)));
  assert.equal(res.kind, 'revoked', 'the guard must not refuse a non-administrator revocation');

  const removed = await app.transaction(async (tx) => commands().remove(tx, { membershipId: 'mem_w3g_full', effectiveTo: new Date() }, await orgWide()));
  assert.equal(removed.kind, 'removed', 'nor a non-administrator membership removal');
});

test('THE CROSS-ROUTE RACE -- concurrent revoke + removeMembership: exactly one is refused', async () => {
  /**
   * THE RESIDUAL RACE GEN-030 NAMED, AND THE ORG LOCK THAT CLOSES IT.
   *
   * The two routes take DIFFERENT per-key locks -- `revokeGrant` on
   * (group, role, node), `removeMembership` on (group, principal) -- so neither
   * contends with the other. With exactly two DISTINCT witnesses, one act
   * removing each, both read a world in which the other still exists, both
   * conclude they are not the last, and both commit: ZERO effective
   * administrators, and an organization nothing can recover.
   *
   * THE TRANSACTIONS ARE HELD OPEN inside the callbacks, and that is
   * load-bearing: two fast calls issued together do not overlap -- the first
   * commits before the second reads -- and this test would pass with the
   * organization lock deleted, measuring sequential execution
   * (`[probe-must-bite]`, the concurrency note).
   *
   * The two acts also touch DIFFERENT groups, so nothing but the organization
   * lock can serialise them.
   */
  const R_ORG = 'org_w3r';
  const R_G1 = 'grp_w3r_one';
  const R_G2 = 'grp_w3r_two';
  const R_P1 = 'stf_w3r_one';
  const R_P2 = 'stf_w3r_two';
  const R_EST = 'est_w3r';

  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'W3R', 'W3 race', 'W3 競態') ON CONFLICT (organization_id) DO NOTHING`, [R_ORG]);
  await owner.query(
    `INSERT INTO property.estate (estate_id, organization_id, name_en, name_zh_hant)
     VALUES ($1, $2, 'R', 'R') ON CONFLICT (estate_id) DO NOTHING`, [R_EST, R_ORG]);
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $3, 'one'), ($2, $3, 'two') ON CONFLICT (group_id) DO NOTHING`, [R_G1, R_G2, R_ORG]);
  await owner.query(
    `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1, $3, 'One', 'recorded_seed'), ($2, $3, 'Two', 'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`, [R_P1, R_P2, R_ORG]);
  for (const [g, p, m, gr] of [[R_G1, R_P1, 'mem_w3r_one', 'gr_w3r_one'],
                               [R_G2, R_P2, 'mem_w3r_two', 'gr_w3r_two']] as const) {
    await owner.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_' || $1, 1, $1, $2, 'grant_administrator', 'estate', $3, now() - interval '1 day')
       ON CONFLICT (grant_id, version) DO NOTHING`, [gr, g, R_EST]);
    await owner.query(
      `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
       VALUES ('gma_' || $1, 1, $1, $2, $3, now() - interval '1 day')
       ON CONFLICT (membership_id, version) DO NOTHING`, [m, g, p]);
  }

  const witnesses = await harness.modules.grants.effectiveAdministrators(R_ORG);
  assert.equal(witnesses.length, 2, 'the premise: exactly two DISTINCT witnesses');
  assert.equal(new Set(witnesses.map((w) => w.grantId)).size, 2, 'different grants');
  assert.equal(new Set(witnesses.map((w) => w.membershipId)).size, 2, 'and different memberships');

  const HOLD = 200;
  const viaRevoke = app.transaction(async (tx) => {
    const r = await harness.modules.grants.revoke(
      tx, { grantId: 'gr_w3r_one', effectiveTo: new Date() }, await administratorScopeAt(`estate:${R_EST}`));
    await new Promise((d) => setTimeout(d, HOLD)); // LOAD-BEARING: widen the window
    return r.kind;
  });
  const viaMembership = second.transaction(async (tx) => {
    const r = await createMembershipCommands(second).remove(
      tx, { membershipId: 'mem_w3r_two', effectiveTo: new Date() },
      await administratorScopeAt(`organization:${R_ORG}`, `estate:${R_EST}`));
    await new Promise((d) => setTimeout(d, HOLD)); // LOAD-BEARING
    return r.kind;
  });

  const kinds = await Promise.all([viaRevoke, viaMembership]);
  assert.equal(
    kinds.filter((k) => k === 'last-administrator').length, 1,
    `exactly one route must be refused, got ${kinds.join(', ')}`,
  );

  const after = await harness.modules.grants.effectiveAdministrators(R_ORG);
  assert.ok(
    after.length >= 1,
    'the organization must keep at least one effective administrator -- zero is unrecoverable',
  );

  await owner.query(`DELETE FROM scope_grant WHERE grant_id LIKE $1 ESCAPE '\\'`, ['gr\\_w3r%']);
  await owner.query(`DELETE FROM group_membership WHERE membership_id LIKE $1 ESCAPE '\\'`, ['mem\\_w3r%']);
  await owner.query(`DELETE FROM user_group WHERE group_id LIKE $1 ESCAPE '\\'`, ['grp\\_w3r%']);
  await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`, ['stf\\_w3r%']);
  await owner.query(`DELETE FROM property.estate WHERE estate_id = $1`, [R_EST]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [R_ORG]);
});
