/**
 * Where a screen’s data comes from, decided once per page.
 *
 *   fixture: the contract-shaped sample in this app (the API has not shipped, or ?source=fixture).
 *   live:    the API (?source=live, or auto when the route answered).
 *   auto:    live when the route answers (or refuses us: a 401 or 403 is the API speaking), fixture otherwise.
 *
 * The front-counter and lookups clients make the same choice with the same rule; this is that rule for
 * the clients added since, so each one does not grow its own copy.
 */

export type SourceKind = 'fixture' | 'live';
export type SourceMode = 'auto' | 'fixture' | 'live';

export interface Sourced<T> {
  /** The source once decided; the fixture until then. */
  kind(): SourceKind;
  /** Settles when the source is known; the client to call. */
  use(): Promise<{ kind: SourceKind; client: T }>;
}

/** Vite sets this off for the test build, where nothing answers. */
export const autoLiveEnabled = (): boolean =>
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.['VITE_PEMO_AUTO_LIVE'] !== '0';

export const DEMO_BEARER = 'demo';
export const API_BASE = '/api/management-web/v0';

export interface ProbeOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Does `path` answer like the API? 200, or 401/403 (the route is there, we are not let in) count.
 * 404, a network error, a timeout and any non-API answer do not.
 */
export async function routeAnswers(path: string, opts: ProbeOptions = {}, accept: (status: number, body: unknown) => boolean = (s) => s === 200): Promise<boolean> {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const origin = (opts.base ?? '').replace(/\/$/, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      doFetch(`${origin}${API_BASE}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${DEMO_BEARER}` } }).then(async (r) => {
        let body: unknown = null;
        if (r.status === 200) { try { body = await r.json(); } catch { return false; } }
        return accept(r.status, body);
      }),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), opts.timeoutMs ?? 2500); }),
    ]);
  } catch { return false; } finally { clearTimeout(timer); }
}

export function sourced<T>(o: {
  mode: SourceMode;
  fixture: T;
  live: T;
  probe: () => Promise<boolean>;
  /** Test seam; defaults to the VITE_PEMO_AUTO_LIVE switch. */
  enabled?: boolean;
}): Sourced<T> {
  let decided: SourceKind = o.mode === 'live' ? 'live' : 'fixture';
  let settled: Promise<SourceKind> | null = null;
  const decide = (): Promise<SourceKind> => (settled ??= (async () => {
    if (o.mode !== 'auto') return o.mode;
    if (!(o.enabled ?? autoLiveEnabled())) return 'fixture';
    return (await o.probe()) ? 'live' : 'fixture';
  })().then((k) => { decided = k; return k; }));
  return {
    kind: () => decided,
    async use() {
      const kind = await decide();
      return { kind, client: kind === 'live' ? o.live : o.fixture };
    },
  };
}

/** A problem+json answer, or one made up for “the API could not be reached”. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: { type: string; title: string; status: number; correlationId: string; staffMessage?: { en: string; 'zh-Hant': string }; retryable?: boolean };
  constructor(status: number, json: Record<string, unknown> | null) {
    const title = typeof json?.['title'] === 'string' ? (json['title'] as string) : `HTTP ${status}`;
    super(title);
    this.status = status;
    const sm = json?.['staffMessage'] as { en?: unknown; 'zh-Hant'?: unknown } | undefined;
    this.problem = {
      type: typeof json?.['type'] === 'string' ? (json['type'] as string) : status === 0 || status >= 500 ? 'https://pemo.local/problems/internal-error' : 'https://pemo.local/problems/error',
      title,
      status,
      correlationId: typeof json?.['correlationId'] === 'string' ? (json['correlationId'] as string) : 'none',
      ...(sm && typeof sm.en === 'string' && typeof sm['zh-Hant'] === 'string' ? { staffMessage: { en: sm.en, 'zh-Hant': sm['zh-Hant'] } } : {}),
      ...(typeof json?.['retryable'] === 'boolean' ? { retryable: json['retryable'] as boolean } : {}),
    };
  }
}

/** One authenticated GET (or any method) that throws ApiError unless the status is 200. */
export async function apiGet(
  path: string,
  o: { base?: string; token?: string; fetchImpl?: typeof fetch; accept?: string },
): Promise<Response> {
  const doFetch = o.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const headers: Record<string, string> = { Accept: o.accept ?? 'application/json' };
  if (o.token) headers['Authorization'] = `Bearer ${o.token}`;
  let res: Response;
  try { res = await doFetch(`${(o.base ?? '').replace(/\/$/, '')}${API_BASE}${path}`, { headers }); }
  catch { throw new ApiError(0, null); }
  if (res.status !== 200) {
    let json: Record<string, unknown> | null = null;
    try { json = (await res.json()) as Record<string, unknown>; } catch { /* a non-JSON body */ }
    throw new ApiError(res.status, json);
  }
  return res;
}
