/**
 * In-memory Shared QR Pass Service v0 demo (VISITOR_ACCESS only).
 * Contract: docs/contracts/qr-pass-service-v0.md (FROZEN 0.1.0).
 * Impl notes: docs/contracts/qr-pass-service-v0-impl-notes.md.
 *
 * - Pass = "QP1:" + base45(COSE_Sign1(CWT claims)), no compression (D1), Ed25519 (D2).
 * - Signing key is generated in memory at construction: kid + key change per process restart.
 * - Online use consume is globally exact (§7); events go to an in-memory outbox (§5.5).
 */

import { createHash, generateKeyPairSync, randomInt, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { Base45Error, base45Decode, base45Encode } from './base45.js';
import { CborError, cborDecode, cborEncode, type CborKey, type CborValue } from './cbor.js';
import { coseSign1, parseCoseSign1, verifyCoseSign1 } from './cose.js';
import {
  DEMO_MODULE,
  FORMAT_VERSION,
  MAX_STALE_SECONDS,
  PURPOSE_WIRE_CODES,
  QR_PREFIX,
  SKEW_SECONDS,
  VISITOR_ACCESS_DEFAULT_USE_LIMIT,
  VISITOR_ACCESS_MAX_LIFETIME_SECONDS,
  type IssueResponse,
  type PassClaims,
  type PassJwk,
  type PassStatus,
  type PassView,
  type Purpose,
  type QrHint,
  type QrPassEvent,
  type QrPassEventType,
  type QrPassProblem,
  type Result,
  type RevocationList,
  type RevokeResponse,
  type ScanOutcome,
  type ScanRecord,
  type ScanResult,
} from './types.js';

// ------------------------------------------------------------------ helpers

/**
 * CWT claim keys. sub/cti/nbf/exp use the registered RFC 8392 labels (§3.1).
 * The contract marks v/p/m/i/u/r as "private" without assigning numbers, so the
 * demo carries them as CWT text-string claim names equal to the contract's
 * compact keys (RFC 8392 §3 allows text claim keys). See impl notes §Ambiguities.
 */
export const CLAIM = { v: 'v', p: 'p', m: 'm', sub: 2, i: 'i', cti: 7, nbf: 5, exp: 4, u: 'u', r: 'r' } as const;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const randomFrom = (alphabet: string, n: number): string => {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[randomInt(alphabet.length)]!;
  return s;
};
export const newPassId = (): string => `qp_${randomFrom(CROCKFORD, 8)}`;
export const newJti = (): string => randomFrom(BASE62, 8);
const newScanId = (): string => `scn_${randomFrom(CROCKFORD, 16)}`;
const newEventId = (): string => `evt_${randomFrom(CROCKFORD, 16)}`;

/** RFC 3339 UTC, whole seconds (contract examples use `…Z`). */
export const isoSeconds = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const isoNowOf = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const epoch = (d: Date): number => Math.floor(d.getTime() / 1000);

/** Accept RFC 3339 strings (contract) — also Date / epoch seconds for in-process callers. */
const parseInstant = (value: unknown): number | undefined => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : epoch(value);
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value.trim())) return undefined;
  const ms = Date.parse(value.trim());
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
};

/** ISO/IEC 18004 alphanumeric capacity at ECC M, versions 1..20. */
const ALNUM_M = [20, 38, 61, 90, 122, 154, 178, 221, 262, 311, 366, 419, 483, 528, 600, 656, 734, 816, 909, 970];
export const minQrVersionAlnumM = (chars: number): number => {
  const idx = ALNUM_M.findIndex((cap) => chars <= cap);
  return idx === -1 ? 40 : idx + 1;
};

const b64url = (b: Uint8Array | string): string => Buffer.from(b).toString('base64url');
const OPAQUE_REF = /^[A-Za-z0-9_.:\-]{1,64}$/;
const REASON = /^[a-z0-9_.\-]{1,40}$/;

const problem = (suffix: QrPassProblem['suffix'], status: number, title: string, detail: string): QrPassProblem =>
  ({ suffix, status, title, detail });
const invalid = (detail: string): { ok: false; problem: QrPassProblem } =>
  ({ ok: false, problem: problem('invalid-request', 400, 'Invalid request', detail) });

// ------------------------------------------------------------------ records

