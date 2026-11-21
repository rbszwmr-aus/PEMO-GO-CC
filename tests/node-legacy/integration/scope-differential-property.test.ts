/**
 * THE DIFFERENTIAL PROPERTY TEST.
 *
 * For any principal and any node:
 *
 *     the SQL expansion contains the node   IF AND ONLY IF   admits(principal, node)
 *
 * This check is different IN KIND from everything else in this suite, and the
 * reason is worth stating precisely.
 *
 * Every other check in this project validates against the fixture corpus, and a
 * corpus is a sample somebody chose. Its blind spots are invisible to any check
 * that uses it as the oracle, because such a check can only ask whether the
 * answer matches the sample. Five gaps have now been found that way — two
 * emitted-only problem types with no fixture, a fixtured state nothing can reach,
 * three of seven severity levels, portfolio plus five UI states, and
 * Location-within-Location, which this suite's own scope tests missed until the
 * asymmetry was stated in prose and reviewed.
 *
 * This test uses NO corpus. It compares two independent expressions of one rule —
 * a recursive SQL expansion in Property Core, and an in-memory ancestry predicate
 * in Identity and Access — over the FULL CROSS PRODUCT of seeded principals and
 * seeded nodes. Its coverage is bounded by the input space rather than by what
 * somebody wrote down, so it catches drift nobody predicted.
 *
 * That is the whole point: the divergence that ships is always the one nobody
 * imagined.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  createScopeQueries,
  SCOPE_NODE_KINDS,
  type ResolvedScope,
  type ScopeNode,
  type ScopeNodeKind,
} from '../../modules/access/dist/index.js';
import { createScopeExpansionQueries } from '../../modules/property/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let accessDb: ReturnType<typeof createModuleDb>;
let propertyDb: ReturnType<typeof createModuleDb>;
let scope: ReturnType<typeof createScopeQueries>;
let expansion: ReturnType<typeof createScopeExpansionQueries>;

test.before(async () => {
  harness = await startHarness();
  accessDb = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  propertyDb = createModuleDb({ schema: 'property', database: loadConfig().moduleDatabases.property });
  scope = createScopeQueries(accessDb);
  expansion = createScopeExpansionQueries(propertyDb);
});
test.after(async () => {
  await accessDb.close();
  await propertyDb.close();
  await harness.close();
});

/**
 * Every node in the seeded world, each with the ancestry the management
 * contract's ScopePath would carry. Built from the database rather than written
 * down, so a node added later is covered without anyone remembering to add it.
 */
const everyNodeWithAncestry = async (): Promise<{ node: ScopeNode; ancestry: ScopeNode[] }[]> => {
  const out: { node: ScopeNode; ancestry: ScopeNode[] }[] = [];

  const estates = await propertyDb.query<{ estate_id: string; organization_id: string; portfolio_id: string | null }>(
    'SELECT estate_id, organization_id, portfolio_id FROM estate',
  );
  for (const e of estates) {
    const ancestry: ScopeNode[] = [{ kind: 'organization', id: e.organization_id }];
    if (e.portfolio_id !== null) ancestry.push({ kind: 'portfolio', id: e.portfolio_id });
    out.push({ node: { kind: 'estate', id: e.estate_id }, ancestry });
  }

  const phases = await propertyDb.query<{ phase_id: string; estate_id: string }>(
    'SELECT phase_id, estate_id FROM phase',
  );
  for (const p of phases) {
    const parent = out.find((o) => o.node.kind === 'estate' && o.node.id === p.estate_id);
    out.push({
      node: { kind: 'phase', id: p.phase_id },
      ancestry: [...(parent?.ancestry ?? []), { kind: 'estate', id: p.estate_id }],
    });
  }

  const buildings = await propertyDb.query<{ building_id: string; estate_id: string; phase_id: string | null }>(
    'SELECT building_id, estate_id, phase_id FROM building',
  );
  for (const b of buildings) {
    const parent = out.find((o) => o.node.kind === 'estate' && o.node.id === b.estate_id);
    const ancestry = [...(parent?.ancestry ?? []), { kind: 'estate' as const, id: b.estate_id }];
    if (b.phase_id !== null) ancestry.push({ kind: 'phase', id: b.phase_id });
    out.push({ node: { kind: 'building', id: b.building_id }, ancestry });
  }

  const floors = await propertyDb.query<{ floor_id: string; building_id: string }>(
    'SELECT floor_id, building_id FROM floor',
  );
  for (const f of floors) {
    const parent = out.find((o) => o.node.kind === 'building' && o.node.id === f.building_id);
    out.push({
      node: { kind: 'floor', id: f.floor_id },
      ancestry: [...(parent?.ancestry ?? []), { kind: 'building', id: f.building_id }],
    });
  }

  const units = await propertyDb.query<{ unit_id: string; floor_id: string }>(
    'SELECT unit_id, floor_id FROM unit',
  );
  for (const u of units) {
    const parent = out.find((o) => o.node.kind === 'floor' && o.node.id === u.floor_id);
    out.push({
      node: { kind: 'unit', id: u.unit_id },
      ancestry: [...(parent?.ancestry ?? []), { kind: 'floor', id: u.floor_id }],
    });
  }

  // Locations: the physical parent chain, THEN the containment chain, because a
  // Location can lie inside another Location via parent_location_id.
  const locations = await propertyDb.query<{
    location_id: string;
    physical_parent_type: string;
    physical_parent_id: string;
    parent_location_id: string | null;
  }>('SELECT location_id, physical_parent_type, physical_parent_id, parent_location_id FROM location');

  const locationById = new Map(locations.map((l) => [l.location_id, l]));
  const ancestryOfLocation = (id: string, seen = new Set<string>()): ScopeNode[] => {
    const row = locationById.get(id);
    if (row === undefined || seen.has(id)) return [];
    seen.add(id);
    if (row.parent_location_id !== null) {
      return [
        ...ancestryOfLocation(row.parent_location_id, seen),
        { kind: 'location', id: row.parent_location_id },
      ];
    }
    const physical = out.find(
      (o) => o.node.kind === row.physical_parent_type && o.node.id === row.physical_parent_id,
    );
    return [...(physical?.ancestry ?? []), ...(physical === undefined ? [] : [physical.node])];
  };

  for (const l of locations) {
    out.push({ node: { kind: 'location', id: l.location_id }, ancestry: ancestryOfLocation(l.location_id) });
  }

  return out;
};

