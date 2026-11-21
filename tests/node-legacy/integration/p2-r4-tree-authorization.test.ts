/**
 * R4 — request-scoped membership Set, oracle parity, near-linear work.
 *
 * Verdicts must match the previous Array#includes scan exactly. The membership
 * Set is built once per resolved RoleScope, not once per node, and is not a
 * cross-user or global cache.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  noRoleScope,
  roleScope,
  scopeCovers,
  takeMembershipSetConstructions,
  uncoveredNodes,
  uncoveredNodesOracle,
  type RoleScope,
} from '../../modules/access/dist/index.js';
import type { ScopeGrant, ScopeNode } from '../../modules/access/dist/index.js';

const key = (kind: string, id: string) => `${kind}:${id}`;

const grant = (role: ScopeGrant['role'], kind: string, id: string): ScopeGrant =>
  ({ role, node: { kind, id } }) as ScopeGrant;

const expandAsKeys = async (nodes: readonly ScopeNode[]): Promise<readonly string[]> =>
  nodes.map((n) => key(n.kind, n.id));

/** A child expander: a floor grant also covers units under it (synthetic tree). */
const expandFloorWithUnits = (unitsPerFloor: number) =>
  async (nodes: readonly ScopeNode[]): Promise<readonly string[]> => {
    const keys: string[] = [];
    for (const n of nodes) {
      keys.push(key(n.kind, n.id));
      if (n.kind === 'floor') {
        for (let i = 0; i < unitsPerFloor; i += 1) {
          keys.push(key('unit', `${n.id}-u${String(i).padStart(3, '0')}`));
        }
      }
      if (n.kind === 'estate') {
        // full estate: two floors already listed as themselves if granted
        keys.push(key('estate', n.id));
      }
    }
    return [...new Set(keys)];
  };

const everyNodeParity = (scope: RoleScope<'estate_staff'>, required: readonly string[]): void => {
  const got = uncoveredNodes(scope, required);
  const oracle = uncoveredNodesOracle(scope, required);
  assert.deepEqual(got, oracle);
  for (const nodeKey of required) {
    assert.equal(scopeCovers(scope, nodeKey), scope.nodeKeys.includes(nodeKey));
  }
};

test('R4 — empty, narrow, full, mixed, wrong-estate and revoked scopes match the oracle', async () => {
  takeMembershipSetConstructions();

  const empty = noRoleScope('estate_staff');
  everyNodeParity(empty, ['estate:A', 'floor:A1', 'unit:A1-u000']);
  assert.deepEqual(uncoveredNodes(empty, ['estate:A']), ['estate:A']);
  assert.equal(scopeCovers(empty, 'estate:A'), false);

  const narrow = await roleScope('estate_staff', [grant('estate_staff', 'floor', 'A1')], expandFloorWithUnits(4));
  const universe = [
    'estate:A', 'estate:B',
    'floor:A1', 'floor:A2', 'floor:B1',
    'unit:A1-u000', 'unit:A1-u001', 'unit:A1-u002', 'unit:A1-u003',
    'unit:A2-u000', 'unit:B1-u000',
  ];
  everyNodeParity(narrow, universe);
  assert.equal(scopeCovers(narrow, 'floor:A1'), true);
  assert.equal(scopeCovers(narrow, 'unit:A1-u002'), true);
  assert.equal(scopeCovers(narrow, 'floor:A2'), false);
  assert.equal(scopeCovers(narrow, 'estate:B'), false);

  const full = await roleScope(
    'estate_staff',
    [grant('estate_staff', 'estate', 'A'), grant('estate_staff', 'floor', 'A1'), grant('estate_staff', 'floor', 'A2')],
    async (nodes) => {
      const keys = new Set(await expandAsKeys(nodes));
      for (const floor of ['A1', 'A2']) {
        keys.add(key('floor', floor));
        for (let i = 0; i < 4; i += 1) keys.add(key('unit', `${floor}-u${String(i).padStart(3, '0')}`));
      }
      return [...keys];
    },
  );
  everyNodeParity(full, universe);
  assert.equal(scopeCovers(full, 'estate:A'), true);
  assert.equal(scopeCovers(full, 'unit:A2-u000'), true);
  assert.equal(scopeCovers(full, 'estate:B'), false); // wrong estate

  const mixed = await roleScope(
    'estate_staff',
    [grant('estate_staff', 'floor', 'A1'), grant('estate_staff', 'floor', 'A2')],
    expandFloorWithUnits(4),
  );
  everyNodeParity(mixed, universe);
  assert.equal(scopeCovers(mixed, 'unit:A2-u003'), true);
  assert.equal(scopeCovers(mixed, 'floor:B1'), false);

  // Revocation: the floor:A2 grant is no longer in the resolved list.
  const revoked = await roleScope(
    'estate_staff',
    [grant('estate_staff', 'floor', 'A1')],
    expandFloorWithUnits(4),
  );
  everyNodeParity(revoked, universe);
  assert.equal(scopeCovers(revoked, 'floor:A2'), false);
  assert.equal(scopeCovers(revoked, 'unit:A2-u000'), false);
  assert.equal(scopeCovers(revoked, 'floor:A1'), true);

  // Wrong organisation / estate keys never appear in a scope that was not expanded to them.
  const otherOrg = await roleScope('estate_staff', [grant('estate_staff', 'estate', 'orgA-estate')], expandAsKeys);
  everyNodeParity(otherOrg, ['estate:orgB-estate', 'floor:orgB-f1', 'estate:orgA-estate']);
  assert.equal(scopeCovers(otherOrg, 'estate:orgB-estate'), false);
  assert.equal(scopeCovers(otherOrg, 'estate:orgA-estate'), true);
});

