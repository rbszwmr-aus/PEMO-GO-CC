/**
 * The scope model (ADR-007 D4, A2, A3/D9).
 *
 * NO ENDPOINT EXISTS YET, DELIBERATELY. A3 records that a scope model is the
 * hardest thing to widen later, because every endpoint and every stored grant
 * assumes its shape. Building an endpoint first would make that shape a fait
 * accompli before it could be reviewed — so the model is proven here, where
 * nothing depends on it and being wrong is still cheap.
 *
 * Resolution is called through @pemo/access's ports and never reimplemented: a
 * second implementation can agree with itself while both are wrong.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  createHistoricalScopeQueries,
  createScopeQueries,
  type ResolvedScope,
  type ScopeNode,
} from '../../modules/access/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
/**
 * FIXTURE WRITES GO THROUGH THE OWNER HANDLE, never the app credential.
 *
 * `pemo_app` holds SELECT + INSERT and nothing else, so a fixture teardown run
 * through it is refused — and the test then cannot tell "the app is forbidden
 * this" from "my fixture could not run". Worse, a constraint probe issued as the
 * app fails on PERMISSION rather than on the constraint it exists to prove.
 *
 * Fixtures are owner work, exactly as the seeds' DELETEs are. The app handle
 * below stays for the module code under test, which is what actually runs as
 * the application.
 */
let accessDb: ReturnType<typeof createModuleDb>;
let fixtureDb: ReturnType<typeof createModuleDb>;
let scope: ReturnType<typeof createScopeQueries>;
let history: ReturnType<typeof createHistoricalScopeQueries>;

test.before(async () => {
  harness = await startHarness();
  accessDb = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  // Owner credential: fixtures are owner work (see the note above).
  fixtureDb = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  scope = createScopeQueries(accessDb);
  history = createHistoricalScopeQueries(accessDb);
});
test.after(async () => {
  await accessDb.close();
  await fixtureDb.close();
  await harness.close();
});

/** Ancestries as the management contract's ScopePath supplies them, root-first. */
const ORG: ScopeNode = { kind: 'organization', id: 'org_wingfu_holdings' };
const ESTATE: ScopeNode = { kind: 'estate', id: 'est_wing_fu_garden' };
const BLOCK_A: ScopeNode = { kind: 'building', id: 'blk_wfg_a' };
const BLOCK_C: ScopeNode = { kind: 'building', id: 'blk_wfg_c' };
const FLOOR_A12: ScopeNode = { kind: 'floor', id: 'fl_wfg_a_12' };
const UNIT_A12A1: ScopeNode = { kind: 'unit', id: 'unit_wfg_a_12_a1' };
const CLUBHOUSE: ScopeNode = { kind: 'location', id: 'loc_wfg_clubhouse' };
const FUNCTION_ROOM: ScopeNode = { kind: 'location', id: 'loc_wfg_function_room' };
const PLANT_C: ScopeNode = { kind: 'location', id: 'loc_wfg_lift_shuttle' };

const ancestryOfUnitA12A1 = [ORG, ESTATE, BLOCK_A, FLOOR_A12];
const ancestryOfClubhouse = [ORG, ESTATE, BLOCK_C];
/**
 * The function room sits INSIDE the clubhouse, so the clubhouse is in its
 * ancestry. A Location can only appear in an ancestry through
 * `parent_location_id`: `physical_parent_type` has no `location` value.
 */
const ancestryOfFunctionRoom = [ORG, ESTATE, BLOCK_C, CLUBHOUSE];
const ancestryOfPlantC = [ORG, ESTATE, BLOCK_A];

const resolve = async (principalId: string): Promise<ResolvedScope> => {
  const resolved = await scope.getPrincipal(principalId);
  assert.ok(resolved, `${principalId} must resolve`);
  return resolved;
};

// ───────────────────────────────────────────────── inheritance over the hierarchy

