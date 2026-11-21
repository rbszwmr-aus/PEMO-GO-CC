/**
 * Facility booking — today's confirmed bookings; fixture toggle checked-in / no-show.
 *
 * "Today" is the fixture clock (19 Sep 2026). The toggle is local to this
 * browser session — no write API.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { BookingDialog } from './BookingDialog.tsx';
import { HintRow } from '../components/FinanceBits.tsx';
import { useMemo, useState } from 'react';
import { FilterBar, NoMatches } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import {
  checkinTodayRows,
  findFacility,
  findZone,
  type BookingStatus,
} from '../data/booking-fixtures.ts';
import { BookingStatusChip, bookingStatusLabel, humanSlot } from './Bookings.tsx';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BOOKING_ICON } from '../data/nav-ia.ts';

type CheckinRow = ReturnType<typeof checkinTodayRows>[number];
type CheckinTab = 'all' | 'confirmed' | 'checked-in' | 'no-show';
/** All, then each desk status; every tab opens by slot, earliest first. */
const STATUSES: readonly StatusDef<CheckinRow, CheckinTab>[] = (['all', 'confirmed', 'checked-in', 'no-show'] as CheckinTab[]).map((id) => ({
  id,
  test: (r: CheckinRow) => id === 'all' || r.status === id,
  sort: { key: 'slot', dir: 'asc' } as const,
}));
const SEARCH = copy('Search facility or requester', '搜尋設施或申請人', '搜索设施或申请人');

export function BookingCheckin({
  locale,
  onOpen,
}: {
  locale: Locale;
  /** Kept for callers that still pass it; a row now opens the booking in a pop-up over this list. */
  onOpen?: ((bookingId: string) => void) | undefined;
}) {
  void onOpen;
  const [openId, setOpenId] = useState<string | null>(null);
  const M = MESSAGES.booking;
  const base = useMemo(() => checkinTodayRows(), []);
  const [overrides, setOverrides] = useState<Record<string, BookingStatus>>({});

  const rows = useMemo(() => base.map((b) => ({ ...b, status: overrides[b.bookingId] ?? b.status })), [base, overrides]);
  const placeOf = (b: CheckinRow): string => {
    const f = findFacility(b.facilityId);
    const z = f ? findZone(f, b.zoneId) : undefined;
    return f ? `${t(f.name, locale)}${z ? ` · ${t(z.name, locale)}` : ''}` : b.facilityId;
  };
  const spec = useMemo<ViewSpec<CheckinRow>>(() => ({
    searchText: (b) => `${placeOf(b)} ${b.requesterName}`,
    filters: {},
    sorts: {
      facility: (b) => placeOf(b),
      requester: (b) => b.requesterName,
      slot: (b) => `${b.date} ${b.slotStart}`,
      status: (b) => bookingStatusLabel(b.status, locale),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locale]);
  const sv = useStatusView(rows, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<CheckinTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'confirmed', label: bookingStatusLabel('confirmed', locale), icon: 'CircleCheck', count: sv.counts.confirmed },
    { id: 'checked-in', label: bookingStatusLabel('checked-in', locale), icon: 'DoorOpen', count: sv.counts['checked-in'] },
    { id: 'no-show', label: bookingStatusLabel('no-show', locale), icon: 'UserX', count: sv.counts['no-show'], alert: true },
  ];

  const mark = (bookingId: string, status: BookingStatus) => {
    setOverrides((prev) => ({ ...prev, [bookingId]: status }));
  };

  const columns = [
    { key: 'facility', label: t(M.colFacility, locale), width: '24%', sortable: true },
    { key: 'requester', label: t(M.colRequester, locale), width: '14%', hideBelow: 600, sortable: true },
    { key: 'slot', label: t(M.colSlot, locale), width: '19%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '18%', sortable: true },
    { key: 'act', label: t(M.colCheckinAct, locale), width: '25%' },
  ];

  return (
    <>
      <HintRow text={t(M.checkinNote, locale)} />

      <StatusHead
        tabs={tabs}
        cardIds={['confirmed', 'checked-in', 'no-show']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={rows.length}
        locale={locale}
        root="checkin-status"
        ariaLabel={t(M.checkinHeading, locale)}
        cardsTestId="checkin-stats"
      />

      <section className="pemo-panel">
        <FilterBar
          locale={locale}
          testId="checkin-filters"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={[]}
          active={tv.active}
          onClear={tv.clear}
        />
        {tv.view.length === 0 ? <NoMatches locale={locale} testId="checkin-no-matches" /> : (
        <Table caption={t(M.checkinHeading, locale)} columns={columns} testId="booking-checkin-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
          {tv.view.map((b) => {
            const place = placeOf(b);
            const slot = humanSlot(b, locale);
            const canMark = b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'no-show';
            return (
              <tr
                key={b.bookingId}
                data-testid="checkin-row"
                data-booking-id={b.bookingId}
                data-status={b.status}
              >
                <td className="pemo-cell--wrap">
                  <a
                    href={`?screen=bookingsDetail&state=detail&lang=${locale}&booking=${encodeURIComponent(b.bookingId)}`}
                    data-testid="checkin-open"
                    data-read-affordance="navigate"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenId(b.bookingId);
                    }}
                  >
                    <Icon name={BOOKING_ICON.bookings} size={ICON_SIZE.control} />{' '}
                    {place}
                  </a>
                  <div className="pemo-meta" data-alt="requester">{b.requesterName}</div>
                </td>
                <WrapCell title={b.requesterName}>{b.requesterName}</WrapCell>
                <td className="pemo-cell--wrap">{slot}</td>
                <td><BookingStatusChip status={b.status} locale={locale} /></td>
                <td>
                  <div className="pemo-actions--row">
                    {canMark && b.status !== 'checked-in' ? (
                    <button
                      type="button"
                      className="pemo-button"
                      data-testid="checkin-mark-in"
                      data-read-affordance="fixture"
                      onClick={() => mark(b.bookingId, 'checked-in')}
                    >
                      <Icon name={BOOKING_ICON.markIn} size={ICON_SIZE.control} />
                      <span>{t(M.markCheckedIn, locale)}</span>
                    </button>
                    ) : null}
                    {canMark && b.status !== 'no-show' ? (
                    <button
                      type="button"
                      className="pemo-button"
                      data-testid="checkin-mark-noshow"
                      data-read-affordance="fixture"
                      onClick={() => mark(b.bookingId, 'no-show')}
                    >
                      <Icon name={BOOKING_ICON.noShow} size={ICON_SIZE.control} />
                      <span>{t(M.markNoShow, locale)}</span>
                    </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
        )}
      </section>
      {openId !== null ? <BookingDialog bookingId={openId} locale={locale} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}