test('R4 — membership Set is built once per resolved role, not once per node, at 1k/2k/4k', async () => {
  const sizes = [1000, 2000, 4000] as const;
  const timings: { size: number; ms: number; constructions: number }[] = [];

  for (const size of sizes) {
    const grants: ScopeGrant[] = [grant('estate_staff', 'estate', 'E')];
    const keys = Array.from({ length: size }, (_, i) => key('unit', `u${String(i).padStart(5, '0')}`));
    const scope = await roleScope('estate_staff', grants, async () => keys);

    takeMembershipSetConstructions();
    const required = [...keys, 'unit:not-in-scope', 'estate:other'];
    const start = process.hrtime.bigint();
    const uncovered = uncoveredNodes(scope, required);
    for (const nodeKey of required) scopeCovers(scope, nodeKey);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const constructions = takeMembershipSetConstructions();

    assert.equal(constructions, 1, `expected 1 membership Set at ${size} nodes, got ${constructions}`);
    assert.deepEqual(uncovered, uncoveredNodesOracle(scope, required));
    assert.deepEqual(uncovered, ['unit:not-in-scope', 'estate:other']);
    timings.push({ size, ms, constructions });
  }

  // Near-linear: 4k should not blow up vs 1k (allow generous slack for noise).
  const t1 = timings[0]!;
  const t4 = timings[2]!;
  assert.ok(
    t4.ms < t1.ms * 12 + 20,
    `membership work not near-linear: 1k=${t1.ms.toFixed(3)}ms 4k=${t4.ms.toFixed(3)}ms`,
  );
  console.log('R4 membership work', timings);
});

test('R4 — two principals do not share a membership Set', async () => {
  const a = await roleScope('estate_staff', [grant('estate_staff', 'floor', 'A1')], expandAsKeys);
  const b = await roleScope('estate_staff', [grant('estate_staff', 'floor', 'B1')], expandAsKeys);
  takeMembershipSetConstructions();
  assert.equal(scopeCovers(a, 'floor:A1'), true);
  assert.equal(scopeCovers(b, 'floor:A1'), false);
  assert.equal(scopeCovers(b, 'floor:B1'), true);
  assert.equal(takeMembershipSetConstructions(), 2);
});
