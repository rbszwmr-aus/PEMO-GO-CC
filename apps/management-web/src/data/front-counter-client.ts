/**
 * Front-counter visitor client: walk-in registration, pass verify (dry run), pass
 * redeem (idempotent), check-out and today’s log.
 *
 * THE SWAP POINT. Screens talk only to `FrontCounterClient`. Two implementations:
 *   - `createFixtureClient`: in-memory, shaped EXACTLY like the Backend contract
 *     docs/contracts/front-counter-visitors-v0-PROPOSED.md (0.1.0-proposed, Backend
 *     feat/front-counter-visitors @ 6559a5a), including its status vocabulary, its
 *     snake_case bodies, +08:00 visit times and UTC-Z pass windows. The default.
 *   - `createLiveClient`: the same calls over fetch on
 *     /api/management-web/v0/front-counter, with Bearer and Idempotency-Key.
 *     Selected by `?source=live` (see `selectFrontCounterClient`). Nothing answers on
 *     :3200 yet, so live mode shows a problem until Backend restarts it.
 */
import { FALLBACK_CODE, VISITOR_PURPOSE, activeItems, normalizePurpose } from '../lookups/lookup-lists.ts';
import { lookupsClient } from '../lookups/lookups-client.ts';

export const FRONT_COUNTER_BASE = '/api/management-web/v0/front-counter';

/**
 * A purpose is a lookup CODE from the admin-managed `visitor_purpose` list (docs/contracts/lookup-lists-v0-PROPOSED_v0.1.md
 * and front-counter-visitors-v0-PROPOSED.md 0.1.2): delivery, contractor, visit, caregiver, family_visit, other, plus any type
 * staff add. It is no longer a fixed enum.
 */
export type Purpose = string;

/** The labels Backend resolves from the list at read time. */
export interface PurposeLabels { en: string; 'zh-Hant': string; 'zh-Hans': string }

/** Coarse verify vocabulary (the contract’s `status_group`). */
export const PASS_STATES = ['valid', 'expired', 'used_up', 'revoked', 'unknown'] as const;
export type PassState = (typeof PASS_STATES)[number];

/** Fine verify vocabulary (the contract’s `status`). */
export type PassStatus =
  | 'valid' | 'expired' | 'not_yet_valid' | 'used_up' | 'revoked'
  | 'invalid_signature' | 'unknown_key' | 'not_found';

export interface HostRef {
  unit_id: string;
  unit_label: string;
}

export interface WalkInInput {
  name: string;
  /** A lookup code, a label in any language, or free text: Backend matches active types and maps the rest to other + purpose_text. */
  purpose: Purpose;
  /** Kept by Backend only when the purpose resolves to other. */
  purpose_text?: string | null | undefined;
  host_unit_id: string;
  phone?: string | undefined;
  id_stub?: string | undefined;
}

export type VisitSource = 'walk_in' | 'pre_registered';
export type VisitStatus = 'expected' | 'on_site' | 'checked_out';
export type VisitOutcome = 'visited' | 'no_show';

/** One visit as the Backend returns it (walk-in create, check-out and today’s log). */
export interface Visit {
  visit_id: string;
  name: string;
  /** The lookup code. A missing purpose reads as other. */
  purpose: Purpose;
  /** English label and all three labels of that code (resolved at read time, so a rename relabels old visits). */
  purpose_label?: string | undefined;
  purpose_labels?: PurposeLabels | undefined;
  /** Free text, only when the purpose is other. */
  purpose_text: string | null;
  source: VisitSource;
  status: VisitStatus;
  host: HostRef;
  phone: string | null;
  id_stub: string | null;
  expected_from: string;
  expected_to: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string;
  resident_ref: string | null;
  pass_id: string | null;
  /** Set when the visit is closed: 'visited' (was on site) or 'no_show' (closed without arriving). Status stays checked_out. */
  outcome: VisitOutcome | null;
  outcome_label: string | null;
}

