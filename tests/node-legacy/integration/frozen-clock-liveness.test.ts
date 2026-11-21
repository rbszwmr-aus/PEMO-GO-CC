/**
 * THE FROZEN-CLOCK LIVENESS BITES (GEN-057).
 *
 * A guard that runs behind a serialising lock reads liveness AFTER it has waited
 * for the winner to commit. If that read filters on `now()` -- PostgreSQL's
 * `transaction_timestamp()`, FROZEN at the transaction's start -- it evaluates
 * "is it live" as of a clock from BEFORE the wait, so a grant that expired while
 * the guard was blocked still counts as live. For `effectiveAdministrators` that
 * is the GEN-030 zero-administrator lockout (both routes conclude "not the last"
 * and commit); for `mayAdministerGroup` it is a floor decided against a grant the
 * group no longer confers. The fix reads liveness with `clock_timestamp()`.
 *
 * THESE TESTS ARE DETERMINISTIC, NOT RACES. Each runs ONE transaction whose
 * `now()` is frozen at its start, supersedes a grant to expire at `now() + 40ms`,
 * sleeps 150ms so `clock_timestamp()` is provably past the expiry, then calls the
 * real guard query on that transaction. Under `clock_timestamp()` the grant is
 * gone; under `now()` it is still "live". Revert either predicate to `now()` and
 * the matching test reds for its own reason -- the frozen clock counts an expired
 * grant as live. (`docs/governance/mutations/manifest.json`.)
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { effectiveAdministrators, mayAdministerGroup } from '../../modules/access/dist/index.js';
import { administratorScopeAt } from '../../apps/api/dist/testing/administrator-scope.js';

const ORG = 'org_fc';
const EST = 'est_fc';
// Site 1 fixtures: effectiveAdministrators (the lockout guard).
const A_GROUP = 'grp_fc_admin';
const A_PRINC = 'stf_fc_admin';
const A_GRANT = 'gr_fc_admin';
const A_MEMB = 'mem_fc_admin';
// Site 2 fixtures: mayAdministerGroup (the delegation floor).
const F_GROUP = 'grp_fc_floor';
const F_GRANT = 'gr_fc_floor';

let owner: ReturnType<typeof createModuleDb>;
let app: ReturnType<typeof createModuleDb>;

const P = (prefix: string) => `${prefix.replace(/_/g, '\\_')}%`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  app = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });

  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'FC', 'Frozen Clock', '凍鐘') ON CONFLICT (organization_id) DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO property.estate (estate_id, organization_id, name_en, name_zh_hant)
     VALUES ($1, $2, 'E', 'E') ON CONFLICT (estate_id) DO NOTHING`, [EST, ORG]);
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $3, 'admins'), ($2, $3, 'floor') ON CONFLICT (group_id) DO NOTHING`,
    [A_GROUP, F_GROUP, ORG]);
  await owner.query(
    `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source)
     VALUES ($1, $2, 'Admin', 'recorded_seed') ON CONFLICT (principal_id) DO NOTHING`, [A_PRINC, ORG]);

  // Site 1: one live effective administrator (grant + membership, both open-ended).
  await owner.query(
    `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('sgra_' || $1, 1, $1, $2, 'grant_administrator', 'estate', $3, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`, [A_GRANT, A_GROUP, EST]);
  await owner.query(
    `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
     VALUES ('gma_' || $1, 1, $1, $2, $3, now() - interval '1 day')
     ON CONFLICT (membership_id, version) DO NOTHING`, [A_MEMB, A_GROUP, A_PRINC]);

  // Site 2: the floor group holds exactly one live grant, at estate:EST.
  await owner.query(
    `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('sgra_' || $1, 1, $1, $2, 'grant_administrator', 'estate', $3, now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`, [F_GRANT, F_GROUP, EST]);
});

test.after(async () => {
  // D3: delete EXACTLY the family this file creates, LIKE-escaped so `_` is literal.
  await owner.query(`DELETE FROM scope_grant WHERE grant_id LIKE $1 ESCAPE '\\'`, [P('gr_fc')]);
  await owner.query(`DELETE FROM group_membership WHERE membership_id LIKE $1 ESCAPE '\\'`, [P('mem_fc')]);
  await owner.query(`DELETE FROM user_group WHERE group_id LIKE $1 ESCAPE '\\'`, [P('grp_fc')]);
  await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`, [P('stf_fc')]);
  await owner.query(`DELETE FROM property.estate WHERE estate_id LIKE $1 ESCAPE '\\'`, [P('est_fc')]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id LIKE $1 ESCAPE '\\'`, [P('org_fc')]);
});

test('[probe-must-bite] EFFECTIVE_ADMINISTRATORS reads liveness at clock_timestamp, not the frozen now()', async () => {
  // Premise: the organization has exactly one effective administrator.
  const before = await effectiveAdministrators(app, ORG);
  assert.equal(before.length, 1, 'premise: one live effective administrator');

  // One transaction, now() frozen at its start. Supersede the grant so its CURRENT
  // version expires at now()+40ms, then sleep past that instant. clock_timestamp()
  // is now provably after the expiry; now() is still the transaction's start.
  await app.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from, effective_to)
       VALUES ('sgra2_' || $1, 2, $1, $2, 'grant_administrator', 'estate', $3,
               now() - interval '1 day', now() + interval '40 milliseconds')`,
      [A_GRANT, A_GROUP, EST]);
    await sleep(150);
    const witnesses = await effectiveAdministrators(tx, ORG);
    assert.equal(
      witnesses.length, 0,
      'a grant that expired ~110ms before this read must NOT count as a live administrator; ' +
        'only now() (frozen at the transaction start, before the expiry) would still see it live',
    );
  });
});

test('[probe-must-bite] mayAdministerGroup floor reads the group\'s live grants at clock_timestamp, not now()', async () => {
  // A caller who administers estate:EST but NOT the organization node.
  const scope = await administratorScopeAt(`estate:${EST}`);

  await app.transaction(async (tx) => {
    // Supersede the floor group's only grant so it expires at now()+40ms.
    await tx.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from, effective_to)
       VALUES ('sgra2_' || $1, 2, $1, $2, 'grant_administrator', 'estate', $3,
               now() - interval '1 day', now() + interval '40 milliseconds')`,
      [F_GRANT, F_GROUP, EST]);
    await sleep(150);
    const floor = await mayAdministerGroup(tx, F_GROUP, ORG, scope);
    // The grant has expired, so the group confers nothing: the empty-group fallback
    // must fire and require the organization node (which this caller lacks). Under
    // now() the expired grant still lists estate:EST, the caller covers it, and the
    // floor wrongly admits without the fallback.
    assert.equal(
      floor.viaEmptyGroupFallback, true,
      'an expired grant must leave the group grantless and trigger the org-node fallback; ' +
        'now() would still count the grant and skip the fallback',
    );
    assert.equal(floor.admitted, false, 'and the caller, lacking the organization node, is refused');
  });
});
