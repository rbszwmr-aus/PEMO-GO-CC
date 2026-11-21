/**
 * Full management portal nav IA from Claude Design (docs/design-ref).
 * Wired screens map to existing ScreenId; unwired nav ids are Coming Soon stubs.
 * Administration Users / Groups / Roles & features / Email / Audit log,
 * Facility booking, strata / management-fee Payments, and Car Park (thin
 * ParkCore connector) are fixture or connector screens.
 */

import type { ScreenId } from './states.ts';
import { copy, type LocalizedText } from '../i18n/locale.ts';
import type { IconSpec } from '../components/icon-shapes.ts';
import { FINANCE_OBJECT_ICON } from '../finance/finance-ui.ts';

/** Facility booking icons (v3 §5): nav items and their row actions share them. */
export const BOOKING_ICON = {
  bookings: 'ClipboardList',
  calendar: 'CalendarDays',
  checkin: 'CalendarCheck',
  facilities: 'MapPin',
  rates: 'Tag',
  markIn: 'LogIn',
  noShow: 'UserX',
} as const satisfies Record<string, IconSpec>;

const m = copy;

export type NavItemId =
  | 'overview'
  | 'properties'
  | 'prop-residents'
  | 'prop-households'
  | 'helpdesk'
  | 'cases'
  | 'safety'
  | 'visitor'
  | 'visitor-log'
  | 'visitor-register'
  | 'visitor-counter'
  | 'access'
  | 'ac-cardholders'
  | 'ac-rights'
  | 'ac-qr'
  | 'ac-doors'
  | 'ac-events'
  | 'iot'
  | 'iot-mailbox'
  | 'iot-ieq'
  | 'bs-carpark'
  | 'bs-cctv'
  | 'bs-lift'
  | 'bs-intercom'
  | 'bs-ev'
  | 'booking'
  | 'bk-bookings'
  | 'bk-calendar'
  | 'bk-checkin'
  | 'bk-facilities'
  | 'bk-rates'
  | 'notices'
  | 'documents'
  | 'integrations'
  | 'reports'
  | 'finance'
  | 'fin-charges'
  | 'fin-payments'
  | 'fin-refunds'
  | 'admin'
  | 'adm-users'
  | 'adm-groups'
  | 'adm-roles'
  | 'adm-email'
  | 'adm-lists'
  | 'adm-audit';

/** Design nav id → existing ScreenId when the surface already exists. */
export const NAV_TO_SCREEN: Partial<Record<NavItemId, ScreenId>> = {
  overview: 's2',
  safety: 's1',
  properties: 's3',
  cases: 's4',
  notices: 's5',
  visitor: 'visitorLog',
  'visitor-log': 'visitorLog',
  'visitor-register': 'visitorRegister',
  'visitor-counter': 'visitorCounter',
  'prop-residents': 'residents',
  'prop-households': 'households',
  helpdesk: 'helpdesk',
  'adm-users': 'adminUsers',
  'adm-groups': 'adminGroups',
  'adm-roles': 'adminRoles',
  'adm-email': 'adminEmail',
  'adm-lists': 'adminLists',
  'adm-audit': 'adminAudit',
  booking: 'bookings',
  'bk-bookings': 'bookings',
  'bk-calendar': 'bookingCalendar',
  'bk-checkin': 'bookingCheckin',
  'bk-facilities': 'bookingFacilities',
  'bk-rates': 'bookingRates',
  reports: 'reports',
  finance: 'charges',
  'fin-charges': 'charges',
  'fin-payments': 'payments',
  'fin-refunds': 'refunds',
  documents: 'documents',
  'bs-carpark': 'carPark',
  integrations: 'integrationStatus',
};

