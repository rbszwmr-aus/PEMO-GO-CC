/**
 * Page fixture corpus for Facility booking (list / calendar / check-in /
 * facilities / rate cards).
 *
 * NOT a management-web contract operation — v0 freeze has no booking list/write
 * endpoints. Rows are Wing Fu Garden demo data for hard-refresh review. Labeled
 * fixture corpus for this page only; do not treat as live API fields.
 */

import { copy, type LocalizedText } from '../i18n/locale.ts';
import type { ScopePath } from './types.ts';
import { HOUSEHOLDS_LIST } from './households-corpus.ts';
import { hkToday } from './reports-fixture.ts';
import type { Flat } from './flat-label.ts';

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked-in' | 'no-show';
export type BookingTone = 'normal' | 'information' | 'warning' | 'unknown';
export type FacilityKind = 'indoor' | 'outdoor' | 'aquatic';
export type PaymentState = 'paid' | 'pending' | 'waived';

/** The fixture clock is the real Hong Kong day, so the calendar always has this month's bookings. */
export const BOOKING_FIXTURE_TODAY = hkToday();
/** Monday of the week that holds today. */
export const BOOKING_FIXTURE_WEEK_START = mondayOf(BOOKING_FIXTURE_TODAY);
const at = (offset: number): string => addDays(BOOKING_FIXTURE_TODAY, offset);

const m = copy;

function householdOf(householdId: string) {
  const row = HOUSEHOLDS_LIST.households.find((h) => h.householdId === householdId);
  if (!row) {
    throw new Error(`booking fixtures: household ${householdId} is not in HOUSEHOLDS_LIST`);
  }
  return row;
}

export interface FacilityZone {
  zoneId: string;
  name: LocalizedText;
  capacity: number;
  slots: Array<{ slotId: string; label: LocalizedText; bookable: boolean }>;
}

export interface FacilityRow {
  facilityId: string;
  name: LocalizedText;
  kind: FacilityKind;
  kindLabel: LocalizedText;
  capacity: number;
  openHours: LocalizedText;
  depositHkd: number;
  active: boolean;
  estateLabel: LocalizedText;
  zones: FacilityZone[];
}

export interface BookingRow {
  bookingId: string;
  facilityId: string;
  zoneId: string;
  requesterName: string;
  requesterKind: LocalizedText;
  householdId: string;
  residentId: string;
  unitSummary: LocalizedText;
  scope: ScopePath;
  date: string;
  slotStart: string;
  slotEnd: string;
  status: BookingStatus;
  tone: BookingTone;
  feeHkd: number;
  memberCount: number;
  guestCount: number;
  payment: { state: PaymentState; label: LocalizedText };
  staffNotes: LocalizedText | null;
}

export interface RateCardRow {
  facilityId: string;
  peakWhen: LocalizedText;
  peakResidentHkd: number;
  peakVisitorHkd: number;
  offPeakWhen: LocalizedText;
  offPeakResidentHkd: number;
  offPeakVisitorHkd: number;
  depositHkd: number;
}

const HH_A1 = householdOf('hh_wfg_a_12_a1');
const HH_B2 = householdOf('hh_wfg_b_03_b2');
const HH_C3 = householdOf('hh_wfg_c_08_c3');
const HH_A4 = householdOf('hh_wfg_a_05_a4_ended');

