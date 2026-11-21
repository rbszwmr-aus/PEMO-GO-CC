/**
 * Dashboard fixture: the estate figures, the 30-day daily series and the pop-up rows behind every chart item.
 * Fixtures are the data source for now (no API call). Everything derives from the two daily arrays, so a card,
 * a donut segment and a bar can never disagree: Bookings = sum of the bars in the period = Confirmed.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New: moved out of the mockup. Period windows (today ... custom) slice the 30 fixture days.
 */

import { copy, type Copy } from '../i18n/locale.ts';

const m = copy;

export const DASH_DAYS = 30;
/** First fixture day, 21 Oct 2026 (Hong Kong time); the last is 19 Nov 2026. */
export const DASH_FIRST_DAY = Date.UTC(2026, 9, 21);
const DAY_MS = 86_400_000;

export const BOOKINGS_PER_DAY: readonly number[] = [0, 1, 2, 1, 0, 3, 4, 2, 1, 2, 3, 5, 2, 1, 0, 2, 3, 4, 6, 3, 2, 1, 2, 4, 5, 3, 2, 3, 4, 2];
export const SAFETY_PER_DAY: readonly number[] = [0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 3, 1, 0, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 4, 1, 0, 1, 0];

export const ESTATE = { locations: 8, households: 126, occupied: 98, safetyDue: 3 } as const;
/** Pending and cancelled bookings over the full 30 days; a shorter period takes its share. */
const PENDING_30 = 5;
const CANCELLED_30 = 4;
/** Receipts are a flat fixture rate per confirmed booking. */
export const HKD_PER_BOOKING = 250;

export type DashPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'last30' | 'custom';
export const DASH_PERIODS: readonly DashPeriod[] = ['today', 'week', 'month', 'quarter', 'year', 'last30', 'custom'];

/** Inclusive day-index window inside the 30 fixture days. */
export type DayWindow = { from: number; to: number };

export const dayIndexOf = (iso: string): number => {
  const [y, mo, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y!, mo! - 1, d!) - DASH_FIRST_DAY) / DAY_MS);
};
export const isoOfDay = (i: number): string => new Date(DASH_FIRST_DAY + i * DAY_MS).toISOString().slice(0, 10);

const clamp = (i: number) => Math.min(DASH_DAYS - 1, Math.max(0, i));

/** Today is Thu 19 Nov 2026. Quarter and year start before the fixture, so they show all 30 days. */
export function periodWindow(period: DashPeriod, custom?: { from: string; to: string }): DayWindow {
  const last = DASH_DAYS - 1;
  switch (period) {
    case 'today': return { from: last, to: last };
    case 'week': return { from: last - 3, to: last };
    case 'month': return { from: 11, to: last };
    case 'custom': {
      if (!custom) return { from: 0, to: last };
      const a = clamp(dayIndexOf(custom.from));
      const b = clamp(dayIndexOf(custom.to));
      return { from: Math.min(a, b), to: Math.max(a, b) };
    }
    default: return { from: 0, to: last };
  }
}

export const sumWindow = (series: readonly number[], w: DayWindow): number =>
  series.slice(w.from, w.to + 1).reduce((a, b) => a + b, 0);

export function figures(w: DayWindow) {
  const days = w.to - w.from + 1;
  const confirmed = sumWindow(BOOKINGS_PER_DAY, w);
  return {
    confirmed,
    pending: Math.round((PENDING_30 * days) / DASH_DAYS),
    cancelled: Math.round((CANCELLED_30 * days) / DASH_DAYS),
    receiptsHkd: confirmed * HKD_PER_BOOKING,
    vacant: ESTATE.households - ESTATE.occupied,
  };
}

export type DrillKind = 'occupied' | 'vacant' | 'confirmed' | 'pending' | 'cancelled' | 'bar' | 'point';
export type DrillTable = 'homes' | 'bookings' | 'safety';
export type DrillRow = { record: Copy; time?: string; status: Copy };

