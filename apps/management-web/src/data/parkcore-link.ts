/**
 * ParkCore operator console — a standalone (or bundled) parking + Octopus
 * console on :5177. PEMO management-web stays on :5175 and only LINKS out.
 *
 * HARD ISOLATION: do not embed ParkCore UI, do not clone the ParkCore app
 * into this tree, and do not proxy its routes. The connector opens a new tab.
 */

export const PARKCORE_ORIGIN = 'http://localhost:5177';

/** Documented LAN stand-in. Replace the host when ParkCore is not on this machine. */
export const PARKCORE_LAN_ORIGIN_PLACEHOLDER = 'http://<lan-host>:5177/';

export const PARKCORE_PATHS = {
  console: '/',
  counter: '/counter',
  lists: '/lists',
  ssoCallback: '/sso/callback',
} as const;

export type ParkCorePath = (typeof PARKCORE_PATHS)[keyof typeof PARKCORE_PATHS];

/** Fixture one-time code. Not a live OIDC grant. */
export const PARKCORE_SSO_STUB_CODE = 'fixture-otc';

export function parkcoreHref(path: ParkCorePath = PARKCORE_PATHS.console): string {
  if (path === '/') return `${PARKCORE_ORIGIN}/`;
  return `${PARKCORE_ORIGIN}${path}`;
}

/**
 * Dual-buy SSO handoff stub: callback URL carrying a one-time code, as the
 * platform contract describes. Still opens ParkCore on :5177 in a new tab.
 * No real issuer, no JWKS verify, no embed.
 */
export function parkcoreSsoStubHref(): string {
  const url = new URL(parkcoreHref(PARKCORE_PATHS.ssoCallback));
  url.searchParams.set('code', PARKCORE_SSO_STUB_CODE);
  url.searchParams.set('aud', 'parkcore');
  return url.toString();
}