export const BOOKING_FACILITIES: FacilityRow[] = [
  {
    facilityId: 'fac_wfg_clubhouse_mp',
    name: m('Clubhouse multi-purpose room', '會所多用途室', '会所多用途室'),
    kind: 'indoor',
    kindLabel: m('Indoor', '室內', '室内'),
    capacity: 40,
    openHours: m('09:00–22:00', '09:00–22:00', '09:00–22:00'),
    depositHkd: 500,
    active: true,
    estateLabel: m('Wing Fu Garden', '榮富花園', '荣富花园'),
    zones: [
      {
        zoneId: 'zone_wfg_mp_main',
        name: m('Main hall', '主廳', '主厅'),
        capacity: 30,
        slots: [
          { slotId: 'mp-main-10', label: m('10:00–12:00', '10:00–12:00', '10:00–12:00'), bookable: true },
          { slotId: 'mp-main-14', label: m('14:00–16:00', '14:00–16:00', '14:00–16:00'), bookable: true },
          { slotId: 'mp-main-19', label: m('19:00–21:00', '19:00–21:00', '19:00–21:00'), bookable: true },
        ],
      },
      {
        zoneId: 'zone_wfg_mp_annex',
        name: m('Side annex', '側廳', '侧厅'),
        capacity: 10,
        slots: [
          { slotId: 'mp-annex-10', label: m('10:00–12:00', '10:00–12:00', '10:00–12:00'), bookable: true },
          { slotId: 'mp-annex-14', label: m('14:00–16:00', '14:00–16:00', '14:00–16:00'), bookable: false },
        ],
      },
    ],
  },
  {
    facilityId: 'fac_wfg_bbq',
    name: m('BBQ pits', '燒烤場', '烧烤场'),
    kind: 'outdoor',
    kindLabel: m('Outdoor', '戶外', '户外'),
    capacity: 8,
    openHours: m('11:00–22:00', '11:00–22:00', '11:00–22:00'),
    depositHkd: 200,
    active: true,
    estateLabel: m('Wing Fu Garden', '榮富花園', '荣富花园'),
    zones: [
      {
        zoneId: 'zone_wfg_bbq_a',
        name: m('Pit A', 'A爐', 'A炉'),
        capacity: 8,
        slots: [
          { slotId: 'bbq-a-12', label: m('12:00–15:00', '12:00–15:00', '12:00–15:00'), bookable: true },
          { slotId: 'bbq-a-18', label: m('18:00–21:00', '18:00–21:00', '18:00–21:00'), bookable: true },
        ],
      },
      {
        zoneId: 'zone_wfg_bbq_b',
        name: m('Pit B', 'B爐', 'B炉'),
        capacity: 8,
        slots: [
          { slotId: 'bbq-b-12', label: m('12:00–15:00', '12:00–15:00', '12:00–15:00'), bookable: true },
          { slotId: 'bbq-b-18', label: m('18:00–21:00', '18:00–21:00', '18:00–21:00'), bookable: true },
        ],
      },
      {
        zoneId: 'zone_wfg_bbq_c',
        name: m('Pit C', 'C爐', 'C炉'),
        capacity: 8,
        slots: [
          { slotId: 'bbq-c-18', label: m('18:00–21:00', '18:00–21:00', '18:00–21:00'), bookable: true },
        ],
      },
    ],
  },
  {
    facilityId: 'fac_wfg_tennis',
    name: m('Tennis court', '網球場', '网球场'),
    kind: 'outdoor',
    kindLabel: m('Outdoor', '戶外', '户外'),
    capacity: 4,
    openHours: m('07:00–22:00', '07:00–22:00', '07:00–22:00'),
    depositHkd: 0,
    active: true,
    estateLabel: m('Wing Fu Garden', '榮富花園', '荣富花园'),
    zones: [
      {
        zoneId: 'zone_wfg_tennis_1',
        name: m('Court 1', '1號場', '1号场'),
        capacity: 4,
        slots: [
          { slotId: 'tn-08', label: m('08:00–09:00', '08:00–09:00', '08:00–09:00'), bookable: true },
          { slotId: 'tn-19', label: m('19:00–20:00', '19:00–20:00', '19:00–20:00'), bookable: true },
        ],
      },
    ],
  },
  {
    facilityId: 'fac_wfg_pool_lane',
    name: m('Swimming pool lane', '泳池泳線', '泳池泳线'),
    kind: 'aquatic',
    kindLabel: m('Aquatic', '水上', '水上'),
    capacity: 1,
    openHours: m('06:30–21:30', '06:30–21:30', '06:30–21:30'),
    depositHkd: 0,
    active: true,
    estateLabel: m('Wing Fu Garden', '榮富花園', '荣富花园'),
    zones: [
      {
        zoneId: 'zone_wfg_pool_1',
        name: m('Lane 1', '1線', '1线'),
        capacity: 1,
        slots: [
          { slotId: 'pl-07', label: m('07:00–08:00', '07:00–08:00', '07:00–08:00'), bookable: true },
          { slotId: 'pl-19', label: m('19:00–20:00', '19:00–20:00', '19:00–20:00'), bookable: true },
        ],
      },
      {
        zoneId: 'zone_wfg_pool_2',
        name: m('Lane 2', '2線', '2线'),
        capacity: 1,
        slots: [
          { slotId: 'pl2-19', label: m('19:00–20:00', '19:00–20:00', '19:00–20:00'), bookable: true },
        ],
      },
    ],
  },
  {
    facilityId: 'fac_wfg_function',
    name: m('Function room', '宴會廳', '宴会厅'),
    kind: 'indoor',
    kindLabel: m('Indoor', '室內', '室内'),
    capacity: 80,
    openHours: m('09:00–23:00', '09:00–23:00', '09:00–23:00'),
    depositHkd: 2000,
    active: true,
    estateLabel: m('Wing Fu Garden', '榮富花園', '荣富花园'),
    zones: [
      {
        zoneId: 'zone_wfg_fn_banquet',
        name: m('Banquet floor', '宴會層', '宴会层'),
        capacity: 80,
        slots: [
          { slotId: 'fn-10', label: m('10:00–13:00', '10:00–13:00', '10:00–13:00'), bookable: true },
          { slotId: 'fn-14', label: m('14:00–18:00', '14:00–18:00', '14:00–18:00'), bookable: true },
        ],
      },
    ],
  },
];

