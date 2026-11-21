/**
 * Dashboard (the Overview screen): L1 line tabs Overview / Alarms; a period bar, six stat cards that open their list
 * page, two donuts, a bar and a line chart whose items open an L3 pop-up of records, and the connected-systems strip.
 * The Alarms tab holds the former Overview content (counters, needs attention, recent notices).
 * Fixtures are the data source (data/dashboard-fixture.ts); the period slices the 30 fixture days.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New, from the dashboard-charts prototype: replaces the Overview body; the old body is the Alarms tab.
 */

import { useState } from 'react';
import { DonutChart, SeriesChart, type SeriesDatum } from '../components/Chart.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { LineTabs } from '../components/Tabs.tsx';
import { StatCard } from '../components/StatCard.tsx';
import { Table } from '../components/Table.tsx';
import {
  BOOKINGS_PER_DAY, DASH_DAYS, DASH_FIRST_DAY, DASH_PERIODS, ESTATE, SAFETY_PER_DAY, drillRows, drillTable, figures, isoOfDay, periodWindow,
  type DashPeriod, type DrillKind,
} from '../data/dashboard-fixture.ts';
import { hkd } from '../data/finance-fixtures.ts';
import type { OverviewResponse } from '../data/types.ts';
import { number } from '../format/datetime.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { S2Overview, S2Systems } from './S2Overview.tsx';

const m = copy;

export type DashboardTab = 'overview' | 'alarms';
/** Where each estate card, and each pop-up's "Open list", goes. */
export type DashboardDrill = 'locations' | 'households' | 'occupied' | 'bookings' | 'receipts' | 'safety';

const L = {
  tabOverview: m('Overview', '總覽', '总览'),
  tabAlarms: m('Alarms', '警報', '警报'),
  tabsAria: m('Dashboard views', '儀表板檢視', '仪表板视图'),
  period: m('Period', '期間', '期间'),
  periods: {
    today: m('Today', '今日', '今天'),
    week: m('Week to date', '本週至今', '本周至今'),
    month: m('Month to date', '本月至今', '本月至今'),
    quarter: m('Quarter to date', '本季至今', '本季至今'),
    year: m('Year to date', '本年至今', '本年至今'),
    last30: m('Last 30 days', '近 30 天', '近 30 天'),
    custom: m('Custom', '自訂', '自定义'),
  } satisfies Record<DashPeriod, ReturnType<typeof m>>,
  from: m('From', '由', '自'),
  to: m('To', '至', '至'),
  apply: m('Apply', '套用', '应用'),
  tz: m('Hong Kong time', '香港時間', '香港时间'),
  current: m('Current', '現時', '当前'),
  inPeriod: m('Period', '期內', '期内'),
  locations: m('Locations', '地點', '地点'),
  households: m('Households', '住戶', '住户'),
  occupied: m('Occupied homes', '已入住單位', '已入住单位'),
  bookings: m('Bookings', '預約', '预约'),
  receipts: m('Booking receipts', '預約收款', '预约收款'),
  safetyDue: m('Safety to answer', '待回應安全事件', '待响应安全事件'),
  occupancyTitle: m('Occupancy', '入住情況', '入住情况'),
  vacant: m('Vacant', '空置', '空置'),
  total: m('Total', '總數', '总数'),
  bookingStatus: m('Booking status', '預約狀態', '预约状态'),
  confirmed: m('Confirmed', '已確認', '已确认'),
  pending: m('Pending', '待確認', '待确认'),
  cancelled: m('Cancelled', '已取消', '已取消'),
  bookingsByDay: m('Bookings by start date', '按開始日期的預約', '按开始日期的预约'),
  safetyByDay: m('Safety events received', '收到的安全事件', '收到的安全事件'),
  sum: m('Total', '合計', '合计'),
  colRecord: m('Record', '記錄', '记录'),
  colTime: m('Time', '時間', '时间'),
  colStatus: m('Status', '狀態', '状态'),
  openList: m('Open list', '開啟清單', '打开列表'),
  noRecords: m('No records', '沒有記錄', '没有记录'),
  safetyEvents: m('Safety events', '安全事件', '安全事件'),
};

