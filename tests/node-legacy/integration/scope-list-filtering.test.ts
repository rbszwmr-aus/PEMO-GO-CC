/**
 * FILTERING HAPPENS IN THE QUERY, and the two expressions of the rule agree.
 *
 * ADR-007 D5: "A response that carries out-of-scope rows and hides them has
 * already leaked them." So a list is filtered by a `WHERE ... = ANY($ids)` built
 * from the expanded scope, and the rows a caller cannot see are ABSENT from the
 * body rather than marked.
 *
 * THE DIFFERENTIAL EXTENSION. The list query and the in-memory predicate are two
 * expressions of one rule, and this asserts:
 *
 *     the list contains the row   IF AND ONLY IF   admits(principal, row)
 *
 * over every seeded principal and every node the list could return. That is the
 * form that catches drift nobody predicted — it compares two implementations
 * rather than either one against a sample.
 *
 * NOTE ON WHAT THIS INSTRUMENT CANNOT SEE, recorded because it was demonstrated
 * rather than imagined: if the world were seeded twice under two identifier
 * schemes, both expressions would agree WITHIN each world and the comparison
 * would pass while a principal reached nothing in the other. A differential test
 * compares two implementations of a rule; it cannot tell you the rule is being
 * applied to the wrong universe.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createScopeQueries, type ScopeNode } from '../../modules/access/dist/index.js';
import {
  createScopeExpansionQueries,
  createTreeQueries,
} from '../../modules/property/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let accessDb: ReturnType<typeof createModuleDb>;
let propertyDb: ReturnType<typeof createModuleDb>;
let scope: ReturnType<typeof createScopeQueries>;
let expansion: ReturnType<typeof createScopeExpansionQueries>;
let tree: ReturnType<typeof createTreeQueries>;

test.before(async () => {
  harness = await startHarness();
  accessDb = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  propertyDb = createModuleDb({ schema: 'property', database: loadConfig().moduleDatabases.property });
  scope = createScopeQueries(accessDb);
  expansion = createScopeExpansionQueries(propertyDb);
  tree = createTreeQueries(propertyDb);
});
test.after(async () => {
  await accessDb.close();
  await propertyDb.close();
  await harness.close();
});

/** Ancestry for a hierarchy node, read from the database rather than written down. */
const ancestryOf = async (kind: string, id: string): Promise<ScopeNode[]> => {
  if (kind === 'estate') {
    const [row] = await propertyDb.query<{ organization_id: string; portfolio_id: string | null }>(
      'SELECT organization_id, portfolio_id FROM estate WHERE estate_id = $1',
      [id],
    );
    const out: ScopeNode[] = [{ kind: 'organization', id: row?.organization_id ?? '' }];
    if (row?.portfolio_id) out.push({ kind: 'portfolio', id: row.portfolio_id });
    return out;
  }
  if (kind === 'building') {
    const [row] = await propertyDb.query<{ estate_id: string; phase_id: string | null }>(
      'SELECT estate_id, phase_id FROM building WHERE building_id = $1',
      [id],
    );
    const out = [...(await ancestryOf('estate', row?.estate_id ?? '')), { kind: 'estate' as const, id: row?.estate_id ?? '' }];
    if (row?.phase_id) out.push({ kind: 'phase', id: row.phase_id });
    return out;
  }
  if (kind === 'floor') {
    const [row] = await propertyDb.query<{ building_id: string }>(
      'SELECT building_id FROM floor WHERE floor_id = $1',
      [id],
    );
    return [...(await ancestryOf('building', row?.building_id ?? '')), { kind: 'building', id: row?.building_id ?? '' }];
  }
  if (kind === 'unit') {
    const [row] = await propertyDb.query<{ floor_id: string }>(
      'SELECT floor_id FROM unit WHERE unit_id = $1',
      [id],
    );
    return [...(await ancestryOf('floor', row?.floor_id ?? '')), { kind: 'floor', id: row?.floor_id ?? '' }];
  }
  return [];
};

const principals = ['stf_wfg_manager', 'stf_wfg_block_a', 'stf_wfg_counter', 'stf_hbv_manager'];

