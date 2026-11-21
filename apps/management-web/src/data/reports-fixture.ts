/**
 * Reports page — fixture-first report figures and the rows behind each one.
 *
 * Backend has no report endpoint yet, so every figure here is DERIVED from the
 * rows below it (a card's number is the count or sum of the rows it opens), which
 * keeps "the number you click is the rows you get" true. Sample data, Wing Fu
 * Garden; labelled as such on the page. Period metrics place their rows on days
 * of the current month, so the Daily and Management tabs differ.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New. 12 cards, 24 metrics, 11 row shapes.
 */

import { copy, pick, type Copy, type Locale } from '../i18n/locale.ts';
import { flatAt, flatLabel } from './flat-label.ts';

const m = copy;

export type ReportTab = 'daily' | 'mgmt';
export interface DateRange { from: string; to: string }

export type RowKind =
  | 'location' | 'household' | 'tenancy' | 'occupant' | 'booking' | 'payment'
  | 'case' | 'notice' | 'document' | 'record' | 'event';

export interface ReportRow {
  cells: string[];
  /** One sort value per column; dates sort as ISO text, money as numbers. */
  keys: Array<string | number>;
  /** The money amount when the metric sums rows (HKD, negative for refunds). */
  amount?: number;
}

export interface MetricDef {
  id: string;
  card: string;
  label: Copy;
  basis: 'current' | 'period';
  kind: RowKind;
  /** Rows when current, rows in the whole month when period (then filtered by date). */
  size: number;
  money?: boolean;
  /** Row title in the pop-up. */
  detail: Copy;
}

export interface CardDef { id: string; title: Copy }

export const CARDS: CardDef[] = [
  { id: 'properties', title: m('Properties', '物業', '物业') },
  { id: 'households', title: m('Household records', '住戶紀錄', '住户记录') },
  { id: 'tenancies', title: m('Tenancies', '租約', '租约') },
  { id: 'occupancy', title: m('Occupancy', '入住', '入住') },
  { id: 'bookings', title: m('Facility bookings', '設施預約', '设施预约') },
  { id: 'payments', title: m('Booking payments', '預約付款', '预约付款') },
  { id: 'safety', title: m('Home Safety', '家居安全', '家居安全') },
  { id: 'notices', title: m('Notices', '通告', '公告') },
  { id: 'documents', title: m('Documents', '文件', '文件') },
  { id: 'access', title: m('Access control', '門禁', '门禁') },
  { id: 'carpark', title: m('Car park', '停車場', '停车场') },
  { id: 'ev', title: m('EV Charging', '電動車充電', '电动车充电') },
];

const rec = (en: string, hant: string, hans: string) => m(en, hant, hans);

