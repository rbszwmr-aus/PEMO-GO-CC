/**
 * Host-flat choices for the front counter, taken from the location tree.
 *
 * A unit’s label is its path under the estate in the tree’s own wording:
 * "Block A · 12/F · Flat A1". The id travels with the choice (the API takes it)
 * but is never shown.
 */
import type { ScopeTreeNode } from './types.ts';
import { t, type Locale } from '../i18n/locale.ts';

export interface UnitChoice {
  unit_id: string;
  unit_label: string;
  /** Building label, for the quick filter. */
  building: string;
  /** Lower-case haystack for search: the label in both languages. */
  haystack: string;
}

export function unitChoices(nodes: readonly ScopeTreeNode[], locale: Locale): UnitChoice[] {
  const byId = new Map<string, ScopeTreeNode>();
  for (const n of nodes) byId.set(n.node.id, n);
  const out: UnitChoice[] = [];
  for (const n of nodes) {
    if (n.node.kind !== 'unit') continue;
    const labels: string[] = [t(n.label, locale)];
    const both: string[] = [n.label.en, n.label['zh-Hant']];
    let building = '';
    let cur: ScopeTreeNode | undefined = n;
    const seen = new Set<string>([n.node.id]);
    while (cur?.parent) {
      const p = byId.get(cur.parent.id);
      if (!p || seen.has(p.node.id)) break;
      seen.add(p.node.id);
      if (p.node.kind === 'estate' || p.node.kind === 'organization') break;
      labels.unshift(t(p.label, locale));
      both.unshift(p.label.en, p.label['zh-Hant']);
      if (p.node.kind === 'building') building = t(p.label, locale);
      cur = p;
    }
    out.push({
      unit_id: n.node.id,
      unit_label: labels.join(' · '),
      building,
      haystack: both.join(' ').toLowerCase(),
    });
  }
  return out;
}

/** Matches every word of the query against the label (either language). Empty query returns the first `limit`. */
export function searchUnits(
  choices: readonly UnitChoice[],
  query: string,
  building: string | null,
  limit = 8,
): UnitChoice[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: UnitChoice[] = [];
  for (const c of choices) {
    if (building && c.building !== building) continue;
    if (words.every((w) => c.haystack.includes(w))) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