interface PassRecord {
  readonly passId: string;
  readonly jti: string;
  readonly kid: string;
  readonly purpose: Purpose;
  readonly module: string;
  readonly subjectRef: string;
  readonly moduleRef: string | null;
  readonly nbf: number;
  readonly exp: number;
  readonly useLimit: number;
  readonly issuedAt: number;
  readonly payload: string;
  usesSeen: number;
  revokedAt: number | null;
  revocationReason: string | null;
  revocationListVersion: number | null;
}

interface SigningKey {
  readonly kid: string;
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
  readonly createdAt: number;
}

export interface IssueInput {
  readonly purpose?: unknown;
  readonly subject_ref?: unknown;
  readonly not_before?: unknown;
  readonly expires_at?: unknown;
  readonly use_limit?: unknown;
  readonly module_ref?: unknown;
}

export interface IssueOptions {
  /** From the caller's credential, never the body (§5.1). Default `pemo`. */
  readonly module?: string;
  readonly idempotencyKey?: string;
  /**
   * In-process issuers (the visitor hook) may ask the service to CAP exp at
   * nbf + max lifetime instead of rejecting (HTTP callers get §5.6 400).
   */
  readonly clampLifetime?: boolean;
}

export interface ScanInput {
  /** The scanned QR string (`QP1:…`). */
  readonly payload?: unknown;
  /** Path pass id for `POST /passes/{pass_id}/uses`. */
  readonly passId?: string;
  readonly device_id?: unknown;
  readonly location_ref?: unknown;
  readonly module_decision_ref?: unknown;
}

export interface ScanQuery {
  readonly module: string;
  readonly pass_id?: string;
  readonly result?: string;
  readonly from?: string;
  readonly to?: string;
  readonly device_id?: string;
}

export interface QrPassStoreOptions {
  readonly now?: () => Date;
  readonly kid?: string;
}

export interface QrPassStore {
  readonly kid: string;
  issue(input: IssueInput, opts?: IssueOptions): Result<{ response: IssueResponse; replayed: boolean }>;
  get(passId: string, module?: string): Result<PassView>;
  findByModuleRef(moduleRef: string, module?: string): PassView | null;
  revoke(passId: string, reason: unknown, module?: string): Result<RevokeResponse>;
  scan(input: ScanInput): Result<ScanOutcome>;
  jwks(): { keys: PassJwk[] };
  revocations(since?: string): Result<{ jws: string; list: RevocationList }>;
  scans(query: ScanQuery): { records: ScanRecord[]; next_cursor: string | null };
  outbox(filter?: { type?: string; pass_id?: string }): QrPassEvent[];
}

// ------------------------------------------------------------------ store