const resident = m('Resident', '住戶', '住户');

export const BOOKING_ROWS: BookingRow[] = [
  {
    bookingId: 'bk_wfg_1001',
    facilityId: 'fac_wfg_clubhouse_mp',
    zoneId: 'zone_wfg_mp_main',
    requesterName: 'Ho Mei-yi 何美儀',
    requesterKind: resident,
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    date: at(0),
    slotStart: '10:00',
    slotEnd: '12:00',
    status: 'confirmed',
    tone: 'information',
    feeHkd: 200,
    memberCount: 3,
    guestCount: 2,
    payment: { state: 'paid', label: m('Paid at counter', '已於櫃檯付款', '已于柜台付款') },
    staffNotes: m('Birthday gathering — chairs already set.', '生日聚會 — 座椅已擺好。', '生日聚会 — 座椅已摆好。'),
  },
  {
    bookingId: 'bk_wfg_1002',
    facilityId: 'fac_wfg_bbq',
    zoneId: 'zone_wfg_bbq_a',
    requesterName: 'Tam Siu-fong 譚小芳',
    requesterKind: resident,
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    date: at(0),
    slotStart: '18:00',
    slotEnd: '21:00',
    status: 'confirmed',
    tone: 'information',
    feeHkd: 150,
    memberCount: 2,
    guestCount: 4,
    payment: { state: 'paid', label: m('Paid in the resident app', '已於住戶應用程式付款', '已于住户应用程序付款') },
    staffNotes: m('Charcoal issued at 17:45.', '17:45 已發炭。', '17:45 已发炭。'),
  },
  {
    bookingId: 'bk_wfg_1003',
    facilityId: 'fac_wfg_tennis',
    zoneId: 'zone_wfg_tennis_1',
    requesterName: 'Chan Ka-ming 陳家明',
    requesterKind: resident,
    householdId: HH_C3.householdId,
    residentId: 'res_wfg_000908',
    unitSummary: HH_C3.unitSummary,
    scope: HH_C3.scope,
    date: at(0),
    slotStart: '08:00',
    slotEnd: '09:00',
    status: 'confirmed',
    tone: 'information',
    feeHkd: 0,
    memberCount: 1,
    guestCount: 1,
    payment: { state: 'waived', label: m('Resident off-peak — no fee', '住戶非繁忙時段 — 免費', '住户非繁忙时段 — 免费') },
    staffNotes: null,
  },
  {
    bookingId: 'bk_wfg_1004',
    facilityId: 'fac_wfg_pool_lane',
    zoneId: 'zone_wfg_pool_1',
    requesterName: 'Ho Mei-yi 何美儀',
    requesterKind: resident,
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    date: at(0),
    slotStart: '07:00',
    slotEnd: '08:00',
    status: 'checked-in',
    tone: 'normal',
    feeHkd: 0,
    memberCount: 1,
    guestCount: 0,
    payment: { state: 'waived', label: m('Lane booking — no fee', '泳線預約 — 免費', '泳线预约 — 免费') },
    staffNotes: m('Checked in at the pool desk.', '已於泳池服務台登記。', '已于泳池服务台登记。'),
  },
  {
    bookingId: 'bk_wfg_1005',
    facilityId: 'fac_wfg_function',
    zoneId: 'zone_wfg_fn_banquet',
    requesterName: 'Tam Siu-fong 譚小芳',
    requesterKind: resident,
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    date: at(1),
    slotStart: '14:00',
    slotEnd: '18:00',
    status: 'pending',
    tone: 'warning',
    feeHkd: 800,
    memberCount: 2,
    guestCount: 18,
    payment: { state: 'pending', label: m('Deposit held — balance due', '已收按金 — 尚欠餘額', '已收押金 — 尚欠余额') },
    staffNotes: m('Awaiting guest list from the household.', '等候住戶交來賓客名單。', '等候住户交来宾客名单。'),
  },
  {
    bookingId: 'bk_wfg_1006',
    facilityId: 'fac_wfg_clubhouse_mp',
    zoneId: 'zone_wfg_mp_main',
    requesterName: 'Cheung Tak-wah 張德華',
    requesterKind: resident,
    householdId: HH_A4.householdId,
    residentId: 'res_wfg_000220',
    unitSummary: HH_A4.unitSummary,
    scope: HH_A4.scope,
    date: at(-1),
    slotStart: '19:00',
    slotEnd: '21:00',
    status: 'cancelled',
    tone: 'unknown',
    feeHkd: 200,
    memberCount: 1,
    guestCount: 0,
    payment: { state: 'waived', label: m('Fee reversed on cancel', '取消後已退回費用', '取消后已退回费用') },
    staffNotes: m('Cancelled by the household the day before.', '住戶於前一日取消。', '住户于前一日取消。'),
  },
  {
    bookingId: 'bk_wfg_1007',
    facilityId: 'fac_wfg_bbq',
    zoneId: 'zone_wfg_bbq_b',
    requesterName: 'Chan Ka-ming 陳家明',
    requesterKind: resident,
    householdId: HH_C3.householdId,
    residentId: 'res_wfg_000908',
    unitSummary: HH_C3.unitSummary,
    scope: HH_C3.scope,
    date: at(-1),
    slotStart: '12:00',
    slotEnd: '15:00',
    status: 'no-show',
    tone: 'warning',
    feeHkd: 150,
    memberCount: 1,
    guestCount: 2,
    payment: { state: 'paid', label: m('No-show fee kept', '已保留缺席費用', '已保留缺席费用') },
    staffNotes: m('Pit released at 12:20.', '12:20 已釋放爐位。', '12:20 已释放炉位。'),
  },
  {
    bookingId: 'bk_wfg_1008',
    facilityId: 'fac_wfg_tennis',
    zoneId: 'zone_wfg_tennis_1',
    requesterName: 'Ho Mei-yi 何美儀',
    requesterKind: resident,
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    date: at(-3),
    slotStart: '19:00',
    slotEnd: '20:00',
    status: 'confirmed',
    tone: 'information',
    feeHkd: 0,
    memberCount: 2,
    guestCount: 0,
    payment: { state: 'waived', label: m('Resident evening session — no fee', '住戶晚間時段 — 免費', '住户晚间时段 — 免费') },
    staffNotes: null,
  },
  {
    bookingId: 'bk_wfg_1009',
    facilityId: 'fac_wfg_function',
    zoneId: 'zone_wfg_fn_banquet',
    requesterName: 'Ho Mei-yi 何美儀',
    requesterKind: resident,
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    date: at(-5),
    slotStart: '10:00',
    slotEnd: '13:00',
    status: 'checked-in',
    tone: 'normal',
    feeHkd: 800,
    memberCount: 3,
    guestCount: 12,
    payment: { state: 'paid', label: m('Paid — deposit to refund', '已付款 — 按金待退', '已付款 — 押金待退') },
    staffNotes: m('Function closed at 13:10; deposit pending inspection.', '宴會於 13:10 結束；按金待檢查後退回。', '宴会于 13:10 结束；押金待检查后退回。'),
  },
  {
    bookingId: 'bk_wfg_1010',
    facilityId: 'fac_wfg_pool_lane',
    zoneId: 'zone_wfg_pool_2',
    requesterName: 'Tam Yee-man 譚綺雯',
    requesterKind: resident,
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000512',
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    date: at(0),
    slotStart: '19:00',
    slotEnd: '20:00',
    status: 'pending',
    tone: 'warning',
    feeHkd: 0,
    memberCount: 1,
    guestCount: 0,
    payment: { state: 'waived', label: m('Lane booking — no fee', '泳線預約 — 免費', '泳线预约 — 免费') },
    staffNotes: m('Household member — confirm pass at the desk.', '住戶成員 — 請於服務台核對通行證。', '住户成员 — 请于服务台核对通行证。'),
  },
];


