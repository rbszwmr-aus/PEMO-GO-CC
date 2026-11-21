/**
 * The lookups adapter: everything a screen needs to read and edit managed lists, behind one interface.
 *
 *   - fixture: the seed in lookup-lists.ts, edits kept in browser storage (a trial user sees them after a reload).
 *   - live:    Backend's lookup contract (docs/contracts/lookup-lists-v0-PROPOSED_v0.1.md) over fetch with Bearer.
 *   - auto:    live when GET /lookups/visitor_purpose answers 200 with items (the same rule the front counter
 *              uses: probe once, decide once per page), the fixture when it 404s, is refused or times out.
 *
 * Screens read `items()` synchronously (a cache the client keeps current and announces through `subscribe`)
 * and write through promises, so the same screen code runs against either source.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { toHans } from '../i18n/hans.ts';
import { LIST_REGISTRY, FALLBACK_CODE, foldLabel, newCode, orderedItems, type LookupItem, type LookupLabels } from './lookup-lists.ts';
import { LOOKUP_STORAGE_KEY, browserStorage, type LookupStorage } from './lookup-storage.ts';

export const LOOKUPS_BASE = '/api/management-web/v0';
/** The demo staff Bearer; same switch and value as the front-counter auto client. */
const DEMO_BEARER = 'demo';

export class LookupError extends Error {
  readonly status: number;
  /** The problem type suffix, e.g. lookup-code-in-use, lookup-label-exists. */
  readonly kind: string;
  readonly inUseCount: number | null;
  constructor(status: number, kind: string, message: string, inUseCount: number | null = null) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.inUseCount = inUseCount;
  }
}

export interface LookupsClient {
  readonly kind: 'fixture' | 'live';
  /** Settles when the source is known and loaded. */
  readonly ready: Promise<'fixture' | 'live'>;
  /** Every type, active or not, in list order. */
  items(listKey: string): readonly LookupItem[];
  subscribe(fn: () => void): () => void;
  create(listKey: string, labels: LookupLabels): Promise<LookupItem>;
  update(listKey: string, code: string, patch: { labels?: LookupLabels; active?: boolean }): Promise<LookupItem>;
  /** Move a type one place up (-1) or down (+1) among the movable types. The fallback type stays last. */
  move(listKey: string, code: string, by: -1 | 1): Promise<void>;
  /** Refused with a 409 LookupError when a record uses the type (fixture: when `usage` says so). */
  remove(listKey: string, code: string, usage?: number): Promise<void>;
  reset(): void;
}

const clean = (l: LookupLabels): LookupLabels => ({ en: l.en.trim(), 'zh-Hant': l['zh-Hant'].trim(), 'zh-Hans': l['zh-Hans'].trim() });
const complete = (l: LookupLabels): boolean => Boolean(l.en && l['zh-Hant'] && l['zh-Hans']);