/** Verify (a dry run). Visitor, host, window and counters are null for an untrusted pass. */
export interface PassCard {
  status: PassStatus;
  status_group: PassState;
  visitor: { name: string; purpose: Purpose; purpose_label?: string | undefined; purpose_labels?: PurposeLabels | undefined; purpose_text: string | null; visit_id: string } | null;
  host: HostRef | null;
  window: { not_before: string; expires_at: string } | null;
  uses_seen: number | null;
  use_limit: number | null;
  uses_remaining: number | null;
  pass_id: string | null;
}

export type RedeemRejection =
  | 'pass' | 'visit-not-linked' | 'visit-cancelled' | 'visit-already-checked-out' | 'key-conflict';

export type RedeemResult =
  | {
      outcome: 'checked_in';
      /** True when this Idempotency-Key had already checked the visitor in; nothing more was consumed. */
      replayed: boolean;
      visit: { visit_id: string; status: VisitStatus; source: VisitSource; checked_in_at: string | null; host: HostRef };
      uses_seen: number | null;
      use_limit: number | null;
      uses_remaining: number | null;
    }
  | {
      outcome: 'rejected';
      reason: RedeemRejection;
      /** The pass’s own status when `reason` is 'pass' (409 used_up, 422 expired/revoked/..., 404 not_found). */
      status?: PassStatus;
      status_group?: PassState;
    };

/** A call the Backend refused outright: 400, 401, 404 on check-out, 5xx, or unreachable (status 0). */
export class FrontCounterError extends Error {
  readonly status: number;
  readonly type: string;
  constructor(status: number, type: string, message: string) {
    super(message);
    this.name = 'FrontCounterError';
    this.status = status;
    this.type = type;
  }
}

export interface FrontCounterClient {
  createWalkIn(input: WalkInInput): Promise<Visit>;
  /** Dry run. Consumes nothing, records nothing. `code` is a QP1: payload or a qp_ pass id. */
  verify(code: string): Promise<PassCard>;
  redeem(code: string, idempotencyKey: string): Promise<RedeemResult>;
  checkOut(visitId: string): Promise<Visit | null>;
  listToday(): Promise<Visit[]>;
  /** Called after any change this client made to today’s log. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Sample codes the fixture knows, for the demo chips. Empty on a live client. */
  readonly demoCodes: readonly { code: string; state: PassState }[];
  readonly kind: 'fixture' | 'live';
  /** Settles with the source in use. Instant for a fixed client; the auto client probes the API first. */
  readonly ready: Promise<'fixture' | 'live'>;
}

/** `{ pass_id }` for a qp_ id, otherwise `{ payload }` (the server decides what a bad payload is). */
export function codeBody(code: string): { pass_id: string } | { payload: string } {
  const v = code.trim();
  return /^qp_/i.test(v) ? { pass_id: v } : { payload: v };
}

/** A fresh Idempotency-Key. One key per Check-in press target: a retry reuses it. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The coarse group of a fine status, exactly the contract’s table. */
export function statusGroup(status: PassStatus): PassState {
  switch (status) {
    case 'valid': return 'valid';
    case 'expired': return 'expired';
    case 'used_up': return 'used_up';
    case 'revoked': return 'revoked';
    default: return 'unknown';
  }
}

/* ------------------------------------------------------------------ time */

const HK_OFFSET_MS = 8 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** RFC 3339 with +08:00, whole seconds: the visit-record convention. */
export function hkIso(d: Date): string {
  const h = new Date(d.getTime() + HK_OFFSET_MS);
  return `${h.getUTCFullYear()}-${pad(h.getUTCMonth() + 1)}-${pad(h.getUTCDate())}T${pad(h.getUTCHours())}:${pad(h.getUTCMinutes())}:${pad(h.getUTCSeconds())}+08:00`;
}

/** RFC 3339 UTC Z, whole seconds: the pass-window convention. */
export function utcIso(d: Date): string {
  return `${d.toISOString().slice(0, 19)}Z`;
}

/** Walk-in expected window: now through the end of the HK day, or now + 1 hour if that is later. */
function walkInWindow(now: Date): { from: string; to: string } {
  const h = new Date(now.getTime() + HK_OFFSET_MS);
  const endOfDay = Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate(), 23, 59, 59) - HK_OFFSET_MS;
  return { from: hkIso(now), to: hkIso(new Date(Math.max(endOfDay, now.getTime() + 3_600_000))) };
}

