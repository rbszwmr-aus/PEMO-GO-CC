/**
 * Facility booking — bookings list → detail, fixture-first.
 *
 * Design nav: AMENITIES → Facility booking → Bookings. Page fixtures only;
 * no list/write operation in the management contract under v0 freeze. SCOPE
 * rail filters rows that already carry a unit path. Writes stay named under
 * DeferredActions (amend / cancel / check-in).
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { NumCell } from '../components/FinanceBits.tsx';
import { dateOnly, number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  BOOKING_FACILITIES,
  BOOKING_FIXTURE_TODAY,
  BOOKING_ROWS,
  BOOKING_STATUSES,
  findFacility,
  findZone,
  type BookingRow,
  type BookingStatus,
} from '../data/booking-fixtures.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BOOKING_ICON } from '../data/nav-ia.ts';
import { LineTabs, type TabItem } from '../components/Tabs.tsx';
import { FilterBar, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { BookingDialog } from './BookingDialog.tsx';

const m = copy;

const LIST_DEFERRED = [
  m('Create a booking', '新增預約', '新增预约'),
];

/** "19 Sept 2026 · 10:00–12:00" — the same date style as the rest of the app. */
export function humanSlot(row: Pick<BookingRow, 'date' | 'slotStart' | 'slotEnd'>, locale: Locale): string {
  return `${dateOnly(row.date, locale)} · ${row.slotStart}–${row.slotEnd}`;
}

export function bookingStatusLabel(status: BookingStatus, locale: Locale): string {
  return t(MESSAGES.booking.status[status], locale);
}

export function money(amount: number, locale: Locale): string {
  return `HKD ${number(amount, locale)}`;
}

export function BookingStatusChip({ status, locale }: { status: BookingStatus; locale: Locale }) {
  return <PlainChip testId="booking-status">{bookingStatusLabel(status, locale)}</PlainChip>;
}

function facilityName(facilityId: string, locale: Locale): string {
  const f = findFacility(facilityId);
  return f ? t(f.name, locale) : facilityId;
}

function zoneName(facilityId: string, zoneId: string, locale: Locale): string {
  const f = findFacility(facilityId);
  const z = f ? findZone(f, zoneId) : undefined;
  return z ? t(z.name, locale) : zoneId;
}

type BookingStatusTab = 'all' | 'today' | 'confirmed' | 'pending';
/** All, then the statuses a desk works through; each opens on its own sort. */
const STATUSES: readonly StatusDef<BookingRow, BookingStatusTab>[] = [
  { id: 'all', test: () => true, sort: { key: 'slot', dir: 'asc' } },
  { id: 'today', test: (b) => b.date === BOOKING_FIXTURE_TODAY, sort: { key: 'slot', dir: 'asc' } },
  { id: 'confirmed', test: (b) => b.status === 'confirmed', sort: { key: 'slot', dir: 'asc' } },
  { id: 'pending', test: (b) => b.status === 'pending', sort: { key: 'slot', dir: 'asc' } },
];
const SEARCH = m('Search facility, requester or unit', '搜尋設施、申請人或單位', '搜索设施、申请人或单元');