/** The next order for a move: the fallback type never moves and nothing moves past it. */
export function movedCodes(items: readonly LookupItem[], code: string, by: -1 | 1): string[] | null {
  const movable = orderedItems(items).filter((i) => !i.isSystem);
  const i = movable.findIndex((x) => x.code === code);
  const j = i + by;
  if (i < 0 || j < 0 || j >= movable.length) return null;
  const next = movable.map((x) => x.code);
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/* --------------------------------------------------------------- fixture */

type Snapshot = Record<string, LookupItem[]>;

function seedSnapshot(): Snapshot {
  const out: Snapshot = {};
  for (const d of LIST_REGISTRY) out[d.listKey] = d.seed.map((i) => ({ ...i, labels: { ...i.labels } }));
  return out;
}

/** The label rule Backend states: no two types shown together may share a label in any language. */
function clash(list: readonly LookupItem[], labels: LookupLabels, except?: string): LookupItem | undefined {
  const mine = [labels.en, labels['zh-Hant'], labels['zh-Hans']].map(foldLabel);
  return list.find((i) => i.code !== except && [i.labels.en, i.labels['zh-Hant'], i.labels['zh-Hans']].some((l) => mine.includes(foldLabel(l))));
}

export function createFixtureLookupsClient(storage: LookupStorage = browserStorage()): LookupsClient {
  const load = (): Snapshot => {
    const base = seedSnapshot();
    const raw = storage.get(LOOKUP_STORAGE_KEY);
    if (!raw) return base;
    try {
      const saved = JSON.parse(raw) as Snapshot;
      for (const k of Object.keys(base)) if (Array.isArray(saved[k])) base[k] = saved[k]!;
      return base;
    } catch { return base; }
  };
  let state = load();
  const listeners = new Set<() => void>();
  const frozen = new Map<string, readonly LookupItem[]>();
  const publish = () => {
    storage.set(LOOKUP_STORAGE_KEY, JSON.stringify(state));
    frozen.clear();
    listeners.forEach((fn) => fn());
  };
  const list = (key: string): LookupItem[] => {
    const l = state[key];
    if (!l) throw new LookupError(404, 'lookup-list-not-found', `unknown list ${key}`);
    return l;
  };
  const labelsGate = (l: readonly LookupItem[], labels: LookupLabels, except?: string) => {
    if (!complete(labels)) throw new LookupError(400, 'invalid-request', 'a label is needed in every language');
    const other = clash(l, labels, except);
    if (other) throw new LookupError(409, 'lookup-label-exists', `label already used by ${other.code}`);
  };

  return {
    kind: 'fixture',
    ready: Promise.resolve('fixture'),
    items(listKey) {
      let cached = frozen.get(listKey);
      if (!cached) { cached = orderedItems(list(listKey)); frozen.set(listKey, cached); }
      return cached;
    },
    subscribe(fn) { listeners.add(fn); return () => void listeners.delete(fn); },
    async create(listKey, labels) {
      const l = list(listKey); const lab = clean(labels);
      labelsGate(l, lab);
      const last = Math.max(0, ...l.filter((i) => !i.isSystem).map((i) => i.sortOrder));
      const item: LookupItem = {
        code: newCode(lab.en, new Set(l.map((i) => i.code))), labels: lab, sortOrder: last + 10, active: true, isSystem: false, scope: 'global',
      };
      l.push(item); publish();
      return item;
    },
    async update(listKey, code, patch) {
      const l = list(listKey);
      const at = l.findIndex((i) => i.code === code);
      if (at < 0) throw new LookupError(404, 'lookup-code-not-found', `unknown type ${code}`);
      const it: LookupItem = { ...l[at]!, labels: { ...l[at]!.labels } };
      if (patch.labels) { const lab = clean(patch.labels); labelsGate(l, lab, code); it.labels = lab; }
      if (patch.active !== undefined) {
        if (!patch.active && it.isSystem) throw new LookupError(409, 'lookup-code-protected', 'the fallback type cannot be deactivated');
        it.active = patch.active;
      }
      l[at] = it; publish();
      return it;
    },
    async move(listKey, code, by) {
      const l = list(listKey);
      const next = movedCodes(l, code, by);
      if (!next) return;
      const rank = new Map(next.map((c, i) => [c, (i + 1) * 10]));
      state[listKey] = l.map((i) => (rank.has(i.code) ? { ...i, sortOrder: rank.get(i.code)! } : i));
      publish();
    },
    async remove(listKey, code, usage = 0) {
      const l = list(listKey);
      const it = l.find((i) => i.code === code);
      if (!it) throw new LookupError(404, 'lookup-code-not-found', `unknown type ${code}`);
      if (it.isSystem) throw new LookupError(409, 'lookup-code-protected', 'the fallback type cannot be deleted');
      if (usage > 0) throw new LookupError(409, 'lookup-code-in-use', 'this type is used by records', usage);
      state[listKey] = l.filter((i) => i.code !== code); publish();
    },
    reset() { state = seedSnapshot(); storage.remove(LOOKUP_STORAGE_KEY); frozen.clear(); listeners.forEach((fn) => fn()); },
  };
}

/* ------------------------------------------------------------------ live */

interface WireItem {
  code: string;
  labels?: Partial<LookupLabels>;
  label_en?: string; label_zh_hant?: string; label_zh_hans?: string;
  sort_order?: number;
  active?: boolean;
  scope?: string;
  is_system?: boolean;
}

function fromWire(w: WireItem): LookupItem {
  const en = w.labels?.en ?? w.label_en ?? w.code;
  const hant = w.labels?.['zh-Hant'] ?? w.label_zh_hant ?? en;
  const hans = w.labels?.['zh-Hans'] ?? w.label_zh_hans ?? toHans(hant);
  return {
    code: w.code, labels: { en, 'zh-Hant': hant, 'zh-Hans': hans },
    sortOrder: w.sort_order ?? 0, active: w.active !== false,
    // The doc marks the fallback with is_system; a server that omits it still has other as the fallback.
    isSystem: w.is_system ?? w.code === FALLBACK_CODE,
    scope: w.scope === 'estate' ? 'estate' : 'global',
  };
}

export interface LiveLookupsOptions {
  /** API origin; empty means same-origin (the dev server proxies the allowlisted paths). */
  base?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export function createLiveLookupsClient(opts: LiveLookupsOptions = {}): LookupsClient {
  const origin = (opts.base ?? '').replace(/\/$/, '');
  const base = origin + LOOKUPS_BASE;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const cache: Snapshot = seedSnapshot();
  const listeners = new Set<() => void>();
  const frozen = new Map<string, readonly LookupItem[]>();
  const emit = () => { frozen.clear(); listeners.forEach((fn) => fn()); };
  let key = 0;

  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method === 'POST' && path.startsWith('/admin/lookups/') && !path.endsWith('/reorder')) { key += 1; headers['Idempotency-Key'] = `ui-${Date.now()}-${key}`; }
    let res: Response;
    try { res = await doFetch(base + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new LookupError(0, 'offline', 'The API could not be reached'); }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* an empty or non-JSON body */ }
    return { status: res.status, json: json as Record<string, unknown> | null };
  }
  const problem = (status: number, json: Record<string, unknown> | null): never => {
    const type = typeof json?.['type'] === 'string' ? (json['type'] as string).split('/').pop() ?? '' : '';
    const n = json?.['in_use_count'];
    throw new LookupError(status, type || 'error', typeof json?.['detail'] === 'string' ? (json['detail'] as string) : `HTTP ${status}`, typeof n === 'number' ? n : null);
  };
  const reload = async (listKey: string): Promise<void> => {
    const { status, json } = await call('GET', `/lookups/${encodeURIComponent(listKey)}?include_inactive=true`);
    if (status !== 200 || !Array.isArray(json?.['items'])) return problem(status, json);
    cache[listKey] = (json['items'] as WireItem[]).map(fromWire);
    emit();
  };
  const labelBody = (l: LookupLabels) => ({ label_en: l.en, label_zh_hant: l['zh-Hant'], label_zh_hans: l['zh-Hans'] });
  const wired = LIST_REGISTRY.filter((d) => d.wired).map((d) => d.listKey);
  let settled: Promise<'live'> | null = null;
  const ready = (): Promise<'live'> => (settled ??= Promise.all(wired.map((k) => reload(k).catch(() => undefined))).then(() => 'live' as const));

  return {
    kind: 'live',
    get ready() { return ready(); },
    items(listKey) {
      void ready();
      let c = frozen.get(listKey);
      if (!c) { c = orderedItems(cache[listKey] ?? []); frozen.set(listKey, c); }
      return c;
    },
    subscribe(fn) { listeners.add(fn); return () => void listeners.delete(fn); },
    async create(listKey, labels) {
      const lab = clean(labels);
      if (!complete(lab)) throw new LookupError(400, 'invalid-request', 'a label is needed in every language');
      const code = newCode(lab.en, new Set((cache[listKey] ?? []).map((i) => i.code)));
      const { status, json } = await call('POST', `/admin/lookups/${encodeURIComponent(listKey)}`, { code, ...labelBody(lab) });
      if ((status !== 201 && status !== 200) || !json?.['item']) return problem(status, json);
      await reload(listKey);
      return fromWire(json['item'] as WireItem);
    },
    async update(listKey, code, patch) {
      const body = { ...(patch.labels ? labelBody(clean(patch.labels)) : {}), ...(patch.active !== undefined ? { active: patch.active } : {}) };
      const { status, json } = await call('PATCH', `/admin/lookups/${encodeURIComponent(listKey)}/${encodeURIComponent(code)}`, body);
      if (status !== 200 || !json?.['item']) return problem(status, json);
      await reload(listKey);
      return fromWire(json['item'] as WireItem);
    },
    async move(listKey, code, by) {
      const next = movedCodes(cache[listKey] ?? [], code, by);
      if (!next) return;
      const { status, json } = await call('POST', `/admin/lookups/${encodeURIComponent(listKey)}/reorder`, { codes: next });
      if (status !== 200) return problem(status, json);
      await reload(listKey);
    },
    async remove(listKey, code) {
      const { status, json } = await call('DELETE', `/admin/lookups/${encodeURIComponent(listKey)}/${encodeURIComponent(code)}`);
      if (status !== 200) return problem(status, json);
      await reload(listKey);
    },
    reset() { /* nothing local to reset */ },
  };
}

