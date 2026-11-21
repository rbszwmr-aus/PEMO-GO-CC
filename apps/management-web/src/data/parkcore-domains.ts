/**
 * ParkCore action-domain catalog for Groups Rights when the fixture license
 * includes `parkcore`. UI domains map to action prefixes; grant marks are the
 * closed action strings (not domain names).
 *
 * EffectiveAllowed = RoleAllows(parkcore_role) ∪ filter(parkcore_actions).
 * Empty or invalid role → no table grants. ParkCore owns the closed set;
 * this file is the fixture stub of that set, not a second source of truth.
 *
 * HARD ISOLATION: this is PEMO fixture chrome. It does not embed ParkCore
 * Admin and it does not read the parkcore database.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';

export const PARKCORE_ROLE_IDS = [
  'ADMINISTRATOR',
  'MANAGER',
  'OPERATOR',
  'READ_ONLY',
] as const;
export type ParkCoreRoleId = (typeof PARKCORE_ROLE_IDS)[number];

export const PARKCORE_ACTION_IDS = [
  'lane.view',
  'lane.operate',
  'payment.view',
  'payment.collect',
  'payment.refund',
  'alarm.view',
  'alarm.ack',
  'occupancy.view',
  'occupancy.adjust',
  'list.view',
  'list.edit',
  'hold.view',
  'hold.release',
  'unit.view',
  'unit.quota',
  'visitor.view',
  'visitor.admit',
  'receipt.view',
  'receipt.export',
  'user.admin',
  'audit.view',
] as const;
export type ParkCoreActionId = (typeof PARKCORE_ACTION_IDS)[number];

export type ParkCoreDomainId =
  | 'lanes'
  | 'payments'
  | 'alarms'
  | 'occupancy'
  | 'plate_lists'
  | 'holds'
  | 'units'
  | 'visitor'
  | 'receipts'
  | 'admin';

export const PARKCORE_DOMAIN_IDS: readonly ParkCoreDomainId[] = [
  'lanes',
  'payments',
  'alarms',
  'occupancy',
  'plate_lists',
  'holds',
  'units',
  'visitor',
  'receipts',
  'admin',
];

/** UI domain → action prefix (contract: screens map from prefixes, not claim strings). */
export const PARKCORE_DOMAIN_PREFIX: Readonly<Record<ParkCoreDomainId, string>> = {
  lanes: 'lane.',
  payments: 'payment.',
  alarms: 'alarm.',
  occupancy: 'occupancy.',
  plate_lists: 'list.',
  holds: 'hold.',
  units: 'unit.',
  visitor: 'visitor.',
  receipts: 'receipt.',
  admin: 'user.|audit.',
};

export const PARKCORE_DOMAIN_CATALOG: readonly {
  id: ParkCoreDomainId;
  actions: readonly ParkCoreActionId[];
}[] = [
  { id: 'lanes', actions: ['lane.view', 'lane.operate'] },
  { id: 'payments', actions: ['payment.view', 'payment.collect', 'payment.refund'] },
  { id: 'alarms', actions: ['alarm.view', 'alarm.ack'] },
  { id: 'occupancy', actions: ['occupancy.view', 'occupancy.adjust'] },
  { id: 'plate_lists', actions: ['list.view', 'list.edit'] },
  { id: 'holds', actions: ['hold.view', 'hold.release'] },
  { id: 'units', actions: ['unit.view', 'unit.quota'] },
  { id: 'visitor', actions: ['visitor.view', 'visitor.admit'] },
  { id: 'receipts', actions: ['receipt.view', 'receipt.export'] },
  { id: 'admin', actions: ['user.admin', 'audit.view'] },
];

const ACTION_SET: ReadonlySet<string> = new Set(PARKCORE_ACTION_IDS);

export function isParkCoreRoleId(value: string | undefined | null): value is ParkCoreRoleId {
  return value != null && (PARKCORE_ROLE_IDS as readonly string[]).includes(value);
}

export function isParkCoreActionId(value: string): value is ParkCoreActionId {
  return ACTION_SET.has(value);
}

export function actionsForParkCoreDomain(domain: ParkCoreDomainId): readonly ParkCoreActionId[] {
  const row = PARKCORE_DOMAIN_CATALOG.find((d) => d.id === domain);
  return row ? row.actions : [];
}

export function domainForParkCoreAction(action: ParkCoreActionId): ParkCoreDomainId | undefined {
  return PARKCORE_DOMAIN_CATALOG.find((d) => d.actions.includes(action))?.id;
}

