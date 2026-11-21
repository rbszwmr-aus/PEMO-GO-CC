/**
 * Management-fee credits / refunds — list → detail, fixture-first.
 *
 * Design nav: CONFIGURE → Payments & refunds → Refunds. Execute stays deferred.
 * No live refund rail and no ParkCore parking fees.
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
import { FINANCE_OBJECT_ICON, REFUND_STATUS_TAG } from '../finance/finance-ui.ts';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FilterBar } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  REFUND_DETAIL_DEFAULT,
  REFUND_ROWS,
  REFUND_STATUSES,
  findCharge,
  findRefund,
  hkd,
  periodLabel,
  type RefundRow,
  type RefundStatus,
} from '../data/finance-fixtures.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

const LIST_DEFERRED = [
  m('Execute a refund', '執行退款', '执行退款'),
  m('Issue a credit note', '發出貸記單', '发出贷记单'),
];

const DETAIL_DEFERRED = [
  m('Execute this refund', '執行此退款', '执行此退款'),
];

export function refundStatusLabel(status: RefundStatus, locale: Locale): string {
  return t(MESSAGES.finance.refundStatus[status], locale);
}

export function RefundStatusChip({ status, locale }: { status: RefundStatus; locale: Locale }) {
  const tag = REFUND_STATUS_TAG[status];
  return (
    <StatusTag tone={tag.tone} icon={tag.icon} testId="refund-status">
      {refundStatusLabel(status, locale)}
    </StatusTag>
  );
}

type RefundTab = 'all' | 'pending' | 'issued' | 'executed';
/** All, then each status; every tab opens newest first. */
const STATUSES: readonly StatusDef<RefundRow, RefundTab>[] = (['all', 'pending', 'issued', 'executed'] as const).map((id) => ({
  id,
  test: (r: RefundRow) => id === 'all' || r.status === id,
  sort: { key: 'when', dir: 'desc' } as const,
}));
const SEARCH = copy('Search household, unit or reason', '搜尋住戶、單位或原因', '搜索住户、单元或原因');

