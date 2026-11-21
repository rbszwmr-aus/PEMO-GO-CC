/**
 * Integration status, S05: the shapes of Backend’s two staff reads and the rules that do not depend on a screen.
 *
 *   GET /api/management-web/v0/integration-status               (list: scope, summary, Hub rows, systems)
 *   GET /api/management-web/v0/integration-status/{systemRef}   (one system, its history, device changes)
 *
 * Contract: docs/contracts/integration-status-v0-PROPOSED_v0.4.1.md, section 5. PEMO never talks to a
 * building system; the 2IoT Hub does, and tells PEMO. Everything here is what PEMO was told, and what PEMO
 * worked out from how long ago it was told.
 */

import type { LocalizedText } from '../i18n/locale.ts';

/** Words from the contract, in English and Traditional Chinese only; Simplified follows Traditional. */
export type WireText = LocalizedText;

export const SYSTEM_STATES = ['online', 'degraded', 'offline', 'unknown', 'maintenance'] as const;
export type SystemState = (typeof SYSTEM_STATES)[number];

/** `late` is a warning on the Hub row only; `silent` and `never` turn every system into `unknown`. */
export const HUB_STATES = ['online', 'late', 'silent', 'never'] as const;
export type HubState = (typeof HUB_STATES)[number];

/** Why PEMO shows a system as `unknown`. */
export const UNKNOWN_REASONS = ['hub_silent', 'hub_never_seen', 'stale_report'] as const;
export type UnknownReason = (typeof UNKNOWN_REASONS)[number];

/** The kinds of system the Hub may report (IF-7 section 8). A kind this build has not seen reads as the server’s own label. */
export const SYSTEM_KINDS = ['metering', 'lift', 'pump_drainage', 'genset', 'fire', 'mvac', 'bms', 'carpark', 'ev_charging', 'access_control', 'cctv', 'intercom', 'robot', 'work_order', 'identity', 'other'] as const;
export type SystemKind = (typeof SYSTEM_KINDS)[number];

export type HistoryCause = 'hub_report' | 'derived';
export type PlaceSource = 'pemo_map' | 'hub_hint';

export interface ResponseMeta {
  correlationId: string;
  contractVersion: string;
  generatedAt: string;
}

export interface SystemItDetails {
  estateNodeId: string;
  placeNodeId: string | null;
  placeSource: PlaceSource | null;
  hubPlaceNodeId: string | null;
  placeMismatch: boolean | null;
  source: string | null;
  detailCode: string | null;
  hubState: HubState | null;
}

export interface IntegrationSystem {
  systemRef: string;
  kind: string;
  kindLabel: WireText;
  displayName: WireText;
  state: SystemState;
  reportedState: SystemState;
  unknownReason: UnknownReason | null;
  needsAttention: boolean;
  needsMapping: boolean;
  expectedEnd: string | null;
  message: WireText;
  since: string | null;
  lastSeenAt: string | null;
  lastReportAt: string | null;
  lastSnapshotAt: string | null;
  devicesTotal: number;
  devicesOffline: number;
  devicesOnline: number;
  itDetails: SystemItDetails;
}

export interface HubRow {
  state: HubState;
  message: WireText;
  needsAttention: boolean;
  lastHeartbeatAt: string | null;
  lastSnapshotAt: string | null;
  summary: { systemsTotal: number; systemsOffline: number; devicesTotal: number; devicesOffline: number };
  itDetails: {
    hubInstance: string;
    estateNodeId: string;
    version: string;
    uptimeS: number;
    outbox: { pending: number; oldestOccurredAt: string | null } | null;
  };
}

export interface IntegrationSummary {
  hubState: HubState | null;
  hubMessage: WireText | null;
  systemsTotal: number;
  online: number;
  degraded: number;
  offline: number;
  unknown: number;
  maintenance: number;
  needsAttention: number;
  needsMapping: number;
  devicesTotal: number;
  devicesOffline: number;
  devicesOnline: number;
  lastHeartbeatAt: string | null;
  lastSnapshotAt: string | null;
}

export interface IntegrationStatusResponse {
  meta: ResponseMeta;
  scope: 'estate' | 'places';
  summary: IntegrationSummary;
  hubs: HubRow[];
  systems: IntegrationSystem[];
}

export interface HistoryEntry {
  at: string;
  from: SystemState | null;
  to: SystemState;
  cause: HistoryCause;
  reason: UnknownReason | null;
  message: WireText;
  itDetails: { detailCode: string | null };
}

export interface DeviceChange {
  hubRef: string;
  state: string;
  since: string | null;
  lastSeenAt: string | null;
  receivedAt: string | null;
}

export interface IntegrationDetailResponse {
  meta: ResponseMeta;
  system: IntegrationSystem;
  history: HistoryEntry[];
  itDetails: { recentDeviceChanges: DeviceChange[] };
}

export const ESTATE_NODE_ID = 'est_wing_fu_garden';

/** The order the contract states: trouble first, then by name. */
const ORDER: Readonly<Record<SystemState, number>> = { offline: 0, degraded: 1, unknown: 2, maintenance: 3, online: 4 };
export function systemOrder(a: IntegrationSystem, b: IntegrationSystem): number {
  return ORDER[a.state] - ORDER[b.state] || a.displayName.en.localeCompare(b.displayName.en, 'en');
}

/** The numbers of a summary, from the systems it covers (what the server does for a narrower scope). */
export function summarise(
  systems: readonly IntegrationSystem[],
  hub: { state: HubState | null; message: WireText | null; lastHeartbeatAt: string | null; lastSnapshotAt: string | null },
): IntegrationSummary {
  const n = (s: SystemState) => systems.filter((x) => x.state === s).length;
  const devicesTotal = systems.reduce((a, x) => a + x.devicesTotal, 0);
  const devicesOffline = systems.reduce((a, x) => a + x.devicesOffline, 0);
  return {
    hubState: hub.state,
    hubMessage: hub.message,
    systemsTotal: systems.length,
    online: n('online'),
    degraded: n('degraded'),
    offline: n('offline'),
    unknown: n('unknown'),
    maintenance: n('maintenance'),
    needsAttention: n('degraded') + n('offline') + n('unknown'),
    needsMapping: systems.filter((x) => x.needsMapping).length,
    devicesTotal,
    devicesOffline,
    devicesOnline: devicesTotal - devicesOffline,
    lastHeartbeatAt: hub.lastHeartbeatAt,
    lastSnapshotAt: hub.lastSnapshotAt,
  };
}

/** True when the Hub cannot vouch for the systems, so a device count would be a guess. */
export const hubIsQuiet = (state: HubState | null): boolean => state === 'silent' || state === 'never';

/** A moment as “4 minutes ago”, counted from the response’s own clock so a stored page never reads wrongly. */
export function agoText(iso: string, nowIso: string, bcp47: string): string {
  const secs = Math.round((new Date(iso).getTime() - new Date(nowIso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(secs);
  if (abs < 60) return rtf.format(secs, 'second');
  if (abs < 3600) return rtf.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), 'hour');
  return rtf.format(Math.round(secs / 86400), 'day');
}

