/**
 * Management-fee receipts — list → detail, fixture-first.
 *
 * Design nav: CONFIGURE → Payments & refunds → Payments. Receipts allocate to
 * charges. Method values are stubs (FPS / cheque / cash / Octopus). No live PSP.
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateOnly, number } from '../format/datetime.ts';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BackLink, ITDetails, NoMatch, NumCell, StatusTag, TitleStrip, sourceText } from '../components/FinanceBits.tsx';
import { CHARGE_STATUS_TAG, FINANCE_OBJECT_ICON, PAYMENT_METHOD_ICON } from '../finance/finance-ui.ts';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FilterBar } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import { EmailOutbox } from './EmailOutbox.tsx';
import {
  PAYMENT_DETAIL_DEFAULT,
  PAYMENT_METHODS,
  PAYMENT_ROWS,
  findCharge,
  findPayment,
  hkd,
  periodLabel,
  type PaymentMethod,
  type PaymentRow,
} from '../data/finance-fixtures.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

const LIST_DEFERRED = [
  m('Record a payment', '記錄付款', '记录付款'),
  m('Reverse a receipt', '撤銷收據', '撤销收据'),
];

const DETAIL_DEFERRED = [
  m('Reverse this receipt', '撤銷此收據', '撤销此收据'),
  m('Reallocate this receipt', '重分配此收據', '重分配此收据'),
];

export function paymentMethodLabel(method: PaymentMethod, locale: Locale): string {
  return t(MESSAGES.finance.paymentMethod[method], locale);
}

export function PaymentMethodChip({ method, locale }: { method: PaymentMethod; locale: Locale }) {
  return (
    <StatusTag tone="neutral" icon={PAYMENT_METHOD_ICON[method]} testId="payment-method">
      {paymentMethodLabel(method, locale)}
    </StatusTag>
  );
}

type PaymentTab = 'all' | 'fps' | 'cheque' | 'cash' | 'octopus';
/** All, then each method; every tab opens newest first. */
const STATUSES: readonly StatusDef<PaymentRow, PaymentTab>[] = (['all', 'fps', 'cheque', 'cash', 'octopus'] as const).map((id) => ({
  id,
  test: (p: PaymentRow) => id === 'all' || p.method === id,
  sort: { key: 'when', dir: 'desc' } as const,
}));
const SEARCH = copy('Search payer, unit or method', '搜尋付款人、單位或方式', '搜索付款人、单元或方式');

function allocatedText(p: PaymentRow, locale: Locale): string {
  return p.allocations
    .map((a) => {
      const c = findCharge(a.chargeId);
      return c ? periodLabel(c.period, locale) : '—';
    })
    .join(', ');
}

