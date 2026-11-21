/**
 * Rail assembly and fixture-chrome filters.
 *
 * Property tree wins on overlap. Scope fills Block B. Help-desk matches the
 * authored unit string. A ScopePath is in focus when the picked node is the
 * row's node or an ancestor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScopeKind, ScopePath, ScopeTreeNode, ScopeTreeResponse } from '../../src/data/types.ts';
import { nodeKey } from '../../src/screens/tree-collapse.ts';
import {
  buildRailNodes,
  filterTreeToFocus,
  findRailNode,
  helpdeskUnitInFocus,
  parseFocusParam,
  pathForFocus,
  scopePathInFocus,
} from '../../src/shell/scope-focus.ts';

const loc = (en: string, zh = en) => ({ en, 'zh-Hant': zh });

function node(
  kind: ScopeKind,
  id: string,
  depth: number,
  label: string,
  parent?: { kind: ScopeKind; id: string } | null,
): ScopeTreeNode {
  return { node: { kind, id }, parent: parent ?? null, label: loc(label), depth, permittedActions: [] };
}

const TREE = {
  meta: { correlationId: 'c', contractVersion: '2.4.0', generatedAt: '2026-08-12T00:00:00+08:00' },
  nodes: [
    node('estate', 'est_wing_fu_garden', 0, 'Wing Fu Garden'),
    node('building', 'blk_wfg_a', 1, 'Block A', { kind: 'estate', id: 'est_wing_fu_garden' }),
    node('floor', 'fl_wfg_a_12', 2, '12/F', { kind: 'building', id: 'blk_wfg_a' }),
    node('unit', 'unit_wfg_a_12_a1', 3, 'Flat A1', { kind: 'floor', id: 'fl_wfg_a_12' }),
    node('building', 'blk_wfg_c', 1, 'Block C', { kind: 'estate', id: 'est_wing_fu_garden' }),
  ],
};

const SCOPE: ScopeTreeResponse = {
  meta: TREE.meta,
  grants: [{ kind: 'estate', id: 'est_wing_fu_garden', label: loc('Wing Fu Garden') }],
  nodes: [
    node('organization', 'org_wingfu_holdings', 0, 'Wing Fu Property Management'),
    node('portfolio', 'pf_wingfu_residential', 1, 'Wing Fu Residential Portfolio', { kind: 'organization', id: 'org_wingfu_holdings' }),
    node('estate', 'est_wing_fu_garden', 2, 'Wing Fu Garden', { kind: 'portfolio', id: 'pf_wingfu_residential' }),
    node('building', 'blk_wfg_a', 3, 'Block A', { kind: 'estate', id: 'est_wing_fu_garden' }),
    node('building', 'blk_wfg_b', 3, 'Block B', { kind: 'estate', id: 'est_wing_fu_garden' }),
    node('building', 'blk_wfg_c', 3, 'Block C', { kind: 'estate', id: 'est_wing_fu_garden' }),
  ],
};

const pathA1: ScopePath = {
  node: { kind: 'unit', id: 'unit_wfg_a_12_a1', label: loc('Flat A1') },
  ancestry: [
    { kind: 'estate', id: 'est_wing_fu_garden' },
    { kind: 'building', id: 'blk_wfg_a' },
    { kind: 'floor', id: 'fl_wfg_a_12' },
  ],
};

const pathB2: ScopePath = {
  node: { kind: 'unit', id: 'unit_wfg_b_03_b2', label: loc('Flat B2') },
  ancestry: [
    { kind: 'estate', id: 'est_wing_fu_garden' },
    { kind: 'building', id: 'blk_wfg_b' },
  ],
};

test('parseFocusParam reads kind:id and rejects empty', () => {
  assert.equal(parseFocusParam('building:blk_wfg_a'), 'building:blk_wfg_a');
  assert.equal(parseFocusParam(''), null);
  assert.equal(parseFocusParam('building'), null);
});

test('rail merges Block B from scope and keeps the property-tree floor and unit', () => {
  const rail = buildRailNodes(TREE, SCOPE);
  const labels = rail.map((n) => n.label.en);
  assert.ok(labels.includes('Wing Fu Garden'));
  assert.ok(labels.includes('Block A'));
  assert.ok(labels.includes('Block B'));
  assert.ok(labels.includes('Block C'));
  assert.ok(labels.includes('12/F'));
  assert.ok(labels.includes('Flat A1'));
  assert.equal(labels.includes('Wing Fu Property Management'), false);
  assert.equal(labels.includes('Wing Fu Residential Portfolio'), false);
  const floor = rail.find((n) => n.node.id === 'fl_wfg_a_12');
  const blockB = rail.find((n) => n.node.id === 'blk_wfg_b');
  const estate = rail.find((n) => n.node.id === 'est_wing_fu_garden');
  assert.ok(floor && blockB && estate);
  assert.ok(rail.indexOf(floor) < rail.indexOf(rail.find((n) => n.node.id === 'blk_wfg_c')!));
  assert.equal(parentKeySafe(blockB), 'estate:est_wing_fu_garden');
  assert.equal(estate.depth, 0);
  assert.equal(blockB.depth, 1);
});

function parentKeySafe(n: ScopeTreeNode): string | null {
  const p = n.parent;
  if (!p || !p.id) return null;
  return `${p.kind}:${p.id}`;
}

test('pathForFocus is estate then building then unit', () => {
  const rail = buildRailNodes(TREE, SCOPE);
  const path = pathForFocus(rail, 'unit:unit_wfg_a_12_a1');
  assert.deepEqual(path.map((n) => n.kind), ['estate', 'building', 'floor', 'unit']);
  assert.deepEqual(path.map((n) => n.id), ['est_wing_fu_garden', 'blk_wfg_a', 'fl_wfg_a_12', 'unit_wfg_a_12_a1']);
});

test('scopePathInFocus keeps rows under the picked node and drops the rest', () => {
  assert.equal(scopePathInFocus(pathA1, null), true);
  assert.equal(scopePathInFocus(pathA1, 'building:blk_wfg_a'), true);
  assert.equal(scopePathInFocus(pathB2, 'building:blk_wfg_a'), false);
  assert.equal(scopePathInFocus(pathB2, 'building:blk_wfg_b'), true);
  assert.equal(scopePathInFocus(pathA1, 'estate:est_wing_fu_garden'), true);
  assert.equal(scopePathInFocus({ node: { kind: 'unit', id: 'x' }, ancestry: [], unassigned: true }, 'estate:est_wing_fu_garden'), false);
});

test('helpdesk unit strings match Block A / 12/F / Flat A1', () => {
  const rail = buildRailNodes(TREE, SCOPE);
  const a = findRailNode(rail, 'building:blk_wfg_a');
  const b = findRailNode(rail, 'building:blk_wfg_b');
  const floor = findRailNode(rail, 'floor:fl_wfg_a_12');
  const unit = findRailNode(rail, 'unit:unit_wfg_a_12_a1');
  assert.equal(helpdeskUnitInFocus('A · 12/F A1', a), true);
  assert.equal(helpdeskUnitInFocus('B · 18/F B4', a), false);
  assert.equal(helpdeskUnitInFocus('B · 18/F B4', b), true);
  assert.equal(helpdeskUnitInFocus('A · 12/F A1', floor), true);
  assert.equal(helpdeskUnitInFocus('A · 7/F A2', floor), false);
  assert.equal(helpdeskUnitInFocus('A · 12/F A1', unit), true);
  assert.equal(helpdeskUnitInFocus('A · 7/F A2', unit), false);
});

test('filterTreeToFocus keeps ancestors and the subtree', () => {
  const rail = buildRailNodes(TREE, SCOPE);
  const vis = filterTreeToFocus(rail, 'building:blk_wfg_a');
  assert.deepEqual(vis.map((n) => n.node.id), ['est_wing_fu_garden', 'blk_wfg_a', 'fl_wfg_a_12', 'unit_wfg_a_12_a1']);
  assert.equal(vis.some((n) => n.node.id === 'blk_wfg_b'), false);
});

test('node keys stay kind:id', () => {
  const rail = buildRailNodes(TREE, SCOPE);
  assert.equal(nodeKey(rail[0]!), 'estate:est_wing_fu_garden');
});
