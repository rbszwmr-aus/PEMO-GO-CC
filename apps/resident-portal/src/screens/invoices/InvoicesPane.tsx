import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/locale.ts';
import { t } from '../../i18n/locale.ts';
import { MESSAGES } from '../../i18n/messages.ts';
import { getMyInvoice, listMyInvoices, summarise } from '../../data/invoices-client.ts';
import {
  filterToStatus,
  statusToFilter,
  type InvoiceDetail as Invoice,
  type InvoiceFilter,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceSummary,
} from '../../data/invoices-types.ts';
import { Loading } from '../../components/StateNotice.tsx';
import { InvoiceList } from './InvoiceList.tsx';
import { InvoiceDetail } from './InvoiceDetail.tsx';

type Nav = (next: { tab?: string; invoice?: string | null; invoiceFilter?: string | null }) => void;

export function InvoicesPane({
  tab,
  invoiceId,
  filter,
  locale,
  onNavigate,
}: {
  tab: string;
  invoiceId?: string;
  /** URL filter (lowercase), e.g. `overdue`. */
  filter?: InvoiceFilter;
  locale: Locale;
  onNavigate: Nav;
}) {
  const M = MESSAGES.invoicesPortal;
  const [rows, setRows] = useState<InvoiceListItem[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>(() => summarise([], null, ''));
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [listReady, setListReady] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<'api' | 'local'>('local');

  const activeFilter: InvoiceStatus | null = filter ? filterToStatus(filter) : null;
  // rows arrive latest-first from the client; the filter keeps that order.
  const visible = useMemo(
    () => (activeFilter ? rows.filter((r) => r.status === activeFilter) : rows),
    [rows, activeFilter],
  );

  const refreshList = useCallback(async () => {
    const res = await listMyInvoices();
    setRows(res.invoices);
    setSummary(res.summary);
    setSource(res.source);
    setListReady(true);
  }, []);

  // The list feeds both tabs (cards on List; prev/next order on Detail).
  useEffect(() => {
    setListReady(false);
    void refreshList();
  }, [tab, refreshList]);

  // Detail fetch per invoice id.
  useEffect(() => {
    if (tab !== 'detail' || !invoiceId) return;
    let cancelled = false;
    void getMyInvoice(invoiceId).then((res) => {
      if (cancelled) return;
      setDetail(res.invoice);
      setDetailSource(res.source);
      setDetailFor(invoiceId);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, invoiceId]);

  // Bare detail tab → open the LATEST invoice in the current (filtered) order.
  useEffect(() => {
    if (tab === 'detail' && !invoiceId && listReady && visible.length > 0) {
      onNavigate({ tab: 'detail', invoice: visible[0]!.invoiceId });
    }
  }, [tab, invoiceId, listReady, visible, onNavigate]);

  const setFilter = (s: InvoiceStatus | null) => onNavigate({ invoiceFilter: s ? statusToFilter(s) : null });

  if (tab === 'detail') {
    if (!listReady) return <Loading locale={locale} />;

    if (!invoiceId) {
      if (visible.length > 0) return <Loading locale={locale} />;
      return (
        <div className="pemo-panel" data-testid="portal-invoice-detail-empty">
          <h1 className="pemo-page-title">
            {t(activeFilter ? M.emptyFilteredTitle : M.emptyTitle, locale)}
          </h1>
          <p className="pemo-note">{t(activeFilter ? M.emptyFilteredBody : M.emptyBody, locale)}</p>
          <p className="pemo-note">
            {activeFilter ? (
              <button
                type="button"
                className="pemo-btn"
                data-testid="portal-invoice-clear-filter"
                onClick={() => setFilter(null)}
              >
                {t(M.clearFilter, locale)}
              </button>
            ) : (
              <button
                type="button"
                className="pemo-btn"
                data-testid="portal-invoice-back"
                onClick={() => onNavigate({ tab: 'list', invoice: null })}
              >
                {t(M.backToList, locale)}
              </button>
            )}
          </p>
        </div>
      );
    }

    if (detailFor !== invoiceId) return <Loading locale={locale} />;

    if (!detail) {
      return (
        <div className="pemo-panel" data-testid="portal-invoice-detail-missing">
          <h1 className="pemo-page-title">{t(M.detailMissingTitle, locale)}</h1>
          <p className="pemo-note">{t(M.detailMissingBody, locale)}</p>
          <p className="pemo-note">
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-invoice-back"
              onClick={() => onNavigate({ tab: 'list', invoice: null })}
            >
              {t(M.backToList, locale)}
            </button>
          </p>
        </div>
      );
    }

    // Same semantics as Ticket/Notice/Visitor detail: list is latest-first,
    // ‹ = previous (older, next row down), › = next (newer, row above).
    const index = visible.findIndex((x) => x.invoiceId === invoiceId);
    const hasPrev = index >= 0 && index < visible.length - 1;
    const hasNext = index > 0;
    const positionLabel =
      index >= 0
        ? t(M.invoicePosition, locale)
            .replace('{current}', String(index + 1))
            .replace('{total}', String(visible.length))
        : undefined;

    return (
      <InvoiceDetail
        invoice={detail}
        source={detailSource}
        locale={locale}
        onBack={() => onNavigate({ tab: 'list', invoice: null })}
        hasPrev={hasPrev}
        hasNext={hasNext}
        {...(positionLabel ? { positionLabel } : {})}
        {...(hasPrev
          ? { onPrev: () => onNavigate({ tab: 'detail', invoice: visible[index + 1]!.invoiceId }) }
          : {})}
        {...(hasNext
          ? { onNext: () => onNavigate({ tab: 'detail', invoice: visible[index - 1]!.invoiceId }) }
          : {})}
      />
    );
  }

  if (!listReady) return <Loading locale={locale} />;

  return (
    <InvoiceList
      invoices={visible}
      summary={summary}
      filter={activeFilter}
      source={source}
      locale={locale}
      onFilter={setFilter}
      onOpen={(id) => onNavigate({ tab: 'detail', invoice: id })}
    />
  );
}