export function RefundsList({
  locale,
  onOpen,
  focusKey,
}: {
  locale: Locale;
  onOpen: (refundId: string) => void;
  focusKey?: NodeKey | null;
}) {
  const M = MESSAGES.finance;
  const scoped = focusKey
    ? REFUND_ROWS.filter((r) => scopePathInFocus(r.scope, focusKey))
    : REFUND_ROWS;
  const spec = useMemo<ViewSpec<RefundRow>>(() => ({
    searchText: (r) => `${r.payerName} ${t(r.unitSummary, locale)} ${t(r.reason, locale)}`,
    filters: {},
    sorts: {
      when: (r) => r.requestedOn,
      household: (r) => r.payerName,
      unit: (r) => t(r.unitSummary, locale),
      amount: (r) => r.amountHkd,
      status: (r) => refundStatusLabel(r.status, locale),
      charge: (r) => (r.chargeId ? relatedLabel(r.chargeId, locale) : null),
    },
  }), [locale]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<RefundTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'pending', label: t(M.countPendingRefund, locale), icon: 'Hourglass', count: sv.counts.pending, alert: true },
    { id: 'issued', label: t(M.countIssued, locale), icon: 'Send', count: sv.counts.issued },
    { id: 'executed', label: t(M.countExecuted, locale), icon: 'CircleCheck', count: sv.counts.executed },
  ];

  const columns = [
    { key: 'when', label: t(M.colRequestedOn, locale), width: '15%', sortable: true },
    { key: 'household', label: t(M.colHousehold, locale), width: '19%', sortable: true },
    { key: 'unit', label: t(M.colUnit, locale), width: '18%', hideBelow: 600, sortable: true },
    { key: 'amount', label: t(M.colAmount, locale), width: '13%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '17%', sortable: true },
    { key: 'charge', label: t(M.colRelatedCharge, locale), width: '18%', hideBelow: 600, sortable: true },
  ];

  return (
    <>
      <section className="pemo-panel" data-testid="refunds-summary">
        <TitleStrip
          icon={FINANCE_OBJECT_ICON.refund}
          title={t(M.refundsListTitle, locale)}
          info={t(M.refundsInfo, locale)}
          testId="refunds-titlestrip"
        />
        {focusKey ? (
          <p className="pemo-note" data-testid="scope-filter-note" data-screen="refunds">
            {t(MESSAGES.shell.filterNote, locale)}
          </p>
        ) : null}
      </section>
      <StatusHead
        tabs={tabs}
        cardIds={['pending', 'issued', 'executed']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="refund-status"
        ariaLabel={t(M.refundsListTitle, locale)}
        cardsTestId="refund-stats"
      />
      <section className="pemo-panel">
        <FilterBar
          locale={locale}
          testId="refunds-bar"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={[]}
          active={tv.active}
          onClear={tv.clear}
        />
      </section>

      {tv.view.length === 0 ? (
        <NoMatch title={M.filterNoMatchRefundsTitle} locale={locale} onClear={() => { tv.clear(); sv.choose('all'); }} testId="refunds-filter-empty" />
      ) : (
        <section className="pemo-panel">
          <Table caption={t(M.refundsListTitle, locale)} columns={columns} testId="refunds-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((r) => {
              const unit = t(r.unitSummary, locale);
              const amount = hkd(r.amountHkd, locale);
              const when = dateOnly(r.requestedOn, locale);
              return (
                <tr
                  key={r.refundId}
                  data-testid="refunds-row"
                  data-refund-id={r.refundId}
                  data-status={r.status}
                  data-household-id={r.householdId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(r.refundId)}
                >
                  <DenseCell title={when}>
                    <a
                      href={`?screen=refundsDetail&state=detail&lang=${locale}&refund=${encodeURIComponent(r.refundId)}`}
                      data-testid="refund-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(r.refundId);
                      }}
                    >
                      {when}
                    </a>
                  </DenseCell>
                  <WrapCell title={r.payerName}>
                    {r.payerName}
                    <div className="pemo-meta" data-alt="unit">{unit}</div>
                    {r.chargeId ? (
                      <div className="pemo-meta" data-alt="charge">
                        <Icon name="Receipt" size={ICON_SIZE.control} />{' '}{relatedLabel(r.chargeId, locale)}
                      </div>
                    ) : null}
                  </WrapCell>
                  <td>
                    <span className="pemo-cell--wrap">{unit}</span>
                  </td>
                  <NumCell value={amount} />
                  <td><RefundStatusChip status={r.status} locale={locale} /></td>
                  <DenseCell title={relatedLabel(r.chargeId, locale)}>
                    {r.chargeId ? (
                      <>
                        <Icon name="Receipt" size={ICON_SIZE.control} />{' '}
                        <span>{relatedLabel(r.chargeId, locale)}</span>
                      </>
                    ) : t(M.notesNone, locale)}
                  </DenseCell>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
    </>
  );
}

export function RefundsDetail({
  refundId,
  locale,
  onBack,
  onOpenHousehold,
  onOpenCharge,
}: {
  refundId: string;
  locale: Locale;
  onBack: () => void;
  onOpenHousehold: (householdId: string) => void;
  onOpenCharge: (chargeId: string) => void;
}) {
  const M = MESSAGES.finance;
  const row = refundId ? findRefund(refundId) : REFUND_DETAIL_DEFAULT;

  if (!row) {
    return (
      <section className="pemo-state" data-testid="refunds-detail-missing" role="status">
        <h2 className="pemo-state__title">{t(M.refundNotFound, locale)}</h2>
        <BackLink href={`?screen=refunds&state=default&lang=${locale}`} label={M.backToRefunds} locale={locale} onBack={onBack} testId="refund-back" />
      </section>
    );
  }

  const charge = row.chargeId ? findCharge(row.chargeId) : undefined;

  return (
    <>
      <section className="pemo-panel" data-testid="refunds-detail" data-refund-id={row.refundId}>
        <TitleStrip head icon={FINANCE_OBJECT_ICON.refund} title={t(row.reason, locale)} info={t(M.refundsInfo, locale)} testId="refund-titlestrip" />
        <div className="pemo-actions">
          <BackLink href={`?screen=refunds&state=default&lang=${locale}`} label={M.backToRefunds} locale={locale} onBack={onBack} testId="refund-back" />
          <RefundStatusChip status={row.status} locale={locale} />
        </div>
        <dl className="pemo-dl" data-testid="refund-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
          <dt>{t(M.colRequestedOn, locale)}</dt>
          <dd>{dateOnly(row.requestedOn, locale)}</dd>
          <dt>{t(M.colHousehold, locale)}</dt>
          <dd>
            <a
              href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(row.householdId)}`}
              data-testid="refund-household-open"
              data-read-affordance="navigate"
              onClick={(e) => {
                e.preventDefault();
                onOpenHousehold(row.householdId);
              }}
            >
              {row.payerName}
            </a>
          </dd>
          <dt>{t(M.colUnit, locale)}</dt>
          <dd>
            {t(row.unitSummary, locale)}
            <ScopePathCell scope={row.scope} locale={locale} />
          </dd>
          <dt>{t(M.colAmount, locale)}</dt>
          <dd className="pemo-num" data-testid="refund-amount">{hkd(row.amountHkd, locale)}</dd>
          <dt>{t(M.colRelatedCharge, locale)}</dt>
          <dd data-testid="refund-charge">
            {row.chargeId && charge ? (
              <>
                <a
                  href={`?screen=chargesDetail&state=detail&lang=${locale}&charge=${encodeURIComponent(row.chargeId)}`}
                  data-testid="refund-charge-open"
                  data-read-affordance="navigate"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenCharge(row.chargeId!);
                  }}
                >
                  <Icon name="Receipt" size={ICON_SIZE.control} />{' '}
                  <span>{relatedLabel(row.chargeId, locale)}</span>
                </a>
              </>
            ) : t(M.notesNone, locale)}
          </dd>
          <dt>{t(M.colReason, locale)}</dt>
          <dd data-testid="refund-reason">{t(row.reason, locale)}</dd>
          <dt>{t(M.fieldNotes, locale)}</dt>
          <dd>{row.staffNotes ? t(row.staffNotes, locale) : t(M.notesNone, locale)}</dd>
        </dl>
        <ITDetails
          locale={locale}
          testId="refund-it-details"
          rows={[
            [M.itRefundId, row.refundId],
            [M.itHouseholdId, row.householdId],
            [M.itResidentId, row.residentId],
            [M.itChargeId, row.chargeId ?? '—'],
            [M.itSource, <span data-testid="refunds-fixture-label">{sourceText(false, locale)}</span>],
          ]}
        />
      </section>
      <DeferredActions locale={locale} actions={DETAIL_DEFERRED} />
    </>
  );
}

/** A related charge in staff words: its kind and period, never its id. */
function relatedLabel(chargeId: string | null | undefined, locale: Locale): string {
  const c = chargeId ? findCharge(chargeId) : undefined;
  return c ? `${t(c.kind, locale)} · ${periodLabel(c.period, locale)}` : '—';
}
