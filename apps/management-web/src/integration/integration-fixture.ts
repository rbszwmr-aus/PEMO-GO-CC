/**
 * Integration status, S05: the fixture the screen reads until Backend’s routes are the source.
 *
 * integration-fixture.json holds the estate manager’s read of a healthy day, written as the contract’s
 * responses (integration-status-v0-PROPOSED_v0.4.1.md section 5.1 and 5.2). The other views a screen has
 * to handle are derived from it by the contract’s own rules (sections 2 and 5.3), so a test can tell
 * which rule produced which view:
 *
 *   hub-late      the Hub is late (120 to 179 s); systems keep what they last reported
 *   hub-silent    the Hub is silent; every system reads `unknown`, reason `hub_silent`
 *   hub-never     PEMO has never heard from the Hub; `unknown`, reason `hub_never_seen`
 *   needs-mapping one system has neither a PEMO entry nor a Hub hint (estate readers only)
 *   places        a block supervisor: scope `places`, no Hub rows, only that block’s systems
 *   places-empty  a block with no mapped systems: 200 with an empty list, not 403
 */

import {
  summarise, systemOrder,
  type HubRow, type IntegrationDetailResponse, type IntegrationStatusResponse, type IntegrationSystem, type DeviceChange, type HistoryEntry, type WireText,
} from './integration-status.ts';
import fixture from './integration-fixture.json' with { type: 'json' };

import { INTEGRATION_VARIANTS, isIntegrationVariant, type IntegrationVariant } from './variants.ts';
export { INTEGRATION_VARIANTS, isIntegrationVariant, type IntegrationVariant };

interface FixtureFile {
  list: IntegrationStatusResponse;
  /** The Hub’s words for the views derived below; wire text, so English and Traditional only. */
  words: Record<'silentSystem' | 'neverSystem' | 'silentHub' | 'neverHub' | 'lateHub', WireText>;
  details: Record<string, { history: HistoryEntry[]; recentDeviceChanges: DeviceChange[] }>;
}
const FILE = fixture as unknown as FixtureFile;

/** The estate manager’s read on a healthy day. */
export const INTEGRATION_FIXTURE: IntegrationStatusResponse = FILE.list;
export const INTEGRATION_SYSTEM_REFS: readonly string[] = INTEGRATION_FIXTURE.systems.map((s) => s.systemRef);

const clone = <T,>(x: T): T => structuredClone(x);

/** Block A’s supervisor, from the table in section 6: Lifts and the visitor intercom. */
const BLOCK_A = 'blk_wfg_a';

function quiet(base: IntegrationStatusResponse, hubState: 'silent' | 'never'): IntegrationStatusResponse {
  const r = clone(base);
  const reason = hubState === 'silent' ? 'hub_silent' : 'hub_never_seen';
  const words = hubState === 'silent' ? FILE.words.silentSystem : FILE.words.neverSystem;
  for (const s of r.systems) {
    s.state = 'unknown';
    s.unknownReason = reason;
    s.needsAttention = true;
    s.expectedEnd = null;
    s.message = words;
    s.itDetails.hubState = hubState;
    if (hubState === 'never') { s.since = null; s.lastSeenAt = null; s.lastReportAt = null; s.lastSnapshotAt = null; s.reportedState = 'unknown'; }
  }
  r.systems.sort(systemOrder);
  const hub: HubRow = r.hubs[0]!;
  hub.state = hubState;
  hub.needsAttention = true;
  hub.message = hubState === 'silent' ? FILE.words.silentHub : FILE.words.neverHub;
  hub.summary = { systemsTotal: r.systems.length, systemsOffline: 0, devicesTotal: hub.summary.devicesTotal, devicesOffline: 0 };
  if (hubState === 'silent') { hub.lastHeartbeatAt = '2026-11-18T09:56:00+08:00'; } else { hub.lastHeartbeatAt = null; hub.lastSnapshotAt = null; hub.itDetails.outbox = null; }
  r.summary = summarise(r.systems, { state: hubState, message: hub.message, lastHeartbeatAt: hub.lastHeartbeatAt, lastSnapshotAt: hub.lastSnapshotAt });
  return r;
}

function late(base: IntegrationStatusResponse): IntegrationStatusResponse {
  const r = clone(base);
  const hub = r.hubs[0]!;
  hub.state = 'late';
  hub.needsAttention = true;
  hub.message = FILE.words.lateHub;
  hub.lastHeartbeatAt = '2026-11-18T09:57:40+08:00';
  for (const s of r.systems) s.itDetails.hubState = 'late';
  r.summary = summarise(r.systems, { state: 'late', message: hub.message, lastHeartbeatAt: hub.lastHeartbeatAt, lastSnapshotAt: hub.lastSnapshotAt });
  return r;
}

function needsMapping(base: IntegrationStatusResponse): IntegrationStatusResponse {
  const r = clone(base);
  const s = r.systems.find((x) => x.systemRef === 'sys_wfg_cctv')!;
  s.needsMapping = true;
  s.itDetails.placeNodeId = null;
  s.itDetails.placeSource = null;
  s.itDetails.hubPlaceNodeId = null;
  s.itDetails.placeMismatch = false;
  r.summary = summarise(r.systems, { state: r.summary.hubState, message: r.summary.hubMessage, lastHeartbeatAt: r.summary.lastHeartbeatAt, lastSnapshotAt: r.summary.lastSnapshotAt });
  return r;
}

/** Section 5.3: a narrower grant sees its own systems, no Hub rows, and none of the Hub-derived fields. */
function places(base: IntegrationStatusResponse, nodeIds: readonly string[]): IntegrationStatusResponse {
  const r = clone(base);
  r.scope = 'places';
  r.hubs = [];
  r.systems = r.systems.filter((s) => s.itDetails.placeNodeId !== null && nodeIds.includes(s.itDetails.placeNodeId));
  for (const s of r.systems) {
    s.itDetails.source = null;
    s.itDetails.hubState = null;
    s.itDetails.hubPlaceNodeId = null;
    s.itDetails.placeMismatch = null;
  }
  r.summary = summarise(r.systems, { state: null, message: null, lastHeartbeatAt: null, lastSnapshotAt: null });
  return r;
}

export function integrationList(variant: IntegrationVariant): IntegrationStatusResponse {
  switch (variant) {
    case 'list': return clone(INTEGRATION_FIXTURE);
    case 'hub-late': return late(INTEGRATION_FIXTURE);
    case 'hub-silent': return quiet(INTEGRATION_FIXTURE, 'silent');
    case 'hub-never': return quiet(INTEGRATION_FIXTURE, 'never');
    case 'needs-mapping': return needsMapping(INTEGRATION_FIXTURE);
    case 'places': return places(INTEGRATION_FIXTURE, [BLOCK_A]);
    case 'places-empty': return places(INTEGRATION_FIXTURE, ['blk_wfg_none']);
  }
}

/** The 5.2 read, or undefined when no such system is in the view (the server answers 404 for both). */
export function integrationDetail(systemRef: string, variant: IntegrationVariant = 'list', limit = 50): IntegrationDetailResponse | undefined {
  const list = integrationList(variant);
  const system: IntegrationSystem | undefined = list.systems.find((s) => s.systemRef === systemRef);
  const extra = FILE.details[systemRef];
  if (!system || !extra) return undefined;
  return {
    meta: { ...list.meta, correlationId: 'cor_integration_detail_01' },
    system: clone(system),
    history: clone(extra.history.slice(0, limit)),
    itDetails: { recentDeviceChanges: clone(extra.recentDeviceChanges) },
  };
}