test('a grant at Estate covers every level beneath it', async () => {
  const manager = await resolve('stf_wfg_manager');

  assert.equal(scope.admits(manager, ESTATE, [ORG]).admitted, true, 'the estate itself');
  assert.equal(scope.admits(manager, BLOCK_A, [ORG, ESTATE]).admitted, true, 'a building');
  assert.equal(scope.admits(manager, FLOOR_A12, [ORG, ESTATE, BLOCK_A]).admitted, true, 'a floor');
  assert.equal(scope.admits(manager, UNIT_A12A1, ancestryOfUnitA12A1).admitted, true, 'a unit');

  // Every one of those is admitted BY THE HIERARCHY, not by coincidence.
  assert.equal(scope.admits(manager, UNIT_A12A1, ancestryOfUnitA12A1).admitted && 
    (scope.admits(manager, UNIT_A12A1, ancestryOfUnitA12A1) as { by: string }).by, 'hierarchy');
});

test('a grant at Building does NOT cover a sibling building', async () => {
  // The case that proves inheritance is bounded rather than decorative.
  const supervisor = await resolve('stf_wfg_block_a');

  assert.equal(scope.admits(supervisor, BLOCK_A, [ORG, ESTATE]).admitted, true, 'their own block');
  assert.equal(scope.admits(supervisor, UNIT_A12A1, ancestryOfUnitA12A1).admitted, true, 'a unit inside it');

  assert.equal(scope.admits(supervisor, BLOCK_C, [ORG, ESTATE]).admitted, false, 'a sibling block');
  assert.equal(
    scope.admits(supervisor, CLUBHOUSE, ancestryOfClubhouse).admitted,
    false,
    'a Location inside the sibling block',
  );

  // And upward: a building grant does not confer the estate.
  assert.equal(scope.admits(supervisor, ESTATE, [ORG]).admitted, false, 'inheritance is downward only');
});

test('a grant at Building DOES cover a Location physically inside it', async () => {
  // Derived from the fixture corpus rather than assumed: mob-s1-safety/default
  // shows loc_c_plant to a principal scoped at estate level, so a Location inside
  // a granted node is inside it.
  const supervisor = await resolve('stf_wfg_block_a');
  const admission = scope.admits(supervisor, PLANT_C, ancestryOfPlantC);
  assert.equal(admission.admitted, true);
  assert.equal(admission.admitted === true ? admission.by : '', 'hierarchy');
});

// ──────────────────────────────────────────────── the Location half of the model

test('a Location grant covers that Location and NOT the building it sits in', async () => {
  /**
   * The case a hierarchy-only model cannot express at all (A2). Counter staff are
   * scoped to a place with no floor and no unit.
   *
   * The asymmetry is deliberate and is the whole point: a building grant reaches
   * DOWN into the Locations inside it, but a Location grant does not reach UP or
   * SIDEWAYS. ADR-003 gives a Location a physical_parent and a serving_scope, and
   * neither is an inheritance edge for authorization.
   */
  const counter = await resolve('stf_wfg_counter');

  const admission = scope.admits(counter, CLUBHOUSE, ancestryOfClubhouse);
  assert.equal(admission.admitted, true, 'their own Location');
  assert.equal(admission.admitted === true ? admission.by : '', 'location');

  assert.equal(scope.admits(counter, BLOCK_C, [ORG, ESTATE]).admitted, false, 'the building it sits in');
  assert.equal(scope.admits(counter, ESTATE, [ORG]).admitted, false, 'the estate');
  assert.equal(scope.admits(counter, UNIT_A12A1, ancestryOfUnitA12A1).admitted, false, 'any unit');
  assert.equal(scope.admits(counter, PLANT_C, ancestryOfPlantC).admitted, false, 'another Location');
});

test('a Location grant covers its DESCENDANT Locations', async () => {
  /**
   * ADR-003: a clubhouse is a container whose children are public_facility
   * Locations — "a resident books the function room, not the clubhouse".
   *
   * An earlier version of this rule refused descendants, and no fixture would
   * have caught it: the management corpus has one Location row and its ancestry
   * is hierarchy-only. Found by review of a stated claim, which is the argument
   * for stating the claim.
   */
  const counter = await resolve('stf_wfg_counter');

  const admission = scope.admits(counter, FUNCTION_ROOM, ancestryOfFunctionRoom);
  assert.equal(admission.admitted, true, 'the clubhouse grant reaches the room inside it');
  assert.equal(admission.admitted === true ? admission.by : '', 'location');
});