/** Legacy ScreenId → design nav id (for active rail state). */
export const SCREEN_TO_NAV: Partial<Record<ScreenId, NavItemId>> = {
  s1: 'safety',
  s2: 'overview',
  s3: 'properties',
  s4: 'cases',
  s5: 'notices',
  s5detail: 'notices',
  s5ack: 'notices',
  s5compose: 'notices',
  s5act: 'notices',
  visitorLog: 'visitor-log',
  visitorRegister: 'visitor-register',
  visitorCounter: 'visitor-counter',
  residents: 'prop-residents',
  residentsDetail: 'prop-residents',
  households: 'prop-households',
  householdsDetail: 'prop-households',
  helpdesk: 'helpdesk',
  helpdeskDetail: 'helpdesk',
  adminUsers: 'adm-users',
  adminUsersDetail: 'adm-users',
  adminGroups: 'adm-groups',
  adminGroupsDetail: 'adm-groups',
  adminRoles: 'adm-roles',
  adminEmail: 'adm-email',
  adminLists: 'adm-lists',
  adminAudit: 'adm-audit',
  integrationStatus: 'integrations',
  integrationStatusDetail: 'integrations',
  bookings: 'bk-bookings',
  bookingsDetail: 'bk-bookings',
  bookingCalendar: 'bk-calendar',
  bookingCheckin: 'bk-checkin',
  bookingFacilities: 'bk-facilities',
  bookingFacilitiesDetail: 'bk-facilities',
  bookingRates: 'bk-rates',
  reports: 'reports',
  charges: 'fin-charges',
  chargesDetail: 'fin-charges',
  payments: 'fin-payments',
  paymentsDetail: 'fin-payments',
  refunds: 'fin-refunds',
  refundsDetail: 'fin-refunds',
  documents: 'documents',
  documentsDetail: 'documents',
  carPark: 'bs-carpark',
};

export interface NavChild {
  id: NavItemId;
  label: LocalizedText;
  /** Glyph fallback when no design PNG. */
  icon: string;
  /** Public path to rail PNG (prefer -w / white-v2 on purple rail). */
  iconImg?: string;
  /** Vendored lucide shape (v3). Used when there is no approved PNG. */
  lucide?: IconSpec;
}

export interface NavItem {
  id: NavItemId;
  label: LocalizedText;
  /** Glyph fallback when no design PNG. */
  icon: string;
  /** Public path to rail PNG (prefer -w / white-v2 on purple rail). */
  iconImg?: string;
  /** Vendored lucide shape (v3). Used when there is no approved PNG. */
  lucide?: IconSpec;
  children?: NavChild[];
}

export interface NavGroup {
  id: string;
  label: LocalizedText;
  items: NavItem[];
}

