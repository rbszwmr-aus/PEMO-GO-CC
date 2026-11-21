/**
 * Integration status, S05: how the screen reads the status, behind one interface.
 *
 *   fixture: the contract-shaped sample (integration-fixture.json and its derived views)
 *   live:    GET /integration-status and /integration-status/{systemRef} over fetch with Bearer
 *   auto:    live when the route answers (a 403 counts: the route is there), the fixture otherwise
 *
 * Only the read exists. PEMO never writes to, or calls, a building system; the 2IoT Hub is the one that does.
 */

import { ApiError, apiGet, routeAnswers, sourced, type ProbeOptions, type SourceKind, type SourceMode } from '../data/sourced.ts';
import { integrationDetail, integrationList, type IntegrationVariant } from './integration-fixture.ts';
import type { IntegrationDetailResponse, IntegrationStatusResponse } from './integration-status.ts';

export interface IntegrationClient {
  list(variant?: IntegrationVariant): Promise<IntegrationStatusResponse>;
  detail(systemRef: string, variant?: IntegrationVariant): Promise<IntegrationDetailResponse>;
}

const notFound = (): ApiError => new ApiError(404, {
  type: 'https://pemo.local/problems/record-not-found',
  title: 'Record not found',
  status: 404,
  correlationId: 'fixture',
});

export function createFixtureIntegrationClient(): IntegrationClient {
  return {
    async list(variant = 'list') { return integrationList(variant); },
    async detail(systemRef, variant = 'list') {
      const d = integrationDetail(systemRef, variant);
      if (!d) throw notFound();
      return d;
    },
  };
}

export function createLiveIntegrationClient(opts: ProbeOptions & { token?: string } = {}): IntegrationClient {
  const o = { ...(opts.base !== undefined ? { base: opts.base } : {}), ...(opts.token ? { token: opts.token } : {}), ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}) };
  return {
    async list() { return (await (await apiGet('/integration-status', o)).json()) as IntegrationStatusResponse; },
    async detail(systemRef) {
      return (await (await apiGet(`/integration-status/${encodeURIComponent(systemRef)}?limit=50`, o)).json()) as IntegrationDetailResponse;
    },
  };
}

export interface IntegrationRead<T> { source: SourceKind; response: T }

export interface IntegrationSource {
  /** `variant` other than the default asks for a sample view (the states a design review needs); live data has no such thing. */
  read(variant?: IntegrationVariant): Promise<IntegrationRead<IntegrationStatusResponse>>;
  readDetail(systemRef: string, variant?: IntegrationVariant): Promise<IntegrationRead<IntegrationDetailResponse>>;
}

export function createIntegrationSource(cfg: { mode: SourceMode; base?: string; token?: string; fetchImpl?: typeof fetch; enabled?: boolean }): IntegrationSource {
  const probe: ProbeOptions = { ...(cfg.base !== undefined ? { base: cfg.base } : {}), ...(cfg.fetchImpl ? { fetchImpl: cfg.fetchImpl } : {}) };
  const fixture = createFixtureIntegrationClient();
  const s = sourced<IntegrationClient>({
    mode: cfg.mode,
    fixture,
    live: createLiveIntegrationClient({ ...probe, token: cfg.mode === 'live' ? cfg.token ?? '' : 'demo' }),
    probe: () => routeAnswers('/integration-status', probe, (st) => st === 200 || st === 401 || st === 403),
    ...(cfg.enabled !== undefined ? { enabled: cfg.enabled } : {}),
  });
  const pick = async (variant: IntegrationVariant | undefined) => {
    if (variant && variant !== 'list') return { kind: 'fixture' as const, client: fixture };
    return s.use();
  };
  return {
    async read(variant) {
      const { kind, client } = await pick(variant);
      return { source: kind, response: await client.list(variant) };
    },
    async readDetail(systemRef, variant) {
      const { kind, client } = await pick(variant);
      return { source: kind, response: await client.detail(systemRef, variant) };
    },
  };
}

let shared: IntegrationSource = createIntegrationSource({ mode: 'auto' });
let sharedKey = 'auto|';

export function integrationSource(): IntegrationSource { return shared; }

/** Tests swap the source; production goes through selectIntegrationSource. */
export function setIntegrationSource(s: IntegrationSource | null): void {
  shared = s ?? createIntegrationSource({ mode: 'auto' });
  sharedKey = 'custom';
}

/** Same modes as the audit and lookups clients, so one `?source=` decides all of them. */
export function selectIntegrationSource(cfg: { mode: SourceMode; base: string; token: string }): IntegrationSource {
  const key = `${cfg.mode}|${cfg.base}|${cfg.mode === 'live' ? cfg.token : ''}`;
  if (key === sharedKey) return shared;
  sharedKey = key;
  shared = createIntegrationSource(cfg);
  return shared;
}
