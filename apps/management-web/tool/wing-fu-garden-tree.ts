/**
 * Wing Fu Garden residential tree, from the same basis as
 * database/seeds/15-property-wing-fu-garden-magnitude.sql.
 *
 * 812 is 8×35 + 7×22 + 9×42. Floor numbering omits 4, 13, 14 and every floor
 * ending in 4. Fixture-world magnitudes — not Charming Garden 富榮花園 (a
 * different estate with 18 numbered blocks). Do not rename.
 */

import type { ScopeTreeNode } from '../src/data/types.ts';

export const WING_FU_GARDEN = {
  estateId: 'est_wing_fu_garden',
  orgId: 'org_wingfu_holdings',
  name: { en: 'Wing Fu Garden', 'zh-Hant': '榮富花園' as const },
  orgName: { en: 'Wing Fu Property Management', 'zh-Hant': '榮富物業管理' as const },
  summary: { en: '3 blocks · 812 units', 'zh-Hant': '3座 · 812單位' as const },
  unitsTotal: 812,
} as const;

export const WING_FU_BLOCKS = [
  { id: 'blk_wfg_a', code: 'a', letter: 'A', unitsPerFloor: 8, topFloor: 40, sequence: 1, attention: false },
  { id: 'blk_wfg_b', code: 'b', letter: 'B', unitsPerFloor: 7, topFloor: 26, sequence: 2, attention: false },
  { id: 'blk_wfg_c', code: 'c', letter: 'C', unitsPerFloor: 9, topFloor: 48, sequence: 3, attention: true },
] as const;

/** Hong Kong omit-rule, same predicate as the seed view residential_floor. */
export function residentialOrdinals(topFloor: number): number[] {
  const out: number[] = [];
  for (let n = 1; n <= topFloor; n++) {
    if (n % 10 === 4 || n === 13 || n === 14) continue;
    out.push(n);
  }
  return out;
}

export function padFloor(ordinal: number): string {
  return String(ordinal).padStart(2, '0');
}

const loc = (en: string, zh: string) => ({ en, 'zh-Hant': zh });

export function buildWingFuGardenTreeNodes(): ScopeTreeNode[] {
  const estate = loc(WING_FU_GARDEN.name.en, WING_FU_GARDEN.name['zh-Hant']);
  const org = loc(WING_FU_GARDEN.orgName.en, WING_FU_GARDEN.orgName['zh-Hant']);
  const nodes: ScopeTreeNode[] = [
    {
      node: { kind: 'estate', id: WING_FU_GARDEN.estateId, label: estate },
      parent: { kind: 'organization', id: WING_FU_GARDEN.orgId, label: org },
      label: estate,
      summary: loc(WING_FU_GARDEN.summary.en, WING_FU_GARDEN.summary['zh-Hant']),
      depth: 0,
      sequence: 1,
      permittedActions: ['composeNotice'],
    },
  ];

  for (const block of WING_FU_BLOCKS) {
    const building = loc(`Block ${block.letter}`, `${block.letter}座`);
    nodes.push({
      node: { kind: 'building', id: block.id, label: building },
      parent: { kind: 'estate', id: WING_FU_GARDEN.estateId, label: estate },
      label: building,
      depth: 1,
      sequence: block.sequence,
      ...(block.attention ? { attention: true } : {}),
      permittedActions: ['composeNotice'],
    });
    for (const ordinal of residentialOrdinals(block.topFloor)) {
      const floorId = `fl_wfg_${block.code}_${padFloor(ordinal)}`;
      const floor = loc(`${ordinal}/F`, `${ordinal}樓`);
      nodes.push({
        node: { kind: 'floor', id: floorId, label: floor },
        parent: { kind: 'building', id: block.id, label: building },
        label: floor,
        depth: 2,
        sequence: ordinal,
        permittedActions: ['composeNotice'],
      });
      for (let u = 1; u <= block.unitsPerFloor; u++) {
        const flat = `${block.letter}${u}`;
        const unitId = `unit_wfg_${block.code}_${padFloor(ordinal)}_${block.code}${u}`;
        const unit = loc(`Flat ${flat}`, `${flat}室`);
        nodes.push({
          node: { kind: 'unit', id: unitId, label: unit },
          parent: { kind: 'floor', id: floorId, label: floor },
          label: unit,
          depth: 3,
          sequence: u,
          permittedActions: ['composeNotice'],
        });
      }
    }
  }
  return nodes;
}