const inExpansion = (
  expanded: Awaited<ReturnType<typeof expansion.expand>>,
  node: ScopeNode,
): boolean => {
  switch (node.kind) {
    case 'organization': return expanded.organizationIds.includes(node.id);
    case 'portfolio': return expanded.portfolioIds.includes(node.id);
    case 'estate': return expanded.estateIds.includes(node.id);
    case 'phase': return expanded.phaseIds.includes(node.id);
    case 'building': return expanded.buildingIds.includes(node.id);
    case 'floor': return expanded.floorIds.includes(node.id);
    case 'unit': return expanded.unitIds.includes(node.id);
    case 'location': return expanded.locationIds.includes(node.id);
  }
};

/**
 * THE OTHER AXIS, AND A DEFECT IN THIS FILE THAT LASTED UNTIL THE REPIN.
 *
 * This was a hand-written list of four. The test one screen up is named *"the
 * input space is derived from the enum, not from a list"* and it was TRUE of the
 * node axis and FALSE of the principal axis — a check whose name was not what it
 * measured, which is the third time this project has recorded that exact shape.
 *
 * It was silent, as that shape always is: `stf_wfg_former` had never been
 * compared at all, and when the reconciled corpus arrived carrying
 * `scope/portfolio-grant.json` and a portfolio-scoped principal was seeded to
 * meet it, the cross product did not grow. 172 comparisons before, 172 after. A
 * derived axis would have gone up; a list cannot.
 *
 * So both axes are now enumerated from the world. `everyPrincipal()` reads the
 * table, and the count is asserted against it below so that a principal which
 * fails to seed cannot shrink the input space quietly either.
 */
const everyPrincipal = async (): Promise<string[]> => {
  const rows = await accessDb.query<{ readonly principal_id: string }>(
    'SELECT principal_id FROM staff_principal ORDER BY principal_id',
  );
  return rows.map((r) => r.principal_id);
};

test('DIFFERENTIAL — the input space is derived from the enum, not from a list', async () => {
  /**
   * A property test moves the sampling bound from "the examples somebody wrote"
   * to "the domain somebody enumerated" — still a human act, as phases proved by
   * being absent from this comparison until someone noticed.
   *
   * So the domain is walked from SCOPE_NODE_KINDS, which a compile-time
   * exhaustiveness guard ties to the contract's eight kinds: a ninth cannot be
   * added to the type without appearing here. And a kind contributing ZERO nodes
   * fails, because a kind that silently contributes nothing is the same silent
   * omission in a different place.
   */
  const nodes = await everyNodeWithAncestry();
  const byKind = new Map<ScopeNodeKind, number>();
  for (const kind of SCOPE_NODE_KINDS) byKind.set(kind, 0);
  for (const { node } of nodes) byKind.set(node.kind, (byKind.get(node.kind) ?? 0) + 1);

  const uncovered = [...byKind.entries()].filter(([, count]) => count === 0).map(([kind]) => kind);

  /**
   * `organization` and `portfolio` are compared through the grants that name them
   * rather than as rows of their own: organization lives in another module's
   * schema, and this test may not read it. Recorded as a deliberate exclusion
   * with its reason, not left as a silent zero.
   */
  assert.deepEqual(
    uncovered,
    ['organization', 'portfolio'],
    `kinds contributing no nodes: ${uncovered.join(', ')}`,
  );

  for (const kind of SCOPE_NODE_KINDS) {
    if (uncovered.includes(kind)) continue;
    assert.ok((byKind.get(kind) ?? 0) > 0, `${kind} must contribute at least one node`);
  }
});

