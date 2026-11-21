/**
 * Facility calendar: the rules that decide what each view and each cell shows, as plain
 * functions so they are testable without a browser.
 *
 * Single facility (the default): a cell shows up to three chips (time · flat), then "+N more".
 * All facilities: chips carry the facility too, and a cell with more than two bookings swaps its
 * chips for one count pill per facility ("BBQ 2 · Pool 1"). Cancelled bookings are not drawn.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import { copy, type Locale } from '../i18n/locale.ts';
import { addDays, mondayOf, type BookingRow } from '../data/booking-fixtures.ts';

export type CalMode = 'day' | 'week' | 'month' | 'year';
export const CAL_MODES: readonly CalMode[] = ['day', 'week', 'month', 'year'];
export const ALL_FACILITIES = 'all';

/** Chips in a single-facility month cell before "+N more". */
export const MAX_CHIPS = 3;
/** In All mode a cell with more bookings than this shows count pills instead of chips. */
export const MAX_ALL_CHIPS = 2;

const SHORT = {
  fac_wfg_clubhouse_mp: copy('Clubhouse', '會所', '会所'),
  fac_wfg_bbq: copy('BBQ', '燒烤', '烧烤'),
  fac_wfg_tennis: copy('Tennis', '網球', '网球'),
  fac_wfg_pool_lane: copy('Pool', '泳池', '泳池'),
  fac_wfg_function: copy('Function', '宴會廳', '宴会厅'),
} as const;

export function shortFacility(facilityId: string, locale: Locale, fallback: string): string {
  const c = (SHORT as Record<string, ReturnType<typeof copy> | undefined>)[facilityId];
  return c ? c[locale] : fallback;
}

/** 1..5: which tint a facility wears in All mode, by its place in the facility list. */
export function tintOf(facilityId: string, order: readonly string[]): number {
  const i = order.indexOf(facilityId);
  return (i < 0 ? 0 : i % 5) + 1;
}

export const drawn = (rows: readonly BookingRow[]): BookingRow[] =>
  rows.filter((b) => b.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date) || a.slotStart.localeCompare(b.slotStart));

const parts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) });
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Six Monday-first weeks that cover the month, so out-of-month days are present and greyed. */
export function monthGrid(day: string): string[] {
  const { y, m } = parts(day);
  const start = mondayOf(iso(y, m, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const weekDays = (day: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(day), i));

/** ‹ and › step one day, week, month or year; a month step keeps the day or clamps to the month end. */
export function shift(day: string, mode: CalMode, dir: 1 | -1): string {
  const { y, m, d } = parts(day);
  if (mode === 'day') return addDays(day, dir);
  if (mode === 'week') return addDays(day, 7 * dir);
  if (mode === 'month') {
    const idx = y * 12 + (m - 1) + dir;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    return iso(ny, nm, Math.min(d, dim(ny, nm)));
  }
  return iso(y + dir, m, Math.min(d, dim(y + dir, m)));
}

export interface Pill { facilityId: string; count: number }
export type CellView =
  | { kind: 'chips'; chips: BookingRow[]; more: number }
  | { kind: 'pills'; pills: Pill[]; total: number };

/** What a month cell shows for one day's bookings (already drawn(), start-time order). */
export function cellView(dayRows: readonly BookingRow[], facility: string, order: readonly string[]): CellView {
  if (facility !== ALL_FACILITIES) {
    const mine = dayRows.filter((b) => b.facilityId === facility);
    return { kind: 'chips', chips: mine.slice(0, MAX_CHIPS), more: Math.max(0, mine.length - MAX_CHIPS) };
  }
  if (dayRows.length <= MAX_ALL_CHIPS) return { kind: 'chips', chips: [...dayRows], more: 0 };
  const counts = new Map<string, number>();
  for (const b of dayRows) counts.set(b.facilityId, (counts.get(b.facilityId) ?? 0) + 1);
  const pills = [...counts.entries()]
    .map(([facilityId, count]) => ({ facilityId, count }))
    .sort((a, b) => order.indexOf(a.facilityId) - order.indexOf(b.facilityId));
  return { kind: 'pills', pills, total: dayRows.length };
}

/** "BBQ 2 · Pool 1" */
export const pillsText = (pills: readonly Pill[], name: (id: string) => string): string => pills.map((p) => `${name(p.facilityId)} ${p.count}`).join(' · ');

/** Hours drawn on the Day view, 07:00 to 22:00. */
export const DAY_HOURS: readonly number[] = Array.from({ length: 16 }, (_, i) => 7 + i);