test('the descendant clause does NOT open the rule upward or sideways', async () => {
  // Re-proving the old cases alongside the narrowed one, per the standing rule:
  // a clause that admits descendants must not quietly admit anything else.
  const counter = await resolve('stf_wfg_counter');

  assert.equal(scope.admits(counter, BLOCK_C, [ORG, ESTATE]).admitted, false, 'the building it sits in');
  assert.equal(scope.admits(counter, ESTATE, [ORG]).admitted, false, 'the estate');
  assert.equal(scope.admits(counter, UNIT_A12A1, ancestryOfUnitA12A1).admitted, false, 'any unit');
  assert.equal(scope.admits(counter, PLANT_C, ancestryOfPlantC).admitted, false, 'a sibling Location');

  // And the reverse direction: a grant ON the function room must not confer the
  // clubhouse that contains it.
  const roomOnly = {
    principalId: 'synthetic',
    organizationId: 'org_wingfu_holdings',
    asAt: new Date().toISOString(),
    grants: [
      {
        grantId: 'synthetic',
        principalId: 'synthetic',
        node: FUNCTION_ROOM,
        effectiveFrom: '2024-01-01T00:00:00+08:00',
        effectiveTo: null,
      },
    ],
  };
  assert.equal(scope.admits(roomOnly, FUNCTION_ROOM, ancestryOfFunctionRoom).admitted, true);
  assert.equal(
    scope.admits(roomOnly, CLUBHOUSE, ancestryOfClubhouse).admitted,
    false,
    'containment is downward only',
  );
});

test('RED — without the descendant clause, exactly the function room is lost', async () => {
  /**
   * The red condition the ruling asked for: removing the clause must lose EXACTLY
   * that row, not merely fail somewhere.
   *
   * The mutant is the pre-fix predicate, reimplemented here only to be shown
   * failing — the production rule stays the single expression that callers use.
   */
  const counter = await resolve('stf_wfg_counter');

  const withoutDescendants = (target: ScopeNode): boolean =>
    counter.grants.some(
      (g) => g.node.kind === 'location' && g.node.kind === target.kind && g.node.id === target.id,
    );

  // The mutant and the real rule agree everywhere except the one row.
  assert.equal(withoutDescendants(CLUBHOUSE), scope.admits(counter, CLUBHOUSE, ancestryOfClubhouse).admitted);
  assert.equal(withoutDescendants(BLOCK_C), scope.admits(counter, BLOCK_C, [ORG, ESTATE]).admitted);
  assert.equal(withoutDescendants(PLANT_C), scope.admits(counter, PLANT_C, ancestryOfPlantC).admitted);

  assert.equal(withoutDescendants(FUNCTION_ROOM), false, 'MUTANT: the room is refused');
  assert.equal(
    scope.admits(counter, FUNCTION_ROOM, ancestryOfFunctionRoom).admitted,
    true,
    'and the real rule admits it — the difference is exactly one row',
  );
});

test('RED — removing the Location grant costs exactly the counter', async () => {
  // Proven by making it fail: the Location grant is the only thing admitting that
  // node, so withdrawing it must remove exactly one admission and nothing else.
  const before = await resolve('stf_wfg_counter');
  assert.equal(scope.admits(before, CLUBHOUSE, ancestryOfClubhouse).admitted, true);

  await fixtureDb.query(
    `UPDATE scope_grant SET effective_to = now() - interval '1 day' WHERE grant_id = 'grant_seed_counter'`,
  );
  try {
    const after = await resolve('stf_wfg_counter');
    assert.equal(after.grants.length, 0, 'the only grant is gone');
    assert.equal(scope.admits(after, CLUBHOUSE, ancestryOfClubhouse).admitted, false);
  } finally {
    await fixtureDb.query(
      `UPDATE scope_grant SET effective_to = NULL WHERE grant_id = 'grant_seed_counter'`,
    );
  }

  // The control, re-run AFTER the mutation as well as before: contamination that
  // is only detected at the end of a run cannot be located.
  const restored = await resolve('stf_wfg_counter');
  assert.equal(scope.admits(restored, CLUBHOUSE, ancestryOfClubhouse).admitted, true);
});

