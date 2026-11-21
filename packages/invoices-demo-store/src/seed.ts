/**
 * Seed invoices for the demo household (Ho Mei-yi, Block A 12/F Flat A1).
 *
 * `chg_wfg_a1_202609` and `chg_wfg_a1_202608` (+ payment `pay_wfg_r1001`) are
 * the same ids / amounts as database/seeds/80-strata-wing-fu-charges.sql. The
 * other four are demo-only rows in the same id style so the screen covers all
 * four statuses. Statuses are DERIVED against DEMO_AS_OF (2026-09-25), not the
 * wall clock, so the demo does not drift.
 */

import type {
  InvoiceChargeType,
  InvoiceDetail,
  InvoiceLineItem,
  InvoicePaymentApplied,
  LocalizedText,
} from './types.js';
import { DEMO_AS_OF, FIXTURE_HOUSEHOLD_ID, FIXTURE_UNIT_ID } from './types.js';
import { deriveInvoiceStatus } from './status.js';

const UNIT_LABEL: LocalizedText = {
  en: 'Block A · 12/F · Flat A1',
  'zh-Hant': 'A座 12樓 A1室',
};

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const periodLabel = (period: string): LocalizedText => {
  const [y, m] = period.split('-');
  const month = Number(m);
  return {
    en: `${MONTHS_EN[month - 1] ?? m} ${y}`,
    'zh-Hant': `${y}年${month}月`,
  };
};

const MGMT_FEE: LocalizedText = { en: 'Monthly management fee', 'zh-Hant': '每月管理費' };

const line = (
  description: LocalizedText,
  chargeType: InvoiceChargeType,
  quantity: number,
  unitAmountHkd: number,
): InvoiceLineItem => ({
  description,
  chargeType,
  quantity,
  unitAmountHkd,
  amountHkd: quantity * unitAmountHkd,
});

interface SeedRow {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly period: string;
  readonly title: LocalizedText;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly paymentsApplied: readonly InvoicePaymentApplied[];
}

const build = (row: SeedRow, asOf: string): InvoiceDetail => {
  const amountHkd = row.lineItems.reduce((sum, l) => sum + l.amountHkd, 0);
  const paidHkd = row.paymentsApplied.reduce((sum, p) => sum + p.amountHkd, 0);
  return {
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    householdId: FIXTURE_HOUSEHOLD_ID,
    unitId: FIXTURE_UNIT_ID,
    unitLabel: UNIT_LABEL,
    period: row.period,
    periodLabel: periodLabel(row.period),
    title: row.title,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: deriveInvoiceStatus({ amountHkd, paidHkd, dueDate: row.dueDate, asOf }),
    currency: 'HKD',
    amountHkd,
    paidHkd,
    balanceHkd: Math.max(0, amountHkd - paidHkd),
    lineItems: row.lineItems,
    paymentsApplied: row.paymentsApplied,
    pdfUrl: null,
  };
};

const ROWS: readonly SeedRow[] = [
  {
    // Strata seed row: 3280, status `due` → UNPAID.
    invoiceId: 'chg_wfg_a1_202609',
    invoiceNumber: 'INV-WFG-A1-202609',
    period: '2026-09',
    title: MGMT_FEE,
    issueDate: '2026-09-01',
    dueDate: '2026-09-30',
    lineItems: [line(MGMT_FEE, 'management_fee', 1, 3280)],
    paymentsApplied: [],
  },
  {
    invoiceId: 'chg_wfg_a1_202609_cp',
    invoiceNumber: 'INV-WFG-A1-202609-CP',
    period: '2026-09',
    title: { en: 'Car park licence fee', 'zh-Hant': '車位牌照費' },
    issueDate: '2026-09-01',
    dueDate: '2026-09-30',
    lineItems: [
      line({ en: 'Car park licence — bay P2-017', 'zh-Hant': '車位牌照 — P2-017 車位' }, 'carpark_licence', 1, 2400),
    ],
    paymentsApplied: [
      {
        paymentId: 'pay_wfg_r1012',
        paidAt: '2026-09-12T19:40:00+08:00',
        method: 'octopus',
        amountHkd: 1200,
        reference: 'Octopus stub · tap 19:40',
      },
    ],
  },
  {
    invoiceId: 'chg_wfg_a1_202607_lv',
    invoiceNumber: 'INV-WFG-A1-202607-LV',
    period: '2026-07',
    title: { en: 'Special levy — external wall repair', 'zh-Hant': '特別徵費 — 外牆維修' },
    issueDate: '2026-07-15',
    dueDate: '2026-08-15',
    lineItems: [
      line(
        { en: 'External wall repair levy, instalment 1 of 4', 'zh-Hant': '外牆維修徵費（第 1 期，共 4 期）' },
        'special_levy',
        1,
        4800,
      ),
      line(
        { en: 'Sinking fund top-up (2 months × HKD 400)', 'zh-Hant': '維修基金補足（2 個月 × 400 港元）' },
        'sinking_fund',
        2,
        400,
      ),
    ],
    paymentsApplied: [],
  },
  {
    // Strata seed row: 3280, paid by pay_wfg_r1001 (FPS, 3 Aug).
    invoiceId: 'chg_wfg_a1_202608',
    invoiceNumber: 'INV-WFG-A1-202608',
    period: '2026-08',
    title: MGMT_FEE,
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    lineItems: [line(MGMT_FEE, 'management_fee', 1, 3280)],
    paymentsApplied: [
      {
        paymentId: 'pay_wfg_r1001',
        paidAt: '2026-08-03T10:15:00+08:00',
        method: 'fps',
        amountHkd: 3280,
        reference: 'FPS stub · WFG-A1-0803',
      },
    ],
  },
  {
    invoiceId: 'chg_wfg_a1_202607',
    invoiceNumber: 'INV-WFG-A1-202607',
    period: '2026-07',
    title: MGMT_FEE,
    issueDate: '2026-07-01',
    dueDate: '2026-07-31',
    lineItems: [line(MGMT_FEE, 'management_fee', 1, 3280)],
    paymentsApplied: [
      {
        paymentId: 'pay_wfg_r0962',
        paidAt: '2026-07-06T11:30:00+08:00',
        method: 'cheque',
        amountHkd: 3280,
        reference: 'Cheque stub · HSBC 004512',
      },
    ],
  },
  {
    invoiceId: 'chg_wfg_a1_202606',
    invoiceNumber: 'INV-WFG-A1-202606',
    period: '2026-06',
    title: MGMT_FEE,
    issueDate: '2026-06-01',
    dueDate: '2026-06-30',
    lineItems: [line(MGMT_FEE, 'management_fee', 1, 3280)],
    paymentsApplied: [
      {
        paymentId: 'pay_wfg_r0917',
        paidAt: '2026-06-04T09:05:00+08:00',
        method: 'fps',
        amountHkd: 3280,
        reference: 'FPS stub · WFG-A1-0604',
      },
    ],
  },
];

export function seedInvoices(asOf: string = DEMO_AS_OF): InvoiceDetail[] {
  return ROWS.map((row) => build(row, asOf));
}
