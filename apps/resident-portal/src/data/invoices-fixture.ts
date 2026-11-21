/**
 * LOCAL FALLBACK CORPUS — used only when :3200 is unreachable. Mirrors the
 * Backend seed in docs/contracts/resident-portal-v0-invoices-demo.md (same ids,
 * amounts and statuses as of 2026-09-25) so deep links (?invoice=chg_…) still
 * resolve offline. Payment dates/references for the demo-only rows are
 * illustrative. Shapes are the freeze shapes (integer HKD, UPPERCASE status).
 */
import type { LocalizedText } from '../i18n/locale.ts';
import type {
  InvoiceChargeType,
  InvoiceDetail,
  InvoiceLineItem,
  InvoicePaymentApplied,
  InvoicePaymentMethod,
  InvoiceStatus,
} from './invoices-types.ts';

const L = (en: string, zhHant: string, zhHans?: string): LocalizedText => ({ en, 'zh-Hant': zhHant, ...(zhHans ? { 'zh-Hans': zhHans } : {}) });
const HOUSEHOLD = 'hh_wfg_a_12_a1';
const UNIT = 'unit_wfg_a_12_a1';
const UNIT_LABEL = L('Block A · 12/F · Flat A1', 'A座 12樓 A1室', 'A栋 12楼 A1室');
const MGMT = L('Monthly management fee', '每月管理費', '每月物业费');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const periodLabel = (p: string) => {
  const [y, m] = p.split('-');
  return L(`${MONTHS[Number(m) - 1]} ${y}`, `${y}年${Number(m)}月`, `${y}年${Number(m)}月`);
};

const line = (description: LocalizedText, chargeType: InvoiceChargeType, quantity: number, unitAmountHkd: number): InvoiceLineItem =>
  ({ description, chargeType, quantity, unitAmountHkd, amountHkd: quantity * unitAmountHkd });
const pay = (paymentId: string, paidAt: string, method: InvoicePaymentMethod, amountHkd: number, reference: string): InvoicePaymentApplied =>
  ({ paymentId, paidAt, method, amountHkd, reference });

function inv(o: {
  invoiceId: string; invoiceNumber: string; period: string; title: LocalizedText;
  issueDate: string; dueDate: string; status: InvoiceStatus;
  lineItems: InvoiceLineItem[]; paymentsApplied: InvoicePaymentApplied[];
}): InvoiceDetail {
  const amountHkd = o.lineItems.reduce((s, l) => s + l.amountHkd, 0);
  const paidHkd = o.paymentsApplied.reduce((s, p) => s + p.amountHkd, 0);
  return {
    invoiceId: o.invoiceId, invoiceNumber: o.invoiceNumber, householdId: HOUSEHOLD, unitId: UNIT,
    unitLabel: UNIT_LABEL, period: o.period, periodLabel: periodLabel(o.period), title: o.title,
    issueDate: o.issueDate, dueDate: o.dueDate, status: o.status, currency: 'HKD',
    amountHkd, paidHkd, balanceHkd: Math.max(0, amountHkd - paidHkd),
    lineItems: o.lineItems, paymentsApplied: o.paymentsApplied, pdfUrl: null,
  };
}

const mgmtLine = (p: string) => line(L(`Management fee — ${periodLabel(p).en}`, `管理費 — ${periodLabel(p)['zh-Hant']}`, `物业费 — ${periodLabel(p)['zh-Hans']}`), 'management_fee', 1, 3280);

export const INVOICE_FIXTURES: readonly InvoiceDetail[] = [
  inv({
    invoiceId: 'chg_wfg_a1_202609', invoiceNumber: 'INV-WFG-A1-202609', period: '2026-09', title: MGMT,
    issueDate: '2026-09-01', dueDate: '2026-09-30', status: 'UNPAID',
    lineItems: [mgmtLine('2026-09')], paymentsApplied: [],
  }),
  inv({
    invoiceId: 'chg_wfg_a1_202609_cp', invoiceNumber: 'INV-WFG-A1-202609-CP', period: '2026-09',
    title: L('Car park licence fee', '車位牌照費', '车位牌照费'), issueDate: '2026-09-01', dueDate: '2026-09-30', status: 'PARTIAL',
    lineItems: [line(L('Car park licence — bay P2-017', '車位牌照 — P2-017 車位', '车位牌照 — P2-017 车位'), 'carpark_licence', 1, 2400)],
    paymentsApplied: [pay('pay_wfg_r1012', '2026-09-12T19:40:00+08:00', 'octopus', 1200, 'Octopus stub · tap 19:40')],
  }),
  inv({
    invoiceId: 'chg_wfg_a1_202608', invoiceNumber: 'INV-WFG-A1-202608', period: '2026-08', title: MGMT,
    issueDate: '2026-08-01', dueDate: '2026-08-31', status: 'PAID',
    lineItems: [mgmtLine('2026-08')],
    paymentsApplied: [pay('pay_wfg_r1001', '2026-08-20T10:00:00+08:00', 'fps', 3280, 'FPS')],
  }),
  inv({
    invoiceId: 'chg_wfg_a1_202607_lv', invoiceNumber: 'INV-WFG-A1-202607-LV', period: '2026-07',
    title: L('Special levy — external wall repair', '特別徵費 — 外牆維修', '特别征费 — 外墙维修'),
    issueDate: '2026-07-15', dueDate: '2026-08-15', status: 'OVERDUE',
    lineItems: [
      line(L('Special levy — external wall repair', '特別徵費 — 外牆維修', '特别征费 — 外墙维修'), 'special_levy', 1, 4800),
      line(L('Sinking fund contribution', '維修基金供款', '维修基金供款'), 'sinking_fund', 2, 400),
    ],
    paymentsApplied: [],
  }),
  inv({
    invoiceId: 'chg_wfg_a1_202607', invoiceNumber: 'INV-WFG-A1-202607', period: '2026-07', title: MGMT,
    issueDate: '2026-07-01', dueDate: '2026-07-31', status: 'PAID',
    lineItems: [mgmtLine('2026-07')],
    paymentsApplied: [pay('pay_wfg_r0962', '2026-07-22T15:00:00+08:00', 'cheque', 3280, 'Cheque')],
  }),
  inv({
    invoiceId: 'chg_wfg_a1_202606', invoiceNumber: 'INV-WFG-A1-202606', period: '2026-06', title: MGMT,
    issueDate: '2026-06-01', dueDate: '2026-06-30', status: 'PAID',
    lineItems: [mgmtLine('2026-06')],
    paymentsApplied: [pay('pay_wfg_r0917', '2026-06-18T10:00:00+08:00', 'fps', 3280, 'FPS')],
  }),
];