/** The household's flat as block / floor / unit, read from the fixture household id (never shown as an id). */
export function flatOf(row: Pick<BookingRow, 'householdId'>): Flat {
  const m2 = /^hh_wfg_([a-z])_(\d+)_([a-z]\d)/.exec(row.householdId);
  return m2 ? { block: (m2[1] as string).toUpperCase(), floor: Number(m2[2]), unit: (m2[3] as string).toUpperCase() } : { block: 'A', floor: 1, unit: 'A1' };
}

const EXTRA_SLOTS: Record<string, Array<[string, string]>> = {
  fac_wfg_clubhouse_mp: [['10:00', '12:00'], ['14:00', '16:00'], ['19:00', '21:00']],
  fac_wfg_bbq: [['12:00', '15:00'], ['18:00', '21:00']],
  fac_wfg_tennis: [['08:00', '09:00'], ['09:00', '10:00'], ['17:00', '18:00']],
  fac_wfg_pool_lane: [['07:00', '08:00'], ['19:00', '20:00']],
  fac_wfg_function: [['10:00', '13:00'], ['14:00', '18:00']],
};

/** [day of this month, facility, slot, zone, household 0-2, status]. Shaped so Month shows quiet days, a crowded BBQ day (4 in one facility) and a mixed day (5 across facilities). */
const EXTRA: Array<[number, string, number, number, number, BookingStatus]> = [
  [2, 'fac_wfg_bbq', 0, 0, 1, 'confirmed'], [2, 'fac_wfg_bbq', 1, 0, 2, 'confirmed'], [2, 'fac_wfg_pool_lane', 0, 0, 0, 'confirmed'],
  [4, 'fac_wfg_clubhouse_mp', 0, 0, 0, 'confirmed'], [4, 'fac_wfg_tennis', 0, 0, 1, 'confirmed'],
  [6, 'fac_wfg_tennis', 1, 0, 2, 'confirmed'], [7, 'fac_wfg_pool_lane', 1, 1, 1, 'confirmed'],
  [9, 'fac_wfg_function', 0, 0, 2, 'confirmed'], [9, 'fac_wfg_clubhouse_mp', 1, 0, 0, 'cancelled'],
  [11, 'fac_wfg_tennis', 2, 0, 1, 'confirmed'], [12, 'fac_wfg_clubhouse_mp', 2, 1, 2, 'confirmed'],
  [13, 'fac_wfg_bbq', 0, 0, 0, 'confirmed'], [13, 'fac_wfg_bbq', 0, 1, 1, 'confirmed'], [13, 'fac_wfg_bbq', 0, 2, 2, 'confirmed'], [13, 'fac_wfg_bbq', 1, 0, 0, 'confirmed'],
  [13, 'fac_wfg_pool_lane', 1, 0, 1, 'confirmed'],
  [15, 'fac_wfg_function', 1, 0, 0, 'confirmed'], [16, 'fac_wfg_pool_lane', 0, 0, 2, 'confirmed'],
  [17, 'fac_wfg_tennis', 0, 0, 0, 'confirmed'], [17, 'fac_wfg_tennis', 2, 0, 1, 'confirmed'],
  [21, 'fac_wfg_clubhouse_mp', 0, 0, 1, 'pending'], [21, 'fac_wfg_bbq', 1, 1, 2, 'confirmed'],
  [23, 'fac_wfg_function', 0, 0, 0, 'confirmed'], [24, 'fac_wfg_pool_lane', 1, 0, 1, 'confirmed'],
  [25, 'fac_wfg_bbq', 0, 0, 2, 'confirmed'], [25, 'fac_wfg_bbq', 1, 0, 0, 'confirmed'], [25, 'fac_wfg_tennis', 1, 0, 1, 'confirmed'],
  [27, 'fac_wfg_clubhouse_mp', 1, 0, 2, 'confirmed'], [28, 'fac_wfg_pool_lane', 0, 0, 0, 'confirmed'],
];

