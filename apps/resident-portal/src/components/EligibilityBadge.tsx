/**
 * The eligibility badge — the inversion made visible.
 *
 * An ineligible facility is PRESENT with its reason (R4, trap 8); it is NOT
 * filtered out. The reason is the caller's OWN standing (`membership-required`,
 * `per-person-quota-reached`, …) and names no other resident, household or
 * device. A list that shows only what you can have cannot tell you why you
 * cannot have the rest.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { Eligibility } from '../data/types.ts';

export function EligibilityBadge({ eligibility, locale }: { eligibility: Eligibility; locale: Locale }) {
  const E = MESSAGES.booking.eligibility;
  if (eligibility.eligible) {
    return (
      <span className="pemo-elig pemo-elig--yes" data-testid="eligibility" data-eligible="true">
        {t(E.eligible, locale)}
      </span>
    );
  }
  const reasonText = eligibility.reason ? t(E.reason[eligibility.reason], locale) : '';
  return (
    <span className="pemo-elig pemo-elig--no" data-testid="eligibility" data-eligible="false">
      <span className="pemo-elig__prefix">{t(E.ineligiblePrefix, locale)}</span>
      {reasonText ? <span className="pemo-elig__reason" data-testid="eligibility-reason">{reasonText}</span> : null}
    </span>
  );
}