/* ------------------------------------------------------------------ auto */

const autoLiveEnabled = (): boolean =>
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_PEMO_AUTO_LIVE'] !== '0';

export interface AutoLookupsOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Test seam; defaults to the VITE_PEMO_AUTO_LIVE switch. */
  enabled?: boolean;
  storage?: LookupStorage;
}

/** Live whenever the lookups route answers with items, the fixture otherwise. Decided once per page. */
export function createAutoLookupsClient(opts: AutoLookupsOptions = {}): LookupsClient {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const fixture = createFixtureLookupsClient(opts.storage);
  const live = createLiveLookupsClient({ base: opts.base ?? '', token: DEMO_BEARER, fetchImpl: doFetch });
  let inner: LookupsClient = fixture;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  const probe = async (): Promise<'fixture' | 'live'> => {
    if (!(opts.enabled ?? autoLiveEnabled())) return 'fixture';
    try {
      const origin = (opts.base ?? '').replace(/\/$/, '');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const answered = await Promise.race([
        doFetch(`${origin}${LOOKUPS_BASE}/lookups/visitor_purpose`, { headers: { Accept: 'application/json', Authorization: `Bearer ${DEMO_BEARER}` } }).then(async (r) => {
          if (r.status !== 200) return false;
          const j = (await r.json()) as { items?: unknown };
          return Array.isArray(j.items);
        }),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), opts.timeoutMs ?? 2500); }),
      ]).finally(() => clearTimeout(timer));
      return answered ? 'live' : 'fixture';
    } catch { return 'fixture'; }
  };
  let settled: Promise<'fixture' | 'live'> | null = null;
  const ready = (): Promise<'fixture' | 'live'> => (settled ??= probe().then(async (k) => {
    inner = k === 'live' ? live : fixture;
    inner.subscribe(emit);
    if (k === 'live') await inner.ready;
    emit();
    return k;
  }));

  return {
    get kind() { return inner.kind; },
    get ready() { return ready(); },
    items(listKey) { void ready(); return inner.items(listKey); },
    subscribe(fn) { listeners.add(fn); return () => void listeners.delete(fn); },
    async create(k, l) { await ready(); return inner.create(k, l); },
    async update(k, c, p) { await ready(); return inner.update(k, c, p); },
    async move(k, c, by) { await ready(); return inner.move(k, c, by); },
    async remove(k, c, u) { await ready(); return inner.remove(k, c, u); },
    reset() { inner.reset(); },
  };
}

