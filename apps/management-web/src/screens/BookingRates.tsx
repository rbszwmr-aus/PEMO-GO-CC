/**
 * Facility booking — read-only peak / off-peak rate cards (resident vs visitor).
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { Table } from '../components/Table.tsx';
import { BOOKING_RATE_CARDS, findFacility } from '../data/booking-fixtures.ts';
import { money } from './Bookings.tsx';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BOOKING_ICON } from '../data/nav-ia.ts';

export function BookingRates({ locale }: { locale: Locale }) {
  const M = MESSAGES.booking;
  const columns = [
    { key: 'facility', label: t(M.colFacility, locale), width: '30%' },
    { key: 'peakRate', label: t(M.colPeakRate, locale), width: '35%' },
    { key: 'offRate', label: t(M.colOffPeakRate, locale), width: '35%' },
  ];

  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title"><Icon name={BOOKING_ICON.rates} size={ICON_SIZE.leading} />{' '}{t(M.ratesHeading, locale)}</h2>
      </section>

      <section className="pemo-panel">
        <Table caption={t(M.ratesTitle, locale)} columns={columns} testId="booking-rates-table">
          {BOOKING_RATE_CARDS.map((r) => {
            const f = findFacility(r.facilityId);
            const name = f ? t(f.name, locale) : r.facilityId;
            const peakWhen = t(r.peakWhen, locale);
            const offWhen = t(r.offPeakWhen, locale);
            const peakRes = money(r.peakResidentHkd, locale);
            const peakVis = money(r.peakVisitorHkd, locale);
            const offRes = money(r.offPeakResidentHkd, locale);
            const offVis = money(r.offPeakVisitorHkd, locale);
            return (
              <tr
                key={r.facilityId}
                data-testid="rates-row"
                data-facility-id={r.facilityId}
              >
                <td className="pemo-cell--wrap">
                  {name}
                  <div className="pemo-meta">
                    {t(M.colDeposit, locale)} <span className="pemo-num pemo-nowrap">{money(r.depositHkd, locale)}</span>
                  </div>
                </td>
                <RateCell when={peakWhen} resident={peakRes} visitor={peakVis} locale={locale} />
                <RateCell when={offWhen} resident={offRes} visitor={offVis} locale={locale} />
              </tr>
            );
          })}
        </Table>
      </section>
    </>
  );
}

/** Resident and visitor rate in one cell, one line each; money never truncates. */
function RateCell({ when, resident, visitor, locale }: { when: string; resident: string; visitor: string; locale: Locale }) {
  const M = MESSAGES.booking;
  // The hours are the cell's context line; each money line stays on one line.
  return (
    <td className="pemo-cell--rate" data-testid="rate-cell">
      <div className="pemo-meta pemo-cell--wrap">{when}</div>
      <div className="pemo-num pemo-nowrap"><span className="pemo-meta">{t(M.rateResident, locale)}</span> {resident}</div>
      <div className="pemo-num pemo-nowrap"><span className="pemo-meta">{t(M.rateVisitor, locale)}</span> {visitor}</div>
    </td>
  );
}