test('DIFFERENTIAL — SQL expansion and the predicate agree on every principal × every node', async () => {
  const nodes = await everyNodeWithAncestry();
  assert.ok(nodes.length >= 20, `expected a populated world, found ${nodes.length} nodes`);

  const disagreements: string[] = [];
  let comparisons = 0;

  const principals = await everyPrincipal();
  assert.ok(
    principals.length >= 6,
    `the seeded world must supply every principal to this comparison, found ${principals.length}`,
  );

  for (const principalId of principals) {
    const resolved = await scope.getPrincipal(principalId);
    assert.ok(resolved, `${principalId} must resolve`);

    const expanded = await expansion.expand(
      resolved.organizationId,
      resolved.grants.map((g) => g.node),
    );

    for (const { node, ancestry } of nodes) {
      const bySql = inExpansion(expanded, node);
      const byPredicate = scope.admits(resolved, node, ancestry).admitted;
      comparisons += 1;
      if (bySql !== byPredicate) {
        disagreements.push(
          `${principalId} × ${node.kind}:${node.id} — sql=${bySql} predicate=${byPredicate}`,
        );
      }
    }
  }

  assert.deepEqual(
    disagreements,
    [],
    `${disagreements.length} of ${comparisons} comparisons disagreed:\n${disagreements.join('\n')}`,
  );
  console.log(
    `      differential: ${principals.length} principals × ${nodes.length} nodes = ${comparisons} comparisons, zero disagreements`,
  );
});

test('DIFFERENTIAL — RED: a divergence in either expression is caught', async () => {
  /**
   * The property is only worth having if it fails when the two disagree. The
   * mutant weakens the PREDICATE — dropping the Location-descendant clause, which
   * is the exact divergence that shipped and was found by review rather than by
   * any check — and asserts the comparison notices.
   */
  const nodes = await everyNodeWithAncestry();
  const resolved = await scope.getPrincipal('stf_wfg_counter');
  assert.ok(resolved);

  const expanded = await expansion.expand(
    resolved.organizationId,
    resolved.grants.map((g) => g.node),
  );

  const mutantAdmits = (node: ScopeNode): boolean =>
    resolved.grants.some((g) => g.node.kind === node.kind && g.node.id === node.id);

  const disagreements = nodes.filter(({ node }) => inExpansion(expanded, node) !== mutantAdmits(node));

  assert.ok(
    disagreements.length > 0,
    'MUTANT: a predicate missing the descendant clause must disagree with the SQL',
  );
  assert.ok(
    disagreements.some((d) => d.node.id === 'loc_wfg_function_room'),
    'and the disagreement must be exactly the contained Location',
  );

  // Control after the mutation: the real predicate still agrees everywhere.
  const real = nodes.filter(
    ({ node, ancestry }) => inExpansion(expanded, node) !== scope.admits(resolved, node, ancestry).admitted,
  );
  assert.deepEqual(real, [], 'the production rule still agrees with the SQL');
});

test('DIFFERENTIAL — the comparison is not vacuous', async () => {
  // A property test over an empty input space passes forever. This asserts both
  // sides actually admit and refuse things, so agreement means something.
  const nodes = await everyNodeWithAncestry();
  const resolved = await scope.getPrincipal('stf_wfg_block_a');
  assert.ok(resolved);

  const expanded = await expansion.expand(resolved.organizationId, resolved.grants.map((g) => g.node));
  const admitted = nodes.filter(({ node }) => inExpansion(expanded, node));
  const refused = nodes.filter(({ node }) => !inExpansion(expanded, node));

  assert.ok(admitted.length > 0, 'the expansion must admit something');
  assert.ok(refused.length > 0, 'and refuse something');
});

test('a portfolio grant reaches its estates and NOT the portfolio-less sibling', async () => {
  /**
   * The differential test proves the two expressions AGREE. It cannot prove they
   * are RIGHT — agreeing on a wrong answer is exactly the failure mode a
   * differential comparison is blind to, and this project has already recorded
   * that limit for the case where both expressions are applied to the wrong
   * universe. So the portfolio tier gets a direct assertion as well.
   *
   * ADR-002 makes Portfolio optional, and the seeded world has both: Wing Fu
   * Garden sits IN `pf_wingfu_residential`, and Tsz Wan Court belongs to the same
   * Organization and to NO portfolio. A portfolio grant that leaked upward
   * through the organization would collect Tsz Wan Court, and every level beneath
   * it, without anything in the response saying so.
   */
  const resolved = await scope.getPrincipal('stf_wfg_portfolio');
  assert.ok(resolved, 'the portfolio-scoped principal must resolve');

  const expanded = await expansion.expand(
    resolved.organizationId,
    resolved.grants.map((g) => g.node),
  );

  assert.ok(expanded.estateIds.includes('est_wing_fu_garden'), 'the portfolio must reach its own estate');
  assert.ok(
    !expanded.estateIds.includes('est_tsz_wan_court'),
    'a portfolio grant must NOT reach an estate that belongs to no portfolio — that is upward leakage through the Organization',
  );

  // And the exclusion must be bounded rather than total: everything beneath the
  // reached estate is reached, or the grant would be decorative.
  assert.ok(expanded.buildingIds.includes('blk_wfg_a'), 'and everything beneath it');
  assert.ok(!expanded.buildingIds.includes('blk_twc_1'), 'and nothing beneath the excluded one');
});
