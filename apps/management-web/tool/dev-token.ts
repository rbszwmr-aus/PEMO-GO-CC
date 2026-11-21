/**
 * Development-stub token, minted the same way apps/api's stub mints one.
 *
 * Not an identity provider. The algorithm matches createDevAuthStub: HMAC-SHA256
 * over a base64url payload with marker `pemo-dev`. Staff subjects are namespaced
 * `staff:` so a resident token cannot be one. Used to open the live screen on
 * amd128 and to drive the live tests — never shipped as a login.
 */

import { createHmac } from 'node:crypto';

const MARKER = 'pemo-dev';

export const DEMO_STAFF_PRINCIPAL = 'stf_wfg_manager';
export const DEMO_RESIDENT_ID = 'res_wfg_000412';

export function mintDevToken(secret: string, subject: string, issuedAt = new Date()): string {
  const claims = { marker: MARKER, residentId: subject, issuedAt: issuedAt.toISOString() };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function mintStaffToken(secret: string, principalId = DEMO_STAFF_PRINCIPAL): string {
  return mintDevToken(secret, `staff:${principalId}`);
}

export function mintResidentToken(secret: string, residentId = DEMO_RESIDENT_ID): string {
  return mintDevToken(secret, residentId);
}
