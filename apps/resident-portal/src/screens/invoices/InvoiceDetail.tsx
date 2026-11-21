import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { InvoiceDetail as Invoice } from '../../data/invoices-types.ts';
import { chargeTypeLabel, dateOrDash, dateTimeOrDash, hkd, methodLabel } from './invoice-format.ts';
import { InvoiceStatusPill } from './InvoiceStatusPill.tsx';

export function InvoiceDetail({
  invoice,
  source,
  locale,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionLabel,
}: {
  invoice: Invoice;
  source: 'api' | 'local';
  locale: Locale;
  onBack: () => void;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string | undefined;
}) {
  const M = MESSAGES.invoicesPortal;
  const none = t(M.none, locale);
  const period = t(invoice.periodLabel, locale);
  const title = t(invoice.title, locale);

  return (
    <div
      className="pemo-panel pemo-inv"
      data-testid="portal-invoice-detail"
      data-invoice-id={invoice.invoiceId}
      data-status={invoice.status}
    >
      <p className="pemo-note" data-testid="portal-invoice-nav">
        <button type="button" className="pemo-btn" data-testid="portal-invoice-back" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
        {positionLabel ? (
          <span className="pemo-meta" data-testid="portal-invoice-position">{positionLabel}</span>
        ) : null}
      </p>

      <div className="pemo-title-row" data-testid="portal-invoice-title-row">
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-invoice-prev"
          aria-label={t(M.prevInvoice, locale)}
          disabled={!hasPrev || !onPrev}
          onClick={() => onPrev?.()}
        >
          ‹
        </button>
        <h1 className="pemo-page-title">{invoice.invoiceNumber}</h1>
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-invoice-next"
          aria-label={t(M.nextInvoice, locale)}
          disabled={!hasNext || !onNext}
          onClick={() => onNext?.()}
        >
          ›
        </button>
      </div>

      <p className="pemo-meta" data-testid="portal-invoice-title">{title}</p>

      <HelpBubble testId="portal-invoice-source" source={source} text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />

      <dl className="pemo-dl">
        <dt>{t(M.fieldStatus, locale)}</dt>
        <dd><InvoiceStatusPill status={invoice.status} locale={locale} /></dd>
        <dt>{t(M.fieldInvoiceNumber, locale)}</dt>
        <dd>{invoice.invoiceNumber}</dd>
        <dt>{t(M.fieldUnit, locale)}</dt>
        <dd>{t(invoice.unitLabel, locale)}</dd>
        <dt>{t(M.fieldPeriod, locale)}</dt>
        <dd>{period}</dd>
        <dt>{t(M.fieldIssued, locale)}</dt>
        <dd>{dateOrDash(invoice.issueDate, locale)}</dd>
        <dt>{t(M.fieldDue, locale)}</dt>
        <dd data-testid="portal-invoice-due">{dateOrDash(invoice.dueDate, locale)}</dd>
      </dl>

      <section aria-labelledby="portal-invoice-lines-heading">
        <h2 id="portal-invoice-lines-heading" className="pemo-panel__title">{t(M.lineItemsHeading, locale)}</h2>
        <div className="pemo-inv-tablewrap">
          <table className="pemo-inv-table" data-testid="portal-invoice-lines">
            <thead>
              <tr>
                <th>{t(M.lineDescription, locale)}</th>
                <th className="pemo-inv-num">{t(M.lineQty, locale)}</th>
                <th className="pemo-inv-num">{t(M.lineUnit, locale)}</th>
                <th className="pemo-inv-num">{t(M.lineAmount, locale)}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((l, i) => {
                const kind = chargeTypeLabel(l.chargeType, locale);
                const desc = t(l.description, locale);
                return (
                  <tr key={`${l.chargeType}-${i}`} data-testid="portal-invoice-line">
                    <td>
                      <div className="pemo-inv-strong">{kind ?? desc}</div>
                      {kind && desc && desc !== kind ? <div className="pemo-meta">{desc}</div> : null}
                    </td>
                    <td className="pemo-inv-num">{l.quantity}</td>
                    <td className="pemo-inv-num">{hkd(l.unitAmountHkd)}</td>
                    <td className="pemo-inv-num">{hkd(l.amountHkd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="portal-invoice-payments-heading">
        <h2 id="portal-invoice-payments-heading" className="pemo-panel__title">{t(M.paymentsHeading, locale)}</h2>
        {invoice.paymentsApplied.length === 0 ? (
          <p className="pemo-note" data-testid="portal-invoice-payments-none">{t(M.paymentsNone, locale)}</p>
        ) : (
          <div className="pemo-inv-tablewrap">
            <table className="pemo-inv-table" data-testid="portal-invoice-payments">
              <thead>
                <tr>
                  <th>{t(M.paymentDate, locale)}</th>
                  <th>{t(M.paymentMethod, locale)}</th>
                  <th>{t(M.paymentReference, locale)}</th>
                  <th className="pemo-inv-num">{t(M.paymentAmount, locale)}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.paymentsApplied.map((p) => (
                  <tr key={p.paymentId} data-testid="portal-invoice-payment">
                    <td>{dateTimeOrDash(p.paidAt, locale)}</td>
                    <td>{methodLabel(p.method, locale)}</td>
                    <td><span className="pemo-identifier">{p.reference || none}</span></td>
                    <td className="pemo-inv-num">{hkd(p.amountHkd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dl className="pemo-inv-totals" data-testid="portal-invoice-totals">
        <dt>{t(M.totalLabel, locale)}</dt>
        <dd data-testid="portal-invoice-amount">{hkd(invoice.amountHkd)}</dd>
        <dt>{t(M.paidLabel, locale)}</dt>
        <dd>{hkd(invoice.paidHkd)}</dd>
        <dt className="pemo-inv-totals__balance">{t(M.balanceLabel, locale)}</dt>
        <dd className="pemo-inv-totals__balance" data-testid="portal-invoice-balance">{hkd(invoice.balanceHkd)}</dd>
      </dl>

      <div className="pemo-toolbar">
        {invoice.pdfUrl ? (
          <a
            className="pemo-btn pemo-btn--secondary"
            data-testid="portal-invoice-pdf"
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(M.pdfLink, locale)}
          </a>
        ) : null}
        <button type="button" className="pemo-btn pemo-btn--primary" data-testid="portal-invoice-pay" disabled>
          {t(M.payOnline, locale)}
        </button>
      </div>
      <p className="pemo-note">{t(M.payOnlineNote, locale)}</p>
    </div>
  );
}
