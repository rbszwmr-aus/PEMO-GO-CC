/**
 * One Explore result card. Renders only what the fixture supplies — name,
 * category, composed location, capacity, from-price, facility state, eligibility.
 *
 * The ineligible card is a card like any other, marked with its reason — it is
 * NOT filtered out (that is Explore's job to not do; this renders whatever it is
 * handed). Composed location values are provisional while the world binding is
 * pending, and the card says so rather than presenting them as settled.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { formatMoney } from '../format/money.ts';
import { FacilityStatePill } from './FacilityStatePill.tsx';
import { EligibilityBadge } from './EligibilityBadge.tsx';
import type { FacilityCard as Card } from '../data/types.ts';

export function FacilityCard({ card, locale }: { card: Card; locale: Locale }) {
  const F = MESSAGES.booking.facility;
  return (
    <article
      className="pemo-card"
      data-testid="facility-card"
      data-facility={card.facilityId}
      data-eligible={card.eligibility.eligible}
    >
      <header className="pemo-card__head">
        <h3 className="pemo-card__name">
          {t(card.name, locale)}
        </h3>
        <span className="pemo-card__category">{t(MESSAGES.booking.category[card.category], locale)}</span>
      </header>

      <div className="pemo-card__meta">
        {card.location.buildingLabel ? <span>{t(card.location.buildingLabel, locale)}</span> : null}
        {card.location.floorLabel ? <span>{t(card.location.floorLabel, locale)}</span> : null}
        {card.capacity !== null && card.capacity !== undefined
          ? <span>{card.capacity} {t(F.people, locale)}</span> : null}
        {card.fromPrice ? <span className="pemo-mono">{t(F.fromPrice, locale)} {formatMoney(card.fromPrice)}</span> : null}
      </div>

      <div className="pemo-card__foot">
        <FacilityStatePill state={card.availability} locale={locale} />
        <EligibilityBadge eligibility={card.eligibility} locale={locale} />
      </div>

      {card.location.provisional
        ? <p className="pemo-card__provisional">{t(F.provisional, locale)}</p> : null}
    </article>
  );
}
