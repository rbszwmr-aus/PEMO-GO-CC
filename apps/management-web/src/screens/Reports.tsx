/**
 * Reports — L1 tabs (Daily operations | Management report), a date bar with Apply and
 * ONE export row (CSV, PDF), twelve cards of metrics, and a fixture-first drill-down:
 * a metric opens the rows behind it as a filtered table in the same page (breadcrumb,
 * removable chip, Back to report, search, sortable columns), and a row opens an L3
 * pop-up. CSV and PDF always export the view on screen.
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) Every metric row has its own icon chip and the card headings use the same chip as the stat cards.
 *   0.1.0 (2026-11-19) New. Fixture-fed until Backend has a rows-behind-each-figure endpoint.
 */

import { useEffect, useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { dateOnly, number } from '../format/datetime.ts';
import { csvText } from '../format/csv.ts';
import { renderReportPdf } from '../format/report-pdf.ts';
import { Icon, type IconName } from '../components/Icon.tsx';
import { InfoTip } from '../components/FinanceBits.tsx';
import { LineTabs, type TabItem } from '../components/Tabs.tsx';
import { FilterChipRow } from '../components/StatCard.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { Table, DenseCell } from '../components/Table.tsx';
import { FilterBar, NoMatches } from '../components/TableControls.tsx';
import { useTableView } from '../components/useTableView.ts';
import type { ViewSpec } from '../components/table-view.ts';
import {
  CARDS, columnsOf, defaultRange, hkToday, metricById, metricsOf, metricValue, rowsOf,
  type DateRange, type MetricDef, type ReportRow, type ReportTab,
} from '../data/reports-fixture.ts';
import { actionLabel, cardsExport, download, drillExport, rangeText, type ExportView } from './report-export.ts';

const PAGE_SIZE = 25;

/** Report card heading glyphs; existing local icons only. */
const CARD_ICON: Record<string, IconName> = {
  properties: 'Building2', households: 'ClipboardList', tenancies: 'FileCheck', occupancy: 'DoorOpen',
  bookings: 'CalendarCheck', payments: 'Wallet', safety: 'CircleAlert', notices: 'Send', documents: 'Inbox',
  access: 'Nfc', carpark: 'MapPin', ev: 'Zap',
};

/** One glyph per metric, from the local icon set; within a card no two metrics share one. */
const METRIC_ICON: Record<string, IconName> = {
  locations: 'MapPin', households: 'ClipboardList',
  'tenancies-active': 'FileCheck', 'tenancies-scheduled': 'Calendar', 'tenancies-ending': 'Hourglass',
  'homes-occupied': 'DoorOpen', occupants: 'LogIn',
  'bookings-confirmed': 'CircleCheck', 'bookings-cancelled': 'X',
  'pay-recorded': 'Receipt', 'pay-refunds': 'Undo2', 'pay-net': 'Banknote',
  'safety-open': 'CircleAlert', 'safety-received': 'Inbox',
  'notices-published': 'Send', 'documents-published': 'NotebookPen',
  'access-records': 'ScanLine', 'access-events': 'Radio',
  'carpark-records': 'ScanLine', 'carpark-events': 'Radio',
  'ev-records': 'ScanLine', 'ev-events': 'Radio',
};

export function Reports({ locale, initialMetric = null }: { locale: Locale; initialMetric?: string | null }) {
  const M = MESSAGES.reports;
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => hkToday(now), [now]);
  const [tab, setTab] = useState<ReportTab>('daily');
  const [draft, setDraft] = useState<DateRange>(() => defaultRange('daily', today));
  const [range, setRange] = useState<DateRange>(() => defaultRange('daily', today));
  const [metricId, setMetricId] = useState<string | null>(initialMetric);
  const def = metricId ? metricById(metricId) ?? null : null;
  const [shown, setShown] = useState<{ rows: readonly ReportRow[]; query: string }>({ rows: [], query: '' });

  const changeTab = (next: ReportTab) => {
    const r = defaultRange(next, today);
    setTab(next);
    setDraft(r);
    setRange(r);
    setMetricId(null);
  };
  const invalid = draft.from > draft.to;
  const apply = () => { if (!invalid) setRange(draft); };

  const tabs: TabItem<ReportTab>[] = [
    { id: 'daily', label: t(M.tabDaily, locale) },
    { id: 'mgmt', label: t(M.tabMgmt, locale) },
  ];

  const view: ExportView = def
    ? drillExport(tab, def, shown.rows, shown.query, range, now, locale)
    : cardsExport(tab, range, today, now, locale);
  const count = def ? shown.rows.length : null;
  const exportCsv = () => download(`${view.fileBase}.csv`, 'text/csv;charset=utf-8', csvText(view.head, view.rows));
  const exportPdf = () => download(`${view.fileBase}.pdf`, 'application/pdf', renderReportPdf(view, locale) as BlobPart);

  const asOf = dateOnly(`${today}T00:00:00+08:00`, locale);

  return (
    <section className="pemo-panel pemo-reports" data-testid="reports">
      <LineTabs items={tabs} active={tab} locale={locale} onChange={changeTab} ariaLabel={t(M.tabsLabel, locale)} root="reports" />

      <div className="pemo-reports__bar" data-testid="reports-bar">
        <label className="pemo-field" htmlFor="report-from">
          {t(M.from, locale)}
          <input id="report-from" type="date" value={draft.from} max={draft.to || undefined} data-tree-chrome="true" data-testid="report-from" onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label className="pemo-field" htmlFor="report-to">
          {t(M.to, locale)}
          <input id="report-to" type="date" value={draft.to} min={draft.from || undefined} data-tree-chrome="true" data-testid="report-to" onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </label>
        <button type="button" className="pemo-button pemo-button--primary" data-tree-chrome="true" data-testid="report-apply" disabled={invalid} onClick={apply}>
          <Icon name="CircleCheck" size={15} /> {t(M.apply, locale)}
        </button>
        <div className="pemo-reports__actions" role="group" aria-label={t(M.actionsLabel, locale)} data-testid="report-actions">
          <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="report-csv" onClick={exportCsv}>
            <Icon name="Download" size={15} /> {actionLabel('CSV', count, locale)}
          </button>
          <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="report-pdf" onClick={exportPdf}>
            <Icon name="Download" size={15} /> {actionLabel('PDF', count, locale)}
          </button>
        </div>
      </div>
      {invalid ? <p className="pemo-note pemo-note--error" role="alert" data-testid="report-range-error">{t(M.invalidRange, locale)}</p> : null}

      {def ? (
        <Drill
          key={`${def.id}|${range.from}|${range.to}|${locale}`}
          def={def}
          tab={tab}
          range={range}
          today={today}
          asOf={asOf}
          locale={locale}
          onBack={() => setMetricId(null)}
          onShown={setShown}
        />
      ) : (
        <>
          <p className="pemo-meta pemo-reports__period" data-testid="report-period">
            <Icon name="CalendarRange" size={14} /> <b>{rangeText(range)}</b>
            <span className="pemo-source" data-testid="report-sample"><Icon name="FlaskConical" size={14} /> {t(M.sampleNote, locale)}</span>
            <InfoTip text={`${t(M.asOf, locale).replace('{when}', asOf)}. ${t(M.hint, locale)} ${t(M.footnote, locale)}`} testId="report-period-info" />
          </p>
          <div className="pemo-reports__grid" data-testid="reports-cards">
            {CARDS.map((card) => (
              <div key={card.id} className="pemo-reportcard" data-testid="report-card" data-card={card.id}>
                <h3 className="pemo-reportcard__title">
                  <span className="pemo-statcard__chip" aria-hidden="true" data-testid="report-card-icon"><Icon name={CARD_ICON[card.id] ?? 'Layers'} size={16} strokeWidth={2} /></span>
                  {t(card.title, locale)}
                </h3>
                {metricsOf(card.id).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="pemo-reportmetric"
                    data-tree-chrome="true"
                    data-testid="report-metric"
                    data-metric={d.id}
                    onClick={() => setMetricId(d.id)}
                  >
                    <span className="pemo-statcard__chip" aria-hidden="true" data-testid="report-metric-icon" data-icon={METRIC_ICON[d.id] ?? 'Info'}>
                      <Icon name={METRIC_ICON[d.id] ?? 'Info'} size={16} strokeWidth={2} />
                    </span>
                    <span className="pemo-reportmetric__label">
                      {t(d.label, locale)}
                      <small title={t(d.basis === 'current' ? M.basisCurrent : M.basisPeriod, locale)} aria-label={t(d.basis === 'current' ? M.basisCurrent : M.basisPeriod, locale)}>
                        <Icon name={d.basis === 'current' ? 'Clock' : 'CalendarRange'} size={13} />
                      </small>
                    </span>
                    <span className="pemo-reportmetric__value">
                      <b data-testid="report-metric-value">{d.money ? metricValue(d, range, today).text : number(metricValue(d, range, today).n, locale)}</b>
                      <Icon name="ChevronRight" size={16} />
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Drill({
  def, tab, range, today, asOf, locale, onBack, onShown,
}: {
  def: MetricDef;
  tab: ReportTab;
  range: DateRange;
  today: string;
  asOf: string;
  locale: Locale;
  onBack: () => void;
  onShown: (s: { rows: readonly ReportRow[]; query: string }) => void;
}) {
  const M = MESSAGES.reports;
  const all = useMemo(() => rowsOf(def, range, today, locale), [def, range, today, locale]);
  const cols = columnsOf(def.kind);
  const spec = useMemo<ViewSpec<ReportRow>>(
    () => ({
      searchText: (r) => r.cells.join(' '),
      sorts: Object.fromEntries(cols.map((_, i) => [`c${i}`, (r: ReportRow) => r.keys[i] ?? null])),
    }),
    [cols],
  );
  const tv = useTableView(all, spec, null, locale);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<ReportRow | null>(null);
  useEffect(() => { onShown({ rows: tv.view, query: tv.state.query }); }, [tv.view, tv.state.query, onShown]);
  useEffect(() => { setPage(0); }, [tv.state.query, tv.state.sort]);

  const card = CARDS.find((c) => c.id === def.card)!;
  const last = Math.max(0, Math.ceil(tv.view.length / PAGE_SIZE) - 1);
  const pageRows = tv.view.slice(Math.min(page, last) * PAGE_SIZE, Math.min(page, last) * PAGE_SIZE + PAGE_SIZE);
  const from = tv.view.length === 0 ? 0 : Math.min(page, last) * PAGE_SIZE + 1;
  const to = Math.min(tv.view.length, (Math.min(page, last) + 1) * PAGE_SIZE);
  const tabLabel = t(tab === 'daily' ? M.tabDaily : M.tabMgmt, locale);

  return (
    <div data-testid="report-drill" data-metric={def.id}>
      <nav className="pemo-crumbs" aria-label={t(M.breadcrumb, locale)} data-testid="report-crumbs">
        <button type="button" className="pemo-crumbs__link" data-tree-chrome="true" onClick={onBack}>{t(M.crumbReports, locale)}</button>
        <span aria-hidden="true">›</span>
        <button type="button" className="pemo-crumbs__link" data-tree-chrome="true" onClick={onBack}>{tabLabel}</button>
        <span aria-hidden="true">›</span>
        <span>{t(card.title, locale)}</span>
        <span aria-hidden="true">›</span>
        <span aria-current="page" data-testid="report-crumb-current">{t(def.label, locale)}</span>
      </nav>
      <FilterChipRow label={`${t(M.metricFilter, locale)}: ${t(def.label, locale)}`} shown={tv.view.length} total={all.length} locale={locale} onClear={onBack} />
      <p className="pemo-meta">{asOf} · {rangeText(range)}</p>
      <div className="pemo-reports__tools">
        <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="report-back" onClick={onBack}>
          <Icon name="ArrowLeft" size={15} /> {t(M.backToReport, locale)}
        </button>
        <FilterBar locale={locale} testId="report-filters" searchLabel={t(M.searchRows, locale)} query={tv.state.query} onQuery={tv.setQuery} filters={[]} active={tv.active} onClear={tv.clear} />
      </div>
      {tv.view.length === 0 ? (
        <NoMatches locale={locale} testId="report-no-rows" />
      ) : (
        <Table
          caption={t(def.label, locale)}
          testId="report-table"
          columns={cols.map((c, i) => ({ key: `c${i}`, label: t(c, locale), sortable: true }))}
          sorting={{ sort: tv.state.sort, onSort: tv.onSort }}
        >
          {pageRows.map((r, i) => (
            <tr
              key={`${i}-${r.cells.join('|')}`}
              data-testid="report-row"
              data-read-affordance="detail"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => setOpen(r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(r); } }}
            >
              {r.cells.map((c, ci) => <DenseCell key={ci} title={c}>{c}</DenseCell>)}
            </tr>
          ))}
        </Table>
      )}
      <div className="pemo-reports__pager" data-testid="report-pager">
        <span data-testid="report-range">{t(M.pageOf, locale).replace('{from}', number(from, locale)).replace('{to}', number(to, locale)).replace('{total}', number(tv.view.length, locale))}</span>
        <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="report-prev" aria-label={t(M.prev, locale)} disabled={page <= 0} onClick={() => setPage(page - 1)}><Icon name="ChevronLeft" size={16} /></button>
        <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="report-next" aria-label={t(M.next, locale)} disabled={page >= last} onClick={() => setPage(page + 1)}><Icon name="ChevronRight" size={16} /></button>
      </div>
      {open ? (
        <Dialog title={t(def.detail, locale)} locale={locale} onClose={() => setOpen(null)} testId="report-dialog">
          <dl className="pemo-dl" data-testid="report-detail">
            {cols.map((c, i) => (
              <div key={i}>
                <dt>{t(c, locale)}</dt>
                <dd>{open.cells[i]}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      ) : null}
    </div>
  );
}
