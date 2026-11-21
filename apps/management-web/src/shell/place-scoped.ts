/**
 * Whether the properties / SCOPE tree rail belongs on this screen.
 *
 * The rail is place-chrome: it only mounts where estate → building → unit
 * filtering applies. Hidden screens reclaim the column (no empty gap). The
 * URL still carries `at=` so coming back restores the prior pick.
 *
 * Properties (s3) is not listed: it is the tree, with its own Locations panel and detail pane,
 * exactly as in the reference, so a second tree beside it would only duplicate it.
 */

import type { NavItemId } from '../data/nav-ia.ts';
import type { ScreenId } from '../data/states.ts';

/** Wired screens whose rows already carry a location (or are the tree itself). */
const PLACE_SCOPED_SCREENS: ReadonlySet<ScreenId> = new Set([
  's1', // Home Safety — events at unit/building
  's2', // Overview of the granted estate
  's4', // Cases carry scope
  's5',
  's5detail',
  's5ack',
  's5compose',
  's5act',
  'visitorLog',
  'visitorRegister',
  'residents',
  'residentsDetail',
  'households',
  'householdsDetail',
  'helpdesk',
  'helpdeskDetail',
  'bookings',
  'bookingsDetail',
  'bookingCalendar',
  'bookingCheckin',
  'bookingFacilities',
  'bookingFacilitiesDetail',
  'bookingRates',
  'charges',
  'chargesDetail',
  'payments',
  'paymentsDetail',
  'refunds',
  'refundsDetail',
  'documents',
  'documentsDetail',
  'carPark',
]);

/**
 * Coming-soon nav targets that are still place-scoped.
 * Car Park is now a wired connector and lives in PLACE_SCOPED_SCREENS; the
 * nav id stays here so a leftover stub URL still shows the rail.
 */
const PLACE_SCOPED_NAV: ReadonlySet<NavItemId> = new Set(['bs-carpark']);

export function isPlaceScopedRail(screen: ScreenId | 'stub', navId: string): boolean {
  if (screen !== 'stub') return PLACE_SCOPED_SCREENS.has(screen);
  return PLACE_SCOPED_NAV.has(navId as NavItemId);
}
