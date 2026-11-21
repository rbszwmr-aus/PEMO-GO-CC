/**
 * Facility booking — facilities & zones catalog + detail.
 *
 * Page fixtures only. Detail lists zones and bookable slots for the picked
 * facility. Writes (add / edit hours) stay named under DeferredActions.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 */

import { DetailBack, DetailTitle } from '../components/DetailChrome.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { BackLink, ITDetails, NumCell } from '../components/FinanceBits.tsx';
import { number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  BOOKING_FACILITIES,
  FACILITY_DETAIL_DEFAULT,
  findFacility,
  type FacilityRow,
} from '../data/booking-fixtures.ts';
import { money } from './Bookings.tsx';
import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { BOOKING_ICON } from '../data/nav-ia.ts';

const m = copy;

const DEFERRED = [
  m('Add a facility', '新增設施', '新增设施'),
  m('Edit opening hours', '更改開放時間', '更改开放时间'),
];

function activeLabel(active: boolean, locale: Locale): string {
  return t(active ? MESSAGES.booking.active : MESSAGES.booking.inactive, locale);
}

export function BookingFacilitiesList({
  locale,
  onOpen,
}: {
  locale: Locale;
  onOpen: (facilityId: string) => void;
}) {
  const M = MESSAGES.booking;
  const columns = [
    { key: 'name', label: t(M.colFacility, locale), width: '28%' },
    { key: 'kind', label: t(M.colKind, locale), width: '14%', hideBelow: 600 },
    { key: 'capacity', label: t(M.colCapacity, locale), width: '12%', hideBelow: 600 },
    { key: 'hours', label: t(M.colHours, locale), width: '18%', hideBelow: 520 },
    { key: 'deposit', label: t(M.colDeposit, locale), width: '14%' },
    { key: 'state', label: t(M.colActive, locale), width: '14%' },
  ];

  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title"><Icon name={BOOKING_ICON.facilities} size={ICON_SIZE.leading} />{' '}{t(M.facilitiesHeading, locale)}</h2>
      </section>

      <section className="pemo-panel">
        <Table caption={t(M.facilitiesTitle, locale)} columns={columns} testId="booking-facilities-table">
          {BOOKING_FACILITIES.map((f) => {
            const name = t(f.name, locale);
            const kind = t(f.kindLabel, locale);
            const hours = t(f.openHours, locale);
            const deposit = money(f.depositHkd, locale);
            const state = activeLabel(f.active, locale);
            return (
              <tr
                key={f.facilityId}
                data-testid="facilities-row"
                data-facility-id={f.facilityId}
                data-active={f.active ? 'true' : 'false'}
              >
                <WrapCell title={name}>
                  <a
                    href={`?screen=bookingFacilitiesDetail&state=detail&lang=${locale}&facility=${encodeURIComponent(f.facilityId)}`}
                    data-testid="facility-open"
                    data-read-affordance="navigate"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpen(f.facilityId);
                    }}
                  >
                    <Icon name={BOOKING_ICON.facilities} size={ICON_SIZE.control} />{' '}
                    {name}
                  </a>
                  <div className="pemo-meta" data-alt="kind">{kind} · {t(M.colCapacity, locale)} {number(f.capacity, locale)}</div>
                </WrapCell>
                <DenseCell title={kind}>{kind}</DenseCell>
                <DenseCell title={String(f.capacity)}>{number(f.capacity, locale)}</DenseCell>
                <DenseCell title={hours}>{hours}</DenseCell>
                <NumCell value={deposit} />
                <DenseCell title={state}>
                  <PlainChip>{state}</PlainChip>
                </DenseCell>
              </tr>
            );
          })}
        </Table>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function BookingFacilitiesDetail({
  facilityId,
  locale,
  onBack,
}: {
  facilityId: string;
  locale: Locale;
  onBack: () => void;
}) {
  const M = MESSAGES.booking;
  const facility: FacilityRow | undefined = facilityId
    ? findFacility(facilityId)
    : FACILITY_DETAIL_DEFAULT;

  if (!facility) {
    return (
      <section className="pemo-panel" data-testid="booking-facilities-detail-missing">
        <p>{t(M.facilityNotFound, locale)}</p>
        <a
          href={`?screen=bookingFacilities&state=default&lang=${locale}`}
          data-testid="facility-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToFacilities, locale)}
        </a>
      </section>
    );
  }

  const zoneColumns = [
    { key: 'zone', label: t(M.colZone, locale), width: '30%' },
    { key: 'capacity', label: t(M.colCapacity, locale), width: '22%' },
    { key: 'slots', label: t(M.colSlots, locale), width: '48%' },
  ];

  return (
    <>
      <section
        className="pemo-panel"
        data-testid="booking-facilities-detail"
        data-facility-id={facility.facilityId}
      >
        <DetailTitle title={t(facility.name, locale)} />
        <div className="pemo-actions">
          <BackLink href={`?screen=bookingFacilities&state=default&lang=${locale}`} label={M.backToFacilitiesShort} locale={locale} onBack={onBack} testId="facility-back" />
        </div>
        <dl className="pemo-dl" data-testid="facility-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
          <dt>{t(M.colKind, locale)}</dt>
          <dd>{t(facility.kindLabel, locale)}</dd>
          <dt>{t(M.colCapacity, locale)}</dt>
          <dd>{number(facility.capacity, locale)}</dd>
          <dt>{t(M.colHours, locale)}</dt>
          <dd>{t(facility.openHours, locale)}</dd>
          <dt>{t(M.colDeposit, locale)}</dt>
          <dd>{money(facility.depositHkd, locale)}</dd>
          <dt>{t(M.colActive, locale)}</dt>
          <dd><PlainChip>{activeLabel(facility.active, locale)}</PlainChip></dd>
          <dt>{t(M.colEstate, locale)}</dt>
          <dd>{t(facility.estateLabel, locale)}</dd>
        </dl>
        <ITDetails
          locale={locale}
          testId="facility-it-details"
          rows={[
            [MESSAGES.finance.itFacilityId, facility.facilityId],
            [MESSAGES.finance.itZoneIds, facility.zones.map((z) => z.zoneId).join(', ')],
            [MESSAGES.finance.itSource, <span data-testid="bookings-fixture-label">{t(M.fixtureLabel, locale)}</span>],
          ]}
        />
      </section>

      <section className="pemo-panel">
        <h3 className="pemo-panel__title">{t(M.zonesHeading, locale)}</h3>
        <Table caption={t(M.zonesHeading, locale)} columns={zoneColumns} testId="facility-zones-table">
          {facility.zones.map((z) => {
            const name = t(z.name, locale);
            const slots = z.slots
              .map((s) => `${t(s.label, locale)}${s.bookable ? '' : ` (${t(M.slotClosed, locale)})`}`)
              .join(' · ');
            return (
              <tr key={z.zoneId} data-testid="facility-zone-row" data-zone-id={z.zoneId}>
                <WrapCell title={name}>
                  {name}
                </WrapCell>
                <DenseCell title={String(z.capacity)}>{number(z.capacity, locale)}</DenseCell>
                <WrapCell title={slots}>{slots}</WrapCell>
              </tr>
            );
          })}
        </Table>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
