/**
 * Shared QR Pass Service v0 (FROZEN 0.1.0) — demo types.
 * Contract: docs/contracts/qr-pass-service-v0.md. Wire/API field names are the
 * contract's (snake_case); this demo implements VISITOR_ACCESS only.
 */

export const QR_PREFIX = 'QP1:';
export const FORMAT_VERSION = 1;
/** D7 — ±120 s. */
export const SKEW_SECONDS = 120;
/** D5 — readers are stale after 600 s. */
export const MAX_STALE_SECONDS = 600;
/** D6 — VISITOR_ACCESS default u = 2, max lifetime 7 days. */
export const VISITOR_ACCESS_DEFAULT_USE_LIMIT = 2;
export const VISITOR_ACCESS_MAX_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const DEMO_MODULE = 'pemo';

/** Shared purpose registry (D4): platform purpose -> short wire code (§3.3). */
export const PURPOSE_WIRE_CODES = { VISITOR_ACCESS: 'VA', PAYMENT: 'PAY' } as const;
export type RegisteredPurpose = keyof typeof PURPOSE_WIRE_CODES;
/** Purposes this demo can issue. */
export type Purpose = 'VISITOR_ACCESS';

/** §5.4 `result` enum — the pass verification result, not the access decision. */
export const SCAN_RESULTS = [
  'ACCEPTED',
  'REJECTED_EXPIRED',
  'REJECTED_NOT_YET_VALID',
  'REJECTED_REVOKED',
  'REJECTED_REPLAY',
  'REJECTED_USE_LIMIT',
  'REJECTED_SIGNATURE',
  'UNKNOWN_KEY',
] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];

/** GET /passes/{id} status vocabulary (§5 table: active / revoked / expired). */
export type PassStatus = 'active' | 'revoked' | 'expired';

/** §6.4-style render hint returned with every pass (§5.1 `qr`). */
export interface QrHint {
  readonly payload: string;
  readonly mode: 'alphanumeric';
  readonly ecc: 'M';
  readonly min_version: number;
}

/** §5.1 issue `201` body, exactly. */
export interface IssueResponse {
  readonly pass_id: string;
  readonly jti: string;
  readonly kid: string;
  readonly purpose: Purpose;
  readonly not_before: string;
  readonly expires_at: string;
  readonly use_limit: number;
  readonly qr: QrHint;
}

/** GET /passes/{id} body (contract names the content, not the shape — see impl notes). */
export interface PassView extends IssueResponse {
  readonly module: string;
  readonly subject_ref: string;
  readonly module_ref: string | null;
  readonly status: PassStatus;
  readonly issued_at: string;
  readonly uses_seen: number;
  /** null when use_limit = 0 (unlimited). */
  readonly uses_remaining: number | null;
  readonly revoked_at: string | null;
  readonly revocation_reason: string | null;
}

/** §5.2 revoke `200` body. */
export interface RevokeResponse {
  readonly pass_id: string;
  readonly revoked_at: string;
  readonly revocation_list_version: number;
}

/** §5.4 scan record. */
export interface ScanRecord {
  readonly scan_id: string;
  readonly device_id: string;
  readonly location_ref: string | null;
  readonly pass_id: string | null;
  readonly jti: string | null;
  readonly kid: string | null;
  readonly purpose: string | null;
  readonly result: ScanResult;
  readonly scanned_at: string;
  readonly received_at: string;
  readonly offline: boolean;
  readonly revocation_list_version: number;
  readonly revocation_stale: boolean;
  readonly module_decision_ref: string | null;
}

/** JSON view of the signed claims (§3.3) — only returned after the signature verified. */
export interface PassClaims {
  readonly v: number;
  readonly p: string;
  readonly m: string;
  readonly s: string;
  readonly i: string;
  readonly j: string;
  readonly nbf: number | null;
  readonly exp: number;
  readonly u: number;
  readonly r: string | null;
}

export interface ScanOutcome {
  readonly scan: ScanRecord;
  readonly claims: PassClaims | null;
  readonly pass: Pick<PassView, 'pass_id' | 'status' | 'use_limit' | 'uses_seen' | 'uses_remaining' | 'subject_ref' | 'module_ref'> | null;
}

/** §5.3 decoded revocation list payload. */
export interface RevocationList {
  readonly list_version: number;
  readonly cursor: string;
  readonly full: boolean;
  readonly since: string | null;
  readonly issued_at: string;
  readonly max_stale_seconds: number;
  readonly revoked: readonly { readonly pass_id: string; readonly exp: number; readonly revoked_at: string }[];
  readonly revoked_kids: readonly string[];
  readonly pruned: readonly string[];
}

/** §5.5 event envelope. */
export type QrPassEventType = 'pass.issued' | 'pass.revoked' | 'pass.scanned';
export interface QrPassEvent {
  readonly id: string;
  readonly type: QrPassEventType;
  readonly occurred_at: string;
  readonly module: string;
  readonly data: Record<string, unknown>;
}

/** §5.6 problem (type suffix; routes render the full RFC 9457 body). */
export type ProblemSuffix =
  | 'invalid-request'
  | 'purpose-unknown'
  | 'unauthorized'
  | 'forbidden-module'
  | 'pass-not-found'
  | 'idempotency-conflict'
  | 'use-limit-reached'
  | 'cursor-expired'
  | 'rate-limited';

export interface QrPassProblem {
  readonly suffix: ProblemSuffix;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: QrPassProblem };

/** JWKS entry (RFC 7517 / RFC 8037), §4. */
export interface PassJwk {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
  readonly kid: string;
  readonly use: 'sig';
  readonly alg: 'EdDSA';
  readonly nbf: number;
}
