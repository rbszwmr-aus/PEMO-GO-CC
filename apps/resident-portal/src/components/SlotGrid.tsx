/**
 * The availability slot grid, plus its list alternative (09 a11y: a slot picker
 * needs a keyboard path AND a list-based alternative — a drag-only grid fails).
 *
 * `SlotState: unavailable` COLLAPSES "booked by another" and "held". The denylist
 * forbids revealing the holder, so this renders ONE thing: no tooltip, no colour
 * split, no aria-label distinguishing them, no per-holder attribute. Every slot
 * carries only its state and its time.
 *
 * The facility state banner sits above the grid: a CLOSED facility shows its
 * state, never an empty grid (which would read "fully booked"). This grid only
 * renders for an OPEN facility the corpus supplies slots for (function-room).
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { formatSlotRange } from '../format/datetime.ts';
import { FacilityStatePill } from './FacilityStatePill.tsx';
import type { AvailabilityView } from '../data/types.ts';

export function SlotGrid({ view, locale }: { view: AvailabilityView; locale: Locale }) {
  const A = MESSAGES.booking.availability;
  const label = (state: string) => t(MESSAGES.booking.slotState[state as 'available'], locale);
  const available = view.slots.filter((s) => s.state === 'available');

  return (
    <section className="pemo-availability" data-testid="availability" data-view={view.view}>
      <h3 className="pemo-availability__heading">{t(A.heading, locale)}</h3>
      <FacilityStatePill state={view.facilityState} locale={locale} />

      {/* Only the `day` view is fixtured; week/month are deferred (Finding C). */}
      <p className="pemo-availability__note">{t(A.viewDeferred, locale)}</p>

      <div className="pemo-slotgrid" role="group" aria-label={t(A.gridLabel, locale)} data-testid="slot-grid">
        {view.slots.map((slot) => (
          <div
            key={slot.startsAt}
            className={`pemo-slot pemo-slot--${slot.state}`}
            data-testid="slot"
            data-state={slot.state}
          >
            <span className="pemo-slot__time">{formatSlotRange(slot.startsAt, slot.endsAt, locale)}</span>
            <span className="pemo-slot__state">{label(slot.state)}</span>
          </div>
        ))}
      </div>

      {/* The list alternative — available times only, for keyboard/screen-reader use. */}
      <div className="pemo-availability__list" data-testid="slot-list">
        <h4 className="pemo-availability__list-heading">{t(A.listHeading, locale)}</h4>
        <ul>
          {available.map((s) => (
            <li key={s.startsAt}>{formatSlotRange(s.startsAt, s.endsAt, locale)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
