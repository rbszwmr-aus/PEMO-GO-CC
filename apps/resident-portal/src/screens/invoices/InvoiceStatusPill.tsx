import type { Locale } from '../../i18n/locale.ts';
import type { InvoiceStatus } from '../../data/invoices-types.ts';
import { statusLabel } from './invoice-format.ts';

export function InvoiceStatusPill({ status, locale }: { status: InvoiceStatus; locale: Locale }) {
  return (
    <span
      className={`pemo-inv-pill pemo-inv-pill--${status.toLowerCase()}`}
      data-testid="portal-invoice-status"
      data-status={status}
    >
      {statusLabel(status, locale)}
    </span>
  );
}
