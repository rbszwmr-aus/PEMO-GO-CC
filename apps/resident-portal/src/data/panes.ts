/**
 * Which states a content pane can be in, and the default.
 *
 * The two booking data panes (Explore and Facility detail, under the `search`
 * service) carry the fixture-backed states plus the generic client states that
 * apply everywhere (loading / denied / offline). Every other pane carries only
 * the generic UI-028 states. Making each state URL-addressable is what keeps the
 * state matrix cheap to test — a state is constructed, never driven to.
 */

import { PANE_STATES } from './states.ts';
import { EXPLORE_STATE_IDS, FACILITY_STATE_IDS } from './booking.ts';

/** Client states that apply to a data pane regardless of fixtures. */
const GENERIC_ON_DATA = ['loading', 'denied', 'offline'] as const;

export function isBookingPane(service: string, tab: string): 'explore' | 'facility' | null {
  if (service !== 'search') return null;
  if (tab === 'explore') return 'explore';
  if (tab === 'detail') return 'facility';
  return null;
}

export function paneStatesFor(service: string, tab: string): string[] {
  const kind = isBookingPane(service, tab);
  if (kind === 'explore') return [...EXPLORE_STATE_IDS, ...GENERIC_ON_DATA];
  if (kind === 'facility') return [...FACILITY_STATE_IDS, ...GENERIC_ON_DATA];
  return [...PANE_STATES];
}

export function defaultStateFor(service: string, tab: string): string {
  const kind = isBookingPane(service, tab);
  if (kind === 'explore') return 'default';
  if (kind === 'facility') return 'policy-absent';
  return 'empty';
}
