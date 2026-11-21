/**
 * Page fixture corpus for Visitors P0 (Visitor log + Register).
 *
 * NOT a management-web contract operation — v0 freeze has no visitor list/write
 * endpoints. Rows mirror the 6 Sept design demo (visStats / visRows) so the
 * screen looks like the design for hard-refresh review. Labeled fixture corpus
 * for this page only; do not treat as live API fields.
 */

export type VisitorTone = 'normal' | 'information' | 'warning' | 'unknown';

export type VisitorStateId =
  | 'expected'
  | 'arrived'
  | 'not-signed-out'
  | 'host-not-reached'
  | 'checked-out';

export interface VisitorStat {
  id: string;
  label: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  value: number;
  note: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  tone: VisitorTone;
}

export interface VisitorRow {
  id: string;
  name: string;
  purpose: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  hostUnit: string;
  hostResident: string | null;
  expected: string;
  expectedWindow: { start: string; end: string } | null;
  pass: string;
  state: VisitorStateId;
  tone: VisitorTone;
  arrivedAt: string | null;
  registeredBy: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  idStub: string | null;
  notes: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined } | null;
}

export interface VisitorListFixture {
  comment: string;
  asOf: string;
  stats: VisitorStat[];
  visitors: VisitorRow[];
}

export const VISITOR_LIST_FIXTURE: VisitorListFixture = {
  comment:
    'Fixture corpus for Visitors P0 — design-aligned demo rows from management-web-6-Sept. Not a live API response.',
  asOf: '2026-09-06T09:41:00+08:00',
  stats: [
    {
      id: 'expected-today',
      label: { en: 'EXPECTED TODAY', 'zh-Hant': '今日預期', 'zh-Hans': '今日预期' },
      value: 14,
      note: {
        en: '6 registered by residents in the app',
        'zh-Hant': '其中 6 位由住戶於應用程式登記', 'zh-Hans': '其中 6 位由住户于应用程序登记',
      },
      tone: 'information',
    },
    {
      id: 'arrived',
      label: { en: 'ARRIVED', 'zh-Hant': '已到達', 'zh-Hans': '已到达' },
      value: 9,
      note: { en: 'last at 09:41', 'zh-Hant': '最近一次 09:41', 'zh-Hans': '最近一次 09:41' },
      tone: 'normal',
    },
    {
      id: 'not-signed-out',
      label: { en: 'NOT SIGNED OUT', 'zh-Hant': '尚未簽出', 'zh-Hans': '尚未签出' },
      value: 3,
      note: { en: 'oldest since 07:55', 'zh-Hant': '最早自 07:55', 'zh-Hans': '最早自 07:55' },
      tone: 'warning',
    },
    {
      id: 'walk-in',
      label: { en: 'WALK-IN, NO HOST', 'zh-Hant': '無主人的即場訪客', 'zh-Hans': '无主人的现场访客' },
      value: 2,
      note: {
        en: 'held at the counter for confirmation',
        'zh-Hant': '暫於櫃檯等候確認', 'zh-Hans': '暂于柜台等候确认',
      },
      tone: 'unknown',
    },
  ],
  visitors: [
    {
      id: 'vis-4418',
      name: 'Chan Ka-ho 陳家豪',
      purpose: { en: 'Family', 'zh-Hant': '探訪家人', 'zh-Hans': '探访家人' },
      hostUnit: 'A · 12/F A1',
      hostResident: 'Ho Mei-yi 何美儀',
      expected: '09:30',
      expectedWindow: { start: '09:00', end: '18:00' },
      pass: 'VP-4418',
      state: 'arrived',
      tone: 'normal',
      arrivedAt: '2026-09-06T09:28:00+08:00',
      registeredBy: { en: 'Resident app', 'zh-Hant': '住戶應用程式', 'zh-Hans': '住户应用程序' },
      idStub: 'HKID ·•••• 123(A)',
      notes: null,
    },
    {
      id: 'vis-4419',
      name: 'Fung Interiors (2 people)',
      purpose: { en: 'Contractor', 'zh-Hant': '承辦商', 'zh-Hans': '承办商' },
      hostUnit: 'B · 18/F B4',
      hostResident: 'Cheung Tak-wah 張德華',
      expected: '10:00',
      expectedWindow: { start: '10:00', end: '17:00' },
      pass: 'VP-4419',
      state: 'expected',
      tone: 'information',
      arrivedAt: null,
      registeredBy: { en: 'Office pre-register', 'zh-Hant': '辦事處預先登記', 'zh-Hans': '办事处预先登记' },
      idStub: null,
      notes: {
        en: 'Two workers; tools via service lift.',
        'zh-Hant': '兩名工人；工具經服務升降機。', 'zh-Hans': '两名工人；工具经服务升降机。',
      },
    },
    {
      id: 'vis-4402',
      name: 'Lam Siu-kei 林小琪',
      purpose: { en: 'Family', 'zh-Hant': '探訪家人', 'zh-Hans': '探访家人' },
      hostUnit: 'A · 7/F A2',
      hostResident: null,
      expected: '08:15',
      expectedWindow: { start: '08:00', end: '12:00' },
      pass: 'VP-4402',
      state: 'not-signed-out',
      tone: 'warning',
      arrivedAt: '2026-09-06T07:55:00+08:00',
      registeredBy: { en: 'Resident app', 'zh-Hant': '住戶應用程式', 'zh-Hans': '住户应用程序' },
      idStub: 'HKID ·•••• 882(B)',
      notes: null,
    },
    {
      id: 'vis-4421',
      name: 'Courier · SF Express',
      purpose: { en: 'Delivery', 'zh-Hant': '送貨', 'zh-Hans': '送货' },
      hostUnit: 'Counter',
      hostResident: null,
      expected: '—',
      expectedWindow: null,
      pass: 'VP-4421',
      state: 'arrived',
      tone: 'normal',
      arrivedAt: '2026-09-06T09:41:00+08:00',
      registeredBy: { en: 'Walk-in at counter', 'zh-Hant': '櫃檯即場登記', 'zh-Hans': '柜台现场登记' },
      idStub: null,
      notes: {
        en: 'Parcel for Flat C2; host not required.',
        'zh-Hant': 'C2 室包裹；無需主人。', 'zh-Hans': 'C2 室包裹；无需主人。',
      },
    },
    {
      id: 'vis-walkin-1',
      name: 'Unnamed walk-in',
      purpose: { en: 'Visit', 'zh-Hant': '探訪', 'zh-Hans': '探访' },
      hostUnit: 'C · 9/F C3',
      hostResident: null,
      expected: '—',
      expectedWindow: null,
      pass: '—',
      state: 'host-not-reached',
      tone: 'unknown',
      arrivedAt: '2026-09-06T09:15:00+08:00',
      registeredBy: { en: 'Walk-in at counter', 'zh-Hant': '櫃檯即場登記', 'zh-Hans': '柜台现场登记' },
      idStub: null,
      notes: {
        en: 'Held at counter — host not reached.',
        'zh-Hant': '暫於櫃檯 — 未能聯絡主人。', 'zh-Hans': '暂于柜台 — 未能联络主人。',
      },
    },
    {
      id: 'vis-4425',
      name: 'Wong Suk-fan 黃淑芬',
      purpose: { en: 'Caregiver', 'zh-Hant': '照顧者', 'zh-Hans': '照顾者' },
      hostUnit: 'A · 12/F A1',
      hostResident: 'Ho Mei-yi 何美儀',
      expected: '14:00',
      expectedWindow: { start: '14:00', end: '18:00' },
      pass: 'VP-4425',
      state: 'expected',
      tone: 'information',
      arrivedAt: null,
      registeredBy: { en: 'Resident app', 'zh-Hant': '住戶應用程式', 'zh-Hans': '住户应用程序' },
      idStub: 'HKID ·•••• 441(C)',
      notes: null,
    },
  ],
};

export function findVisitor(id: string): VisitorRow | undefined {
  return VISITOR_LIST_FIXTURE.visitors.find((v) => v.id === id);
}
