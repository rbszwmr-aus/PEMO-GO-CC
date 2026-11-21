import { seedInvoices } from './seed.js';
import type {
  InvoiceDetail,
  InvoiceStatus,
  InvoiceSummary,
  InvoiceSummaryRow,
} from './types.js';
import { DEMO_AS_OF, FIXTURE_HOUSEHOLD_ID, FIXTURE_RESIDENT_ID } from './types.js';

export interface DemoInvoiceStore {
  /** Demo resident → household. Unknown resident → null (sees nothing). */
  householdForResident(residentRef: string): string | null;
  /** Newest issueDate first. */
  listForHousehold(householdId: string, status?: InvoiceStatus): InvoiceSummaryRow[];
  /** Null when missing OR belonging to another household (same answer). */
  getForHousehold(householdId: string, invoiceId: string): InvoiceDetail | null;
  summaryForHousehold(householdId: string | null): InvoiceSummary;
}

const toRow = (d: InvoiceDetail): InvoiceSummaryRow => ({
  invoiceId: d.invoiceId,
  invoiceNumber: d.invoiceNumber,
  householdId: d.householdId,
  unitId: d.unitId,
  unitLabel: d.unitLabel,
  period: d.period,
  periodLabel: d.periodLabel,
  title: d.title,
  issueDate: d.issueDate,
  dueDate: d.dueDate,
  status: d.status,
  currency: d.currency,
  amountHkd: d.amountHkd,
  paidHkd: d.paidHkd,
  balanceHkd: d.balanceHkd,
});

export function createInvoiceStore(
  initial: readonly InvoiceDetail[] = seedInvoices(),
  opts: {
    readonly residentHouseholds?: Readonly<Record<string, string>>;
    readonly asOf?: string;
  } = {},
): DemoInvoiceStore {
  const invoices: readonly InvoiceDetail[] = initial.map((i) => ({ ...i }));
  const households = opts.residentHouseholds ?? { [FIXTURE_RESIDENT_ID]: FIXTURE_HOUSEHOLD_ID };
  const asOf = opts.asOf ?? DEMO_AS_OF;

  const forHousehold = (householdId: string): InvoiceDetail[] =>
    invoices
      .filter((i) => i.householdId === householdId)
      .slice()
      .sort((a, b) =>
        a.issueDate === b.issueDate
          ? a.invoiceId < b.invoiceId ? -1 : 1
          : a.issueDate < b.issueDate ? 1 : -1);

  return {
    householdForResident(residentRef: string): string | null {
      return households[residentRef] ?? null;
    },

    listForHousehold(householdId: string, status?: InvoiceStatus): InvoiceSummaryRow[] {
      return forHousehold(householdId)
        .filter((i) => status === undefined || i.status === status)
        .map(toRow);
    },

    getForHousehold(householdId: string, invoiceId: string): InvoiceDetail | null {
      const hit = invoices.find((i) => i.invoiceId === invoiceId);
      return hit && hit.householdId === householdId ? hit : null;
    },

    summaryForHousehold(householdId: string | null): InvoiceSummary {
      const rows = householdId === null ? [] : forHousehold(householdId);
      const counts: Record<InvoiceStatus, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0, OVERDUE: 0 };
      let outstanding = 0;
      let overdue = 0;
      for (const r of rows) {
        counts[r.status] += 1;
        if (r.status !== 'PAID') outstanding += r.balanceHkd;
        if (r.status === 'OVERDUE') overdue += r.balanceHkd;
      }
      return {
        householdId,
        currency: 'HKD',
        asOf,
        counts,
        totalCount: rows.length,
        outstandingBalanceHkd: outstanding,
        overdueBalanceHkd: overdue,
      };
    },
  };
}

let singleton: DemoInvoiceStore | null = null;

export function getDemoInvoiceStore(): DemoInvoiceStore {
  if (!singleton) singleton = createInvoiceStore();
  return singleton;
}

export function resetDemoInvoiceStoreForTests(): void {
  singleton = null;
}
