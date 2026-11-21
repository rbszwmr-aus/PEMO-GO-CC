/**
 * Collapse is client chrome over the server nested preorder.
 *
 * The walk is not re-sorted. Default hides floors and units. Expand all
 * missing is a failure, not a skip — see test/artefact/tree-collapse.test.ts
 * for the same predicate over dist/.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScopeKind, ScopeTreeNode } from '../../src/data/types.ts';
import {
  collapseAll,
  collapseSubtree,
  defaultExpanded,
  expandAll,
  expandSubtree,
  expandedToRevealMatches,
  nodeKey,
  nodeMatchesQuery,
  searchKeepKeys,
  toggleExpanded,
  visibleNodes,
  visibleNodesForQuery,
  withChildren,
} from '../../src/screens/tree-collapse.ts';

const loc = (en: string) => ({ en, 'zh-Hant': en });

function node(
  kind: ScopeKind,
  id: string,
  depth: number,
  label: string,
  parent?: { kind: ScopeKind; id: string } | null,
): ScopeTreeNode {
  return { node: { kind, id }, parent: parent ?? null, label: loc(label), depth, permittedActions: [] };
}

/** Nested preorder, not kind-grouped: Block A floor/unit sit before Block C. */
const NESTED: ScopeTreeNode[] = [
  node('estate', 'e1', 0, 'Wing Fu Garden'),
  node('building', 'bA', 1, 'Block A', { kind: 'estate', id: 'e1' }),
  node('floor', 'fA12', 2, '12/F', { kind: 'building', id: 'bA' }),
  node('unit', 'uA1', 3, 'Flat A1', { kind: 'floor', id: 'fA12' }),
  node('building', 'bC', 1, 'Block C', { kind: 'estate', id: 'e1' }),
];

const kindsOf = (nodes: ScopeTreeNode[]) => nodes.map((n) => n.node.kind);
const labelsOf = (nodes: ScopeTreeNode[]) => nodes.map((n) => n.label.en);

test('default view shows estate and buildings, not floors or units', () => {
  const vis = visibleNodes(NESTED, defaultExpanded(NESTED));
  assert.deepEqual(kindsOf(vis), ['estate', 'building', 'building']);
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block A', 'Block C']);
  assert.equal(vis.some((n) => n.node.kind === 'unit'), false);
  assert.equal(vis.some((n) => n.node.kind === 'floor'), false);
});

test('expand all shows every node in the original nested preorder', () => {
  const vis = visibleNodes(NESTED, expandAll(NESTED));
  assert.equal(vis.length, NESTED.length);
  assert.deepEqual(vis.map(nodeKey), NESTED.map(nodeKey));
  assert.deepEqual(kindsOf(vis), ['estate', 'building', 'floor', 'unit', 'building']);
  assert.notDeepEqual(kindsOf(vis), ['estate', 'building', 'building', 'floor', 'unit']);
});

test('collapse all hides floors and units', () => {
  const vis = visibleNodes(NESTED, collapseAll(NESTED));
  assert.deepEqual(kindsOf(vis), ['estate', 'building', 'building']);
  assert.equal(vis.some((n) => n.node.kind === 'unit' || n.node.kind === 'floor'), false);
});

test('expanding one building shows its floors, not its units and not another building', () => {
  const blockA = NESTED[1]!;
  assert.equal(withChildren(NESTED).has(nodeKey(blockA)), true);
  const vis = visibleNodes(NESTED, toggleExpanded(defaultExpanded(NESTED), nodeKey(blockA)));
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block A', '12/F', 'Block C']);
  assert.equal(vis.some((n) => n.node.kind === 'unit'), false);
});

test('the walk is not re-sorted by kind', () => {
  const vis = visibleNodes(NESTED, expandAll(NESTED));
  const firstFloor = vis.findIndex((n) => n.node.kind === 'floor');
  const secondBuilding = vis.findIndex((n) => n.node.id === 'bC');
  assert.ok(firstFloor > 0, 'a floor is missing');
  assert.ok(secondBuilding > 0, 'Block C is missing');
  assert.ok(firstFloor < secondBuilding, 'a Block A floor must precede Block C; kind-grouped would reverse that');
});

/** Two buildings with floors and units so a block action cannot leak across siblings. */
const TWO_BLOCKS: ScopeTreeNode[] = [
  node('estate', 'e1', 0, 'Wing Fu Garden'),
  node('building', 'bA', 1, 'Block A', { kind: 'estate', id: 'e1' }),
  node('floor', 'fA12', 2, '12/F', { kind: 'building', id: 'bA' }),
  node('unit', 'uA1', 3, 'Flat A1', { kind: 'floor', id: 'fA12' }),
  node('building', 'bB', 1, 'Block B', { kind: 'estate', id: 'e1' }),
  node('floor', 'fB1', 2, '1/F', { kind: 'building', id: 'bB' }),
  node('unit', 'uB1', 3, 'Flat B1', { kind: 'floor', id: 'fB1' }),
];