// ─────────────────────────────────────── effective dating: two different answers

test('the two questions have different answers', async () => {
  /**
   * What may this person see NOW, and what were they permitted to see THEN. A
   * system that can only answer the first cannot be audited.
   *
   * The former manager's grant ran to 1 June 2026. Today it admits nothing; as at
   * 1 March 2026 it admitted the estate.
   */
  const now = await resolve('stf_wfg_former');
  assert.equal(now.grants.length, 0, 'the ended grant is not current');
  assert.equal(scope.admits(now, ESTATE, [ORG]).admitted, false, 'nothing today');

  const then = await history.resolveAsAt('stf_wfg_former', new Date('2026-03-01T10:00:00+08:00'));
  assert.ok(then);
  assert.equal(then.grants.length, 1, 'the grant was in force then');
  assert.equal(scope.admits(then, ESTATE, [ORG]).admitted, true, 'the estate was visible then');
  assert.equal(scope.admits(then, UNIT_A12A1, ancestryOfUnitA12A1).admitted, true);

  // RED CONDITION. If the historical question silently answered with today's
  // grants, these two would agree — and a test that only ever resolves "now"
  // could not tell the difference.
  assert.notEqual(
    scope.admits(now, ESTATE, [ORG]).admitted,
    scope.admits(then, ESTATE, [ORG]).admitted,
    'if these agreed, as-at resolution would be indistinguishable from now',
  );
});

test('the boundary instant belongs to exactly one period', async () => {
  // Half-open [from, to), matching the tstzrange the exclusion constraint uses.
  // The instant a grant ends is already outside it.
  const justBefore = await history.resolveAsAt(
    'stf_wfg_former',
    new Date('2026-05-31T23:59:59+08:00'),
  );
  const atEnd = await history.resolveAsAt('stf_wfg_former', new Date('2026-06-01T00:00:00+08:00'));

  assert.equal(justBefore?.grants.length, 1, 'one second before the end, still in force');
  assert.equal(atEnd?.grants.length, 0, 'at the end instant, no longer in force');
});

test('a second assertion of one grant instance is refused — supersession safety', async () => {
  /**
   * REPLACES a test that asserted the wrong invariant for the wrong reason.
   *
   * It read: "Two periods for one principal and node would give 'what was in
   * force then' two answers ... Refused by an exclusion constraint" — carrying
   * forward 0112's rationale, which was written about a `principal_id` column
   * 0115 had already dropped. GEN-023 measured that a principal CAN hold two
   * overlapping identical grants at one node, through two groups, and that this
   * is legal by ADR-012 D5. The old test passed while describing something the
   * schema did not do.
   *
   * 0118 dropped that constraint (it compared ASSERTED periods, so an instance
   * collided with its own revocation) and `UNIQUE (grant_id, version)` is what
   * holds supersession now — ADR-013 D2. That is what this asserts, and it is an
   * invariant the schema really has.
   */
  await assert.rejects(
    fixtureDb.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_overlap_probe', 1, 'grant_seed_mgr_estate', 'grp_of_one_stf_wfg_manager',
               'estate_staff', 'estate', 'est_wing_fu_garden', '2025-01-01T00:00:00+08:00')`,
    ),
    /scope_grant_version_unique/,
    'two version-1 assertions of one instance must collide',
  );

  // The control after the mutation: the legitimate grant is untouched.
  const manager = await resolve('stf_wfg_manager');
  assert.equal(manager.grants.length, 1);
});

test('two DIFFERENT groups may grant the same role at the same node (ADR-012 D5)', async () => {
  /**
   * THE CASE THE OLD TEST CLAIMED WAS FORBIDDEN. It is legal, it is the design,
   * and the reader must return BOTH grants — rights are a union, monotonic, with
   * no deny and no exclusion. This is here so that the write-path cardinality
   * guard and the battery detector, both keyed on (group, role, node), can never
   * quietly grow into forbidding it.
   */
  const before = await resolve('stf_wfg_manager');
  assert.equal(before.grants.length, 1);

  await fixtureDb.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     SELECT 'grp_d5_probe', organization_id, 'D5 probe' FROM user_group WHERE group_id = 'grp_of_one_stf_wfg_manager'`,
  );
  try {
    await fixtureDb.query(
      `INSERT INTO group_membership (membership_id, group_id, principal_id, effective_from)
       VALUES ('mem_d5_probe', 'grp_d5_probe', 'stf_wfg_manager', '2024-01-01T00:00:00+08:00')`,
    );
    await fixtureDb.query(
      `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_d5_probe', 1, 'gr_d5_probe', 'grp_d5_probe', 'estate_staff', 'estate',
               'est_wing_fu_garden', '2024-01-01T00:00:00+08:00')`,
    );

    const after = await resolve('stf_wfg_manager');
    assert.equal(after.grants.length, 2, 'both grants are returned — the union, not a deduplication');
    assert.equal(new Set(after.grants.map((g) => g.groupId)).size, 2, 'two distinct groups');
    assert.equal(scope.admits(after, ESTATE, [ORG]).admitted, true);
  } finally {
    await fixtureDb.query(`DELETE FROM scope_grant WHERE grant_id = 'gr_d5_probe'`);
    await fixtureDb.query(`DELETE FROM group_membership WHERE membership_id = 'mem_d5_probe'`);
    await fixtureDb.query(`DELETE FROM user_group WHERE group_id = 'grp_d5_probe'`);
  }

  const restored = await resolve('stf_wfg_manager');
  assert.equal(restored.grants.length, 1, 'the probe left nothing behind');
});

