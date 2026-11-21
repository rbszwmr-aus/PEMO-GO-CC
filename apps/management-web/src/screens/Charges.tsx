/**
 * Strata / management-fee charges — list → detail, fixture-first.
 *
 * Design nav: CONFIGURE → Payments & refunds → Charges. Page fixtures only;
 * no list/write operation in the management contract under v0 freeze. SCOPE
 * rail filters rows that already carry a unit path. Writes stay named under
 * DeferredActions (remind / adjust / record payment).
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { DetailPanes } from '../components/DetailPanes.tsx';
import { useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateOnly, dateTime, number } from '../format/datetime.ts';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BackLink, ITDetails, InfoTip, NoMatch, NumCell, ObjectLink, StatusTag, TitleStrip, sourceText } from '../components/FinanceBits.tsx';
import { CHARGE_STATUS_TAG, INVOICE_SEND_TONE, FINANCE_OBJECT_ICON, PAYMENT_METHOD_ICON, nextSendStep, type SendStep } from '../finance/finance-ui.ts';
import { ScopePathCell, scopePathText } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FilterBar, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  CHARGE_DETAIL_DEFAULT,
  CHARGE_ROWS,
  CHARGE_STATUSES,
  chargePeriods,
  findCharge,
  hkd,
  invoiceSendBadge,
  outstandingHkd,
  paymentsForCharge,
  periodLabel,
  type ChargeRow,
  type ChargeStatus,
  type InvoiceSendBadge,
} from '../data/finance-fixtures.ts';
import {
  invoiceSentAtOf,
  processDueInvoiceSends,
  sendInvoiceNow,
} from '../finance/invoice-sends.ts';
import type { ChargeReceipt, LiveChargeRow } from '../data/strata-live.ts';
import { chargeToInvoice, invoicePdfDataUrl, invoicePdfFileName } from '../finance/invoice-template.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';
import { EmailOutbox, useInvoiceSendStore } from './EmailOutbox.tsx';

const m = copy;

const LIST_DEFERRED = [
  m('Send a reminder', '發送催繳', '发送催缴'),
  m('Adjust a charge', '調整帳單', '调整账单'),
  m('Record a payment', '記錄付款', '记录付款'),
];

const PANE_DETAILS = copy('Details', '詳情', '详情');
const PANE_EMAILS = copy('Emails', '電郵', '电邮');

const DETAIL_DEFERRED = [
  m('Send a reminder', '發送催繳', '发送催缴'),
  m('Adjust this charge', '調整此帳單', '调整此账单'),
  m('Record a payment', '記錄付款', '记录付款'),
];

export function chargeStatusLabel(status: ChargeStatus, locale: Locale): string {
  return t(MESSAGES.finance.chargeStatus[status], locale);
}

export function ChargeStatusChip({ status, locale }: { status: ChargeStatus; locale: Locale }) {
  const tag = CHARGE_STATUS_TAG[status];
  return (
    <StatusTag tone={tag.tone} icon={tag.icon} testId="charge-status">
      {chargeStatusLabel(status, locale)}
    </StatusTag>
  );
}

export function InvoiceSendChip({ badge, locale }: { badge: InvoiceSendBadge; locale: Locale }) {
  return (
    <StatusTag tone={INVOICE_SEND_TONE[badge]} icon={badge === 'sent' ? 'Send' : 'Clock'} testId="invoice-send-badge">
      {t(MESSAGES.finance.invoiceSendBadge[badge], locale)}
    </StatusTag>
  );
}

type ChargeTab = 'all' | 'due' | 'overdue' | 'partial' | 'paid';
/** All, then each status; each tab opens on its own sort. */
const STATUSES: readonly StatusDef<ChargeRow, ChargeTab>[] = [
  { id: 'all', test: () => true, sort: { key: 'period', dir: 'desc' } },
  { id: 'due', test: (c) => c.status === 'due', sort: { key: 'outstanding', dir: 'desc' } },
  { id: 'overdue', test: (c) => c.status === 'overdue', sort: { key: 'outstanding', dir: 'desc' } },
  { id: 'partial', test: (c) => c.status === 'partial', sort: { key: 'outstanding', dir: 'desc' } },
  { id: 'paid', test: (c) => c.status === 'paid', sort: { key: 'period', dir: 'desc' } },
];
const SEARCH = copy('Search payer, unit or invoice', '搜尋付款人、單位或發票', '搜索付款人、单元或发票');

