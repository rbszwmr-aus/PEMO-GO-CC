/**
 * QR visitor pass: parsing and display derivation.
 *
 * Shape: docs/contracts/qr-pass-service-v0-impl-notes.md (the object returned by
 * GET /api/qr-pass/v0/passes/{id}); the resident-portal visitor responses embed it
 * as `visitor.pass`, or null. Field names stay snake_case exactly as the API sends
 * them. Pure: no Vite aliases, so node:test imports it directly.
 */

export type PassApiStatus = 'active' | 'revoked' | 'expired';
/** Display-only. `used` is derived here; the API never sends it. */
export type PassDisplayStatus = PassApiStatus | 'used';

export interface VisitorPassQr {
  payload: string;
  mode: string;
  ecc: string;
  min_version: number;
}

export interface VisitorPass {
  pass_id: string;
  jti: string;
  kid: string;
  purpose: string;
  not_before: string;
  expires_at: string;
  use_limit: number;
  qr: VisitorPassQr;
  module: string;
  subject_ref: string;
  module_ref: string;
  status: PassApiStatus;
  issued_at: string;
  uses_seen: number;
  uses_remaining: number | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

const API_STATUSES: readonly string[] = ['active', 'revoked', 'expired'];
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Parse `visitor.pass`. Missing, null, or unusable (no pass id or no QR payload)
 * is null, which the screens show as "No pass issued". An unrecognised status is
 * treated as `expired`, never as valid.
 */
export function asVisitorPass(raw: unknown): VisitorPass | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const qr = o.qr && typeof o.qr === 'object' ? (o.qr as Record<string, unknown>) : {};
  const passId = str(o.pass_id);
  const payload = str(qr.payload);
  if (!passId || !payload) return null;
  const statusRaw = str(o.status);
  return {
    pass_id: passId,
    jti: str(o.jti),
    kid: str(o.kid),
    purpose: str(o.purpose),
    not_before: str(o.not_before),
    expires_at: str(o.expires_at),
    use_limit: num(o.use_limit, 0),
    qr: {
      payload,
      mode: str(qr.mode) || 'alphanumeric',
      ecc: str(qr.ecc) || 'M',
      min_version: num(qr.min_version, 1),
    },
    module: str(o.module),
    subject_ref: str(o.subject_ref),
    module_ref: str(o.module_ref),
    status: API_STATUSES.includes(statusRaw) ? (statusRaw as PassApiStatus) : 'expired',
    issued_at: str(o.issued_at),
    uses_seen: num(o.uses_seen, 0),
    uses_remaining: typeof o.uses_remaining === 'number' ? o.uses_remaining : null,
    revoked_at: strOrNull(o.revoked_at),
    revocation_reason: strOrNull(o.revocation_reason),
  };
}

/**
 * What the pill shows. `used` when every use is consumed and the pass is not
 * revoked. Display-only: the API keeps a used-up pass `active` and the detail
 * shows that raw status next to the pill. use_limit 0 means unlimited, so it is
 * never `used`.
 */
export function passDisplayStatus(
  p: Pick<VisitorPass, 'status' | 'uses_seen' | 'use_limit'>,
): PassDisplayStatus {
  if (p.status === 'revoked') return 'revoked';
  if (p.use_limit > 0 && p.uses_seen >= p.use_limit) return 'used';
  return p.status;
}

/** Deep link to this visitor's detail in the portal (the copy-only share). */
export function visitorDetailLink(base: string, visitorId: string, lang: string): string {
  const q = new URLSearchParams({ service: 'visitor', tab: 'detail', visitor: visitorId, lang });
  return `${base}?${q.toString()}`;
}

/** `{name}` placeholders. Unknown names stay as written. */
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}