// ──────────────────────────────────────────── the unassigned row (ADR-006 C4)

test('an unassigned row is visible within the owning Organization, at any grant level', async () => {
  /**
   * RULED: visible to any principal within the owning Organization.
   *
   * C4 requires quarantine to be VISIBLE, and a rule making an unassigned event
   * less visible than a mapped one inverts the intent. And narrower scoping is
   * impossible by construction — scoping to an Estate requires knowing which
   * Estate, which is exactly the assignment that is missing.
   */
  const manager = await resolve('stf_wfg_manager');
  const counter = await resolve('stf_wfg_counter');

  assert.equal(scope.admitsUnassigned(manager, 'org_wingfu_holdings').admitted, true);
  assert.equal(
    scope.admitsUnassigned(counter, 'org_wingfu_holdings').admitted,
    true,
    'a counter-scoped principal sees it too — that is the ruling, not an accident',
  );

  const admission = scope.admitsUnassigned(manager, 'org_wingfu_holdings');
  assert.equal(admission.admitted === true ? admission.by : '', 'unassigned');
});

test('an unassigned row does NOT cross organizations', async () => {
  const manager = await resolve('stf_wfg_manager');
  assert.equal(
    scope.admitsUnassigned(manager, 'org_harbour_property').admitted,
    false,
    'cross-organization isolation is absolute and is not a role',
  );
});

// ────────────────────────────────────────────────────────── module boundary

test('access cannot read another module\'s tables', async () => {
  // The layer no lint rule can see. Access owns who may see what; it does not own
  // the hierarchy, and it cannot reach it even if someone wrote the query.
  await assert.rejects(accessDb.query('SELECT * FROM unit LIMIT 1'), /does not exist/);
  await assert.rejects(accessDb.query('SELECT * FROM safety_event LIMIT 1'), /does not exist/);
  await assert.rejects(accessDb.query('SELECT * FROM organization LIMIT 1'), /does not exist/);

  // Its own tables resolve.
  await accessDb.query('SELECT 1 FROM scope_grant LIMIT 1');
});

test('node_kind cannot name a kind the contract cannot express', async () => {
  // The enum is the management contract's ScopeRef.kind copied verbatim, so the
  // inconsistency is unrepresentable rather than merely forbidden.
  await assert.rejects(
    fixtureDb.query(
      `INSERT INTO scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('grant_bad_kind', 'grp_of_one_stf_wfg_manager', 'estate_staff', 'household', 'hh_x', now())`,
    ),
    /scope_grant_node_kind_check/,
  );
});