export const METRICS: MetricDef[] = [
  { id: 'locations', card: 'properties', label: rec('Active locations', '使用中位置', '使用中位置'), basis: 'current', kind: 'location', size: 8, detail: rec('Location', '位置', '位置') },
  { id: 'households', card: 'households', label: rec('Household records', '住戶紀錄', '住户记录'), basis: 'current', kind: 'household', size: 126, detail: rec('Household', '住戶', '住户') },
  { id: 'tenancies-active', card: 'tenancies', label: rec('Active tenancies', '有效租約', '有效租约'), basis: 'current', kind: 'tenancy', size: 118, detail: rec('Tenancy', '租約', '租约') },
  { id: 'tenancies-scheduled', card: 'tenancies', label: rec('Scheduled tenancies', '待生效租約', '待生效租约'), basis: 'current', kind: 'tenancy', size: 4, detail: rec('Tenancy', '租約', '租约') },
  { id: 'tenancies-ending', card: 'tenancies', label: rec('Tenancies ending in period', '期內屆滿的租約', '期内届满的租约'), basis: 'period', kind: 'tenancy', size: 9, detail: rec('Tenancy', '租約', '租约') },
  { id: 'homes-occupied', card: 'occupancy', label: rec('Occupied homes', '已入住單位', '已入住单位'), basis: 'current', kind: 'household', size: 109, detail: rec('Home', '單位', '单位') },
  { id: 'occupants', card: 'occupancy', label: rec('Current occupants', '現居人數', '现居人数'), basis: 'current', kind: 'occupant', size: 301, detail: rec('Occupant', '住客', '住客') },
  { id: 'bookings-confirmed', card: 'bookings', label: rec('Confirmed bookings starting in period', '期內開始的已確認預約', '期内开始的已确认预约'), basis: 'period', kind: 'booking', size: 46, detail: rec('Booking', '預約', '预约') },
  { id: 'bookings-cancelled', card: 'bookings', label: rec('Cancelled bookings starting in period', '期內開始的已取消預約', '期内开始的已取消预约'), basis: 'period', kind: 'booking', size: 6, detail: rec('Booking', '預約', '预约') },
  { id: 'pay-recorded', card: 'payments', label: rec('Payments recorded', '已記錄付款', '已记录付款'), basis: 'period', kind: 'payment', size: 31, money: true, detail: rec('Payment', '付款', '付款') },
  { id: 'pay-refunds', card: 'payments', label: rec('Refunds recorded', '已記錄退款', '已记录退款'), basis: 'period', kind: 'payment', size: 3, money: true, detail: rec('Refund', '退款', '退款') },
  { id: 'pay-net', card: 'payments', label: rec('Net booking receipts', '預約收款淨額', '预约收款净额'), basis: 'period', kind: 'payment', size: 34, money: true, detail: rec('Payment', '付款', '付款') },
  { id: 'safety-open', card: 'safety', label: rec('Open safety cases', '未結安全個案', '未结安全个案'), basis: 'current', kind: 'case', size: 2, detail: rec('Case', '個案', '个案') },
  { id: 'safety-received', card: 'safety', label: rec('Safety cases received in period', '期內收到的安全個案', '期内收到的安全个案'), basis: 'period', kind: 'case', size: 12, detail: rec('Case', '個案', '个案') },
  { id: 'notices-published', card: 'notices', label: rec('Published in period', '期內已發布', '期内已发布'), basis: 'period', kind: 'notice', size: 7, detail: rec('Notice', '通告', '公告') },
  { id: 'documents-published', card: 'documents', label: rec('Published in period', '期內已發布', '期内已发布'), basis: 'period', kind: 'document', size: 4, detail: rec('Document', '文件', '文件') },
  { id: 'access-records', card: 'access', label: rec('Current local records', '現有本地紀錄', '现有本地记录'), basis: 'current', kind: 'record', size: 342, detail: rec('Record', '紀錄', '记录') },
  { id: 'access-events', card: 'access', label: rec('Gateway events received in period', '期內收到的閘道事件', '期内收到的网关事件'), basis: 'period', kind: 'event', size: 1204, detail: rec('Event', '事件', '事件') },
  { id: 'carpark-records', card: 'carpark', label: rec('Current local records', '現有本地紀錄', '现有本地记录'), basis: 'current', kind: 'record', size: 220, detail: rec('Record', '紀錄', '记录') },
  { id: 'carpark-events', card: 'carpark', label: rec('Gateway events received in period', '期內收到的閘道事件', '期内收到的网关事件'), basis: 'period', kind: 'event', size: 3880, detail: rec('Event', '事件', '事件') },
  { id: 'ev-records', card: 'ev', label: rec('Current local records', '現有本地紀錄', '现有本地记录'), basis: 'current', kind: 'record', size: 12, detail: rec('Record', '紀錄', '记录') },
  { id: 'ev-events', card: 'ev', label: rec('Gateway events received in period', '期內收到的閘道事件', '期内收到的网关事件'), basis: 'period', kind: 'event', size: 96, detail: rec('Event', '事件', '事件') },
];

export const metricById = (id: string): MetricDef | undefined => METRICS.find((x) => x.id === id);
export const metricsOf = (cardId: string): MetricDef[] => METRICS.filter((x) => x.card === cardId);

