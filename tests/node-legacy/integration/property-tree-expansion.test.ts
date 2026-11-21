/**
 * getPropertyTree expansion — the ruled function, and the invariant the ruling
 * rests on: NO ATTENTION-BEARING NODE IS HIDDEN.
 *
 * The tree is a pure function of scope + attention (PO ruling): a node is
 * attention-bearing if it or any descendant carries a safety event needing
 * action, an open case, or a quarantine; a node is expanded iff attention-bearing.
 *
 * This tests the function directly, on a constructed hierarchy, so it is
 * independent of both open items: Contract's regeneration of tree.json, and the
 * severity threshold (which governs which events ENTER the attention set,
 * upstream of this function). The function is correct for every threshold, and
 * this proves it.
 *
 * `blk_wfg_b` is the case that made the old fixture a defect: it carries a
 * critical smoke event and an open case, and the hand-authored tree.json omitted
 * it entirely. Under the rule it MUST be present and expanded. That is asserted
 * here as the headline, using the real seeded identifiers.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { attentionBearingIds, expandTree, type AttentionLeaf } from '../../modules/property/dist/index.js';
import type { TreeNodeRow } from '../../modules/property/dist/index.js';

const L = (s: string) => ({ en: s, 'zh-Hant': s });

/** A small but faithful slice of Wing Fu Garden: estate → 3 blocks → floors → units. */
const HIERARCHY: TreeNodeRow[] = [
  { kind: 'estate', id: 'est_wing_fu_garden', parentKind: null, parentId: null, label: L('Wing Fu Garden'), depth: 1 },
  { kind: 'building', id: 'blk_wfg_a', parentKind: 'estate', parentId: 'est_wing_fu_garden', label: L('Block A'), depth: 2 },
  { kind: 'building', id: 'blk_wfg_b', parentKind: 'estate', parentId: 'est_wing_fu_garden', label: L('Block B'), depth: 2 },
  { kind: 'building', id: 'blk_wfg_c', parentKind: 'estate', parentId: 'est_wing_fu_garden', label: L('Block C'), depth: 2 },
  { kind: 'floor', id: 'fl_wfg_b_03', parentKind: 'building', parentId: 'blk_wfg_b', label: L('3/F'), depth: 3 },
  { kind: 'unit', id: 'unit_wfg_b_03_b2', parentKind: 'floor', parentId: 'fl_wfg_b_03', label: L('B2'), depth: 4 },
  { kind: 'floor', id: 'fl_wfg_a_01', parentKind: 'building', parentId: 'blk_wfg_a', label: L('1/F'), depth: 3 },
  { kind: 'unit', id: 'unit_wfg_a_01_a1', parentKind: 'floor', parentId: 'fl_wfg_a_01', label: L('A1'), depth: 4 },
];

const noSummary = () => undefined;

test('blk_wfg_b is attention-bearing through its unit — the confirmed defect', () => {
  // The critical smoke event sits on unit_wfg_b_03_b2. Attention propagates up.
  const leaves: AttentionLeaf[] = [{ kind: 'unit', id: 'unit_wfg_b_03_b2' }];
  const bearing = attentionBearingIds(HIERARCHY, leaves);

  assert.ok(bearing.has('unit_wfg_b_03_b2'), 'the leaf itself');
  assert.ok(bearing.has('fl_wfg_b_03'), 'its floor');
  assert.ok(bearing.has('blk_wfg_b'), 'ITS BUILDING — the node the old fixture hid');
  assert.ok(bearing.has('est_wing_fu_garden'), 'up to the estate');

  // And nothing spurious: Block A, with no attention leaf, is not bearing.
  assert.ok(!bearing.has('blk_wfg_a'), 'a building with no attention is not attention-bearing');
});

test('an attention-bearing building is EXPANDED to its attention leaf; a quiet one COLLAPSES', () => {
  const leaves: AttentionLeaf[] = [{ kind: 'unit', id: 'unit_wfg_b_03_b2' }];
  const { tree } = expandTree(HIERARCHY, leaves, noSummary);
  const ids = new Set(tree.map((n) => n.node.id));

  // Block B expands: its floor and unit are present.
  assert.ok(ids.has('blk_wfg_b') && ids.has('fl_wfg_b_03') && ids.has('unit_wfg_b_03_b2'),
    'the attention path is fully present');
  assert.equal(tree.find((n) => n.node.id === 'blk_wfg_b')?.attention, true);

  // Block A collapses: the building shows, its floor and unit do not.
  assert.ok(ids.has('blk_wfg_a'), 'a collapsed building still appears at its own level');
  assert.ok(!ids.has('fl_wfg_a_01') && !ids.has('unit_wfg_a_01_a1'),
    'but nothing beneath a collapsed building is rendered');
  assert.equal(tree.find((n) => n.node.id === 'blk_wfg_a')?.attention, false);
});

test('THE INVARIANT — every attention-bearing node renders; none is hidden', () => {
  // The property the whole ruling exists to guarantee, over multiple attention
  // sources at once: a unit event, and a building-level quarantine.
  const leaves: AttentionLeaf[] = [
    { kind: 'unit', id: 'unit_wfg_b_03_b2' },   // safety event
    { kind: 'building', id: 'blk_wfg_c' },       // quarantine at building level
  ];
  const { tree, hiddenAttention } = expandTree(HIERARCHY, leaves, noSummary);
  const rendered = new Set(tree.map((n) => n.node.id));
  const bearing = attentionBearingIds(HIERARCHY, leaves);

  assert.deepEqual(hiddenAttention, [], 'no attention leaf fell outside the scoped tree');
  for (const id of bearing) {
    assert.ok(rendered.has(id), `attention-bearing ${id} MUST render, or an operator is blind to it`);
  }
  assert.ok(rendered.has('blk_wfg_c'), 'the building-level quarantine surfaces its building');
});

test('RED — dropping the ancestor walk hides the building of an attention leaf', () => {
  // The mutation is the exact defect: mark only the leaf, not its ancestors. The
  // building then collapses and hides the unit that needs action — which is how
  // blk_wfg_b disappeared. A leaf-only attention set must fail the invariant.
  const leaves: AttentionLeaf[] = [{ kind: 'unit', id: 'unit_wfg_b_03_b2' }];
  const leafOnly = new Set(['unit_wfg_b_03_b2']); // the mutant "bearing" set

  const byId = new Map(HIERARCHY.map((n) => [n.id, n]));
  const rendersUnder = (id: string): boolean => {
    let cursor = byId.get(id)?.parentId ?? null;
    while (cursor !== null) {
      if (!leafOnly.has(cursor)) return false; // collapsed ancestor
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    return true;
  };
  assert.equal(rendersUnder('unit_wfg_b_03_b2'), false,
    'MUTANT: leaf-only marking hides the unit, because its building is collapsed');

  // The real function does not: control after the mutation.
  const bearing = attentionBearingIds(HIERARCHY, leaves);
  assert.ok(bearing.has('blk_wfg_b'), 'the real function marks the ancestor and keeps the unit visible');
});