export function PaymentsList({
  locale,
  onOpen,
  focusKey,
  liveRows,
}: {
  locale: Locale;
  onOpen: (paymentId: string) => void;
  focusKey?: NodeKey | null;
  liveRows?: readonly PaymentRow[];
}) {
  const M = MESSAGES.finance;
  const source = liveRows ?? PAYMENT_ROWS;
  const scoped = focusKey
    ? source.filter((p) => scopePathInFocus(p.scope, focusKey))
    : source;
  const spec = useMemo<ViewSpec<PaymentRow>>(() => ({
    searchText: (p) => `${p.payerName} ${t(p.unitSummary, locale)} ${paymentMethodLabel(p.method, locale)}`,
    filters: {},
    sorts: {
      when: (p) => p.paidOn,
      payer: (p) => p.payerName,
      method: (p) => paymentMethodLabel(p.method, locale),
      amount: (p) => p.amountHkd,
      charges: (p) => allocatedText(p, locale),
    },
  }), [locale]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<PaymentTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'fps', label: t(M.countFps, locale), icon: PAYMENT_METHOD_ICON.fps, count: sv.counts.fps },
    { id: 'cheque', label: t(M.countCheque, locale), icon: PAYMENT_METHOD_ICON.cheque, count: sv.counts.cheque },
    { id: 'cash', label: t(M.countCash, locale), icon: PAYMENT_METHOD_ICON.cash, count: sv.counts.cash },
    { id: 'octopus', label: t(M.countOctopus, locale), icon: PAYMENT_METHOD_ICON.octopus, count: sv.counts.octopus },
  ];

  const columns = [
    { key: 'when', label: t(M.colPaidOn, locale), width: '22%', sortable: true },
    { key: 'payer', label: t(M.colPayer, locale), width: '22%', sortable: true },
    { key: 'method', label: t(M.colMethod, locale), width: '17%', hideBelow: 520, sortable: true },
    { key: 'amount', label: t(M.colAmount, locale), width: '19%', sortable: true },
    { key: 'charges', label: t(M.colAllocatedTo, locale), width: '20%', hideBelow: 600, sortable: true },
  ];

  return (
    <>
      <section className="pemo-panel" data-testid="payments-summary">
        <TitleStrip
          icon={FINANCE_OBJECT_ICON.payment}
          title={t(M.paymentsListTitle, locale)}
          info={t(M.paymentsInfo, locale)}
          testId="payments-titlestrip"
        />
        {focusKey ? (
          <p className="pemo-note" data-testid="scope-filter-note" data-screen="payments">
            {t(MESSAGES.shell.filterNote, locale)}
          </p>
        ) : null}
      </section>
      <StatusHead
        tabs={tabs}
        cardIds={['fps', 'cheque', 'cash', 'octopus']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="payment-status"
        ariaLabel={t(M.paymentsListTitle, locale)}
        cardsTestId="payment-stats"
      />
      <section className="pemo-panel">
        <FilterBar
          locale={locale}
          testId="payments-bar"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={[]}
          active={tv.active}
          onClear={tv.clear}
        />
      </section>

      {tv.view.length === 0 ? (
        <NoMatch title={M.filterNoMatchPaymentsTitle} locale={locale} onClear={() => { tv.clear(); sv.choose('all'); }} testId="payments-filter-empty" />
      ) : (
        <section className="pemo-panel">
          <Table caption={t(M.paymentsListTitle, locale)} columns={columns} testId="payments-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((p) => {
              const unit = t(p.unitSummary, locale);
              const amount = hkd(p.amountHkd, locale);
              const when = dateOnly(p.paidOn, locale);
              const allocated = p.allocations
                .map((a) => {
                  const c = findCharge(a.chargeId);
                  return c ? periodLabel(c.period, locale) : '—';
                })
                .join(', ');
              return (
                <tr
                  key={p.paymentId}
                  data-testid="payments-row"
                  data-payment-id={p.paymentId}
                  data-method={p.method}
                  data-household-id={p.householdId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(p.paymentId)}
                >
                  <DenseCell title={when}>
                    <a
                      href={`?screen=paymentsDetail&state=detail&lang=${locale}&payment=${encodeURIComponent(p.paymentId)}`}
                      data-testid="payment-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(p.paymentId);
                      }}
                    >
                      <span className="pemo-nowrap">{when}</span>
                    </a>
                  </DenseCell>
                  <td className="pemo-cell--wrap" data-testid="payment-row-payer">
                    {p.payerName}
                    <div className="pemo-meta">{unit}</div>
                    <div className="pemo-meta" data-alt="charges">{t(M.colAllocatedTo, locale)}: {allocated}</div>
                  </td>
                  <td><PaymentMethodChip method={p.method} locale={locale} /></td>
                  <NumCell value={amount} />
                  <td className="pemo-cell--wrap">{allocated}</td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      {liveRows ? null : <EmailOutbox locale={locale} testId="payments-outbox" />}

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
    </>
  );
}

export function PaymentsDetail({
  paymentId,
  locale,
  onBack,
  onOpenCharge,
  liveRow,
}: {
  paymentId: string;
  locale: Locale;
  onBack: () => void;
  onOpenCharge: (chargeId: string) => void;
  /** Pass a row from the live list. `null` means the list loaded and this id is absent. */
  liveRow?: PaymentRow | null;
}) {
  const M = MESSAGES.finance;
  const row = liveRow !== undefined
    ? (liveRow ?? undefined)
    : (paymentId ? findPayment(paymentId) : PAYMENT_DETAIL_DEFAULT);

  if (!row) {
    return (
      <section className="pemo-state" data-testid="payments-detail-missing" role="status">
        <h2 className="pemo-state__title">{t(M.paymentNotFound, locale)}</h2>
        <BackLink href={`?screen=payments&state=default&lang=${locale}`} label={M.backToPayments} locale={locale} onBack={onBack} testId="payment-back" />
      </section>
    );
  }

  return (
    <>
      <section className="pemo-panel" data-testid="payments-detail" data-payment-id={row.paymentId}>
        <TitleStrip head icon={FINANCE_OBJECT_ICON.payment} title={`${t(M.openPayment, locale)} · ${dateOnly(row.paidOn, locale)}`} info={t(M.paymentsInfo, locale)} testId="payment-titlestrip" />
        <div className="pemo-actions">
          <BackLink href={`?screen=payments&state=default&lang=${locale}`} label={M.backToPayments} locale={locale} onBack={onBack} testId="payment-back" />
          <PaymentMethodChip method={row.method} locale={locale} />
        </div>
        <dl className="pemo-dl" data-testid="payment-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
          <dt>{t(M.colPaidOn, locale)}</dt>
          <dd data-testid="payment-paid-on">{dateOnly(row.paidOn, locale)}</dd>
          <dt>{t(M.colPayer, locale)}</dt>
          <dd>
            {row.payerName}
          </dd>
          <dt>{t(M.colUnit, locale)}</dt>
          <dd>
            {t(row.unitSummary, locale)}
            <ScopePathCell scope={row.scope} locale={locale} />
          </dd>
          <dt>{t(M.colAmount, locale)}</dt>
          <dd className="pemo-num" data-testid="payment-amount">{hkd(row.amountHkd, locale)}</dd>
          <dt>{t(M.fieldNotes, locale)}</dt>
          <dd>{row.staffNotes ? t(row.staffNotes, locale) : t(M.notesNone, locale)}</dd>
        </dl>
        <ITDetails
          locale={locale}
          testId="payment-it-details"
          rows={[
            [M.itPaymentId, row.paymentId],
            [M.itReference, <span data-testid="payment-reference">{t(row.reference, locale)}</span>],
            [M.itHouseholdId, row.householdId],
            [M.itResidentId, row.residentId],
            [M.itChargeLinks, row.allocations.map((a) => a.chargeId).join(', ')],
            [M.itSource, <span data-testid={liveRow !== undefined ? 'payments-live-label' : 'payments-fixture-label'}>{sourceText(liveRow !== undefined, locale)}</span>],
          ]}
        />
      </section>

      <section className="pemo-panel" data-testid="payment-allocations">
        <TitleStrip icon={FINANCE_OBJECT_ICON.charge} title={t(M.allocationsHeading, locale)} />
        <Table
          caption={t(M.allocationsHeading, locale)}
          columns={[
            { key: 'charge', label: t(M.colChargeId, locale), width: '28%' },
            { key: 'period', label: t(M.colPeriod, locale), width: '24%', hideBelow: 560 },
            { key: 'amount', label: t(M.colAllocated, locale), width: '24%' },
            { key: 'status', label: t(M.colStatus, locale), width: '24%' },
          ]}
          testId="payment-allocations-table"
        >
          {row.allocations.map((a) => {
            const charge = findCharge(a.chargeId);
            const period = charge ? periodLabel(charge.period, locale) : '—';
            const status = charge ? t(MESSAGES.finance.chargeStatus[charge.status], locale) : '—';
            const tag = charge ? CHARGE_STATUS_TAG[charge.status] : null;
            return (
              <tr key={a.chargeId} data-testid="payment-allocation-row" data-charge-id={a.chargeId}>
                <DenseCell title={charge ? t(charge.kind, locale) : t(M.openInvoice, locale)}>
                  <a
                    href={`?screen=chargesDetail&state=detail&lang=${locale}&charge=${encodeURIComponent(a.chargeId)}`}
                    data-testid="payment-charge-open"
                    data-read-affordance="navigate"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenCharge(a.chargeId);
                    }}
                  >
                    <Icon name="Receipt" size={ICON_SIZE.control} />{' '}
                    <span>{charge ? t(charge.kind, locale) : t(M.openInvoice, locale)}</span>
                  </a>
                </DenseCell>
                <DenseCell title={period}>{period}</DenseCell>
                <NumCell value={hkd(a.amountHkd, locale)} />
                <DenseCell title={status}>
                  {tag ? <StatusTag tone={tag.tone} icon={tag.icon} testId="payment-allocation-status">{status}</StatusTag> : status}
                </DenseCell>
              </tr>
            );
          })}
        </Table>
      </section>

      <DeferredActions locale={locale} actions={DETAIL_DEFERRED} />
    </>
  );
}