export const createQrPassStore = (options: QrPassStoreOptions = {}): QrPassStore => {
  const now = options.now ?? (() => new Date());
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const key: SigningKey = {
    kid: options.kid ?? `k${randomFrom(CROCKFORD, 5)}`,
    privateKey,
    publicKey,
    createdAt: epoch(now()),
  };
  const keys = new Map<string, SigningKey>([[key.kid, key]]);
  const revokedKids = new Set<string>();

  const passes = new Map<string, PassRecord>();
  const idempotency = new Map<string, { hash: string; passId: string }>();
  const scanLog: ScanRecord[] = [];
  const events: QrPassEvent[] = [];
  let listVersion = 0;

  const emit = (type: QrPassEventType, module: string, data: Record<string, unknown>): void => {
    events.push({ id: newEventId(), type, occurred_at: isoNowOf(now()), module, data });
  };

  const qrHint = (payload: string): QrHint =>
    ({ payload, mode: 'alphanumeric', ecc: 'M', min_version: minQrVersionAlnumM(payload.length) });

  const issueResponse = (r: PassRecord): IssueResponse => ({
    pass_id: r.passId,
    jti: r.jti,
    kid: r.kid,
    purpose: r.purpose,
    not_before: isoSeconds(r.nbf),
    expires_at: isoSeconds(r.exp),
    use_limit: r.useLimit,
    qr: qrHint(r.payload),
  });

  const statusOf = (r: PassRecord): PassStatus =>
    r.revokedAt !== null ? 'revoked' : epoch(now()) > r.exp ? 'expired' : 'active';

  const usesRemaining = (r: PassRecord): number | null =>
    r.useLimit === 0 ? null : Math.max(0, r.useLimit - r.usesSeen);

  const view = (r: PassRecord): PassView => ({
    ...issueResponse(r),
    module: r.module,
    subject_ref: r.subjectRef,
    module_ref: r.moduleRef,
    status: statusOf(r),
    issued_at: isoSeconds(r.issuedAt),
    uses_seen: r.usesSeen,
    uses_remaining: usesRemaining(r),
    revoked_at: r.revokedAt === null ? null : isoSeconds(r.revokedAt),
    revocation_reason: r.revocationReason,
  });

  const signPass = (r: Omit<PassRecord, 'payload' | 'usesSeen' | 'revokedAt' | 'revocationReason' | 'revocationListVersion'>): string => {
    const claims = new Map<CborKey, CborValue>([
      [CLAIM.v, FORMAT_VERSION],
      [CLAIM.p, PURPOSE_WIRE_CODES[r.purpose]],
      [CLAIM.m, r.module],
      [CLAIM.sub, r.subjectRef],
      [CLAIM.i, r.passId],
      [CLAIM.cti, new TextEncoder().encode(r.jti)],
      [CLAIM.nbf, r.nbf],
      [CLAIM.exp, r.exp],
      [CLAIM.u, r.useLimit],
    ]);
    if (r.moduleRef !== null) claims.set(CLAIM.r, r.moduleRef);
    return QR_PREFIX + base45Encode(coseSign1(cborEncode(claims), key.kid, key.privateKey));
  };

  const decodeClaims = (payload: Uint8Array): PassClaims => {
    const map = cborDecode(payload);
    if (!(map instanceof Map)) throw new CborError('claims must be a map');
    const str = (k: CborKey, optional = false): string | null => {
      const v = map.get(k);
      if (v === undefined && optional) return null;
      if (typeof v !== 'string') throw new CborError(`claim ${String(k)} must be text`);
      return v;
    };
    const int = (k: CborKey, optional = false): number | null => {
      const v = map.get(k);
      if (v === undefined && optional) return null;
      if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new CborError(`claim ${String(k)} must be int`);
      return v;
    };
    const cti = map.get(CLAIM.cti);
    const j = cti instanceof Uint8Array ? new TextDecoder('utf-8', { fatal: true }).decode(cti)
      : typeof cti === 'string' ? cti : undefined;
    if (j === undefined) throw new CborError('claim cti missing');
    const claims: PassClaims = {
      v: int(CLAIM.v)!, p: str(CLAIM.p)!, m: str(CLAIM.m)!, s: str(CLAIM.sub)!, i: str(CLAIM.i)!, j,
      nbf: int(CLAIM.nbf, true), exp: int(CLAIM.exp)!, u: int(CLAIM.u)!, r: str(CLAIM.r, true),
    };
    if (claims.v !== FORMAT_VERSION) throw new CborError(`unsupported format version ${claims.v}`);
    if (claims.u < 0) throw new CborError('use limit must be >= 0');
    return claims;
  };

  const claimsOf = (r: PassRecord): PassClaims => ({
    v: FORMAT_VERSION, p: PURPOSE_WIRE_CODES[r.purpose], m: r.module, s: r.subjectRef, i: r.passId,
    j: r.jti, nbf: r.nbf, exp: r.exp, u: r.useLimit, r: r.moduleRef,
  });

  const purposeFromWire = (code: string): string =>
    (Object.entries(PURPOSE_WIRE_CODES).find(([, c]) => c === code)?.[0]) ?? code;

  const signJws = (payload: object): string => {
    const h = b64url(JSON.stringify({ alg: 'EdDSA', kid: key.kid }));
    const p = b64url(JSON.stringify(payload));
    const sig = cryptoSign(null, Buffer.from(`${h}.${p}`, 'ascii'), key.privateKey);
    return `${h}.${p}.${b64url(sig)}`;
  };

  const ownedPass = (passId: string, module: string): Result<PassRecord> => {
    const r = passes.get(passId);
    if (!r) return { ok: false, problem: problem('pass-not-found', 404, 'Pass not found', `pass ${passId} does not exist`) };
    if (r.module !== module) {
      return { ok: false, problem: problem('forbidden-module', 403, 'Forbidden', `pass ${passId} belongs to another module`) };
    }
    return { ok: true, value: r };
  };

  return {
    kid: key.kid,

    issue(input, opts = {}) {
      const module = opts.module ?? DEMO_MODULE;
      const hash = createHash('sha256').update(JSON.stringify([
        input.purpose, input.subject_ref, input.not_before ?? null, input.expires_at, input.use_limit ?? null, input.module_ref ?? null,
      ])).digest('hex');
      const idemKey = opts.idempotencyKey !== undefined ? `${module}\u0000${opts.idempotencyKey}` : undefined;
      if (idemKey !== undefined) {
        const seen = idempotency.get(idemKey);
        if (seen) {
          if (seen.hash !== hash) {
            return { ok: false, problem: problem('idempotency-conflict', 409, 'Idempotency conflict', 'Idempotency-Key was already used with a different body') };
          }
          return { ok: true, value: { response: issueResponse(passes.get(seen.passId)!), replayed: true } };
        }
      }

      if (typeof input.purpose !== 'string' || input.purpose.length === 0) return invalid('purpose is required');
      if (input.purpose !== 'VISITOR_ACCESS') {
        const registered = Object.hasOwn(PURPOSE_WIRE_CODES, input.purpose);
        return {
          ok: false,
          problem: problem('purpose-unknown', 400, 'Unknown purpose', registered
            ? `purpose ${input.purpose} is not allowed for this module (demo issues VISITOR_ACCESS only)`
            : `purpose ${input.purpose} is not registered`),
        };
      }
      const purpose: Purpose = 'VISITOR_ACCESS';
      if (typeof input.subject_ref !== 'string' || !OPAQUE_REF.test(input.subject_ref)) {
        return invalid('subject_ref is required: opaque ref, 1-64 chars [A-Za-z0-9_.:-], no PII');
      }
      const nowS = epoch(now());
      const nbf = input.not_before === undefined || input.not_before === null ? nowS : parseInstant(input.not_before);
      if (nbf === undefined) return invalid('not_before must be an RFC 3339 timestamp with offset');
      if (input.expires_at === undefined || input.expires_at === null) return invalid('expires_at is required');
      let exp = parseInstant(input.expires_at);
      if (exp === undefined) return invalid('expires_at must be an RFC 3339 timestamp with offset');
      if (exp <= nbf) return invalid('expires_at must be after not_before');
      if (exp - nbf > VISITOR_ACCESS_MAX_LIFETIME_SECONDS) {
        if (!opts.clampLifetime) return invalid('lifetime exceeds the VISITOR_ACCESS maximum of 7 days (D6)');
        exp = nbf + VISITOR_ACCESS_MAX_LIFETIME_SECONDS;
      }
      let useLimit = VISITOR_ACCESS_DEFAULT_USE_LIMIT;
      if (input.use_limit !== undefined && input.use_limit !== null) {
        if (typeof input.use_limit !== 'number' || !Number.isInteger(input.use_limit) || input.use_limit < 0 || input.use_limit > 1000) {
          return invalid('use_limit must be an integer 0..1000 (0 = unlimited)');
        }
        useLimit = input.use_limit;
      }
      let moduleRef: string | null = null;
      if (input.module_ref !== undefined && input.module_ref !== null) {
        if (typeof input.module_ref !== 'string' || input.module_ref.length === 0 || input.module_ref.length > 200) {
          return invalid('module_ref must be a non-empty string (max 200) or null');
        }
        moduleRef = input.module_ref;
      }

      let passId = newPassId();
      while (passes.has(passId)) passId = newPassId();
      const base = { passId, jti: newJti(), kid: key.kid, purpose, module, subjectRef: input.subject_ref, moduleRef, nbf, exp, useLimit, issuedAt: nowS };
      const record: PassRecord = { ...base, payload: signPass(base), usesSeen: 0, revokedAt: null, revocationReason: null, revocationListVersion: null };
      passes.set(passId, record);
      if (idemKey !== undefined) idempotency.set(idemKey, { hash, passId });
      emit('pass.issued', module, {
        pass_id: record.passId, jti: record.jti, kid: record.kid, purpose: record.purpose, subject_ref: record.subjectRef,
        not_before: isoSeconds(record.nbf), expires_at: isoSeconds(record.exp), use_limit: record.useLimit,
      });
      return { ok: true, value: { response: issueResponse(record), replayed: false } };
    },

    get(passId, module = DEMO_MODULE) {
      const owned = ownedPass(passId, module);
      return owned.ok ? { ok: true, value: view(owned.value) } : owned;
    },

    findByModuleRef(moduleRef, module = DEMO_MODULE) {
      let latest: PassRecord | undefined;
      for (const r of passes.values()) if (r.moduleRef === moduleRef && r.module === module) latest = r;
      return latest ? view(latest) : null;
    },

    revoke(passId, reason, module = DEMO_MODULE) {
      const owned = ownedPass(passId, module);
      if (!owned.ok) return owned;
      const r = owned.value;
      if (r.revokedAt !== null) {
        return { ok: true, value: { pass_id: r.passId, revoked_at: isoSeconds(r.revokedAt), revocation_list_version: r.revocationListVersion! } };
      }
      const code = reason === undefined || reason === null ? 'unspecified' : reason;
      if (typeof code !== 'string' || !REASON.test(code)) return invalid('reason must be a short module code [a-z0-9_.-]{1,40} (no free text / PII)');
      listVersion += 1;
      r.revokedAt = epoch(now());
      r.revocationReason = code;
      r.revocationListVersion = listVersion;
      const body: RevokeResponse = { pass_id: r.passId, revoked_at: isoSeconds(r.revokedAt), revocation_list_version: listVersion };
      emit('pass.revoked', r.module, { pass_id: r.passId, reason: code, revoked_at: body.revoked_at, revocation_list_version: listVersion });
      return { ok: true, value: body };
    },

    scan(input) {
      const at = now();
      const nowS = epoch(at);
      const hasPayload = input.payload !== undefined && input.payload !== null;
      if (hasPayload && typeof input.payload !== 'string') return invalid('payload must be the scanned QR string');
      if (!hasPayload && input.passId === undefined) return invalid('payload is required');
      const optStr = (v: unknown, name: string): string | null | { error: string } => {
        if (v === undefined || v === null) return null;
        return typeof v === 'string' && v.length > 0 && v.length <= 120 ? v : { error: `${name} must be a string (1-120)` };
      };
      const device = optStr(input.device_id, 'device_id');
      const location = optStr(input.location_ref, 'location_ref');
      const decision = optStr(input.module_decision_ref, 'module_decision_ref');
      for (const v of [device, location, decision]) if (v !== null && typeof v === 'object') return invalid(v.error);

      let result: ScanResult | undefined;
      let claims: PassClaims | null = null;
      let kid: string | null = null;
      let record: PassRecord | undefined;

      if (hasPayload) {
        const payload = (input.payload as string).trim();
        try {
          if (!payload.startsWith(QR_PREFIX)) throw new CborError(`missing ${QR_PREFIX} prefix`);
          const parsed = parseCoseSign1(base45Decode(payload.slice(QR_PREFIX.length)));
          kid = parsed.kid;
          const k = keys.get(parsed.kid);
          if (!k) result = 'UNKNOWN_KEY';
          else if (revokedKids.has(parsed.kid)) result = 'REJECTED_REVOKED';
          else if (!verifyCoseSign1(parsed, k.publicKey)) result = 'REJECTED_SIGNATURE';
          else claims = decodeClaims(parsed.payload);
        } catch (e) {
          if (!(e instanceof CborError || e instanceof Base45Error || e instanceof TypeError)) throw e;
          result = 'REJECTED_SIGNATURE';
          claims = null;
        }
        if (claims !== null) {
          if (input.passId !== undefined && claims.i !== input.passId) {
            return invalid(`payload is for pass ${claims.i}, not ${input.passId}`);
          }
          record = passes.get(claims.i);
        }
      } else {
        const r = passes.get(input.passId!);
        if (!r) return { ok: false, problem: problem('pass-not-found', 404, 'Pass not found', `pass ${input.passId} does not exist`) };
        record = r;
        claims = claimsOf(r);
        kid = r.kid;
      }

      if (result === undefined && claims !== null) {
        if (claims.p !== PURPOSE_WIRE_CODES.VISITOR_ACCESS) result = 'REJECTED_SIGNATURE';
        else if (record?.revokedAt != null) result = 'REJECTED_REVOKED';
        else if (nowS > claims.exp + SKEW_SECONDS) result = 'REJECTED_EXPIRED';
        else if (claims.nbf !== null && nowS < claims.nbf - SKEW_SECONDS) result = 'REJECTED_NOT_YET_VALID';
        else if (!record) result = 'REJECTED_REVOKED'; // signed by us but unknown to this store: treat as withdrawn
        else if (claims.u === 1 && record.usesSeen >= 1) result = 'REJECTED_REPLAY';
        else if (claims.u > 1 && record.usesSeen >= claims.u) result = 'REJECTED_USE_LIMIT';
        else {
          record.usesSeen += 1;
          result = 'ACCEPTED';
        }
      }

      const trusted = claims !== null && result !== 'REJECTED_SIGNATURE';
      const scan: ScanRecord = {
        scan_id: newScanId(),
        device_id: (device as string | null) ?? 'pemo_demo_gate',
        location_ref: location as string | null,
        pass_id: trusted ? claims!.i : null,
        jti: trusted ? claims!.j : null,
        kid,
        purpose: trusted ? purposeFromWire(claims!.p) : null,
        result: result!,
        scanned_at: isoNowOf(at),
        received_at: isoNowOf(at),
        offline: false,
        revocation_list_version: listVersion,
        revocation_stale: false,
        module_decision_ref: decision as string | null,
      };
      scanLog.push(scan);
      if (record && trusted) emit('pass.scanned', record.module, { ...scan });
      const pv = record && trusted ? view(record) : null;
      return {
        ok: true,
        value: {
          scan,
          claims: trusted ? claims : null,
          pass: pv === null ? null : {
            pass_id: pv.pass_id, status: pv.status, use_limit: pv.use_limit, uses_seen: pv.uses_seen,
            uses_remaining: pv.uses_remaining, subject_ref: pv.subject_ref, module_ref: pv.module_ref,
          },
        },
      };
    },

    jwks() {
      const keysOut: PassJwk[] = [];
      for (const k of keys.values()) {
        if (revokedKids.has(k.kid)) continue;
        const jwk = k.publicKey.export({ format: 'jwk' }) as { x: string };
        keysOut.push({ kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid: k.kid, use: 'sig', alg: 'EdDSA', nbf: k.createdAt });
      }
      return { keys: keysOut };
    },

    revocations(since) {
      const nowS = epoch(now());
      let sinceVersion: number | null = null;
      if (since !== undefined) {
        const m = /^rl_(\d{1,9})$/.exec(since);
        if (!m) return invalid('since must be a cursor returned by a previous list (rl_<n>)');
        sinceVersion = Number(m[1]);
        if (sinceVersion > listVersion) {
          return { ok: false, problem: problem('cursor-expired', 410, 'Cursor expired', `cursor ${since} is not known; fetch a full snapshot`) };
        }
      }
      const revoked: { pass_id: string; exp: number; revoked_at: string }[] = [];
      const pruned: string[] = [];
      for (const r of passes.values()) {
        if (r.revokedAt === null || r.revocationListVersion === null) continue;
        const isPruned = nowS > r.exp + SKEW_SECONDS;
        if (sinceVersion === null) {
          if (!isPruned) revoked.push({ pass_id: r.passId, exp: r.exp, revoked_at: isoSeconds(r.revokedAt) });
        } else if (r.revocationListVersion > sinceVersion) {
          if (!isPruned) revoked.push({ pass_id: r.passId, exp: r.exp, revoked_at: isoSeconds(r.revokedAt) });
        } else if (isPruned) {
          pruned.push(r.passId);
        }
      }
      const list: RevocationList = {
        list_version: listVersion,
        cursor: `rl_${listVersion}`,
        full: sinceVersion === null,
        since: sinceVersion === null ? null : `rl_${sinceVersion}`,
        issued_at: isoNowOf(now()),
        max_stale_seconds: MAX_STALE_SECONDS,
        revoked,
        revoked_kids: [...revokedKids],
        pruned,
      };
      return { ok: true, value: { jws: signJws(list), list } };
    },

    scans(query) {
      const from = query.from !== undefined ? parseInstant(query.from) : undefined;
      const to = query.to !== undefined ? parseInstant(query.to) : undefined;
      const records = scanLog.filter((s) => {
        if (s.pass_id === null) return false;
        const owner = passes.get(s.pass_id);
        if (!owner || owner.module !== query.module) return false;
        if (query.pass_id !== undefined && s.pass_id !== query.pass_id) return false;
        if (query.result !== undefined && s.result !== query.result) return false;
        if (query.device_id !== undefined && s.device_id !== query.device_id) return false;
        const t = Math.floor(Date.parse(s.scanned_at) / 1000);
        if (from !== undefined && t < from) return false;
        if (to !== undefined && t > to) return false;
        return true;
      });
      return { records: records.slice(-500), next_cursor: null };
    },

    outbox(filter = {}) {
      return events.filter((e) =>
        (filter.type === undefined || e.type === filter.type)
        && (filter.pass_id === undefined || e.data.pass_id === filter.pass_id));
    },
  };
};

let singleton: QrPassStore | null = null;
export const getDemoQrPassStore = (): QrPassStore => {
  if (!singleton) singleton = createQrPassStore();
  return singleton;
};
export const resetDemoQrPassStoreForTests = (): void => {
  singleton = null;
};

