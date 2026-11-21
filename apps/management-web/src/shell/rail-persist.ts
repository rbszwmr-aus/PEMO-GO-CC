/**
 * Open/closed state for the two staff rails.
 *
 * Carried on the URL (same as every other staff-shell fact). The client
 * forbids localStorage / sessionStorage / cookies — those APIs are the
 * credential-storage guard's needles. Absent params mean both rails are open.
 */

export const NAV_COLLAPSED_PARAM = 'nav';
export const SCOPE_COLLAPSED_PARAM = 'scopeRail';
export const COLLAPSED_VALUE = 'collapsed';

export function readRailCollapsed(params: URLSearchParams, key: string): boolean {
  return params.get(key) === COLLAPSED_VALUE;
}

export function writeRailCollapsed(params: URLSearchParams, key: string, collapsed: boolean): void {
  if (collapsed) params.set(key, COLLAPSED_VALUE);
  else params.delete(key);
}