const EXTRA_HOUSEHOLDS = [HH_A1, HH_B2, HH_C3];
const NAME_OF: Record<string, string> = Object.fromEntries(BOOKING_ROWS.map((b) => [b.householdId, b.requesterName]));

BOOKING_ROWS.push(
  ...EXTRA.map(([day, facilityId, slot, zone, hh, status], i): BookingRow => {
    const f = BOOKING_FACILITIES.find((x) => x.facilityId === facilityId)!;
    const household = EXTRA_HOUSEHOLDS[hh] as (typeof EXTRA_HOUSEHOLDS)[number];
    const [slotStart, slotEnd] = (EXTRA_SLOTS[facilityId] as Array<[string, string]>)[slot] as [string, string];
    return {
      bookingId: `bk_wfg_${2001 + i}`,
      facilityId,
      zoneId: (f.zones[zone] ?? f.zones[0])!.zoneId,
      requesterName: NAME_OF[household.householdId] ?? 'Ho Mei-yi 何美儀',
      requesterKind: resident,
      householdId: household.householdId,
      residentId: `res_wfg_0${900 + i}`,
      unitSummary: household.unitSummary,
      scope: household.scope,
      date: `${BOOKING_FIXTURE_TODAY.slice(0, 8)}${String(day).padStart(2, '0')}`,
      slotStart,
      slotEnd,
      status,
      tone: status === 'pending' ? 'warning' : status === 'cancelled' ? 'unknown' : 'information',
      feeHkd: facilityId === 'fac_wfg_function' ? 800 : facilityId === 'fac_wfg_bbq' ? 150 : 0,
      memberCount: 2,
      guestCount: 1,
      payment: { state: 'paid', label: m('Paid in the resident app', '已於住戶應用程式付款', '已于住户应用程序付款') },
      staffNotes: null,
    };
  }),
);