export const NAV_IA: NavGroup[] = [
  {
    id: 'operate',
    label: m('OPERATE', '營運', '营运'),
    items: [
      { id: 'overview', label: m('Overview', '總覽', '总览'), icon: '◱', iconImg: '/icons/overview-w.png' },
      {
        id: 'properties',
        label: m('Properties', '物業', '物业'),
        icon: '▤',
        iconImg: '/icons/properties-white-v2.png',
        children: [
          { id: 'prop-residents', label: m('Residents', '住戶', '住户'), icon: '◍' },
          { id: 'prop-households', label: m('Households', '住戶單位', '住户单元'), icon: '◫' },
        ],
      },
      { id: 'helpdesk', label: m('Help desk', '服務台', '服务台'), icon: '◒', iconImg: '/icons/helpdesk-w.png' },
      { id: 'cases', label: m('Cases', '個案', '案件'), icon: '▣', iconImg: '/icons/cases-w.png' },
    ],
  },
  {
    id: 'safety',
    label: m('SAFETY AND SECURITY', '安全與保安', '安全与保安'),
    items: [
      { id: 'safety', label: m('Home Safety', '家居安全', '家居安全'), icon: '◈', iconImg: '/icons/safety-w.png' },
      {
        id: 'visitor',
        label: m('Visitors', '訪客', '访客'),
        icon: '▥',
        iconImg: '/icons/visitor-w.png',
        children: [
          { id: 'visitor-log', label: m('Visitor log', '訪客紀錄', '访客记录'), icon: '▤' },
          { id: 'visitor-counter', label: m('Front counter', '服務櫃檯', '前台'), icon: '⌂' },
          { id: 'visitor-register', label: m('Register', '登記', '登记'), icon: '✎' },
        ],
      },
      {
        id: 'access',
        label: m('Access control', '門禁', '门禁'),
        icon: '⬓',
        iconImg: '/icons/access-w.png',
        children: [
          { id: 'ac-cardholders', label: m('Cardholders', '持卡人', '持卡人'), icon: '◍' },
          { id: 'ac-rights', label: m('Access rights', '通行權限', '通行权限'), icon: '◨' },
          { id: 'ac-qr', label: m('QR credentials', 'QR 憑證', 'QR 凭证'), icon: '▩' },
          { id: 'ac-doors', label: m('Doors', '大門', '大门'), icon: '▯' },
          { id: 'ac-events', label: m('Events & alarms', '事件與警報', '事件与警报'), icon: '◬' },
        ],
      },
      {
        id: 'iot',
        label: m('Smart IoT', '智慧物聯', '智慧物联'),
        icon: '◎',
        children: [
          { id: 'iot-mailbox', label: m('Mailbox', '信箱', '信箱'), icon: '▯', iconImg: '/icons/mailbox-w.png' },
          { id: 'iot-ieq', label: m('IEQ', '室內環境質素', '室内环境质素'), icon: '◌', iconImg: '/icons/ieq-w.png' },
        ],
      },
    ],
  },
  {
    id: 'building',
    label: m('BUILDING SYSTEMS', '樓宇系統', '楼宇系统'),
    items: [
      { id: 'bs-carpark', label: m('Car Park', '停車場', '停车场'), icon: '▭', iconImg: '/icons/carpark-w.png' },
      { id: 'bs-cctv', label: m('CCTV', '閉路電視', '闭路电视'), icon: '◉', iconImg: '/icons/cctv-w.png' },
      { id: 'bs-lift', label: m('Lift', '升降機', '升降机'), icon: '⬒', iconImg: '/icons/lift-w.png' },
      { id: 'bs-intercom', label: m('Intercom', '對講機', '对讲机'), icon: '◑', iconImg: '/icons/intercom-w.png' },
      { id: 'bs-ev', label: m('EV Charging', '電動車充電', '电动车充电'), icon: '⚡', iconImg: '/icons/ev-w.png' },
    ],
  },
  {
    id: 'amenities',
    label: m('AMENITIES', '會所設施', '会所设施'),
    items: [
      {
        id: 'booking',
        label: m('Facility booking', '設施預約', '设施预约'),
        icon: '▧',
        iconImg: '/icons/clubhouse-w.png',
        children: [
          { id: 'bk-bookings', label: m('Bookings', '預約', '预约'), icon: '▤', lucide: BOOKING_ICON.bookings },
          { id: 'bk-calendar', label: m('Calendar', '日曆', '日历'), icon: '▦', lucide: BOOKING_ICON.calendar },
          { id: 'bk-checkin', label: m('Check-in', '簽到', '签到'), icon: '◪', lucide: BOOKING_ICON.checkin },
          { id: 'bk-facilities', label: m('Facilities & zones', '設施與分區', '设施与分区'), icon: '▥', lucide: BOOKING_ICON.facilities },
          { id: 'bk-rates', label: m('Rate cards', '收費表', '收费表'), icon: '◨', lucide: BOOKING_ICON.rates },
        ],
      },
    ],
  },
  {
    id: 'communicate',
    label: m('COMMUNICATE', '通訊', '通讯'),
    items: [
      { id: 'notices', label: m('Notices', '通告', '公告'), icon: '✉', iconImg: '/icons/notices-w.png' },
      { id: 'documents', label: m('Documents', '文件', '文件'), icon: '▢', iconImg: '/icons/documents-w.png' },
    ],
  },
  {
    id: 'configure',
    label: m('CONFIGURE', '設定', '设置'),
    items: [
      { id: 'integrations', label: m('Integration status', '整合狀態', '整合状态'), icon: '⇄' },
      {
        id: 'finance',
        label: m('Payments & refunds', '付款與退款', '付款与退款'),
        icon: '◈',
        lucide: FINANCE_OBJECT_ICON.finance,
        children: [
          { id: 'fin-charges', label: m('Charges', '管理費帳單', '物业费账单'), icon: '▤', lucide: FINANCE_OBJECT_ICON.charge },
          { id: 'fin-payments', label: m('Payments', '付款', '付款'), icon: '▣', lucide: FINANCE_OBJECT_ICON.payment },
          { id: 'fin-refunds', label: m('Refunds', '退款', '退款'), icon: '◍', lucide: FINANCE_OBJECT_ICON.refund },
        ],
      },
      { id: 'reports', label: m('Reports', '報告', '报告'), icon: '▦', iconImg: '/icons/reports-w.png' },
      {
        id: 'admin',
        label: m('Administration', '系統管理', '系统管理'),
        icon: '⚙',
        children: [
          { id: 'adm-users', label: m('Users', '用戶', '用户'), icon: '◍' },
          { id: 'adm-groups', label: m('Groups', '群組', '群组'), icon: '◫' },
          { id: 'adm-roles', label: m('Roles & features', '角色與功能', '角色与功能'), icon: '◨' },
          { id: 'adm-email', label: m('Email', '電郵', '电子邮件'), icon: '✉' },
          { id: 'adm-lists', label: m('Lists', '清單', '列表'), icon: '☰' },
          { id: 'adm-audit', label: m('Audit log', '審計紀錄', '审计记录'), icon: '▧' },
        ],
      },
    ],
  },
];