/* ------------------------------------------------------------- selection */

export type LookupsSourceMode = 'auto' | 'fixture' | 'live';

let shared: LookupsClient = createAutoLookupsClient();
let sharedKey = 'auto|';

export function lookupsClient(): LookupsClient { return shared; }

/** Tests swap the client; production goes through selectLookupsClient. */
export function setLookupsClient(c: LookupsClient | null): void {
  shared = c ?? createAutoLookupsClient();
  sharedKey = 'custom';
}

/** Same modes as the front-counter client, so one `?source=` decides both. Selecting the same thing twice keeps the client. */
export function selectLookupsClient(cfg: { mode: LookupsSourceMode; base: string; token: string }): LookupsClient {
  const key = `${cfg.mode}|${cfg.base}|${cfg.mode === 'live' ? cfg.token : ''}`;
  if (key === sharedKey) return shared;
  sharedKey = key;
  shared = cfg.mode === 'fixture'
    ? createFixtureLookupsClient()
    : cfg.mode === 'live'
      ? createLiveLookupsClient({ base: cfg.base, token: cfg.token })
      : createAutoLookupsClient({ base: cfg.base });
  return shared;
}

/** Every type in a list, active or not, kept current when staff edit the list or the source settles. */
export function useLookupItems(listKey: string): readonly LookupItem[] {
  const c = lookupsClient();
  useEffect(() => { void c.ready; }, [c]);
  return useSyncExternalStore(c.subscribe, () => c.items(listKey), () => c.items(listKey));
}