export const BOOKING_RATE_CARDS: RateCardRow[] = [
  {
    facilityId: 'fac_wfg_clubhouse_mp',
    peakWhen: m('Sat–Sun 18:00–22:00', '星期六至日 18:00–22:00', '星期六至日 18:00–22:00'),
    peakResidentHkd: 200,
    peakVisitorHkd: 400,
    offPeakWhen: m('Weekdays and before 18:00', '平日及 18:00 前', '平日及 18:00 前'),
    offPeakResidentHkd: 80,
    offPeakVisitorHkd: 160,
    depositHkd: 500,
  },
  {
    facilityId: 'fac_wfg_bbq',
    peakWhen: m('Fri–Sun 17:00–22:00', '星期五至日 17:00–22:00', '星期五至日 17:00–22:00'),
    peakResidentHkd: 150,
    peakVisitorHkd: 300,
    offPeakWhen: m('Mon–Thu all sessions', '星期一至四所有時段', '星期一至四所有时段'),
    offPeakResidentHkd: 80,
    offPeakVisitorHkd: 160,
    depositHkd: 200,
  },
  {
    facilityId: 'fac_wfg_tennis',
    peakWhen: m('Sat–Sun 08:00–12:00 and 18:00–22:00', '星期六至日 08:00–12:00 及 18:00–22:00', '星期六至日 08:00–12:00 及 18:00–22:00'),
    peakResidentHkd: 40,
    peakVisitorHkd: 80,
    offPeakWhen: m('Other hours', '其他時段', '其他时段'),
    offPeakResidentHkd: 0,
    offPeakVisitorHkd: 40,
    depositHkd: 0,
  },
  {
    facilityId: 'fac_wfg_pool_lane',
    peakWhen: m('Sat–Sun 09:00–12:00', '星期六至日 09:00–12:00', '星期六至日 09:00–12:00'),
    peakResidentHkd: 0,
    peakVisitorHkd: 60,
    offPeakWhen: m('All other lane hours', '其他泳線時段', '其他泳线时段'),
    offPeakResidentHkd: 0,
    offPeakVisitorHkd: 40,
    depositHkd: 0,
  },
  {
    facilityId: 'fac_wfg_function',
    peakWhen: m('Fri–Sun 14:00–23:00', '星期五至日 14:00–23:00', '星期五至日 14:00–23:00'),
    peakResidentHkd: 800,
    peakVisitorHkd: 1600,
    offPeakWhen: m('Mon–Thu 09:00–14:00', '星期一至四 09:00–14:00', '星期一至四 09:00–14:00'),
    offPeakResidentHkd: 400,
    offPeakVisitorHkd: 800,
    depositHkd: 2000,
  },
];

