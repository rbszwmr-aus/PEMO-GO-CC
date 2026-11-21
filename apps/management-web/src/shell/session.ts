/**
 * Fixture-first staff session. Carried on the URL like every other shell fact.
 *
 * Absent `session` means signed in as the demo account (Alex Chen). Log out
 * writes `session=signed-out` and clears any live token stub. Sign in
 * (fixture) deletes the param — no localStorage / sessionStorage / cookies,
 * and no real SSO.
 */

export const SESSION_PARAM = 'session';
export const SESSION_SIGNED_OUT = 'signed-out';

export function readSignedIn(params: URLSearchParams): boolean {
  return params.get(SESSION_PARAM) !== SESSION_SIGNED_OUT;
}

export function writeSession(params: URLSearchParams, signedIn: boolean): void {
  if (signedIn) params.delete(SESSION_PARAM);
  else params.set(SESSION_PARAM, SESSION_SIGNED_OUT);
}