export function BookingsList({
  locale,
  onOpen,
  focusKey,
  onView,
  detailId = null,
  onCloseDetail,
}: {
  locale: Locale;
  onOpen: (bookingId: string) => void;
  focusKey?: NodeKey | null;
  /** L1 List | Calendar: leave this page for the other one. */
  onView?: (view: 'list' | 'calendar') => void;
  /** A booking's pop-up is open (the detail route is a deep link to it). */
  detailId?: string | null;
  onCloseDetail?: () => void;
}) {
  const M = MESSAGES.booking;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const scoped = focusKey
    ? BOOKING_ROWS.filter((b) => scopePathInFocus(b.scope, focusKey))
    : BOOKING_ROWS;
  // The date range narrows the rows every tab counts; status is the tabs'.
  const ranged = useMemo(() => scoped.filter((b) => (!from || b.date >= from) && (!to || b.date <= to)), [scoped, from, to]);
  const spec = useMemo<ViewSpec<BookingRow>>(() => ({
    searchText: (b) => `${facilityName(b.facilityId, locale)} ${zoneName(b.facilityId, b.zoneId, locale)} ${b.requesterName} ${t(b.unitSummary, locale)}`,
    filters: { facility: (b) => b.facilityId },
    sorts: {
      facility: (b) => facilityName(b.facilityId, locale),
      requester: (b) => b.requesterName,
      unit: (b) => t(b.unitSummary, locale),
      slot: (b) => `${b.date} ${b.slotStart}`,
      status: (b) => bookingStatusLabel(b.status, locale),
      fee: (b) => b.feeHkd,
    },
  }), [locale]);
  const sv = useStatusView(ranged, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<BookingStatusTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'today', label: t(M.countToday, locale), icon: 'CalendarCheck', count: sv.counts.today },
    { id: 'confirmed', label: t(M.countConfirmed, locale), icon: 'CircleCheck', count: sv.counts.confirmed },
    { id: 'pending', label: t(M.countPending, locale), icon: 'Hourglass', count: sv.counts.pending, alert: true },
  ];
  const filters: FilterDef[] = [
    {
      key: 'facility', label: t(M.filterFacility, locale), allLabel: t(M.filterAll, locale),
      options: BOOKING_FACILITIES.map((f) => ({ value: f.facilityId, label: t(f.name, locale) })),
      value: tv.state.filters['facility'] ?? '', onChange: (v) => tv.setFilter('facility', v),
    },
  ];

  const columns = [
    { key: 'facility', label: t(M.colFacility, locale), width: '25%', sortable: true },
    { key: 'requester', label: t(M.colRequester, locale), width: '17%', hideBelow: 600, sortable: true },
    { key: 'unit', label: t(M.colUnit, locale), width: '15%', hideBelow: 800, sortable: true },
    { key: 'slot', label: t(M.colSlot, locale), width: '18%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '14%', sortable: true },
    { key: 'fee', label: t(M.colFee, locale), width: '11%', hideBelow: 600, sortable: true },
  ];

  return (
    <>
      {onView ? <BookingViewTabs active="list" locale={locale} onChange={onView} /> : null}
      <StatusHead
        tabs={tabs}
        cardIds={['today', 'confirmed', 'pending']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={ranged.length}
        locale={locale}
        root="booking-status"
        ariaLabel={t(M.listTitle, locale)}
        cardsTestId="booking-stats"
      />
      <section className="pemo-panel" data-testid="bookings-filters">
        {focusKey ? (
          <p className="pemo-note" data-testid="scope-filter-note" data-screen="bookings">
            {t(MESSAGES.shell.filterNote, locale)}
          </p>
        ) : null}
        <FilterBar
          locale={locale}
          testId="bookings-bar"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={filters}
          active={tv.active}
          onClear={tv.clear}
        />
        <div className="pemo-toolbar" style={{ marginTop: 'var(--pemo-space-3)' }}>
          <label className="pemo-field pemo-field--icon" title={t(M.filterFrom, locale)}>
            <Icon name="CalendarRange" size={ICON_SIZE.control} />
            <input type="date" aria-label={t(M.filterFrom, locale)} data-testid="bookings-filter-from" data-read-affordance="filter" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="pemo-field pemo-field--icon" title={t(M.filterTo, locale)}>
            <Icon name="CalendarRange" size={ICON_SIZE.control} />
            <input type="date" aria-label={t(M.filterTo, locale)} data-testid="bookings-filter-to" data-read-affordance="filter" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {from || to ? (
            <button type="button" className="pemo-button pemo-button--quiet" data-read-affordance="filter" data-testid="bookings-dates-clear" onClick={() => { setFrom(''); setTo(''); }}>
              <Icon name="X" size={ICON_SIZE.control} />
              <span>{t(MESSAGES.ui.clearFilter, locale)}</span>
            </button>
          ) : null}
        </div>
      </section>

      {tv.view.length === 0 ? (
        <section className="pemo-state" data-testid="bookings-filter-empty" role="status">
          <h2 className="pemo-state__title">{t(M.filterNoMatchTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.filterNoMatch, locale)}</p>
        </section>
      ) : (
        <section className="pemo-panel">
          <Table caption={t(M.listTitle, locale)} columns={columns} testId="bookings-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((b) => {
              const facility = facilityName(b.facilityId, locale);
              const zone = zoneName(b.facilityId, b.zoneId, locale);
              const place = `${facility} · ${zone}`;
              const unit = t(b.unitSummary, locale);
              const slot = humanSlot(b, locale);
              const fee = money(b.feeHkd, locale);
              return (
                <tr
                  key={b.bookingId}
                  data-testid="bookings-row"
                  data-booking-id={b.bookingId}
                  data-status={b.status}
                  data-facility-id={b.facilityId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(b.bookingId)}
                >
                  <td className="pemo-cell--wrap" data-testid="booking-row-place">
                    <a
                      href={`?screen=bookingsDetail&state=detail&lang=${locale}&booking=${encodeURIComponent(b.bookingId)}`}
                      data-testid="booking-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(b.bookingId);
                      }}
                    >
                      <Icon name={BOOKING_ICON.bookings} size={ICON_SIZE.control} />{' '}
                      {place}
                    </a>
                    <div className="pemo-meta" data-alt="requester">{b.requesterName} · {unit}</div>
                  </td>
                  <WrapCell title={b.requesterName}>
                    {b.requesterName}
                    <div className="pemo-meta">{t(b.requesterKind, locale)}</div>
                    <div className="pemo-meta" data-alt="unit">{unit}</div>
                  </WrapCell>
                  <td className="pemo-cell--wrap">{unit}</td>
                  <td className="pemo-cell--wrap">{slot}</td>
                  <td><BookingStatusChip status={b.status} locale={locale} /></td>
                  <NumCell value={fee} />
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
      {detailId !== null && onCloseDetail ? <BookingDialog bookingId={detailId} locale={locale} onClose={onCloseDetail} /> : null}
    </>
  );
}

/** L1 tabs shared by the Bookings list and the Calendar. */
export function BookingViewTabs({ active, locale, onChange }: { active: 'list' | 'calendar'; locale: Locale; onChange: (v: 'list' | 'calendar') => void }) {
  const M = MESSAGES.booking;
  return (
    <LineTabs
      items={[{ id: 'list', label: t(M.tabList, locale) }, { id: 'calendar', label: t(M.tabCalendar, locale) }]}
      active={active}
      locale={locale}
      onChange={onChange}
      ariaLabel={t(M.pageTabsLabel, locale)}
      root="booking-page"
    />
  );
}
