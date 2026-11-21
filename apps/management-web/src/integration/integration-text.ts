/**
 * Integration status, S05: the words the screen puts on a system, kept apart from the screen so they can be tested.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Copy, type Locale } from '../i18n/locale.ts';
import { scopeNodeLabel } from '../data/host-label.ts';
import { ESTATE_NODE_ID, type IntegrationSystem, type SystemKind } from './integration-status.ts';

const M = MESSAGES.integration;
export const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/**
 * The non-residential Locations a system can sit in. The residential property tree holds estate, blocks, floors
 * and flats only (a contract-track fixture), so these two would read “Another place”; the names are the seed’s.
 */
const LOCATION_NAMES: Readonly<Record<string, Copy>> = {
  loc_wfg_carpark: copy('Resident car park', '住戶停車場', '住户停车场'),
  loc_wfg_clubhouse: copy('Wing Fu Clubhouse', '榮富會所', '荣富会所'),
};

/** A place by its name in the property tree; no node, or the estate itself, is the whole estate. */
export function placeLabel(nodeId: string | null, locale: Locale): string {
  if (nodeId === null || nodeId === ESTATE_NODE_ID) return t(M.wholeEstate, locale);
  if (Object.hasOwn(LOCATION_NAMES, nodeId)) return t(LOCATION_NAMES[nodeId]!, locale);
  return scopeNodeLabel(nodeId, locale) ?? t(M.otherPlace, locale);
}

/** The kind of system in the reader’s language; a kind this build has not seen keeps the Hub’s own label. */
export function kindText(s: Pick<IntegrationSystem, 'kind' | 'kindLabel'>, locale: Locale): string {
  return Object.hasOwn(M.systemKind, s.kind) ? t(M.systemKind[s.kind as SystemKind], locale) : t(s.kindLabel, locale);
}

/** Why a system reads as it does: PEMO’s own sentence when PEMO worked it out, the Hub’s words otherwise. */
export function saidText(s: Pick<IntegrationSystem, 'state' | 'unknownReason' | 'message'>, locale: Locale): string {
  if (s.state === 'unknown') {
    const r = s.unknownReason;
    return t(r && Object.hasOwn(M.unknownReason, r) ? M.unknownReason[r] : M.unknownReasonOther, locale);
  }
  return t(s.message, locale);
}

export const deviceText = (s: IntegrationSystem, quiet: boolean, locale: Locale): string =>
  quiet || s.state === 'unknown' || s.devicesTotal === 0 ? t(M.noValue, locale) : fill(t(M.devicesOf, locale), { online: s.devicesOnline, total: s.devicesTotal });