export function ChargesList({
  locale,
  onOpen,
  onOpenHousehold,
  focusKey,
  liveRows,
}: {
  locale: Locale;
  onOpen: (chargeId: string) => void;
  onOpenHousehold: (householdId: string) => void;
  focusKey?: NodeKey | null;
  /** When set, the list is the API. Omit for the fixture corpus. */
  liveRows?: readonly LiveChargeRow[];
}) {
  const M = MESSAGES.finance;
  useInvoiceSendStore();
  const source = liveRows ?? CHARGE_ROWS;
  const scoped = focusKey
    ? source.filter((c) => scopePathInFocus(c.scope, focusKey))
    : source;
  const spec = useMemo<ViewSpec<ChargeRow>>(() => ({
    searchText: (c) => `${c.payerName} ${t(c.unitSummary, locale)} ${t(c.kind, locale)} ${c.invoiceNumber}`,
    filters: { period: (c) => c.period },
    sorts: {
      period: (c) => c.period,
      household: (c) => c.payerName,
      unit: (c) => t(c.unitSummary, locale),
      amount: (c) => c.amountHkd,
      outstanding: (c) => outstandingHkd(c),
      status: (c) => chargeStatusLabel(c.status, locale),
      email: (c) => invoiceSendBadge(c.scheduledSendAt, liveRows ? c.invoiceSentAt : invoiceSentAtOf(c.chargeId)),
    },
  }), [locale, liveRows]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<ChargeTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'due', label: t(M.countDue, locale), icon: 'Clock', count: sv.counts.due },
    { id: 'overdue', label: t(M.countOverdue, locale), icon: 'CircleAlert', count: sv.counts.overdue, alert: true },
    { id: 'partial', label: t(M.countPartial, locale), icon: 'Coins', count: sv.counts.partial },
    { id: 'paid', label: t(M.countPaid, locale), icon: 'CircleCheck', count: sv.counts.paid },
  ];
  const filters: FilterDef[] = [
    {
      key: 'period', label: t(M.filterPeriod, locale), allLabel: t(M.filterAll, locale),
      options: chargePeriods().map((p) => ({ value: p, label: periodLabel(p, locale) })),
      value: tv.state.filters['period'] ?? '', onChange: (v) => tv.setFilter('period', v),
    },
  ];

  const columns = [
    { key: 'period', label: t(M.colPeriod, locale), width: '12%', hideBelow: 600, sortable: true },
    { key: 'household', label: t(M.colHousehold, locale), width: '12%', sortable: true },
    { key: 'unit', label: t(M.colUnit, locale), width: '13%', hideBelow: 800, sortable: true },
    { key: 'amount', label: t(M.colAmount, locale), width: '11%', hideBelow: 600, sortable: true },
    { key: 'outstanding', label: t(M.colOutstanding, locale), width: '13%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '11%', sortable: true },
    { key: 'email', label: t(M.colInvoiceEmail, locale), width: '14%', hideBelow: 800, sortable: true },
    { key: 'invoice', label: t(M.colInvoice, locale), width: '14%', hideBelow: 520 },
  ];
  const clearFilters = () => { tv.clear(); sv.choose('all'); };

  return (
    <>
      <section className="pemo-panel" data-testid="charges-summary">
        <TitleStrip
          icon={FINANCE_OBJECT_ICON.charge}
          title={t(M.chargesListTitle, locale)}
          info={t(M.chargesInfo, locale)}
          testId="charges-titlestrip"
        />
        {focusKey ? (
          <p className="pemo-note" data-testid="scope-filter-note" data-screen="charges">
            {t(MESSAGES.shell.filterNote, locale)}
          </p>
        ) : null}
        <div className="pemo-toolbar pemo-toolbar--finance" data-testid="charges-filters">
          {liveRows ? null : (
            <span className="pemo-actions" data-testid="invoice-send-actions" style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className="pemo-button"
                data-testid="process-due-invoice-sends"
                data-read-affordance="fixture"
                onClick={() => { void processDueInvoiceSends(); }}
              >
                <Icon name="Send" size={ICON_SIZE.control} />
                <span>{t(M.runDueInvoiceSends, locale)}</span>
              </button>
              <InfoTip text={t(M.sendInfo, locale)} testId="invoice-send-info" />
            </span>
          )}
        </div>
      </section>
      <StatusHead
        tabs={tabs}
        cardIds={['due', 'overdue', 'partial', 'paid']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="charge-status"
        ariaLabel={t(M.chargesListTitle, locale)}
        cardsTestId="charge-stats"
      />
      <section className="pemo-panel">
        <FilterBar
          locale={locale}
          testId="charges-bar"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={filters}
          active={tv.active}
          onClear={tv.clear}
        />
      </section>

      {tv.view.length === 0 ? (
        <NoMatch title={M.filterNoMatchChargesTitle} locale={locale} onClear={clearFilters} testId="charges-filter-empty" />
      ) : (
        <section className="pemo-panel">
          <Table caption={t(M.chargesListTitle, locale)} columns={columns} testId="charges-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((c) => {
              const unit = t(c.unitSummary, locale);
              const amount = hkd(c.amountHkd, locale);
              const outstanding = hkd(outstandingHkd(c), locale);
              const period = periodLabel(c.period, locale);
              const detailHref = `?screen=chargesDetail&state=detail&lang=${locale}&charge=${encodeURIComponent(c.chargeId)}`;
              return (
                <tr
                  key={c.chargeId}
                  data-testid="charges-row"
                  data-charge-id={c.chargeId}
                  data-status={c.status}
                  data-period={c.period}
                  data-household-id={c.householdId}
                  data-invoice-send={invoiceSendBadge(c.scheduledSendAt, liveRows ? c.invoiceSentAt : invoiceSentAtOf(c.chargeId))}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(c.chargeId)}
                >
                  <td className="pemo-nowrap" data-testid="charge-row-period">{period}</td>
                  <WrapCell title={c.payerName}>
                    <a
                      href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(c.householdId)}`}
                      data-testid="charge-household-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenHousehold(c.householdId);
                      }}
                    >
                      {c.payerName}
                    </a>
                    <div className="pemo-meta" data-alt="period">{period}</div>
                    <div className="pemo-meta" data-alt="unit">{unit}</div>
                  </WrapCell>
                  <td className="pemo-cell--unit" title={`${unit} · ${scopePathText(c.scope, locale)}`} data-testid="charge-row-unit">
                    <span className="pemo-cell--wrap">{unit}</span>
                  </td>
                  <NumCell value={amount} />
                  <NumCell value={outstanding} testId="charge-row-outstanding" />
                  <td data-testid="charge-row-tags">
                    <ChargeStatusChip status={c.status} locale={locale} />
                  </td>
                  <td data-testid="charge-row-email">
                    <InvoiceSendChip
                      badge={invoiceSendBadge(c.scheduledSendAt, liveRows ? c.invoiceSentAt : invoiceSentAtOf(c.chargeId))}
                      locale={locale}
                    />
                  </td>
                  <td className="pemo-cell--action">
                    <ObjectLink
                      href={detailHref}
                      icon={FINANCE_OBJECT_ICON.charge}
                      label={t(M.openInvoice, locale)}
                      onOpen={() => onOpen(c.chargeId)}
                      testId="charge-open"
                      stopRow
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      {liveRows ? null : <EmailOutbox locale={locale} testId="charges-outbox" />}

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
    </>
  );
}


export function ChargesDetail({
  chargeId,
  locale,
  onBack,
  onOpenHousehold,
  onOpenPayment,
  liveCharge,
  liveReceipts,
  onSendInvoice,
  sendNote,
}: {
  chargeId: string;
  locale: Locale;
  onBack: () => void;
  onOpenHousehold: (householdId: string) => void;
  onOpenPayment: (paymentId: string) => void;
  liveCharge?: LiveChargeRow;
  liveReceipts?: readonly ChargeReceipt[];
  onSendInvoice?: () => void;
  sendNote?: string | null;
}) {
  const M = MESSAGES.finance;
  useInvoiceSendStore();
  const row = liveCharge ?? (chargeId ? findCharge(chargeId) : CHARGE_DETAIL_DEFAULT);

  if (!row) {
    return (
      <section className="pemo-state" data-testid="charges-detail-missing" role="status">
        <h2 className="pemo-state__title">{t(M.chargeNotFound, locale)}</h2>
        <BackLink href={`?screen=charges&state=default&lang=${locale}`} label={M.backToCharges} locale={locale} onBack={onBack} testId="charge-back" />
      </section>
    );
  }

  const fixtureReceipts = liveCharge ? [] : paymentsForCharge(row.chargeId);
  const receiptLines = liveCharge
    ? (liveReceipts ?? []).map((r) => ({
        paymentId: r.paymentId,
        method: r.method,
        amountHkd: r.amountHkd,
        paidOn: r.paidOn,
      }))
    : fixtureReceipts.map((p) => ({
        paymentId: p.paymentId,
        method: p.method,
        amountHkd: p.allocations.find((a) => a.chargeId === row.chargeId)?.amountHkd ?? 0,
        paidOn: p.paidOn,
      }));
  const sentAt = liveCharge ? row.invoiceSentAt : invoiceSentAtOf(row.chargeId);
  const sendBadge = invoiceSendBadge(row.scheduledSendAt, sentAt);
  const invoice = chargeToInvoice(row);

  return (
    <>
      <section className="pemo-panel" data-testid="charges-detail" data-charge-id={row.chargeId}>
        <TitleStrip head icon={FINANCE_OBJECT_ICON.charge} title={t(row.kind, locale)} info={t(M.chargesInfo, locale)} testId="charge-titlestrip" />
        <div className="pemo-actions">
          <BackLink href={`?screen=charges&state=default&lang=${locale}`} label={M.backToCharges} locale={locale} onBack={onBack} testId="charge-back" />
          <ChargeStatusChip status={row.status} locale={locale} />
          <InvoiceSendChip badge={sendBadge} locale={locale} />
        </div>
        <DetailPanes
          key={row.chargeId}
          locale={locale}
          root="charge-pane"
          ariaLabel={t(M.chargeDetailTitle, locale)}
          panes={[
            { id: 'details', label: t(PANE_DETAILS, locale), icon: 'Info', node: (
              <>
        <dl className="pemo-dl" data-testid="charge-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
              <dt>{t(M.colPeriod, locale)}</dt>
              <dd data-testid="charge-period">{periodLabel(row.period, locale)}</dd>
              <dt>{t(M.colHousehold, locale)}</dt>
              <dd>
                <a
                  href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(row.householdId)}`}
                  data-testid="charge-household-open"
                  data-read-affordance="navigate"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenHousehold(row.householdId);
                  }}
                >
                  {row.payerName}
                </a>
                <div className="pemo-meta">
                  <span data-testid="charge-contact-email">{row.contactEmail}</span>
                </div>
              </dd>
              <dt>{t(M.colUnit, locale)}</dt>
              <dd>
                {t(row.unitSummary, locale)}
                <ScopePathCell scope={row.scope} locale={locale} />
              </dd>
              <dt>{t(M.colIssued, locale)}</dt>
              <dd>{dateOnly(row.issuedOn, locale)}</dd>
              <dt>{t(M.colDue, locale)}</dt>
              <dd>{dateOnly(row.dueOn, locale)}</dd>
              <dt>{t(M.colScheduledSend, locale)}</dt>
              <dd data-testid="charge-scheduled-send">{dateTime(row.scheduledSendAt, locale)}</dd>
              <dt>{t(M.colInvoiceSent, locale)}</dt>
              <dd data-testid="charge-invoice-sent">
                {sentAt ? dateTime(sentAt, locale) : t(M.invoiceNotSent, locale)}
              </dd>
              <dt>{t(M.colAmount, locale)}</dt>
              <dd className="pemo-num" data-testid="charge-amount">{hkd(row.amountHkd, locale)}</dd>
              <dt>{t(M.colPaid, locale)}</dt>
              <dd className="pemo-num">{hkd(row.paidHkd, locale)}</dd>
              <dt>{t(M.colOutstanding, locale)}</dt>
              <dd className="pemo-num" data-testid="charge-outstanding">{hkd(outstandingHkd(row), locale)}</dd>
              <dt>{t(M.fieldNotes, locale)}</dt>
              <dd>{row.staffNotes ? t(row.staffNotes, locale) : t(M.notesNone, locale)}</dd>
            </dl>
            {liveCharge && (liveCharge.invoiceEmail.status === 'log-only' || liveCharge.invoiceEmail.status === 'failed' || liveCharge.invoiceEmail.status === 'unknown') ? (
              <p className="pemo-note" data-testid="invoice-transport-detail">{liveCharge.invoiceEmail.detail}</p>
            ) : null}
            <InvoiceSendControls
              locale={locale}
              to={row.contactEmail}
              invoiceNumber={row.invoiceNumber}
              amount={hkd(row.amountHkd, locale)}
              sent={Boolean(sentAt)}
              live={Boolean(liveCharge)}
              liveNote={sendNote ?? null}
              pdfHref={invoicePdfDataUrl(invoice, locale)}
              pdfName={invoicePdfFileName(invoice)}
              onSend={async () => {
                if (onSendInvoice) {
                  onSendInvoice();
                  return 'pending';
                }
                const result = await sendInvoiceNow(row.chargeId);
                return result.entry ? 'sent' : 'failed';
              }}
            />
            <ITDetails
              locale={locale}
              testId="charge-it-details"
              rows={[
                [M.itChargeId, row.chargeId],
                [M.itInvoiceNumber, <span data-testid="charge-invoice-number">{row.invoiceNumber}</span>],
                [M.itHouseholdId, row.householdId],
                [M.itResidentId, row.residentId],
                [M.itSource, <span data-testid={liveCharge ? 'charges-live-label' : 'charges-fixture-label'}>{sourceText(Boolean(liveCharge), locale)}</span>],
              ]}
            />
              </>
            ) },
            { id: 'receipts', label: t(M.receiptsHeading, locale), icon: 'Receipt', count: receiptLines.length, node: (
      <div data-testid="charge-receipts">
        {receiptLines.length === 0 ? (
          <p className="pemo-note" data-testid="charge-receipts-none">{t(M.receiptsNone, locale)}</p>
        ) : (
          <Table
            caption={t(M.receiptsHeading, locale)}
            columns={[
              { key: 'id', label: t(M.colPaymentId, locale), width: '28%' },
              { key: 'method', label: t(M.colMethod, locale), width: '24%' },
              { key: 'amount', label: t(M.colAllocated, locale), width: '24%' },
              { key: 'when', label: t(M.colPaidOn, locale), width: '24%' },
            ]}
            testId="charge-receipts-table"
          >
            {receiptLines.map((p) => {
              const allocated = p.amountHkd;
              const method = t(MESSAGES.finance.paymentMethod[p.method], locale);
              return (
                <tr key={p.paymentId} data-testid="charge-receipt-row" data-payment-id={p.paymentId}>
                  <DenseCell title={t(M.openPayment, locale)}>
                    <a
                      href={`?screen=paymentsDetail&state=detail&lang=${locale}&payment=${encodeURIComponent(p.paymentId)}`}
                      data-testid="charge-payment-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenPayment(p.paymentId);
                      }}
                    >
                      <Icon name="CreditCard" size={ICON_SIZE.control} />{' '}
                      <span>{t(M.openPayment, locale)}</span>
                    </a>
                  </DenseCell>
                  <DenseCell title={method}>
                    <Icon name={PAYMENT_METHOD_ICON[p.method]} size={ICON_SIZE.control} />{' '}{method}
                  </DenseCell>
                  <NumCell value={hkd(allocated, locale)} />
                  <DenseCell title={dateOnly(p.paidOn, locale)}>{dateOnly(p.paidOn, locale)}</DenseCell>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
            ) },
            ...(liveCharge ? [] : [{ id: 'emails' as const, label: t(PANE_EMAILS, locale), icon: 'Mail' as const, node: <EmailOutbox locale={locale} chargeId={row.chargeId} testId="charge-outbox" /> }]),
          ]}
        />
      </section>

      <DeferredActions locale={locale} actions={DETAIL_DEFERRED} />
    </>
  );
}

