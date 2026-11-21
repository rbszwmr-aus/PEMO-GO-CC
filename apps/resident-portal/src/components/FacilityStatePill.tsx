/**
 * A FACILITY-level state pill — open / closed / coming-soon.
 *
 * A facility state is NOT a slot state: a closed facility shows its state and
 * reason here, never an empty slot grid (which would say "fully booked", a
 * different and false statement). `expectedReturn: null` renders as "no date" —
 * the export's "25 Aug" is not in the corpus and must never be invented.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { formatDate } from '../format/datetime.ts';
import type { FacilityState } from '../data/types.ts';

export function FacilityStatePill({ state, locale }: { state: FacilityState; locale: Locale }) {
  const label = t(MESSAGES.booking.facilityState[state.state], locale);
  const showReturn = state.state !== 'open';
  return (
    <div className={`pemo-facstate pemo-facstate--${state.state}`} data-testid="facility-state" data-state={state.state}>
      <span className="pemo-facstate__label">{label}</span>
      {state.reason ? <span className="pemo-facstate__reason">{t(state.reason, locale)}</span> : null}
      {showReturn ? (
        <span className="pemo-facstate__return" data-testid="expected-return">
          {state.expectedReturn === null
            ? t(MESSAGES.booking.availability.noDate, locale)
            : formatDate(state.expectedReturn, locale)}
        </span>
      ) : null}
    </div>
  );
}
