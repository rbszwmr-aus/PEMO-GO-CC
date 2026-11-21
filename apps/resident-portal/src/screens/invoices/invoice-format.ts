import { formatDate, formatTime } from '../../format/datetime.ts';
import { formatMoney } from '../../format/money.ts';
import { t, type Locale, type LocalizedText } from '../../i18n/locale.ts';
import { MESSAGES } from '../../i18n/messages.ts';
import type { InvoiceStatus } from '../../data/invoices-types.ts';

const M = MESSAGES.invoicesPortal;

/** Integer HKD → "HK$3,280". */
export const hkd = (amountHkd: number): string => formatMoney({ amount: amountHkd, currency: 'HKD' });

export function statusLabel(status: InvoiceStatus, locale: Locale): string {
  return t(M.status[status.toLowerCase() as Lowercase<InvoiceStatus>], locale);
}

/** DD MMM YYYY for a YYYY-MM-DD date; the em dash placeholder when absent. */
export function dateOrDash(date: string | null | undefined, locale: Locale): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return t(M.none, locale);
  return formatDate(date, locale);
}

/** RFC 3339 timestamp → "DD MMM YYYY HH:MM" in Asia/Hong_Kong. */
export function dateTimeOrDash(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return t(M.none, locale);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t(M.none, locale);
  const hkDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return `${formatDate(hkDate, locale)} ${formatTime(iso, locale)}`;
}

export function chargeTypeLabel(chargeType: string, locale: Locale): string | null {
  const known = (M.lineKind as Record<string, LocalizedText>)[chargeType];
  return known ? t(known, locale) : null;
}

export function methodLabel(method: string, locale: Locale): string {
  const known = (M.method as Record<string, LocalizedText>)[method];
  return known ? t(known, locale) : method || t(M.none, locale);
}