/**
 * PDF + Send for one invoice. Send is consequential: details → review →
 * confirm, and the success line appears only after the send reports back.
 * In live mode the parent owns the request and reports through `liveNote`.
 */
function InvoiceSendControls({
  locale,
  to,
  invoiceNumber,
  amount,
  sent,
  live,
  liveNote,
  pdfHref,
  pdfName,
  onSend,
}: {
  locale: Locale;
  to: string;
  invoiceNumber: string;
  amount: string;
  sent: boolean;
  live: boolean;
  liveNote: string | null;
  pdfHref: string;
  pdfName: string;
  onSend: () => Promise<'sent' | 'failed' | 'pending'>;
}) {
  const M = MESSAGES.finance;
  const [step, setStep] = useState<SendStep>('idle');
  const go = (e: Parameters<typeof nextSendStep>[1]) => setStep((s) => nextSendStep(s, e));
  return (
    <>
      <div className="pemo-actions" data-testid="invoice-send-actions" style={{ marginTop: 'var(--pemo-space-3)' }}>
        <a
          className="pemo-button"
          href={pdfHref}
          download={pdfName}
          data-testid="invoice-pdf-download"
          data-read-affordance="download"
        >
          <Icon name="Download" size={ICON_SIZE.control} />
          <span>{t(M.downloadInvoicePdf, locale)}</span>
        </a>
        {live ? null : (
          <button
            type="button"
            className="pemo-button"
            data-testid="process-due-invoice-sends"
            data-read-affordance="fixture"
            onClick={() => { void processDueInvoiceSends(); }}
          >
            <Icon name="Send" size={ICON_SIZE.control} />
            <span>{t(M.runDueInvoiceSends, locale)}</span>
          </button>
        )}
        <button
          type="button"
          className="pemo-button"
          data-testid="send-invoice-now"
          data-read-affordance={live ? 'live' : 'fixture'}
          data-send-step={step}
          disabled={sent || step === 'review' || step === 'sending'}
          onClick={() => go('send')}
        >
          <Icon name="Send" size={ICON_SIZE.control} />
          <span>{t(M.sendInvoiceNow, locale)}</span>
        </button>
        <InfoTip text={t(M.sendInfo, locale)} testId="invoice-send-info" />
      </div>
      {step === 'review' || step === 'sending' ? (
        <div className="pemo-review" data-testid="invoice-send-review" role="group" aria-label={t(M.sendReviewTitle, locale)}>
          <h3 className="pemo-review__title">{t(M.sendReviewTitle, locale)}</h3>
          <dl className="pemo-dl">
            <dt>{t(M.sendReviewTo, locale)}</dt>
            <dd><span data-testid="invoice-send-review-to">{to}</span></dd>
            <dt>{t(M.colInvoice, locale)}</dt>
            <dd>{invoiceNumber}</dd>
            <dt>{t(M.colAmount, locale)}</dt>
            <dd className="pemo-num">{amount}</dd>
          </dl>
          <div className="pemo-actions" style={{ marginTop: 'var(--pemo-space-3)' }}>
            <button
              type="button"
              className="pemo-button pemo-button--primary"
              data-testid="invoice-send-confirm"
              data-read-affordance={live ? 'live' : 'fixture'}
              disabled={step === 'sending'}
              onClick={() => {
                go('confirm');
                void onSend().then((r) => {
                  if (r === 'sent') go('succeeded');
                  else if (r === 'failed') go('failed');
                  else setStep('idle');
                }, () => go('failed'));
              }}
            >
              <Icon name="Send" size={ICON_SIZE.control} />
              <span>{step === 'sending' ? t(M.sendSending, locale) : t(M.sendConfirm, locale)}</span>
            </button>
            <button
              type="button"
              className="pemo-button pemo-button--quiet"
              data-testid="invoice-send-cancel"
              data-read-affordance={live ? 'live' : 'fixture'}
              disabled={step === 'sending'}
              onClick={() => go('cancel')}
            >
              {t(M.sendCancel, locale)}
            </button>
          </div>
        </div>
      ) : null}
      {step === 'sent' ? (
        <p className="pemo-note" data-testid="invoice-send-result" role="status">{t(M.sendDone, locale)}</p>
      ) : null}
      {step === 'failed' ? (
        <p className="pemo-note" data-testid="invoice-send-result" role="status">{t(M.sendFailed, locale)}</p>
      ) : null}
      {live && liveNote ? (
        <p className="pemo-note" data-testid="invoice-send-result" role="status">{liveNote}</p>
      ) : null}
    </>
  );
}
