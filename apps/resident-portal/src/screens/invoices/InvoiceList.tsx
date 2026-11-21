import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import {
  INVOICE_STATUSES,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceSummary,
} from '../../data/invoices-types.ts';
import { dateOrDash, hkd, statusLabel } from './invoice-format.ts';
import { InvoiceStatusPill } from './InvoiceStatusPill.tsx';

export function InvoiceList({
  invoices,
  summary,
  filter,
  source,
  locale,
  onFilter,
  onOpen,
}: {
  /** Already filtered, in list order. */
  invoices: readonly InvoiceListItem[];
  /** From GET …/invoices/summary — the card counts. */
  summary: InvoiceSummary;
  filter: InvoiceStatus | null;
  source: 'api' | 'local';
  locale: Locale;
  onFilter: (status: InvoiceStatus | null) => void;
  onOpen: (id: string) => void;
}) {
  const M = MESSAGES.invoicesPortal;
  const countText = (n: number) => t(M.countInvoices, locale).replace('{n}', String(n));

  return (
    <div className="pemo-panel pemo-inv" data-testid="portal-invoice-list" data-filter={filter ?? 'all'}>
      <header className="pemo-explore__head">
        <h1 className="pemo-page-title">{t(M.listTitle, locale)}</h1>
        <HelpBubble testId="portal-invoice-source" source={source} text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      </header>

      <section aria-labelledby="portal-invoice-summary-heading">
        <h2 id="portal-invoice-summary-heading" className="pemo-panel__title">{t(M.summaryHeading, locale)}</h2>
        <div className="pemo-inv-cards" data-testid="portal-invoice-cards">
          <button
            type="button"
            className="pemo-inv-card pemo-inv-card--all"
            data-testid="portal-invoice-card"
            data-status="all"
            aria-pressed={filter === null}
            onClick={() => onFilter(null)}
          >
            <span className="pemo-inv-card__label">{t(M.filterAll, locale)}</span>
            <span className="pemo-inv-card__value" data-testid="portal-invoice-card-count">{summary.totalCount}</span>
            <span className="pemo-meta" data-testid="portal-invoice-outstanding">
              {t(M.outstanding, locale).replace('{amount}', hkd(summary.outstandingBalanceHkd))}
            </span>
          </button>
          {INVOICE_STATUSES.map((s) => {
            const active = filter === s;
            return (
              <button
                type="button"
                key={s}
                className={`pemo-inv-card pemo-inv-card--${s.toLowerCase()}`}
                data-testid="portal-invoice-card"
                data-status={s}
                aria-pressed={active}
                onClick={() => onFilter(active ? null : s)}
              >
                <span className="pemo-inv-card__label">{statusLabel(s, locale)}</span>
                <span className="pemo-inv-card__value" data-testid="portal-invoice-card-count">{summary.counts[s]}</span>
                <span className="pemo-meta">
                  {s === 'OVERDUE'
                    ? t(M.overdueBalance, locale).replace('{amount}', hkd(summary.overdueBalanceHkd))
                    : t(M.filterHint, locale)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {filter ? (
        <p className="pemo-note pemo-inv-filter-note" data-testid="portal-invoice-filter-note">
          <span>{t(M.filterActive, locale).replace('{status}', statusLabel(filter, locale))}</span>
          <button
            type="button"
            className="pemo-btn pemo-btn--ghost"
            data-testid="portal-invoice-clear-filter"
            onClick={() => onFilter(null)}
          >
            {t(M.clearFilter, locale)}
          </button>
        </p>
      ) : null}

      {invoices.length === 0 ? (
        <section className="pemo-state" data-testid="portal-invoice-empty" role="status">
          <h2 className="pemo-state__title">{t(filter ? M.emptyFilteredTitle : M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(filter ? M.emptyFilteredBody : M.emptyBody, locale)}</p>
        </section>
      ) : (
        <>
          <p className="pemo-meta" data-testid="portal-invoice-row-count">{countText(invoices.length)}</p>
          <div className="pemo-inv-rowhead" aria-hidden="true">
            <span>{t(M.colInvoice, locale)}</span>
            <span>{t(M.colPeriod, locale)}</span>
            <span>{t(M.colDue, locale)}</span>
            <span className="pemo-inv-num">{t(M.colAmount, locale)}</span>
            <span className="pemo-inv-num">{t(M.colBalance, locale)}</span>
            <span>{t(M.colStatus, locale)}</span>
          </div>
          <ul className="pemo-explore__results" data-testid="portal-invoice-rows">
            {invoices.map((inv) => (
              <li key={inv.invoiceId}>
                <button
                  type="button"
                  className="pemo-facility-card pemo-inv-row"
                  data-testid="portal-invoice-row"
                  data-invoice-id={inv.invoiceId}
                  data-status={inv.status}
                  onClick={() => onOpen(inv.invoiceId)}
                >
                  <span className="pemo-inv-row__id">
                    <span className="pemo-facility-card__title" data-testid="portal-invoice-number">{inv.invoiceNumber}</span>
                    <span className="pemo-meta">{t(inv.title, locale)}</span>
                  </span>
                  <span className="pemo-inv-row__cell" data-label={t(M.colPeriod, locale)}>{t(inv.periodLabel, locale)}</span>
                  <span className="pemo-inv-row__cell" data-label={t(M.colDue, locale)} data-testid="portal-invoice-due">{dateOrDash(inv.dueDate, locale)}</span>
                  <span className="pemo-inv-row__cell pemo-inv-num" data-label={t(M.colAmount, locale)} data-testid="portal-invoice-amount">{hkd(inv.amountHkd)}</span>
                  <span className="pemo-inv-row__cell pemo-inv-num pemo-inv-strong" data-label={t(M.colBalance, locale)} data-testid="portal-invoice-balance">{hkd(inv.balanceHkd)}</span>
                  <span className="pemo-inv-row__cell"><InvoiceStatusPill status={inv.status} locale={locale} /></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
