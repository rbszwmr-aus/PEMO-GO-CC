/**
 * Sequence then id is the sibling order for the properties / SCOPE tree.
 * Magnitudes follow seed 15 (fixture world), not Charming Garden 富榮花園.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { compareSequenceThenId, compareSiblings } from '../../src/shell/sequence-sort.ts';
import { buildRailNodes } from '../../src/shell/scope-focus.ts';
import { REPO_ROOT } from '../../tool/corpus-source.ts';
import {
  WING_FU_BLOCKS,
  WING_FU_GARDEN,
  buildWingFuGardenTreeNodes,
  residentialOrdinals,
} from '../../tool/wing-fu-garden-tree.ts';
import type { ScopeKind, ScopeTreeNode } from '../../src/data/types.ts';

const loc = (en: string) => ({ en, 'zh-Hant': en });

function node(
  kind: ScopeKind,
  id: string,
  label: string,
  sequence: number,
  parent?: { kind: ScopeKind; id: string } | null,
): ScopeTreeNode {
  return {
    node: { kind, id },
    parent: parent ?? null,
    label: loc(label),
    depth: 0,
    sequence,
    permittedActions: [],
  };
}

test('compareSequenceThenId orders by sequence then id, never by label', () => {
  const zebra = { sequence: 1, id: 'blk_z', label: 'Zebra' };
  const apple = { sequence: 2, id: 'blk_a', label: 'Apple' };
  assert.ok(compareSequenceThenId(zebra, apple) < 0, 'sequence 1 precedes 2 even when the label would reverse it');
  assert.ok(compareSequenceThenId({ sequence: 1, id: 'z' }, { sequence: 1, id: 'a' }) > 0, 'equal sequence falls through to id');
  assert.ok(compareSequenceThenId({ id: 'missing' }, { sequence: 0, id: 'first' }) > 0, 'missing sequence sorts last');
});

test('rail siblings follow sequence even when the payload lists C before A', () => {
    const tree = {
    meta: { correlationId: 'c', contractVersion: '2.4.0', generatedAt: '2026-08-12T00:00:00+08:00' },
    nodes: [
      node('estate', 'est_wing_fu_garden', 'Wing Fu Garden', 1),
      node('building', 'blk_wfg_c', 'Block C', 3, { kind: 'estate', id: 'est_wing_fu_garden' }),
      node('building', 'blk_wfg_a', 'Block A', 1, { kind: 'estate', id: 'est_wing_fu_garden' }),
      node('building', 'blk_wfg_b', 'Block B', 2, { kind: 'estate', id: 'est_wing_fu_garden' }),
    ],
  };
  const rail = buildRailNodes(tree, null);
  assert.deepEqual(
    rail.filter((n) => n.node.kind === 'building').map((n) => n.node.id),
    ['blk_wfg_a', 'blk_wfg_b', 'blk_wfg_c'],
  );
});

test('Wing Fu Garden tree is A then B then C with Block B floors and flats', () => {
  const nodes = buildWingFuGardenTreeNodes();
  const buildings = nodes.filter((n) => n.node.kind === 'building');
  assert.deepEqual(buildings.map((n) => n.label.en), ['Block A', 'Block B', 'Block C']);
  assert.deepEqual(buildings.map((n) => n.sequence), [1, 2, 3]);
  assert.ok(nodes.some((n) => n.node.id === 'blk_wfg_b'), 'Block B is present');

  const bFloors = nodes.filter((n) => n.node.kind === 'floor' && n.parent?.id === 'blk_wfg_b');
  assert.ok(bFloors.length > 0, 'Block B has floors');
  assert.equal(bFloors.length, residentialOrdinals(26).length);
  assert.equal(bFloors.some((n) => n.label.en === '4/F' || n.label.en === '13/F' || n.label.en === '14/F'), false);

  const firstBFloor = bFloors[0]!;
  const flats = nodes.filter((n) => n.node.kind === 'unit' && n.parent?.id === firstBFloor.node.id);
  assert.equal(flats.length, 7);
  assert.deepEqual(flats.map((n) => n.label.en), ['Flat B1', 'Flat B2', 'Flat B3', 'Flat B4', 'Flat B5', 'Flat B6', 'Flat B7']);
});

test('tree magnitudes match seed 15 and are not Charming Garden', () => {
  const nodes = buildWingFuGardenTreeNodes();
  const units = nodes.filter((n) => n.node.kind === 'unit');
  const floors = nodes.filter((n) => n.node.kind === 'floor');
  assert.equal(units.length, WING_FU_GARDEN.unitsTotal);
  assert.equal(units.length, 8 * 35 + 7 * 22 + 9 * 42);
  assert.equal(floors.length, 35 + 22 + 42);

  for (const block of WING_FU_BLOCKS) {
    const blockFloors = nodes.filter((n) => n.node.kind === 'floor' && n.parent?.id === block.id);
    const blockUnits = nodes.filter((n) => n.node.kind === 'unit' && n.parent?.id?.startsWith(`fl_wfg_${block.code}_`));
    assert.equal(blockFloors.length, residentialOrdinals(block.topFloor).length, block.letter);
    assert.equal(blockUnits.length, block.unitsPerFloor * blockFloors.length, block.letter);
  }

  const blob = JSON.stringify(nodes);
  assert.equal(blob.includes('Charming Garden'), false);
  assert.equal(blob.includes('富榮花園'), false);
  assert.ok(blob.includes('Wing Fu Garden'));
  assert.ok(blob.includes('榮富花園'));
});

test('committed tree.json is generated from the seed-15 basis', () => {
  const committed = JSON.parse(
    readFileSync(join(REPO_ROOT, 'tests/fixtures/management-web/mob-s3-properties/tree.json'), 'utf8'),
  );
  assert.deepEqual(committed.nodes, buildWingFuGardenTreeNodes());
  assert.equal(committed.nodes.length, 1 + 3 + 99 + 812);
});

test('facilities and shared areas are the top children under their parent, the rest keep their order', () => {
  const est = { kind: 'estate' as const, id: 'est_wing_fu_garden' };
  const tree = {
    meta: { correlationId: 'c', contractVersion: '2.4.0', generatedAt: '2026-08-12T00:00:00+08:00' },
    nodes: [
      node('estate', 'est_wing_fu_garden', 'Wing Fu Garden', 1),
      node('building', 'blk_wfg_a', 'Block A', 1, est),
      node('building', 'blk_wfg_b', 'Block B', 2, est),
      node('location', 'loc_wfg_pool', 'Swimming pool', 7, est),
      node('building', 'blk_wfg_c', 'Block C', 3, est),
      node('location', 'loc_wfg_clubhouse', 'Wing Fu Clubhouse', 9, est),
      node('location', 'loc_wfg_function_room', 'Function room', 1, { kind: 'location', id: 'loc_wfg_clubhouse' }),
      node('floor', 'fl_wfg_a_01', '1/F', 1, { kind: 'building', id: 'blk_wfg_a' }),
    ],
  };
  const rail = buildRailNodes(tree, null);
  const under = (pid: string) => rail.filter((n) => n.parent?.id === pid).map((n) => n.node.id);
  assert.deepEqual(under('est_wing_fu_garden'), ['loc_wfg_pool', 'loc_wfg_clubhouse', 'blk_wfg_a', 'blk_wfg_b', 'blk_wfg_c']);
  // Depth-first walk: a facility's own children follow it directly, before the blocks.
  assert.deepEqual(rail.map((n) => n.node.id), [
    'est_wing_fu_garden', 'loc_wfg_pool', 'loc_wfg_clubhouse', 'loc_wfg_function_room',
    'blk_wfg_a', 'fl_wfg_a_01', 'blk_wfg_b', 'blk_wfg_c',
  ]);
  assert.ok(compareSiblings({ kind: 'location', sequence: 99, id: 'z' }, { kind: 'building', sequence: 1, id: 'a' }) < 0);
  assert.equal(compareSiblings({ kind: 'building', sequence: 1, id: 'a' }, { kind: 'building', sequence: 1, id: 'a' }), 0);
  // Without any facility the order is exactly what it was.
  const plain = buildRailNodes({ ...tree, nodes: tree.nodes.filter((n) => n.node.kind !== 'location') }, null);
  assert.deepEqual(plain.filter((n) => n.node.kind === 'building').map((n) => n.node.id), ['blk_wfg_a', 'blk_wfg_b', 'blk_wfg_c']);
});
