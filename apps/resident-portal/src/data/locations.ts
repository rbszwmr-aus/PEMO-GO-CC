/**
 * Host-unit labels for the portal. The portal has no location-tree API of its own,
 * so a unit id is turned into the tree's own wording ("Block A · 12/F · Flat A1")
 * from the ids the demo stores use (`unt_demo_a_12f_a1`, `unit_wfg_a_12_a1`). When the
 * API sends a label with the visitor, that wins; a raw id is never shown.
 */
import { pick, type Locale } from '../i18n/locale.ts';

const UNIT_ID = /^un(?:it|t)_(?:wfg|demo)_([a-z])_(\d{1,2})f?_([a-z]\d{1,2})$/i;

export interface UnitPlace {
  block: string;
  floor: number;
  unit: string;
}

export function parseUnitId(unitId: string | null | undefined): UnitPlace | null {
  const m = unitId ? UNIT_ID.exec(unitId.trim()) : null;
  if (!m) return null;
  return { block: m[1]!.toUpperCase(), floor: Number(m[2]), unit: m[3]!.toUpperCase() };
}

/** "Block A · 12/F · Flat A1", "A座 · 12樓 · A1室" or "A栋 · 12楼 · A1室"; null when the id is not one we can read. */
export function unitLocationLabel(unitId: string | null | undefined, locale: Locale): string | null {
  const p = parseUnitId(unitId);
  if (!p) return null;
  return pick(locale, {
    en: `Block ${p.block} · ${p.floor}/F · Flat ${p.unit}`,
    'zh-Hant': `${p.block}座 · ${p.floor}樓 · ${p.unit}室`,
    'zh-Hans': `${p.block}栋 · ${p.floor}楼 · ${p.unit}室`,
  });
}