export function findNavLabel(id: string): LocalizedText | null {
  for (const g of NAV_IA) {
    for (const it of g.items) {
      if (it.id === id) return it.label;
      for (const c of it.children ?? []) {
        if (c.id === id) return c.label;
      }
    }
  }
  return null;
}

export function isNavItemId(id: string): id is NavItemId {
  return findNavLabel(id) !== null;
}

/** Resolve URL screen param to either a live ScreenId or a stub nav id. */
export function resolveAppScreen(param: string | null):
  | { kind: 'screen'; screen: ScreenId }
  | { kind: 'stub'; navId: NavItemId } {
  if (!param) return { kind: 'screen', screen: 's2' };
  // Legacy ScreenIds
  const legacy: ScreenId[] = ['s1', 's2', 's3', 's4', 's5', 's5detail', 's5ack', 's5compose', 's5act', 'visitorLog', 'visitorRegister', 'visitorCounter', 'residents', 'residentsDetail', 'households', 'householdsDetail', 'helpdesk', 'helpdeskDetail', 'adminUsers', 'adminUsersDetail', 'adminGroups', 'adminGroupsDetail', 'adminRoles', 'adminEmail', 'adminLists', 'adminAudit', 'bookings', 'bookingsDetail', 'bookingCalendar', 'bookingCheckin', 'bookingFacilities', 'bookingFacilitiesDetail', 'bookingRates', 'reports', 'charges', 'chargesDetail', 'payments', 'paymentsDetail', 'refunds', 'refundsDetail', 'documents', 'documentsDetail', 'carPark', 'integrationStatus', 'integrationStatusDetail'];
  if ((legacy as string[]).includes(param)) {
    return { kind: 'screen', screen: param as ScreenId };
  }
  if (isNavItemId(param)) {
    const mapped = NAV_TO_SCREEN[param];
    if (mapped) return { kind: 'screen', screen: mapped };
    return { kind: 'stub', navId: param };
  }
  return { kind: 'screen', screen: 's2' };
}