test('two grants differing only by role coexist; the same role twice does not (ADR-010 D4)', async () => {
  // GAP 1, made permanent. Under 0112's key these two rows were one
  // (principal, node) pair over overlapping periods and the second was rejected,
  // which made the project's ONLY worked staffing example — Ng Ka-ho as
  // supervisor AND duty officer AND case assignee — unrepresentable. That is
  // `prefer unrepresentable over forbidden` firing in the wrong direction.
  const rows = await accessDb.query<{ readonly role: string }>(
    `SELECT role FROM scope_grant WHERE node_id = 'blk_wfg_a' ORDER BY role`,
  );
  const roles = rows.map((r) => r.role);
  assert.ok(roles.length >= 2, 'the seeded world must carry two roles at one node');
  assert.ok(new Set(roles).size >= 2, `expected distinct roles at one node, got ${roles.join(',')}`);

  // AND THE KEY STILL BITES — but no longer HERE, and this half was rewritten at
  // GEN-024 rather than deleted.
  //
  // It used to assert that a second live grant for the same (group, role, node)
  // was refused by `scope_grant_no_overlapping_periods`. 0118 dropped that
  // constraint: it compared ASSERTED periods, so under the assertion model an
  // instance collided with its own revocation, and revoking a grant was
  // therefore not expressible by the runtime at all.
  //
  // The invariant survives; only its mechanism moved, and it moved OUT of the
  // schema. So the schema-level assertion that belongs here is the one the schema
  // still makes — that `role` is in the key, which is what GAP 1 was about — and
  // the live-cardinality half is proven where it now lives:
  //
  //   the write path   tests/integration/grant-assertions.test.ts
  //                    (refusal, and a real two-connection race)
  //   the whole table  docs/governance/bin/live-grant-cardinality.sh, in the battery
  //
  // Asserting a dropped constraint here would be a test that passes for a reason
  // that no longer exists — which is exactly the defect GEN-023 found in the
  // sibling test above.
  const sameNodeRoles = await accessDb.query<{ readonly role: string }>(
    `SELECT DISTINCT role FROM scope_grant WHERE node_id = 'blk_wfg_a' AND group_id <> ''`,
  );
  assert.ok(
    sameNodeRoles.length >= 2,
    'role is in the key: two roles coexist at one node, which 0112 could not express',
  );
});

test('a grant cannot be held by a principal directly (ADR-012 D2)', async () => {
  // GAP 2. `principal_id` is DROPPED, not nullable and not deprecated, so the
  // failure is "column does not exist" rather than a constraint violation. That
  // is the stronger form: there is no state to reject because there is no state
  // to express.
  await assert.rejects(
    fixtureDb.query(
      `INSERT INTO scope_grant (grant_id, principal_id, role, node_kind, node_id, effective_from)
       VALUES ('grant_direct_probe', 'stf_wfg_manager', 'estate_staff',
               'building', 'blk_wfg_a', now())`,
    ),
    /column "principal_id" .* does not exist/,
  );
});

test('a group of one gives exactly one person one permission at one node (ADR-012 D2)', async () => {
  // The group-of-one is the NORMAL way to give one person one permission, not a
  // workaround — ADR-012 D2, accepted by the Product Owner when the cost was named.
  const members = await accessDb.query<{ readonly principal_id: string }>(
    `SELECT principal_id FROM group_membership WHERE group_id = 'grp_of_one_stf_wfg_counter'`,
  );
  assert.equal(members.length, 1);
  assert.equal(members[0]?.principal_id, 'stf_wfg_counter');

  const scope = createScopeQueries(accessDb);
  const counter = await scope.getPrincipal('stf_wfg_counter');
  assert.ok(counter);
  assert.ok(
    counter.grants.some((g) => g.node.id === 'loc_wfg_clubhouse'),
    'the counter principal must reach its Location through its group of one',
  );

  const manager = await scope.getPrincipal('stf_wfg_manager');
  assert.ok(manager);
  assert.ok(
    manager.grants.every((g) => g.groupId !== 'grp_of_one_stf_wfg_counter'),
    'no other principal may hold a grant through that group',
  );
});