const VIEW_ACTIONS: readonly ParkCoreActionId[] = PARKCORE_ACTION_IDS.filter((a) => a.endsWith('.view'));

/**
 * Role → action table (fixture stub of ParkCore RoleAllows).
 * Empty/invalid role is handled in effectiveParkcoreActions — not a table row.
 */
export const PARKCORE_ROLE_ALLOWS: Readonly<Record<ParkCoreRoleId, readonly ParkCoreActionId[]>> = {
  ADMINISTRATOR: PARKCORE_ACTION_IDS,
  MANAGER: [
    'lane.view',
    'lane.operate',
    'payment.view',
    'payment.collect',
    'payment.refund',
    'alarm.view',
    'occupancy.view',
    'list.view',
    'list.edit',
    'hold.view',
    'hold.release',
    'unit.view',
    'visitor.view',
    'receipt.view',
    'audit.view',
  ],
  OPERATOR: [
    'lane.view',
    'payment.view',
    'payment.collect',
    'alarm.view',
    'occupancy.view',
    'list.view',
    'hold.view',
    'unit.view',
    'visitor.view',
    'visitor.admit',
    'receipt.view',
  ],
  READ_ONLY: VIEW_ACTIONS,
};

/** Table grants for a role. Empty or invalid role → no table grants. */
export function roleAllowsParkCore(role: string | undefined | null): ReadonlySet<ParkCoreActionId> {
  if (!isParkCoreRoleId(role)) return new Set();
  return new Set(PARKCORE_ROLE_ALLOWS[role]);
}

/** Drop strings that are not in the closed fixture action set. */
export function filterParkCoreActions(actions: readonly string[] | undefined): ParkCoreActionId[] {
  if (!actions) return [];
  return PARKCORE_ACTION_IDS.filter((a) => actions.includes(a));
}

/**
 * EffectiveAllowed = RoleAllows(role) ∪ filter(parkcore_actions).
 * Empty/invalid role contributes nothing from the table.
 */
export function effectiveParkcoreActions(
  role: string | undefined | null,
  extra: readonly string[] | undefined,
): ReadonlySet<ParkCoreActionId> {
  const out = new Set<ParkCoreActionId>(roleAllowsParkCore(role));
  for (const action of filterParkCoreActions(extra)) out.add(action);
  return out;
}

/**
 * Groups Rights session display: EffectiveAllowed minus explicit ungrants.
 * Toggling an extra updates parkcore_actions; ungranting a role-derived
 * action records it in parkcore_denied so Role ∪ actions stays the additive rule.
 */
export function sessionParkcoreAllowed(
  role: string | undefined | null,
  extra: readonly string[] | undefined,
  denied: readonly string[] | undefined,
): ReadonlySet<ParkCoreActionId> {
  const out = new Set(effectiveParkcoreActions(role, extra));
  for (const action of filterParkCoreActions(denied)) out.delete(action);
  return out;
}

export type DomainGrantCount = { granted: number; total: number };

/** Per-domain granted/total from the current session ParkCore grant set. */
export function parkcoreDomainGrantCounts(
  granted: ReadonlySet<ParkCoreActionId>,
): Record<ParkCoreDomainId, DomainGrantCount> {
  const out = {} as Record<ParkCoreDomainId, DomainGrantCount>;
  for (const id of PARKCORE_DOMAIN_IDS) {
    const actions = actionsForParkCoreDomain(id);
    let n = 0;
    for (const action of actions) if (granted.has(action)) n += 1;
    out[id] = { granted: n, total: actions.length };
  }
  return out;
}

export function parkcoreDomainLabel(domain: ParkCoreDomainId, locale: Locale): string {
  return t(MESSAGES.admin.parkcoreDomain[domain], locale);
}

export function parkcoreActionLabel(action: ParkCoreActionId, locale: Locale): string {
  return t(MESSAGES.admin.parkcoreAction[action], locale);
}

export function parkcoreRoleLabel(role: ParkCoreRoleId, locale: Locale): string {
  return t(MESSAGES.admin.parkcoreRole[role], locale);
}

export function uncataloguedParkCoreActions(): ParkCoreActionId[] {
  return PARKCORE_ACTION_IDS.filter((a) => domainForParkCoreAction(a) === undefined);
}

export function duplicateCataloguedParkCoreActions(): ParkCoreActionId[] {
  const seen = new Set<ParkCoreActionId>();
  const dup: ParkCoreActionId[] = [];
  for (const row of PARKCORE_DOMAIN_CATALOG) {
    for (const action of row.actions) {
      if (seen.has(action)) dup.push(action);
      else seen.add(action);
    }
  }
  return dup;
}
