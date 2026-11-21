/**
 * The count badge — a PRIMITIVE whose value is data this PID does not render.
 *
 * The export shows counts (My bookings 2, Notifications 3). The count is data,
 * and this PID renders none, so the badge carries no number. What it DOES carry
 * is the export's space-reservation rule: an absent badge reserves its space so
 * rows do not shift when a count later arrives. That behaviour is the part of
 * the badge that is not data, so it is the part that is built now.
 *
 * Amber ground (brand.accent) with brand.deep text — brand.accent is on-brand
 * only and never text on a light surface (2.21:1). Here it is a ground on the
 * sidebar's deep field, which is its permitted position.
 */

export function Badge({ present }: { present: boolean }) {
  // Reserve the slot whether or not a count exists, so rows do not shift. The
  // zero-width space keeps the box's height without asserting a count of zero.
  return (
    <span
      className={`pemo-badge${present ? ' pemo-badge--reserved' : ''}`}
      data-testid="badge-slot"
      aria-hidden="true"
    >
      {'​'}
    </span>
  );
}