const COLS: Record<RowKind, Copy[]> = {
  location: [m('Location', '位置', '位置'), m('Type', '類型', '类型'), m('Homes', '單位數', '单位数')],
  household: [m('Home', '單位', '单位'), m('Household', '住戶', '住户'), m('Members', '成員', '成员'), m('Status', '狀態', '状态')],
  tenancy: [m('Home', '單位', '单位'), m('Tenant', '租戶', '租户'), m('Tenancy start', '租約開始', '租约开始'), m('Tenancy end', '租約結束', '租约结束'), m('Status', '狀態', '状态')],
  occupant: [m('Home', '單位', '单位'), m('Name', '姓名', '姓名'), m('Role', '身份', '身份')],
  booking: [m('Date', '日期', '日期'), m('Home', '單位', '单位'), m('Facility', '設施', '设施'), m('Status', '狀態', '状态')],
  payment: [m('Date', '日期', '日期'), m('Home', '單位', '单位'), m('Facility', '設施', '设施'), m('Amount (HKD)', '金額（港幣）', '金额（港币）')],
  case: [m('Received', '收到日期', '收到日期'), m('Home', '單位', '单位'), m('Type', '類型', '类型'), m('Status', '狀態', '状态')],
  notice: [m('Published', '發布日期', '发布日期'), m('Title', '標題', '标题'), m('Audience', '對象', '对象')],
  document: [m('Published', '發布日期', '发布日期'), m('Title', '標題', '标题'), m('Category', '類別', '类别')],
  record: [m('Record', '紀錄', '记录'), m('Home', '單位', '单位'), m('Type', '類型', '类型')],
  event: [m('Date', '日期', '日期'), m('Record', '紀錄', '记录'), m('Event', '事件', '事件')],
};
export const columnsOf = (kind: RowKind): Copy[] => COLS[kind];

const NAMES: Array<[string, string, string]> = [
  ['Chan Tai-man', '陳大文', '陈大文'], ['Lam Siu-kei', '林小琪', '林小琪'], ['Ho Mei-yi', '何美儀', '何美仪'],
  ['Fung Wing', '馮榮', '冯荣'], ['Pang Hoi', '彭海', '彭海'], ['Wu Tak-ming', '胡德明', '胡德明'],
  ['Ip Chun-wai', '葉俊威', '叶俊威'], ['Cheung Ka-yan', '張嘉欣', '张嘉欣'], ['Wong Suk-fan', '黃淑芬', '黄淑芬'],
  ['Leung Ho-yin', '梁浩賢', '梁浩贤'], ['Yip Man-ting', '葉文婷', '叶文婷'], ['Tse Kwok-leung', '謝國良', '谢国良'],
];
const name = (i: number, locale: Locale): string => {
  const [en, hant, hans] = NAMES[i % NAMES.length] as [string, string, string];
  return pick(locale, { en: `${en} ${hant}`, 'zh-Hant': `${en} ${hant}`, 'zh-Hans': `${en} ${hans}` });
};
const FACILITIES: Array<[string, string, string]> = [
  ['BBQ Garden', '燒烤花園', '烧烤花园'], ['Swimming Pool', '游泳池', '游泳池'], ['Clubhouse Hall', '會所大廳', '会所大厅'],
  ['Tennis Court', '網球場', '网球场'], ['Function Room', '多用途室', '多用途室'],
];
const pickL = (t: [string, string, string], locale: Locale) => pick(locale, { en: t[0], 'zh-Hant': t[1], 'zh-Hans': t[2] });

const iso = (y: number, mo: number, d: number) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parts = (day: string) => ({ y: Number(day.slice(0, 4)), mo: Number(day.slice(5, 7)), d: Number(day.slice(8, 10)) });
const addDays = (day: string, n: number): string => {
  const dt = new Date(Date.UTC(parts(day).y, parts(day).mo - 1, parts(day).d + n));
  return dt.toISOString().slice(0, 10);
};

/** Today in Hong Kong as YYYY-MM-DD. */
export function hkToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export const monthStart = (day: string): string => `${day.slice(0, 8)}01`;
export const defaultRange = (tab: ReportTab, today: string): DateRange => (tab === 'daily' ? { from: today, to: today } : { from: monthStart(today), to: today });