const dayFmt = (locale: Locale, i: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Hong_Kong', ...opts }).format(new Date(DASH_FIRST_DAY + i * 86_400_000));

function series(values: readonly number[], from: number, to: number, locale: Locale, onPick: (day: number) => void): SeriesDatum[] {
  const out: SeriesDatum[] = [];
  for (let i = from; i <= to; i++) {
    out.push({
      key: `d${i}`,
      label: dayFmt(locale, i, { weekday: 'short', day: 'numeric', month: 'short' }),
      tick: dayFmt(locale, i, { day: 'numeric', month: 'short' }),
      value: values[i] ?? 0,
      onPick: () => onPick(i),
    });
  }
  return out;
}

const DRILL_OF: Record<DrillKind, DashboardDrill> = {
  occupied: 'households', vacant: 'households', confirmed: 'bookings', pending: 'bookings', cancelled: 'bookings', bar: 'bookings', point: 'safety',
};

export function Dashboard({ data, locale, tab, onTab, onDrill, onCounterClick, focusKey }: {
  data: OverviewResponse;
  locale: Locale;
  tab: DashboardTab;
  onTab: (tab: DashboardTab) => void;
  onDrill: Record<DashboardDrill, () => void>;
  onCounterClick?: Partial<Record<string, () => void>> | undefined;
  focusKey?: string | null | undefined;
}) {
  const [period, setPeriod] = useState<DashPeriod>('last30');
  const [draft, setDraft] = useState({ from: isoOfDay(0), to: isoOfDay(DASH_DAYS - 1) });
  const [applied, setApplied] = useState(draft);
  const [pop, setPop] = useState<{ kind: DrillKind; day: number } | null>(null);
  const A = (c: Parameters<typeof t>[0]) => t(c, locale);

  const w = periodWindow(period, applied);
  const f = figures(w);
  const range = `${dayFmt(locale, w.from, { day: 'numeric', month: 'short' })} – ${dayFmt(locale, w.to, { day: 'numeric', month: 'short', year: 'numeric' })} · ${A(L.tz)}`;

  const card = (id: DashboardDrill, label: string, value: number | string, icon: IconName, sub: string, tone?: 'warning') => (
    <StatCard key={id} id={id} label={label} value={value} icon={icon} sub={sub} tone={tone} locale={locale} nav onPress={onDrill[id]} />
  );

  const popTitle = (k: DrillKind, day: number): string =>
    k === 'bar' ? `${A(L.bookings)} · ${dayFmt(locale, day, { day: 'numeric', month: 'short' })}`
    : k === 'point' ? `${A(L.safetyEvents)} · ${dayFmt(locale, day, { day: 'numeric', month: 'short' })}`
    : k === 'occupied' ? A(L.occupied) : k === 'vacant' ? A(L.vacant) : k === 'confirmed' ? A(L.confirmed) : k === 'pending' ? A(L.pending) : A(L.cancelled);

  const donutPick = (kind: DrillKind) => () => setPop({ kind, day: 0 });

  return (
    <div className="pemo-dash" data-testid="dashboard">
      <LineTabs
        root="dash"
        ariaLabel={A(L.tabsAria)}
        locale={locale}
        active={tab}
        onChange={onTab}
        items={[
          { id: 'overview', label: A(L.tabOverview), icon: 'LayoutGrid' },
          { id: 'alarms', label: A(L.tabAlarms), icon: 'CircleAlert', count: ESTATE.safetyDue, alert: true },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <div className="pemo-dash-filter" data-testid="dash-filter">
            <label className="pemo-field pemo-dash-field">
              <Icon name="CalendarRange" size={18} />
              <span className="pemo-visually-hidden">{A(L.period)}</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value as DashPeriod)} data-tree-chrome="true" data-testid="dash-period">
                {DASH_PERIODS.map((id) => <option key={id} value={id}>{A(L.periods[id])}</option>)}
              </select>
            </label>
            {period === 'custom' ? (
              <>
                <label className="pemo-field pemo-dash-field">
                  <span>{A(L.from)}</span>
                  <input type="date" value={draft.from} min={isoOfDay(0)} max={draft.to} data-tree-chrome="true" data-testid="dash-from" onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                </label>
                <label className="pemo-field pemo-dash-field">
                  <span>{A(L.to)}</span>
                  <input type="date" value={draft.to} min={draft.from} max={isoOfDay(DASH_DAYS - 1)} data-tree-chrome="true" data-testid="dash-to" onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                </label>
                <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="dash-apply" onClick={() => setApplied(draft)}>{A(L.apply)}</button>
              </>
            ) : null}
            <span className="pemo-dash-filter__range" data-testid="dash-range">{range}</span>
          </div>

          <div className="pemo-dash-cards" data-testid="dash-cards">
            {card('locations', A(L.locations), ESTATE.locations, 'Building2', A(L.current))}
            {card('households', A(L.households), ESTATE.households, 'Layers', A(L.current))}
            {card('occupied', A(L.occupied), ESTATE.occupied, 'DoorOpen', A(L.current))}
            {card('bookings', A(L.bookings), f.confirmed, 'CalendarCheck', A(L.inPeriod))}
            {card('receipts', A(L.receipts), hkd(f.receiptsHkd, locale), 'Wallet', A(L.inPeriod))}
            {card('safety', A(L.safetyDue), ESTATE.safetyDue, 'CircleAlert', A(L.current), 'warning')}
          </div>

          <div className="pemo-dash-split">
            <section className="pemo-panel" data-testid="dash-occupancy">
              <div className="pemo-panel__head"><h2 className="pemo-panel__title">{A(L.occupancyTitle)}</h2><span className="pemo-dash-panel-meta">{A(L.current)}</span></div>
              <DonutChart
                testId="dash-occupancy-donut"
                locale={locale}
                ariaLabel={A(L.occupancyTitle)}
                totalLabel={A(L.total)}
                data={[
                  { key: 'occupied', label: A(L.occupied), value: ESTATE.occupied, tone: 'primary', onPick: donutPick('occupied') },
                  { key: 'vacant', label: A(L.vacant), value: f.vacant, tone: 'soft', onPick: donutPick('vacant') },
                ]}
              />
            </section>
            <section className="pemo-panel" data-testid="dash-booking-status">
              <div className="pemo-panel__head"><h2 className="pemo-panel__title">{A(L.bookingStatus)}</h2><span className="pemo-dash-panel-meta">{A(L.inPeriod)}</span></div>
              <DonutChart
                testId="dash-booking-donut"
                locale={locale}
                ariaLabel={A(L.bookingStatus)}
                totalLabel={A(L.total)}
                data={[
                  { key: 'confirmed', label: A(L.confirmed), value: f.confirmed, tone: 'primary', onPick: donutPick('confirmed') },
                  { key: 'pending', label: A(L.pending), value: f.pending, tone: 'attention', onPick: donutPick('pending') },
                  { key: 'cancelled', label: A(L.cancelled), value: f.cancelled, tone: 'critical', onPick: donutPick('cancelled') },
                ]}
              />
            </section>
          </div>

          <div className="pemo-dash-split">
            <section className="pemo-panel" data-testid="dash-bookings-chart">
              <div className="pemo-panel__head"><h2 className="pemo-panel__title">{A(L.bookingsByDay)}</h2><span className="pemo-dash-panel-meta">{A(L.inPeriod)}</span></div>
              <SeriesChart testId="dash-bookings-series" kind="bars" locale={locale} ariaLabel={A(L.bookingsByDay)} totalLabel={A(L.sum)} data={series(BOOKINGS_PER_DAY, w.from, w.to, locale, (day) => setPop({ kind: 'bar', day }))} />
            </section>
            <section className="pemo-panel" data-testid="dash-safety-chart">
              <div className="pemo-panel__head"><h2 className="pemo-panel__title">{A(L.safetyByDay)}</h2><span className="pemo-dash-panel-meta">{A(L.inPeriod)}</span></div>
              <SeriesChart testId="dash-safety-series" kind="line" locale={locale} ariaLabel={A(L.safetyByDay)} totalLabel={A(L.sum)} data={series(SAFETY_PER_DAY, w.from, w.to, locale, (day) => setPop({ kind: 'point', day }))} />
            </section>
          </div>

          <S2Systems data={data} locale={locale} />
        </>
      ) : (
        <S2Overview data={data} locale={locale} onCounterClick={onCounterClick} focusKey={focusKey} />
      )}

      {pop ? (() => {
        const { rows, total } = drillRows(pop.kind, pop.day, w);
        const table = drillTable(pop.kind);
        const cols = table === 'homes'
          ? [{ key: 'rec', label: A(L.colRecord), width: '60%' }, { key: 'status', label: A(L.colStatus), width: '40%' }]
          : [{ key: 'rec', label: A(L.colRecord), width: '44%' }, { key: 'time', label: A(L.colTime), width: '30%' }, { key: 'status', label: A(L.colStatus), width: '26%' }];
        return (
          <Dialog title={popTitle(pop.kind, pop.day)} locale={locale} onClose={() => setPop(null)} wide testId="dash-drill">
            {rows.length === 0 ? <p className="pemo-meta" data-testid="dash-drill-empty">{A(L.noRecords)}</p> : (
              <Table caption={popTitle(pop.kind, pop.day)} testId="dash-drill-table" columns={cols}>
                {rows.map((r, i) => (
                  <tr key={i} data-testid="dash-drill-row">
                    <td><b>{A(r.record)}</b></td>
                    {table === 'homes' ? null : <td>{r.time}</td>}
                    <td>{A(r.status)}</td>
                  </tr>
                ))}
              </Table>
            )}
            {total > rows.length ? <p className="pemo-meta" data-testid="dash-drill-count">{number(rows.length, locale)} / {number(total, locale)}</p> : null}
            <div className="pemo-dialog__actions">
              <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="dash-drill-open" onClick={onDrill[DRILL_OF[pop.kind]]}>
                {A(L.openList)} <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </Dialog>
        );
      })() : null}
    </div>
  );
}
