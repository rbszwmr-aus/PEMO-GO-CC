/**
 * ADR-018 -- AUTHORITY OWNS ITS PRECONDITION.
 *
 * `G-2`'s floors used to take `readonly string[]`: a flat set of node keys the
 * composition layer PROMISED it had filtered to the caller's
 * `grant_administrator` grants. Every route did filter it. But EXPANSION
 * DISCARDS THE ROLE -- a `ScopeGrant` knows it is `estate_staff`, a node key does
 * not -- so a route passing its FULL expanded scope would have widened every
 * floor from *administers this node* to *holds any grant anywhere*, and nothing
 * in the type system, the schema or the tests would have noticed. `GEN-033`
 * carried it out as the one thing to close.
 *
 * TWO INDEPENDENT BITES, because the change has two halves that fail differently:
 *
 *   1. THE TYPE. `G-2` now takes a branded `GrantAdministratorScope` that only
 *      `grantAdministratorScope` can build. A raw set is not a compile error by
 *      convention -- it is one by construction. Asserted by COMPILING
 *      `tests/types/grant-administrator-scope.types.mts`, whose `@ts-expect-error`
 *      directives go unused (and therefore ERROR) the moment a floor widens.
 *
 *   2. THE FILTER. A type that guarantees the value came from one place says
 *      nothing about whether that place is right. So the constructor is fed a
 *      scope containing a NON-administrator grant and the resulting floor must
 *      still refuse -- which is the behaviour a caller who wrote the filter by
 *      hand could get wrong, and used to.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import {
  grantAdministratorScope, mayAdministerGroup,
  type ScopeGrant, type ScopeNode,
} from '../../modules/access/dist/index.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ORG = 'org_g35';
const EST_STAFF = 'est_g35_staff';
const EST_ADMIN = 'est_g35_admin';

let owner: ReturnType<typeof createModuleDb>;

/**
 * The expander, stubbed to IDENTITY.
 *
 * Property Core's hierarchy is not the subject here and a real expansion would
 * make the assertion about subtree shape rather than about the filter. Identity
 * means every node the constructor is handed comes back, so if a non-admin node
 * appears in the result it can only have come from the filter -- which is
 * exactly the failure this test exists to see.
 */
const identityExpansion = async (nodes: readonly ScopeNode[]): Promise<readonly string[]> =>
  nodes.map((n) => `${n.kind}:${n.id}`);

/** A caller holding `estate_staff` at one estate and `grant_administrator` at another. */
const grant = (role: ScopeGrant['role'], nodeId: string, n: number): ScopeGrant => ({
  grantId: `gr_g35_c${n}`, groupId: 'grp_g35_caller', role,
  node: { kind: 'estate', id: nodeId },
  effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: null,
});

const MIXED_SCOPE: readonly ScopeGrant[] = [
  grant('estate_staff', EST_STAFF, 1),
  grant('grant_administrator', EST_ADMIN, 2),
];

test.before(async () => {
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'G35', 'G35', 'G35') ON CONFLICT (organization_id) DO NOTHING`, [ORG]);
  await owner.query(
    `INSERT INTO user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, 'staff-node group') ON CONFLICT (group_id) DO NOTHING`,
    ['grp_g35_target', ORG]);
  // The group confers at the estate the caller holds only a NON-admin grant at.
  await owner.query(
    `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('sgra_g35_t', 1, 'gr_g35_t', 'grp_g35_target', 'estate_staff', 'estate', $1,
             now() - interval '1 day')
     ON CONFLICT (grant_id, version) DO NOTHING`, [EST_STAFF]);
});

test.after(async () => {
  await owner.query(`DELETE FROM scope_grant WHERE group_id = 'grp_g35_target'`);
  await owner.query(`DELETE FROM user_group WHERE organization_id = $1`, [ORG]);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG]);
  await owner.close();
});

test('the type-level guard: a raw node set cannot reach a G-2 floor', () => {
  /**
   * The passing condition is the COMPILE, and specifically that every
   * `@ts-expect-error` in the fixture is a real error -- `tsc` reports an unused
   * one as `TS2578`. Widening a floor to `GrantAdministratorScope | readonly
   * string[]`, which is the plausible wrong rule and not a syntactic deletion,
   * makes the raw-set line legal and reds this with exactly that code. Measured,
   * not assumed.
   *
   * `tests/**` is in no project's `include` and the test runner strips types
   * rather than checking them, so without this step a type-level guarantee would
   * be invisible to the entire gate.
   */
  const tsc = resolve(REPO, 'apps/api/node_modules/.bin/tsc');
  const out = execFileSync(tsc, ['-p', resolve(REPO, 'tests/types/tsconfig.json')],
                           { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(out.trim(), '', out);
});

test('the filter: a non-administrator grant is excluded, and the floor refuses', async () => {
  const scope = await grantAdministratorScope(MIXED_SCOPE, identityExpansion);

  // WHAT THE SCOPE CONTAINS. The admin node is in; the staff node is not.
  assert.deepEqual([...scope.nodeKeys], [`estate:${EST_ADMIN}`]);

  // WHAT THE FLOOR DOES WITH IT. The target group confers at the staff estate,
  // which the caller holds a grant at -- just not an ADMINISTRATOR one. A filter
  // that kept non-admin grants would admit this, which is the whole hole.
  await owner.transaction(async (tx) => {
    const floor = await mayAdministerGroup(tx, 'grp_g35_target', ORG, scope);
    assert.equal(floor.admitted, false);
    assert.deepEqual([...floor.uncoveredNodes], [`estate:${EST_STAFF}`]);
    assert.equal(floor.viaEmptyGroupFallback, false);
  });
});
