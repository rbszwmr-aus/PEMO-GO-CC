/**
 * A flat (home) as people read it: block, floor, unit. Never a system id.
 * English: "A · 12/F A1". Chinese stays localised: "A座12樓A1" / "A座12楼A1".
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New; shared by Reports rows and the Facility calendar chips.
 */

import { pick, type Locale } from '../i18n/locale.ts';

export interface Flat {
  block: string;
  floor: number;
  unit: string;
}

export function flatLabel(f: Flat, locale: Locale): string {
  return pick(locale, {
    en: `${f.block} · ${f.floor}/F ${f.unit}`,
    'zh-Hant': `${f.block}座${f.floor}樓${f.unit}`,
    'zh-Hans': `${f.block}座${f.floor}楼${f.unit}`,
  });
}

/** The i-th home of the estate: unique for i < 12 per floor, deterministic. */
export function flatAt(i: number): Flat {
  const slot = i % 12;
  const block = 'ABC'[slot % 3] as string;
  return { block, floor: 3 + Math.floor(i / 12), unit: `${block}${1 + Math.floor(slot / 3)}` };
}
