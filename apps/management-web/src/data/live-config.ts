/**
 * Live mode is URL-constructed, the same way fixture states are.
 *
 * Default is fixture: the state matrix, corpus, and production-build browser
 * suite do not pass `source=live`, so they keep rendering CORPUS / page fixtures.
 *
 * `?source=live` turns on the live client for the wired management reads and
 * sends. Residents / visitors / households stay on fixtures.
 *
 * Credentials are not taken from the URL in a normal build, and a `token`
 * query is stripped from the address on load so it cannot linger in history,
 * share URLs or referrer. The literal `token=demo` path is available only when
 * `VITE_PEMO_ALLOW_URL_DEMO_TOKEN=1` (off by default). That flag is how the
 * local demo (including the :5176 portal alongside this SPA) can still be
 * opened with `?token=demo`. Arbitrary tokens in the URL are never ingested.
 *
 * The bearer is held in memory for this page load only. It is not written back
 * to the URL and is never stored in localStorage / sessionStorage / cookies.
 *
 * Credential-bearing requests go only to the configured API base: same-origin,
 * or `VITE_API_BASE` when set. A `api=` query pointing elsewhere is ignored
 * as a credential destination.
 */

export interface LiveConfig {
  readonly live: boolean;
  /** API origin. Empty means the configured / same-origin base. */
  readonly api: string;
  /** Staff bearer token, or empty. Empty is a real missing credential, not a default. */
  readonly token: string;
}

export const DEMO_LIVE_TOKEN = 'demo';

export interface CredentialPolicy {
  /** When true, a URL token exactly equal to `demo` may be ingested once. */
  readonly allowUrlDemoToken: boolean;
  /** Explicit API base (no trailing slash). Empty means page origin. */
  readonly configuredApiBase: string;
}

const readEnv = (name: string): string =>
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name] ?? '';

/** Test seam; defaults to the compile-time env (flag off unless it is exactly `1`). */
let policyOverride: Partial<CredentialPolicy> | undefined;

export function setCredentialPolicyForTests(policy: Partial<CredentialPolicy> | undefined): void {
  policyOverride = policy;
}

export function credentialPolicy(): CredentialPolicy {
  return {
    allowUrlDemoToken: policyOverride?.allowUrlDemoToken ?? readEnv('VITE_PEMO_ALLOW_URL_DEMO_TOKEN') === '1',
    configuredApiBase: (policyOverride?.configuredApiBase ?? readEnv('VITE_API_BASE')).replace(/\/$/, ''),
  };
}

/** In-memory bearer for this page load. Not a persistent store. */
let sessionToken = '';

export function setSessionToken(token: string): void {
  sessionToken = token;
}

export function getSessionToken(): string {
  return sessionToken;
}

/** Remove `token` from a query. Returns whether one was present. */
export function stripTokenParam(params: URLSearchParams): boolean {
  const had = params.has('token');
  params.delete('token');
  return had;
}

/**
 * Ingest at most the demo token, and only when the dev/demo flag is on.
 * Always deletes `token` from `params` so callers can write a clean URL.
 */
export function consumeUrlToken(params: URLSearchParams, policy: CredentialPolicy = credentialPolicy()): string {
  const raw = params.get('token') ?? '';
  stripTokenParam(params);
  if (!policy.allowUrlDemoToken) return '';
  return raw === DEMO_LIVE_TOKEN ? DEMO_LIVE_TOKEN : '';
}

/** Strip `token` from the current address without a navigation. */
export function stripTokenFromLocation(location: Location, history: History): void {
  const url = new URL(location.href);
  if (!stripTokenParam(url.searchParams)) return;
  const search = url.searchParams.toString();
  history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`);
}

export function readLiveConfig(
  params: URLSearchParams,
  policy: CredentialPolicy = credentialPolicy(),
): LiveConfig {
  const hadToken = params.has('token');
  const ingested = consumeUrlToken(params, policy);
  // Only set or replace when the URL actually carried a token. A token-less
  // URL must not clear a token already held in memory — React StrictMode
  // runs the route initialiser twice, and the second run sees the stripped URL.
  if (hadToken) setSessionToken(ingested);
  return {
    live: params.get('source') === 'live',
    api: params.get('api') ?? '',
    token: hadToken ? ingested : getSessionToken(),
  };
}

export function writeLiveConfig(params: URLSearchParams, config: LiveConfig): void {
  if (!config.live) return;
  params.set('source', 'live');
  if (config.api) params.set('api', config.api);
  // Never write a credential back onto the URL.
  params.delete('token');
}

const originOf = (value: string, pageOrigin: string): string | undefined => {
  try {
    return new URL(value || pageOrigin, pageOrigin).origin;
  } catch {
    return undefined;
  }
};

/**
 * The only base that may receive a bearer. An unapproved `api=` value is
 * ignored; the caller falls back to the configured or same-origin base.
 */
export function liveBaseUrl(
  config: LiveConfig,
  pageOrigin: string,
  policy: CredentialPolicy = credentialPolicy(),
): string {
  const allowed = (policy.configuredApiBase || pageOrigin).replace(/\/$/, '');
  const requested = (config.api || allowed).replace(/\/$/, '');
  const allowedOrigin = originOf(allowed, pageOrigin);
  const requestedOrigin = originOf(requested, pageOrigin);
  if (allowedOrigin !== undefined && requestedOrigin === allowedOrigin) return requested;
  return allowed;
}

/** True only when `baseUrl` is the configured / same-origin API base. */
export function maySendCredentials(
  baseUrl: string,
  pageOrigin: string,
  policy: CredentialPolicy = credentialPolicy(),
): boolean {
  const allowed = liveBaseUrl({ live: true, api: '', token: '' }, pageOrigin, policy);
  const allowedOrigin = originOf(allowed, pageOrigin);
  const requestOrigin = originOf(baseUrl, pageOrigin);
  return allowedOrigin !== undefined && requestOrigin === allowedOrigin;
}