/** The day a period row falls on: every third row is today, the rest spread over the month so far. */
function dayOf(i: number, today: string): string {
  const d = parts(today).d;
  const day = i % 3 === 0 ? d : 1 + ((i * 7) % d);
  return `${today.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

const TITLES = {
  notice: [m('Lift maintenance schedule', '升降機保養安排', '升降机保养安排'), m('Typhoon signal arrangements', '颱風信號安排', '台风信号安排'), m('Water tank cleaning', '食水缸清洗', '食水缸清洗'), m('Fire drill reminder', '消防演習提示', '消防演习提示')],
  document: [m('House rules', '住戶守則', '住户守则'), m('Management fee schedule', '管理費收費表', '管理费收费表'), m('Owners’ meeting minutes', '業主大會會議紀錄', '业主大会会议纪录')],
};
const copyOf = (c: Copy, locale: Locale) => c[locale];

function rowFor(def: MetricDef, i: number, today: string, locale: Locale): ReportRow {
  const flat = flatAt(i);
  const home = flatLabel(flat, locale);
  const homeKey = `${flat.block}${String(flat.floor).padStart(3, '0')}${flat.unit}`;
  const day = dayOf(i, today);
  switch (def.kind) {
    case 'location': {
      const types: Array<[string, string, string]> = [['Block', '座', '座'], ['Podium', '平台', '平台'], ['Car park', '停車場', '停车场'], ['Clubhouse', '會所', '会所']];
      const ty = pickL(types[i % 4] as [string, string, string], locale);
      const nm = locale === 'en' ? `Block ${'ABC'[i % 3]}${i >= 3 ? ` · Zone ${i}` : ''}` : `${'ABC'[i % 3]}座${i >= 3 ? ` ${i} 區` : ''}`;
      return { cells: [nm, ty, String(12 + i * 3)], keys: [nm, ty, 12 + i * 3] };
    }
    case 'household': {
      const st = pickL(['Occupied', '已入住', '已入住'], locale);
      const mem = 1 + (i % 5);
      return { cells: [home, name(i, locale), String(mem), st], keys: [homeKey, name(i, locale), mem, st] };
    }
    case 'tenancy': {
      const startDay = addDays(today, -(200 + ((i * 13) % 500)));
      const scheduled = def.id === 'tenancies-scheduled';
      const ending = def.id === 'tenancies-ending';
      const start = scheduled ? addDays(today, 5 + i * 9) : startDay;
      const end = ending ? dayOf(i, today) : addDays(start, 365 + ((i * 17) % 360));
      const soon = !scheduled && end <= addDays(today, 30);
      const stT: [string, string, string] = scheduled ? ['Scheduled', '待生效', '待生效'] : soon ? ['Ending soon', '即將屆滿', '即将届满'] : ['Active', '有效', '有效'];
      const st = pickL(stT, locale);
      return { cells: [home, name(i, locale), start, end, st], keys: [homeKey, name(i, locale), start, end, st] };
    }
    case 'occupant': {
      const role = pickL(i % 3 === 0 ? ['Tenant', '租戶', '租户'] : i % 3 === 1 ? ['Household member', '住戶成員', '住户成员'] : ['Owner-occupier', '業主自住', '业主自住'], locale);
      return { cells: [flatLabel(flatAt(Math.floor(i / 3)), locale), name(i, locale), role], keys: [homeKey, name(i, locale), role] };
    }
    case 'booking': {
      const cancelled = def.id === 'bookings-cancelled';
      const fac = pickL(FACILITIES[i % FACILITIES.length] as [string, string, string], locale);
      const st = pickL(cancelled ? ['Cancelled', '已取消', '已取消'] : ['Confirmed', '已確認', '已确认'], locale);
      return { cells: [day, home, fac, st], keys: [day, homeKey, fac, st] };
    }
    case 'payment': {
      const refund = def.id === 'pay-refunds' || (def.id === 'pay-net' && i % 12 === 11);
      const raw = 120 + ((i * 53) % 700);
      const amount = refund ? -raw : raw;
      const fac = pickL(FACILITIES[i % FACILITIES.length] as [string, string, string], locale);
      const shown = def.id === 'pay-net' || !refund ? hkdPlain(amount) : hkdPlain(raw);
      return { cells: [day, home, fac, shown], keys: [day, homeKey, fac, amount], amount: def.id === 'pay-refunds' ? raw : amount };
    }
    case 'case': {
      const ty = pickL([['Smoke alarm', '煙霧警報', '烟雾警报'], ['Gas leak report', '氣體洩漏報告', '气体泄漏报告'], ['Door left open', '門未關好', '门未关好']][i % 3] as [string, string, string], locale);
      const st = pickL(def.id === 'safety-open' ? ['Open', '未結', '未结'] : i % 2 ? ['Resolved', '已解決', '已解决'] : ['Open', '未結', '未结'], locale);
      return { cells: [day, home, ty, st], keys: [day, homeKey, ty, st] };
    }
    case 'notice': {
      const title = copyOf(TITLES.notice[i % TITLES.notice.length] as Copy, locale);
      const aud = pickL(i % 2 ? ['All residents', '全體住戶', '全体住户'] : ['Block A', 'A座', 'A座'], locale);
      return { cells: [day, title, aud], keys: [day, title, aud] };
    }
    case 'document': {
      const title = copyOf(TITLES.document[i % TITLES.document.length] as Copy, locale);
      const cat = pickL(i % 2 ? ['Rules', '守則', '守则'] : ['Finance', '財務', '财务'], locale);
      return { cells: [day, title, cat], keys: [day, title, cat] };
    }
    case 'record': {
      const ty = pickL(def.card === 'carpark' ? ['Parking bay', '車位', '车位'] : def.card === 'ev' ? ['Charger', '充電器', '充电器'] : ['Access card', '門禁卡', '门禁卡'], locale);
      const label = def.card === 'carpark' ? `${locale === 'en' ? 'Bay' : '車位'} ${100 + i}` : def.card === 'ev' ? `${locale === 'en' ? 'Charger' : '充電器'} ${1 + i}` : `${locale === 'en' ? 'Card' : '卡'} ${1000 + i}`;
      const holder = def.card === 'ev' ? '—' : home;
      return { cells: [label, holder, ty], keys: [label, holder === '—' ? '' : homeKey, ty] };
    }
    case 'event': {
      const ev = pickL(def.card === 'carpark' ? ['Vehicle entered', '車輛駛入', '车辆驶入'] : def.card === 'ev' ? ['Charging started', '開始充電', '开始充电'] : ['Door opened', '開門', '开门'], locale);
      const label = `${locale === 'en' ? 'Gateway record' : '閘道紀錄'} ${1 + (i % 40)}`;
      return { cells: [day, label, ev], keys: [day, label, ev] };
    }
  }
}

const hkdPlain = (n: number): string => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The rows behind one metric for a date range (current metrics ignore the range). */
export function rowsOf(def: MetricDef, range: DateRange, today: string, locale: Locale): ReportRow[] {
  const out: ReportRow[] = [];
  for (let i = 0; i < def.size; i += 1) {
    if (def.basis === 'period') {
      const d = dayOf(i, today);
      if (d < range.from || d > range.to) continue;
    }
    out.push(rowFor(def, i, today, locale));
  }
  return out;
}

/** What a card shows: the row count, or the HKD total for money metrics. Locale-free, so it can never disagree with the rows. */
export function metricValue(def: MetricDef, range: DateRange, today: string): { n: number; text: string } {
  const rows = rowsOf(def, range, today, 'en');
  if (def.money) {
    const total = rows.reduce((a, r) => a + (r.amount ?? 0), 0);
    return { n: total, text: `HKD ${hkdPlain(total)}` };
  }
  return { n: rows.length, text: rows.length.toLocaleString('en-HK') };
}

export const REPORT_ESTATE = m('Wing Fu Garden', '榮富花園', '荣富花园');
