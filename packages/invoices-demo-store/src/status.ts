import type { InvoiceStatus } from './types.js';

/**
 * PAID    — balance 0.
 * OVERDUE — balance > 0 and dueDate is before asOf (wins over PARTIAL).
 * PARTIAL — some paid, balance > 0, not yet past due.
 * UNPAID  — nothing paid, not yet past due.
 * Dates are `YYYY-MM-DD` (HK business dates), compared lexically.
 */
export const deriveInvoiceStatus = (input: {
  readonly amountHkd: number;
  readonly paidHkd: number;
  readonly dueDate: string;
  readonly asOf: string;
}): InvoiceStatus => {
  const balance = input.amountHkd - input.paidHkd;
  if (balance <= 0) return 'PAID';
  if (input.dueDate < input.asOf) return 'OVERDUE';
  if (input.paidHkd > 0) return 'PARTIAL';
  return 'UNPAID';
};