export const drillTable = (k: DrillKind): DrillTable =>
  k === 'occupied' || k === 'vacant' ? 'homes' : k === 'point' ? 'safety' : 'bookings';

const STATUS = {
  occupied: m('Occupied', '已入住', '已入住'),
  vacant: m('Vacant', '空置', '空置'),
  confirmed: m('Confirmed', '已確認', '已确认'),
  pending: m('Pending', '待確認', '待确认'),
  cancelled: m('Cancelled', '已取消', '已取消'),
  open: m('Open', '未處理', '未处理'),
  acknowledged: m('Acknowledged', '已確認收到', '已确认收到'),
  resolved: m('Resolved', '已解決', '已解决'),
};

const FACILITIES = [
  m('Clubhouse hall', '會所禮堂', '会所礼堂'),
  m('Gym room', '健身室', '健身室'),
  m('Pool deck', '泳池平台', '泳池平台'),
  m('BBQ area', '燒烤區', '烧烤区'),
  m('Tennis court', '網球場', '网球场'),
  m('Function room', '多用途室', '多用途室'),
];
const SLOTS = ['09:00 – 11:00', '12:00 – 13:00', '15:00 – 17:00', '19:00 – 21:00', '21:00 – 22:00', '07:00 – 08:00'];
const EVENTS = [
  m('Lift 2 stopped', '2 號升降機停用', '2 号升降机停用'),
  m('Smoke detector fault', '煙霧探測器故障', '烟雾探测器故障'),
  m('Door held open', '門被撐開', '门被撑开'),
  m('Water leak sensor', '漏水感應器', '漏水感应器'),
];
const BLOCKS = ['A', 'B', 'C'].map((b) => m(`Block ${b}`, `${b}座`, `${b}座`));

export const DRILL_ROW_LIMIT = 6;

/** The rows behind one chart item (at most DRILL_ROW_LIMIT), and how many records the item stands for. */
export function drillRows(kind: DrillKind, day: number, w: DayWindow): { rows: DrillRow[]; total: number } {
  const f = figures(w);
  const total =
    kind === 'occupied' ? ESTATE.occupied
    : kind === 'vacant' ? f.vacant
    : kind === 'confirmed' ? f.confirmed
    : kind === 'pending' ? f.pending
    : kind === 'cancelled' ? f.cancelled
    : kind === 'bar' ? (BOOKINGS_PER_DAY[day] ?? 0)
    : (SAFETY_PER_DAY[day] ?? 0);
  const n = Math.min(total, DRILL_ROW_LIMIT);
  const rows: DrillRow[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === 'occupied' || kind === 'vacant') {
      const floor = 1 + ((i * 5 + (kind === 'vacant' ? 3 : 0)) % 28);
      rows.push({
        record: m(`${BLOCKS[i % 3]!.en} · ${floor}/F · ${'ABCDEF'[i % 6]}`, `${BLOCKS[i % 3]!['zh-Hant']} · ${floor}樓 · ${'ABCDEF'[i % 6]}`, `${BLOCKS[i % 3]!['zh-Hans']} · ${floor}楼 · ${'ABCDEF'[i % 6]}`),
        status: STATUS[kind],
      });
    } else if (kind === 'point') {
      rows.push({ record: EVENTS[(day + i) % EVENTS.length]!, time: `${String(8 + ((day + i * 3) % 12)).padStart(2, '0')}:${i % 2 ? '40' : '05'}`, status: [STATUS.open, STATUS.acknowledged, STATUS.resolved][(day + i) % 3]! });
    } else {
      rows.push({
        record: FACILITIES[(day + i) % FACILITIES.length]!,
        time: SLOTS[(day + i * 2) % SLOTS.length]!,
        status: kind === 'pending' ? STATUS.pending : kind === 'cancelled' ? STATUS.cancelled : STATUS.confirmed,
      });
    }
  }
  return { rows, total };
}
