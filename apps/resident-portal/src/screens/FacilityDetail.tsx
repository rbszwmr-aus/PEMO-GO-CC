/**
 * Facility detail — overview, rates, rules (R7), equipment, location, FAQ, plus
 * the availability grid where the corpus supplies one.
 *
 * The facility state and eligibility sit at the top, as separate concepts: a
 * closed facility (sauna) shows its state and reason; an ineligible facility
 * (gym) shows its eligibility reason. Neither is expressed as the other.
 *
 * There is NO functional "Book" control — the contract has no writes, and an
 * affordance that does nothing asserts a capability that does not exist
 * (UI-028-ST's account-menu rule). Booking is deferred, with its reason.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { FacilityStatePill } from '../components/FacilityStatePill.tsx';
import { EligibilityBadge } from '../components/EligibilityBadge.tsx';
import { PolicyRules } from '../components/PolicyRules.tsx';
import { RateCard } from '../components/RateCard.tsx';
import { EquipmentList } from '../components/EquipmentList.tsx';
import { SlotGrid } from '../components/SlotGrid.tsx';
import { availabilityFor } from '../data/booking.ts';
import type { FacilityDetail as Detail } from '../data/types.ts';

export function FacilityDetail({ detail, locale }: { detail: Detail; locale: Locale }) {
  const F = MESSAGES.booking.facility;
  const T = F.tabs;
  const av = availabilityFor(detail.facilityId);

  return (
    <article className="pemo-detail" data-testid="facility-detail" data-facility={detail.facilityId}>
      <header className="pemo-detail__head">
        <h1 className="pemo-page-title">{t(detail.name, locale)}</h1>
        <span className="pemo-detail__category">{t(MESSAGES.booking.category[detail.category], locale)}</span>
        <div className="pemo-detail__status">
          <FacilityStatePill state={detail.availability} locale={locale} />
          <EligibilityBadge eligibility={detail.eligibility} locale={locale} />
        </div>
      </header>

      <section className="pemo-detail__section" data-testid="section-overview">
        <h2>{t(T.overview, locale)}</h2>
        <p>{t(detail.overview.description, locale)}</p>
        {detail.overview.capacity != null
          ? <p>{t(F.capacity, locale)}: {detail.overview.capacity} {t(F.people, locale)}</p> : null}
        {detail.overview.serviceHours
          ? <p>{t(F.serviceHours, locale)}: {t(detail.overview.serviceHours, locale)}</p> : null}
        {detail.overview.amenities?.length
          ? <p>{t(F.amenities, locale)}: {detail.overview.amenities.map((a) => t(a, locale)).join(' · ')}</p> : null}
        {detail.overview.accessibility?.length
          ? <p>{t(F.accessibility, locale)}: {detail.overview.accessibility.map((a) => t(a, locale)).join(' · ')}</p> : null}
      </section>

      <section className="pemo-detail__section" data-testid="section-rates">
        <h2>{t(T.rates, locale)}</h2>
        <RateCard rates={detail.rates} locale={locale} />
      </section>

      <section className="pemo-detail__section" data-testid="section-rules">
        <h2>{t(T.rules, locale)}</h2>
        <PolicyRules rules={detail.rules} locale={locale} />
      </section>

      <section className="pemo-detail__section" data-testid="section-equipment">
        <h2>{t(T.equipment, locale)}</h2>
        <EquipmentList equipment={detail.equipment} locale={locale} />
      </section>

      <section className="pemo-detail__section" data-testid="section-location">
        <h2>{t(T.location, locale)}</h2>
        {detail.location.buildingLabel ? <p>{t(detail.location.buildingLabel, locale)}</p> : null}
        {detail.location.floorLabel ? <p>{t(detail.location.floorLabel, locale)}</p> : null}
        {detail.location.provisional ? <p className="pemo-detail__provisional">{t(F.provisional, locale)}</p> : null}
      </section>

      {detail.faq.length ? (
        <section className="pemo-detail__section" data-testid="section-faq">
          <h2>{t(T.faq, locale)}</h2>
          {detail.faq.map((item, i) => (
            <details key={i} className="pemo-faq">
              <summary>{t(item.question, locale)}</summary>
              <p>{t(item.answer, locale)}</p>
            </details>
          ))}
        </section>
      ) : null}

      {av ? <SlotGrid view={av} locale={locale} /> : null}

      <p className="pemo-detail__book-deferred" data-testid="book-deferred">{t(F.bookDeferred, locale)}</p>
    </article>
  );
}
