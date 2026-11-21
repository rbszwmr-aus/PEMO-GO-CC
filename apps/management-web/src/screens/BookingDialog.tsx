/**
 * One booking as an L3 pop-up with its own line tabs (Details | Payments | History).
 * Opened from a calendar chip, a Bookings row, or the booking deep link. Cancel asks inline
 * (a second step inside the same pop-up, never a pop-up on a pop-up) and only marks the
 * booking cancelled on this screen: there is no booking write API yet.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) Details stay one column (read-only pop-up); Start and End are separate rows with the Hong Kong time line under Start.
 *   0.2.0 (2026-11-19) Details are a two-column list: requester | unit, start | end with the Hong Kong time note under them, facility | composition, notes on the full row.
 *   0.1.0 (2026-11-19) New. Replaces the Bookings detail page; keeps its test ids.
 */

import { useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { ITDetails } from '../components/FinanceBits.tsx';
import { number, dateOnly } from '../format/datetime.ts';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { LineTabs, type TabItem } from '../components/Tabs.tsx';
import { addDays, BOOKING_DETAIL_DEFAULT, findBooking, findFacility, findZone, type BookingRow } from '../data/booking-fixtures.ts';
import { BookingStatusChip, bookingStatusLabel, humanSlot, money } from './Bookings.tsx';

type DialogTab = 'details' | 'payments' | 'history';

const DEFERRED = [
  copy('Amend booking', '更改預約', '更改预约'),
  copy('Record check-in', '記錄登記', '记录登记'),
];

export function BookingDialog({ bookingId, locale, onClose }: { bookingId: string; locale: Locale; onClose: () => void }) {
  const M = MESSAGES.booking;
  /** An empty id is the bare deep link: show the first sample booking, as the old detail page did. */
  const base: BookingRow | undefined = bookingId === '' ? BOOKING_DETAIL_DEFAULT : findBooking(bookingId);
  const [tab, setTab] = useState<DialogTab>('details');
  const [asking, setAsking] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (!base) {
    return (
      <Dialog title={t(M.detailTitle, locale)} locale={locale} onClose={onClose} testId="booking-dialog">
        <p className="pemo-note" data-testid="bookings-detail-missing">{t(M.notFound, locale)}</p>
        <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="booking-back" onClick={onClose}>{t(M.backToList, locale)}</button>
      </Dialog>
    );
  }
  const row: BookingRow = cancelled ? { ...base, status: 'cancelled', tone: 'unknown' } : base;
  const facility = findFacility(row.facilityId);
  const zone = facility ? findZone(facility, row.zoneId) : undefined;
  const place = facility ? `${t(facility.name, locale)}${zone ? ` · ${t(zone.name, locale)}` : ''}` : row.facilityId;
  const tabs: TabItem<DialogTab>[] = [
    { id: 'details', label: t(M.tabDetails, locale) },
    { id: 'payments', label: t(M.tabPayments, locale) },
    { id: 'history', label: t(M.tabHistory, locale) },
  ];

  return (
    <Dialog title={place} locale={locale} onClose={onClose} wide testId="booking-dialog">
      <section data-testid="bookings-detail" data-booking-id={row.bookingId}>
        <div className="pemo-actions">
          <BookingStatusChip status={row.status} locale={locale} />
          <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="booking-back" onClick={onClose}>{t(MESSAGES.ui.close, locale)}</button>
        </div>
        <LineTabs items={tabs} active={tab} locale={locale} onChange={setTab} ariaLabel={t(M.dialogTabs, locale)} root="booking-dialog" />

        {tab === 'details' ? (
          <>
            <dl className="pemo-dl" data-testid="booking-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
              <dt>{t(M.colRequester, locale)}</dt>
              <dd>
                {row.requesterName}
                <div className="pemo-meta">{t(row.requesterKind, locale)}</div>
              </dd>
              <dt>{t(M.colUnit, locale)}</dt>
              <dd>
                {t(row.unitSummary, locale)}
                <ScopePathCell scope={row.scope} locale={locale} />
              </dd>
              <dt>{t(M.fieldStart, locale)}</dt>
              <dd data-testid="booking-start">
                {dateOnly(row.date, locale)} · {row.slotStart}
                <div className="pemo-meta" data-testid="booking-timezone">{t(M.timeZoneNote, locale)}</div>
              </dd>
              <dt>{t(M.fieldEnd, locale)}</dt>
              <dd data-testid="booking-end">{dateOnly(row.date, locale)} · {row.slotEnd}</dd>
              <dt>{t(M.colFacility, locale)}</dt>
              <dd>{place}</dd>
              <dt>{t(M.fieldComposition, locale)}</dt>
              <dd data-testid="booking-composition">
                {t(M.membersCount, locale)} {number(row.memberCount, locale)}
                {' · '}
                {t(M.guestsCount, locale)} {number(row.guestCount, locale)}
              </dd>
              <dt>{t(M.fieldNotes, locale)}</dt>
              <dd>{row.staffNotes ? t(row.staffNotes, locale) : t(M.notesNone, locale)}</dd>
            </dl>
            <ITDetails
              locale={locale}
              testId="booking-it-details"
              rows={[
                [MESSAGES.finance.itBookingId, row.bookingId],
                [MESSAGES.finance.itHouseholdId, row.householdId],
                [MESSAGES.finance.itResidentId, row.residentId],
                [MESSAGES.finance.itSource, <span data-testid="bookings-fixture-label">{t(M.fixtureLabel, locale)}</span>],
              ]}
            />
          </>
        ) : null}

        {tab === 'payments' ? (
          <dl className="pemo-dl" data-testid="booking-payments" style={{ marginTop: 'var(--pemo-space-4)' }}>
            <dt>{t(M.paymentFee, locale)}</dt>
            <dd>{money(row.feeHkd, locale)}</dd>
            <dt>{t(M.fieldPayment, locale)}</dt>
            <dd data-testid="booking-payment">{t(row.payment.label, locale)}</dd>
          </dl>
        ) : null}

        {tab === 'history' ? (
          <dl className="pemo-dl" data-testid="booking-history" style={{ marginTop: 'var(--pemo-space-4)' }}>
            <dt>{t(M.historyBooked, locale)}</dt>
            <dd>{dateOnly(addDays(row.date, -3), locale)}</dd>
            <dt>{t(M.historyStatus, locale)}</dt>
            <dd>{bookingStatusLabel(row.status, locale)}</dd>
          </dl>
        ) : null}

        {cancelled ? <p className="pemo-note" role="status" data-testid="booking-cancelled-note">{t(M.cancelledNote, locale)}</p> : null}
        {row.status !== 'cancelled' && !asking ? (
          <div className="pemo-dialog__actions">
            <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="booking-cancel" onClick={() => setAsking(true)}>{t(M.cancelCta, locale)}</button>
          </div>
        ) : null}
        {asking && !cancelled ? (
          <div className="pemo-dialog__confirm" role="alertdialog" aria-label={t(M.cancelAsk, locale)} data-testid="booking-cancel-confirm">
            <span>{t(M.cancelAsk, locale)}</span>
            <button type="button" className="pemo-button pemo-button--primary" data-tree-chrome="true" data-testid="booking-cancel-yes" onClick={() => { setCancelled(true); setAsking(false); }}>{t(M.cancelYes, locale)}</button>
            <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="booking-cancel-keep" onClick={() => setAsking(false)}>{t(M.cancelKeep, locale)}</button>
          </div>
        ) : null}
      </section>
      <DeferredActions locale={locale} actions={DEFERRED} />
    </Dialog>
  );
}