test('expanding a block subtree shows that block floors and units only', () => {
  const blockA = nodeKey(TWO_BLOCKS[1]!);
  const blockB = nodeKey(TWO_BLOCKS[4]!);
  const vis = visibleNodes(TWO_BLOCKS, expandSubtree(defaultExpanded(TWO_BLOCKS), TWO_BLOCKS, blockB));
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block A', 'Block B', '1/F', 'Flat B1']);
  assert.equal(vis.some((n) => n.label.en === '12/F' || n.label.en === 'Flat A1'), false);
  const expanded = expandSubtree(defaultExpanded(TWO_BLOCKS), TWO_BLOCKS, blockB);
  assert.equal(expanded.has(blockA), false);
  assert.equal(expanded.has(blockB), true);
  assert.equal(expanded.has(nodeKey(TWO_BLOCKS[5]!)), true);
});

test('collapsing a block subtree leaves another block expansion alone', () => {
  const blockA = nodeKey(TWO_BLOCKS[1]!);
  const blockB = nodeKey(TWO_BLOCKS[4]!);
  const both = expandSubtree(expandSubtree(defaultExpanded(TWO_BLOCKS), TWO_BLOCKS, blockA), TWO_BLOCKS, blockB);
  const visBoth = visibleNodes(TWO_BLOCKS, both);
  assert.deepEqual(labelsOf(visBoth), ['Wing Fu Garden', 'Block A', '12/F', 'Flat A1', 'Block B', '1/F', 'Flat B1']);

  const after = collapseSubtree(both, TWO_BLOCKS, blockB);
  const vis = visibleNodes(TWO_BLOCKS, after);
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block A', '12/F', 'Flat A1', 'Block B']);
  assert.equal(after.has(blockA), true);
  assert.equal(after.has(nodeKey(TWO_BLOCKS[2]!)), true);
  assert.equal(after.has(blockB), false);
  assert.equal(after.has(nodeKey(TWO_BLOCKS[5]!)), false);
});

test('a flat query keeps the unit and ancestors, not a sibling block', () => {
  const keep = searchKeepKeys(TWO_BLOCKS, 'Flat B1');
  assert.deepEqual(
    TWO_BLOCKS.filter((n) => keep.has(nodeKey(n))).map((n) => n.label.en),
    ['Wing Fu Garden', 'Block B', '1/F', 'Flat B1'],
  );
  assert.equal(keep.has(nodeKey(TWO_BLOCKS[1]!)), false);
  assert.equal(keep.has(nodeKey(TWO_BLOCKS[3]!)), false);
});

test('search auto-expand opens ancestors so the matching flat is visible', () => {
  const query = 'Flat B1';
  const vis = visibleNodesForQuery(TWO_BLOCKS, expandedToRevealMatches(TWO_BLOCKS, query), query);
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block B', '1/F', 'Flat B1']);
  assert.equal(vis.some((n) => n.label.en === 'Block A' || n.label.en === 'Flat A1'), false);
});

test('empty query leaves the default estate-and-buildings view', () => {
  const vis = visibleNodesForQuery(TWO_BLOCKS, defaultExpanded(TWO_BLOCKS), '   ');
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block A', 'Block B']);
  assert.equal(searchKeepKeys(TWO_BLOCKS, '   ').size, 0);
});

test('zh-Hant labels match even when the English label does not', () => {
  const bilingual: ScopeTreeNode[] = [
    { ...TWO_BLOCKS[0]!, label: { en: 'Wing Fu Garden', 'zh-Hant': '榮富花園' } },
    { ...TWO_BLOCKS[1]!, label: { en: 'Block A', 'zh-Hant': 'A座' } },
  ];
  assert.equal(nodeMatchesQuery(bilingual[1]!, 'a座'), true);
  assert.equal(nodeMatchesQuery(bilingual[1]!, 'block a'), true);
  const keep = searchKeepKeys(bilingual, '榮富');
  assert.equal(keep.has(nodeKey(bilingual[0]!)), true);
  assert.equal(keep.has(nodeKey(bilingual[1]!)), false);
});

test('a matching block does not keep non-matching floors', () => {
  const vis = visibleNodesForQuery(
    TWO_BLOCKS,
    expandedToRevealMatches(TWO_BLOCKS, 'Block B'),
    'Block B',
  );
  assert.deepEqual(labelsOf(vis), ['Wing Fu Garden', 'Block B']);
});