/** id_stub as the Backend stores it: already-masked stays, anything longer becomes **** + last 4. */
export function maskIdStub(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith('*')) return v;
  const alnum = v.replace(/[^0-9A-Za-z]/g, '');
  return alnum.length <= 4 ? alnum : `****${alnum.slice(-4)}`;
}

/* --------------------------------------------------------------- fixture */

/** The Backend’s small seeded unit map. An unknown id is accepted and its label is the raw id. */
const SEEDED_UNIT_LABELS: Record<string, string> = {
  unt_demo_a_12f_a1: 'A · 12/F A1',
  unit_wfg_a_12_a1: 'A · 12/F A1',
};
const hostOf = (unit_id: string): HostRef => ({ unit_id, unit_label: SEEDED_UNIT_LABELS[unit_id] ?? unit_id });

interface FixturePass {
  pass_id: string;
  payload: string;
  visit_id: string;
  not_before: string;
  expires_at: string;
  use_limit: number;
  uses_seen: number;
  revoked: boolean;
}

const HOUR = 3_600_000;

/** purpose, purpose_label, purpose_labels and purpose_text as Backend returns them: labels come from the list at read time. */
function purposeFields(v: Pick<Visit, 'purpose' | 'purpose_text'>): Pick<Visit, 'purpose' | 'purpose_label' | 'purpose_labels' | 'purpose_text'> {
  const it = lookupsClient().items(VISITOR_PURPOSE).find((i) => i.code === v.purpose);
  return {
    purpose: v.purpose,
    ...(it ? { purpose_label: it.labels.en, purpose_labels: { ...it.labels } } : {}),
    purpose_text: v.purpose === FALLBACK_CODE ? v.purpose_text : null,
  };
}

function seed(now: Date): { passes: FixturePass[]; visits: Visit[] } {
  const at = (h: number) => new Date(now.getTime() + h * HOUR);
  const mk = (
    n: number, name: string, purpose: Purpose, purpose_text: string | null, unit: string,
    status: VisitStatus, pass: Omit<FixturePass, 'visit_id'>, hFrom: number, hTo: number,
  ): { pass: FixturePass; visit: Visit } => {
    const visit_id = `vis_fx_${n}`;
    const visit: Visit = {
      visit_id, name, purpose, purpose_text, source: 'pre_registered', status, host: hostOf(unit),
      phone: null, id_stub: null,
      expected_from: hkIso(at(hFrom)), expected_to: hkIso(at(hTo)),
      checked_in_at: status === 'expected' ? null : hkIso(at(-1)),
      checked_out_at: null,
      created_at: hkIso(at(-20)), updated_at: hkIso(at(-1)),
      resident_ref: 'res_fx', pass_id: pass.pass_id, outcome: null, outcome_label: null,
    };
    return { pass: { ...pass, visit_id }, visit };
  };
  const rows = [
    mk(1, 'Chan Tai-man 陳大文', 'visit', null, 'unit_wfg_a_12_a1', 'expected',
      { pass_id: 'qp_demo_valid', payload: 'QP1:DEMO-VALID', not_before: utcIso(at(-1)), expires_at: utcIso(at(5)), use_limit: 2, uses_seen: 0, revoked: false }, -1, 5),
    mk(2, 'Lam Siu-kei 林小琪', 'visit', null, 'unit_wfg_a_07_a2', 'expected',
      { pass_id: 'qp_demo_expired', payload: 'QP1:DEMO-EXPIRED', not_before: utcIso(at(-30)), expires_at: utcIso(at(-6)), use_limit: 2, uses_seen: 1, revoked: false }, -30, -6),
    mk(3, 'Wong Suk-fan 黃淑芬', 'family_visit', null, 'unit_wfg_a_12_a1', 'on_site',
      { pass_id: 'qp_demo_used', payload: 'QP1:DEMO-USED', not_before: utcIso(at(-3)), expires_at: utcIso(at(9)), use_limit: 2, uses_seen: 2, revoked: false }, -3, 9),
    mk(4, 'Fung Interiors 馮氏裝修', 'contractor', null, 'unit_wfg_b_18_b4', 'expected',
      { pass_id: 'qp_demo_revoked', payload: 'QP1:DEMO-REVOKED', not_before: utcIso(at(-2)), expires_at: utcIso(at(6)), use_limit: 2, uses_seen: 0, revoked: true }, -2, 6),
    mk(5, 'Ho Mei-yi 何美儀', 'visit', null, 'unit_wfg_a_07_a2', 'expected',
      { pass_id: 'qp_demo_later', payload: 'QP1:DEMO-LATER', not_before: utcIso(at(3)), expires_at: utcIso(at(8)), use_limit: 1, uses_seen: 0, revoked: false }, 3, 8),
  ];
  return { passes: rows.map((r) => r.pass), visits: rows.map((r) => r.visit) };
}

