/**
 * Where the four screen data clients (front counter, managed lookups, audit log, integration status) get their
 * source. The app states the source once per render (`setClientSource`); a client module is only fetched when a
 * screen that reads it is opened (`loadClients`, called by that screen's loader), and is told the current source
 * the moment it loads. A module that is already loaded is told again whenever the source changes — the same
 * re-selection the app did on every source change before these modules left the entry bundle. Selecting is idempotent.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) New (initial-bundle work): the clients and their fixtures load with the screens that read them.
 */

import type { SourceMode } from './sourced.ts';

export interface ClientSource { mode: SourceMode; base: string; token: string }
export type ClientName = 'frontCounter' | 'lookups' | 'audit' | 'integration';

const selectors: Record<ClientName, (m: () => Promise<unknown>) => Promise<(s: ClientSource) => void>> = {
  frontCounter: async (m) => (await m() as typeof import('./front-counter-client.ts')).selectFrontCounterClient as never,
  lookups: async (m) => (await m() as typeof import('../lookups/lookups-client.ts')).selectLookupsClient as never,
  audit: async (m) => (await m() as typeof import('../audit/audit-client.ts')).selectAuditSource as never,
  integration: async (m) => (await m() as typeof import('../integration/integration-client.ts')).selectIntegrationSource as never,
};
const modules: Record<ClientName, () => Promise<unknown>> = {
  frontCounter: () => import('./front-counter-client.ts'),
  lookups: () => import('../lookups/lookups-client.ts'),
  audit: () => import('../audit/audit-client.ts'),
  integration: () => import('../integration/integration-client.ts'),
};

let current: ClientSource | null = null;
const ready = new Map<ClientName, (s: ClientSource) => void>();

/** The app's current source. Clients already loaded are re-selected; the others pick it up when they load. */
export function setClientSource(source: ClientSource): void {
  if (current && current.mode === source.mode && current.base === source.base && current.token === source.token) return;
  current = source;
  for (const select of ready.values()) select(source);
}

/** Fetch (once) the named client modules and select the current source on each. */
export async function loadClients(names: readonly ClientName[]): Promise<void> {
  await Promise.all(names.map(async (name) => {
    if (!ready.has(name)) {
      const select = await selectors[name](modules[name]);
      ready.set(name, select);
      if (current) select(current);
    }
  }));
}