export const BOOKING_DETAIL_DEFAULT = BOOKING_ROWS[0]!;
export const FACILITY_DETAIL_DEFAULT = BOOKING_FACILITIES[0]!;

export function findBooking(bookingId: string): BookingRow | undefined {
  return BOOKING_ROWS.find((b) => b.bookingId === bookingId);
}

export function findFacility(facilityId: string): FacilityRow | undefined {
  return BOOKING_FACILITIES.find((f) => f.facilityId === facilityId);
}

export function findZone(facility: FacilityRow, zoneId: string): FacilityZone | undefined {
  return facility.zones.find((z) => z.zoneId === zoneId);
}

export function rateCardFor(facilityId: string): RateCardRow | undefined {
  return BOOKING_RATE_CARDS.find((r) => r.facilityId === facilityId);
}

export function bookingsOnDate(date: string): BookingRow[] {
  return BOOKING_ROWS.filter((b) => b.date === date);
}

export function bookingsInWeek(weekStart: string): BookingRow[] {
  const start = Date.parse(`${weekStart}T00:00:00+08:00`);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return BOOKING_ROWS.filter((b) => {
    const t = Date.parse(`${b.date}T00:00:00+08:00`);
    return t >= start && t < end;
  });
}

export function checkinTodayRows(): BookingRow[] {
  return BOOKING_ROWS.filter(
    (b) => b.date === BOOKING_FIXTURE_TODAY && (b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'no-show'),
  );
}

/** The Monday on or before an ISO day (weeks are Monday-first). */
export function mondayOf(isoDate: string): string {
  const dow = new Date(`${isoDate}T00:00:00+08:00`).toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong', weekday: 'short' });
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dow);
  return addDays(isoDate, -back);
}

export function addDays(isoDate: string, days: number): string {
  const t = Date.parse(`${isoDate}T00:00:00+08:00`) + days * 24 * 60 * 60 * 1000;
  const d = new Date(t);
  const y = d.toLocaleString('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric' });
  const mth = d.toLocaleString('en-CA', { timeZone: 'Asia/Hong_Kong', month: '2-digit' });
  const day = d.toLocaleString('en-CA', { timeZone: 'Asia/Hong_Kong', day: '2-digit' });
  return `${y}-${mth}-${day}`;
}

export function slotLabel(row: BookingRow): string {
  return `${row.date} ${row.slotStart}–${row.slotEnd}`;
}

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'confirmed', 'pending', 'cancelled', 'checked-in', 'no-show',
];