/** The demo visits as the fixture client seeds them, for counting how often a purpose type is used. */
export function seededVisits(now: Date = new Date()): Visit[] {
  return seed(now).visits;
}

function statusOf(p: FixturePass, now: Date): PassStatus {
  const t = now.getTime();
  if (p.revoked) return 'revoked';
  if (t < Date.parse(p.not_before)) return 'not_yet_valid';
  if (t >= Date.parse(p.expires_at)) return 'expired';
  if (p.use_limit > 0 && p.uses_seen >= p.use_limit) return 'used_up';
  return 'valid';
}

const NO_PASS = (status: PassStatus): PassCard => ({
  status, status_group: statusGroup(status), visitor: null, host: null, window: null,
  uses_seen: null, use_limit: null, uses_remaining: null, pass_id: null,
});

export const DEMO_CODES: readonly { code: string; state: PassState }[] = [
  { code: 'QP1:DEMO-VALID', state: 'valid' },
  { code: 'QP1:DEMO-EXPIRED', state: 'expired' },
  { code: 'QP1:DEMO-USED', state: 'used_up' },
  { code: 'QP1:DEMO-REVOKED', state: 'revoked' },
  { code: 'QP1:DEMO-LATER', state: 'unknown' },
];

/** The in-memory fixture client. `now` is injectable so tests control the clock. */
export function createFixtureClient(now: () => Date = () => new Date()): FrontCounterClient {
  const seeded = seed(now());
  const passes = seeded.passes;
  const visits: Visit[] = seeded.visits;
  const replays = new Map<string, { body: string; result: RedeemResult }>();
  const listeners = new Set<() => void>();
  let seq = 0;
  const emit = () => listeners.forEach((l) => l());
  const find = (code: string): { pass: FixturePass | undefined; known: boolean } => {
    const b = codeBody(code);
    if ('pass_id' in b) return { pass: passes.find((p) => p.pass_id === b.pass_id), known: true };
    return { pass: passes.find((p) => p.payload === b.payload), known: false };
  };
  const cardOf = (p: FixturePass): PassCard => {
    const v = visits.find((x) => x.visit_id === p.visit_id);
    const status = statusOf(p, now());
    return {
      status, status_group: statusGroup(status),
      visitor: v ? { name: v.name, ...purposeFields(v), visit_id: v.visit_id } : null,
      host: v ? v.host : null,
      window: { not_before: p.not_before, expires_at: p.expires_at },
      uses_seen: p.uses_seen, use_limit: p.use_limit,
      uses_remaining: p.use_limit > 0 ? Math.max(0, p.use_limit - p.uses_seen) : null,
      pass_id: p.pass_id,
    };
  };

  return {
    kind: 'fixture',
    ready: Promise.resolve('fixture'),
    demoCodes: DEMO_CODES,
    async createWalkIn(input) {
      if (!input.name.trim() || !input.purpose.trim() || !input.host_unit_id.trim()) {
        throw new FrontCounterError(400, 'validation', 'name, purpose and host_unit_id are required');
      }
      seq += 1;
      const w = walkInWindow(now());
      const stamp = hkIso(now());
      // Backend's rule: match a code or a label among the ACTIVE types; no match stores other and keeps the words.
      const items = activeItems(lookupsClient().items(VISITOR_PURPOSE));
      const matched = normalizePurpose(input.purpose, items);
      const code = matched ?? FALLBACK_CODE;
      const text = code !== FALLBACK_CODE ? null : matched ? (input.purpose_text?.trim() || null) : input.purpose.trim();
      const visit: Visit = {
        visit_id: `vis_fx_w${seq}`, name: input.name.trim(), purpose: code, purpose_text: text,
        source: 'walk_in', status: 'on_site', host: hostOf(input.host_unit_id.trim()),
        phone: input.phone?.trim() || null, id_stub: input.id_stub ? maskIdStub(input.id_stub) : null,
        expected_from: w.from, expected_to: w.to, checked_in_at: stamp, checked_out_at: null,
        created_at: stamp, updated_at: stamp, resident_ref: null, pass_id: null, outcome: null, outcome_label: null,
      };
      visits.unshift(visit);
      emit();
      return { ...visit, ...purposeFields(visit) };
    },
    async verify(code) {
      const { pass, known } = find(code);
      if (!pass) return NO_PASS(known ? 'not_found' : 'invalid_signature');
      return cardOf(pass);
    },
    async redeem(code, idempotencyKey) {
      if (!idempotencyKey.trim()) throw new FrontCounterError(400, 'missing-request-key', 'A request key is required');
      const body = JSON.stringify(codeBody(code));
      const prior = replays.get(idempotencyKey);
      if (prior) {
        if (prior.body !== body) return { outcome: 'rejected', reason: 'key-conflict' };
        return prior.result.outcome === 'checked_in' ? { ...prior.result, replayed: true } : prior.result;
      }
      const { pass, known } = find(code);
      let result: RedeemResult;
      if (!pass) {
        const status: PassStatus = known ? 'not_found' : 'invalid_signature';
        result = { outcome: 'rejected', reason: 'pass', status, status_group: statusGroup(status) };
      } else {
        const status = statusOf(pass, now());
        const visit = visits.find((x) => x.visit_id === pass.visit_id);
        if (status !== 'valid') {
          result = { outcome: 'rejected', reason: 'pass', status, status_group: statusGroup(status) };
        } else if (!visit) {
          result = { outcome: 'rejected', reason: 'visit-not-linked' };
        } else if (visit.status === 'checked_out') {
          result = { outcome: 'rejected', reason: 'visit-already-checked-out' };
        } else {
          pass.uses_seen += 1;
          if (visit.status === 'expected') {
            visit.status = 'on_site';
            visit.checked_in_at = hkIso(now());
            visit.updated_at = hkIso(now());
          }
          result = {
            outcome: 'checked_in', replayed: false,
            visit: { visit_id: visit.visit_id, status: visit.status, source: visit.source, checked_in_at: visit.checked_in_at, host: visit.host },
            uses_seen: pass.uses_seen, use_limit: pass.use_limit,
            uses_remaining: pass.use_limit > 0 ? Math.max(0, pass.use_limit - pass.uses_seen) : null,
          };
          emit();
        }
      }
      replays.set(idempotencyKey, { body, result });
      return result;
    },
    async checkOut(visitId) {
      const v = visits.find((x) => x.visit_id === visitId);
      if (!v) return null;
      if (v.status !== 'checked_out') {
        v.status = 'checked_out';
        v.outcome = v.checked_in_at ? 'visited' : 'no_show';
        v.outcome_label = v.checked_in_at ? 'visited' : 'no-show / closed';
        v.checked_out_at = hkIso(now());
        v.updated_at = v.checked_out_at;
        emit();
      }
      return { ...v };
    },
    async listToday() {
      return visits.map((v) => ({ ...v, ...purposeFields(v) }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/* ------------------------------------------------------------------ live */

interface Problem {
  type?: string;
  title?: string;
  detail?: string;
  pass_status?: string;
  status_group?: string;
}

const problemSuffix = (p: Problem): string => (p.type ?? '').split('/').pop() ?? '';
const isStatus = (v: unknown): v is PassStatus =>
  typeof v === 'string' &&
  ['valid', 'expired', 'not_yet_valid', 'used_up', 'revoked', 'invalid_signature', 'unknown_key', 'not_found'].includes(v);

export interface LiveClientOptions {
  /** API origin; empty means same-origin (the dev server proxies the allowlisted path). */
  base?: string;
  /** Staff bearer. Empty sends none: a real missing credential, so the Backend answers 401. */
  token?: string;
  fetchImpl?: typeof fetch;
}

/** The same calls as the fixture, over fetch on the contract’s routes. */
export function createLiveClient(opts: LiveClientOptions = {}): FrontCounterClient {
  const origin = (opts.base ?? '').replace(/\/$/, '');
  const base = origin + FRONT_COUNTER_BASE;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  async function call(method: 'GET' | 'POST', path: string, body?: unknown, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch {
      throw new FrontCounterError(0, 'offline', 'The API could not be reached');
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* an empty or non-JSON body */ }
    return { status: res.status, json: json as Record<string, unknown> | null };
  }
  const fail = (status: number, json: Record<string, unknown> | null): never => {
    const p = (json ?? {}) as Problem;
    throw new FrontCounterError(status, problemSuffix(p) || 'error', p.detail ?? p.title ?? `HTTP ${status}`);
  };

  return {
    kind: 'live',
    ready: Promise.resolve('live'),
    demoCodes: [],
    async createWalkIn(input) {
      const { status, json } = await call('POST', '/visits', {
        name: input.name.trim(), purpose: input.purpose, host_unit_id: input.host_unit_id,
        ...(input.purpose_text ? { purpose_text: input.purpose_text } : {}),
        ...(input.phone ? { phone: input.phone } : {}), ...(input.id_stub ? { id_stub: input.id_stub } : {}),
      });
      if (status !== 201 || !json?.['visit']) return fail(status, json);
      emit();
      return json['visit'] as Visit;
    },
    async verify(code) {
      const { status, json } = await call('POST', '/passes/verify', codeBody(code));
      if (status !== 200 || !json) return fail(status, json);
      return json as unknown as PassCard;
    },
    async redeem(code, idempotencyKey) {
      if (!idempotencyKey.trim()) throw new FrontCounterError(400, 'missing-request-key', 'A request key is required');
      const { status, json } = await call('POST', '/passes/redeem', codeBody(code), { 'Idempotency-Key': idempotencyKey });
      if (status === 200 && json) {
        emit();
        return {
          outcome: 'checked_in', replayed: (json as { replayed?: unknown }).replayed === true,
          visit: json['visit'] as Extract<RedeemResult, { outcome: 'checked_in' }>['visit'],
          uses_seen: (json['uses_seen'] as number | null) ?? null,
          use_limit: (json['use_limit'] as number | null) ?? null,
          uses_remaining: (json['uses_remaining'] as number | null) ?? null,
        };
      }
      const p = (json ?? {}) as Problem;
      const suffix = problemSuffix(p);
      if (status === 409 && suffix.endsWith('-conflict')) return { outcome: 'rejected', reason: 'key-conflict' };
      if (status === 409 && (suffix === 'visit-not-linked' || suffix === 'visit-cancelled' || suffix === 'visit-already-checked-out')) {
        return { outcome: 'rejected', reason: suffix };
      }
      if (isStatus(p.pass_status) && (status === 409 || status === 422 || status === 404)) {
        return { outcome: 'rejected', reason: 'pass', status: p.pass_status, status_group: statusGroup(p.pass_status) };
      }
      return fail(status, json);
    },
    async checkOut(visitId) {
      const { status, json } = await call('POST', `/visits/${encodeURIComponent(visitId)}/check-out`);
      if (status === 404) return null;
      if (status !== 200 || !json?.['visit']) return fail(status, json);
      emit();
      return json['visit'] as Visit;
    },
    async listToday() {
      const { status, json } = await call('GET', '/visits');
      if (status !== 200 || !Array.isArray(json?.['visits'])) return fail(status, json);
      return json['visits'] as Visit[];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/* ------------------------------------------------------------------ auto */

/** The demo staff Bearer the auto client sends. Demo builds only: a real deployment sets VITE_PEMO_AUTO_LIVE=0. */
export const DEMO_BEARER = 'demo';

const autoLiveEnabled = (): boolean =>
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_PEMO_AUTO_LIVE'] !== '0';

export interface AutoClientOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  /** How long the API gets to answer before the contract fixture is used instead. */
  timeoutMs?: number;
  /** Test seam; defaults to the VITE_PEMO_AUTO_LIVE switch. */
  enabled?: boolean;
}

/**
 * Live whenever the API answers, the contract fixture when it does not. The first call probes
 * GET /visits with the demo Bearer: a 200 with a visits array means live; anything else (404 from a
 * static host, a refused connection, a timeout, a proxy error) means fixture. Decided once per page.
 */
export function createAutoClient(opts: AutoClientOptions = {}): FrontCounterClient {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const fixture = createFixtureClient();
  const live = createLiveClient({ base: opts.base ?? '', token: DEMO_BEARER, fetchImpl: doFetch });
  let inner: FrontCounterClient = fixture;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const probe = async (): Promise<'fixture' | 'live'> => {
    if (!(opts.enabled ?? autoLiveEnabled())) return 'fixture';
    try {
      const origin = (opts.base ?? '').replace(/\/$/, '');
      const url = origin + FRONT_COUNTER_BASE + '/visits';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const answered = await Promise.race([
        doFetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${DEMO_BEARER}` } }).then(async (r) => {
          if (r.status !== 200) return false;
          const j = (await r.json()) as { visits?: unknown };
          return Array.isArray(j.visits);
        }),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), opts.timeoutMs ?? 2500); }),
      ]).finally(() => clearTimeout(timer));
      return answered ? 'live' : 'fixture';
    } catch {
      return 'fixture';
    }
  };
  // Lazy: nothing is fetched until a screen asks, so importing this module costs nothing.
  let settled: Promise<'fixture' | 'live'> | null = null;
  const ready = (): Promise<'fixture' | 'live'> => {
    settled ??= probe().then((k) => {
      inner = k === 'live' ? live : fixture;
      inner.subscribe(emit);
      emit(); // the source is known: readers load from it
      return k;
    });
    return settled;
  };

  return {
    get kind() { return inner.kind; },
    get demoCodes() { return inner.demoCodes; },
    get ready() { return ready(); },
    async createWalkIn(input) { await ready(); return inner.createWalkIn(input); },
    async verify(code) { await ready(); return inner.verify(code); },
    async redeem(code, key) { await ready(); return inner.redeem(code, key); },
    async checkOut(id) { await ready(); return inner.checkOut(id); },
    async listToday() { await ready(); return inner.listToday(); },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/* ------------------------------------------------------------- selection */

export type SourceMode = 'auto' | 'fixture' | 'live';

let current: FrontCounterClient = createAutoClient();
let currentKey = 'auto|';

export function getFrontCounterClient(): FrontCounterClient {
  return current;
}

/** Tests pass a fresh fixture; `selectFrontCounterClient` is the app way in. */
export function setFrontCounterClient(client: FrontCounterClient): void {
  current = client;
  currentKey = 'custom';
}

/**
 * No URL params: auto (live when the API answers, else fixture). `?source=fixture` forces the fixture,
 * `?source=live` forces live with the token given. Selecting the same thing twice keeps the same client,
 * so the fixture log survives navigation.
 */
export function selectFrontCounterClient(cfg: { mode: SourceMode; base: string; token: string }): FrontCounterClient {
  const key = `${cfg.mode}|${cfg.base}|${cfg.mode === 'live' ? cfg.token : ''}`;
  if (key === currentKey) return current;
  currentKey = key;
  current = cfg.mode === 'fixture'
    ? createFixtureClient()
    : cfg.mode === 'live'
      ? createLiveClient({ base: cfg.base, token: cfg.token })
      : createAutoClient({ base: cfg.base });
  return current;
}
