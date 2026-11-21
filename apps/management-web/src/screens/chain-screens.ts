/**
 * Which routes belong to the pop-up chain (list under a detail pop-up). Kept apart from ChainHost.tsx so the app
 * shell can ask "is this a chain route?" without loading the pop-up host and its screens.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) Split out of ChainHost.tsx (initial-bundle work); ChainHost re-exports these.
 */

import type { ScreenId } from '../data/states.ts';

/** Detail route -> the list that sits under it when it is opened first. */
export const CHAIN_LIST_OF: Partial<Record<ScreenId, ScreenId>> = {
  chargesDetail: 'charges',
  paymentsDetail: 'payments',
  refundsDetail: 'refunds',
  householdsDetail: 'households',
  residentsDetail: 'residents',
  bookingFacilitiesDetail: 'bookingFacilities',
  helpdeskDetail: 'helpdesk',
  adminUsersDetail: 'adminUsers',
  adminGroupsDetail: 'adminGroups',
};
export const CHAIN_LISTS: ScreenId[] = ['charges', 'payments', 'refunds', 'households', 'residents', 'bookingFacilities', 'helpdesk', 'adminUsers', 'adminGroups'];
/** The state id each list screen is rendered with. */
export const CHAIN_LIST_STATE: Record<string, string> = {
  charges: 'default', payments: 'default', refunds: 'default', households: 'list', residents: 'list',
  bookingFacilities: 'default', helpdesk: 'queue', adminUsers: 'list', adminGroups: 'list',
};

export function isChainScreen(screen: ScreenId): boolean {
  return screen in CHAIN_LIST_OF || CHAIN_LISTS.includes(screen);
}
