/**
 * How a host flat is shown: from the location tree, in the viewer’s language
 * ("Block A · 12/F · Flat A1" / "A座 · 12樓 · A1室"), never as a system id.
 *
 * The Backend’s `unit_label` is a seeded demo label ("A · 12/F A1") and, for a unit
 * it does not know, the raw id. So the tree label wins; the Backend’s own label is
 * used only when the tree does not know the unit AND the label is not just the id.
 */
import type { PropertyTreeResponse } from './types.ts';
import { buildRailNodes } from '../shell/scope-focus.ts';
import { unitChoices } from './unit-choices.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { HostRef } from './front-counter-client.ts';

/**
 * The location tree the labels come from: the app states it (`setLocationTree`) from whichever tree it is showing, the
 * fixture tree in fixture mode and the live tree in live mode, so this module reads no corpus. Until one is stated a
 * flat is shown by the Backend's own label, or not at all.
 */
let tree: PropertyTreeResponse | null = null;

export function setLocationTree(next: PropertyTreeResponse | null): void {
  if (next === tree) return;
  tree = next;
  cache.clear();
  nodeCache.clear();
}

export const locationTree = (): PropertyTreeResponse | null => tree;

const cache = new Map<Locale, Map<string, string>>();

function labelsFor(locale: Locale): Map<string, string> {
  let m = cache.get(locale);
  if (!m) {
    const nodes = buildRailNodes(tree, null);
    m = new Map(unitChoices(nodes, locale).map((c) => [c.unit_id, c.unit_label]));
    cache.set(locale, m);
  }
  return m;
}

/**
 * The Backend treats these two ids as the same flat (the portal demo unit and the estate tree unit),
 * so the tree label is used for both.
 */
const SAME_FLAT: Record<string, string> = { unt_demo_a_12f_a1: 'unit_wfg_a_12_a1' };

const looksLikeId = (s: string) => /^(unt|unit|vis|qp)_/i.test(s);

/** The label to show, or null when all there is would be an id. */
export function hostDisplay(host: HostRef | null | undefined, locale: Locale): string | null {
  if (!host) return null;
  const labels = labelsFor(locale);
  const fromTree = labels.get(host.unit_id) ?? labels.get(SAME_FLAT[host.unit_id] ?? ''); 
  if (fromTree) return fromTree;
  const own = host.unit_label.trim();
  return own && own !== host.unit_id && !looksLikeId(own) ? own : null;
}

const nodeCache = new Map<Locale, Map<string, string>>();

/**
 * A scope node (estate, building, floor, unit) by its id, named from the location tree in the
 * viewer’s language, or null when the tree does not know it. Screens show this and keep the id
 * for the collapsed IT details.
 */
export function scopeNodeLabel(id: string | null | undefined, locale: Locale): string | null {
  if (!id) return null;
  let m = nodeCache.get(locale);
  if (!m) {
    m = new Map((tree?.nodes ?? []).map((n) => [n.node.id, t(n.label, locale)]));
    nodeCache.set(locale, m);
  }
  return m.get(id) ?? m.get(SAME_FLAT[id] ?? '') ?? null;
}

/** A flat by its unit id, in the same form as hostDisplay (block, floor, flat), or null. */
export function unitLabel(unitId: string | null | undefined, locale: Locale): string | null {
  if (!unitId) return null;
  const labels = labelsFor(locale);
  return labels.get(unitId) ?? labels.get(SAME_FLAT[unitId] ?? '') ?? null;
}