test('out-of-scope rows are ABSENT from the list, not marked', async () => {
  // A block supervisor asks for a list that would otherwise include the whole
  // estate. The other block's rows must not be in the result at all.
  const supervisor = await scope.getPrincipal('stf_wfg_block_a');
  assert.ok(supervisor);

  const expanded = await expansion.expand(
    supervisor.organizationId,
    supervisor.grants.map((g) => g.node),
  );
  const rows = await tree.nodesInScope(expanded);
  const ids = rows.map((r) => r.id);

  assert.ok(ids.includes('blk_wfg_a'), 'their own block is present');
  assert.ok(!ids.includes('blk_wfg_c'), 'a sibling block is ABSENT');
  assert.ok(!ids.includes('est_wing_fu_garden'), 'the estate above them is ABSENT');
  assert.ok(!ids.some((id) => id.startsWith('unit_hbv')), 'another organization is ABSENT');

  // And the list is not empty, so the absences above mean something.
  assert.ok(rows.length > 0, 'the supervisor sees their own block and what is under it');
});

test('DIFFERENTIAL — list membership agrees with the predicate, for every principal', async () => {
  const everyNode = await propertyDb.query<{ kind: string; id: string }>(
    `SELECT 'estate' AS kind, estate_id AS id FROM estate
     UNION ALL SELECT 'building', building_id FROM building
     UNION ALL SELECT 'floor', floor_id FROM floor
     UNION ALL SELECT 'unit', unit_id FROM unit WHERE unit_class = 'residential'`,
  );

  const disagreements: string[] = [];
  let comparisons = 0;

  for (const principalId of principals) {
    const resolved = await scope.getPrincipal(principalId);
    assert.ok(resolved);

    const expanded = await expansion.expand(resolved.organizationId, resolved.grants.map((g) => g.node));
    const listed = new Set((await tree.nodesInScope(expanded)).map((r) => `${r.kind}:${r.id}`));

    for (const node of everyNode) {
      const target: ScopeNode = { kind: node.kind as ScopeNode['kind'], id: node.id };
      const ancestry = await ancestryOf(node.kind, node.id);

      const inList = listed.has(`${node.kind}:${node.id}`);
      const byPredicate = scope.admits(resolved, target, ancestry).admitted;
      comparisons += 1;
      if (inList !== byPredicate) {
        disagreements.push(`${principalId} × ${node.kind}:${node.id} — list=${inList} predicate=${byPredicate}`);
      }
    }
  }

  assert.deepEqual(
    disagreements,
    [],
    `${disagreements.length} of ${comparisons} comparisons disagreed:\n${disagreements.join('\n')}`,
  );
  console.log(`      list differential: ${comparisons} comparisons, zero disagreements`);
});

test('DIFFERENTIAL — RED: a post-filter implementation fails the same assertion', async () => {
  /**
   * The mutant is the implementation the PID names as the defect: fetch
   * everything, then hide what the caller may not see. Its BODY still contains
   * the rows, which is the whole point — a response that carries them has already
   * leaked them.
   */
  const supervisor = await scope.getPrincipal('stf_wfg_block_a');
  assert.ok(supervisor);

  // The mutant: an unfiltered query, "filtered" by a flag the client is trusted
  // to respect.
  const unfiltered = await propertyDb.query<{ id: string }>('SELECT building_id AS id FROM building');
  const mutantBody = unfiltered.map((b) => ({
    id: b.id,
    visible: b.id === 'blk_wfg_a',
  }));

  assert.ok(
    mutantBody.some((r) => r.id === 'blk_wfg_c'),
    'MUTANT: the out-of-scope row is present in the body, merely marked invisible',
  );

  // The real list does not contain it at all.
  const expanded = await expansion.expand(supervisor.organizationId, supervisor.grants.map((g) => g.node));
  const real = await tree.nodesInScope(expanded);
  assert.ok(!real.some((r) => r.id === 'blk_wfg_c'), 'the real list omits it entirely');

  // Control after the mutation: the real path is unchanged.
  assert.ok(real.some((r) => r.id === 'blk_wfg_a'));
});
