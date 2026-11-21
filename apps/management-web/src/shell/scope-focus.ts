/**
 * Current viewing place in the estate → building → floor → unit tree.
 *
 * The rail is assembled from GET /properties/tree plus any estate-down nodes
 * the scope response already carries. Property-tree nodes win on overlap.
 * Sibling order: facilities and shared areas first, then sequence then id, never label
 * (compareSiblings in sequence-sort.ts). The Properties page reads the same list, so rail and page agree.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Facilities and shared areas are the top children under their parent.
 *   0.1.0 Rail assembly, focus helpers.
 *
 * `at=kind:id` on the URL is the selected place. Screens that already carry
 * a ScopePath (or a help-desk unit string) filter the rows they already have.
 * That is fixture chrome, not a live query parameter.
 */

import type {
  PropertyTreeResponse,
  ScopeKind,
  ScopePath,
  ScopeRef,
  ScopeTreeNode,
  ScopeTreeResponse,
} from '../data/types.ts';
import { indexByKey, nodeKey, parentKey, type NodeKey } from '../screens/tree-collapse.ts';
import { compareSiblings } from './sequence-sort.ts';

const RAIL_KINDS = new Set<ScopeKind>(['estate', 'building', 'floor', 'unit', 'location']);

export function parseFocusParam(param: string | undefined | null): NodeKey | null {
  if (!param) return null;
  const [kind, ...rest] = param.split(':');
  const id = rest.join(':');
  if (!kind || !id) return null;
  return `${kind}:${id}`;
}

export function focusKeyOf(ref: ScopeRef): NodeKey {
  return `${ref.kind}:${ref.id}`;
}

/** Estate-down nodes: property tree wins on overlap; scope fills gaps. */
export function buildRailNodes(
  tree: PropertyTreeResponse | null,
  scope: ScopeTreeResponse | null,
): ScopeTreeNode[] {
  const byKey = new Map<NodeKey, ScopeTreeNode>();
  for (const n of scope?.nodes ?? []) {
    if (RAIL_KINDS.has(n.node.kind)) byKey.set(nodeKey(n), { ...n });
  }
  for (const n of tree?.nodes ?? []) {
    if (RAIL_KINDS.has(n.node.kind)) byKey.set(nodeKey(n), { ...n });
  }

  const raw = [...byKey.values()].map((n) => {
    const pk = parentKey(n);
    if (pk && !byKey.has(pk)) return { ...n, parent: null };
    return n;
  });
  const map = indexByKey(raw);

  const depthOf = (n: ScopeTreeNode, seen: Set<NodeKey>): number => {
    const key = nodeKey(n);
    if (seen.has(key)) return 0;
    seen.add(key);
    const pk = parentKey(n);
    if (!pk) return 0;
    const p = map.get(pk);
    return p ? 1 + depthOf(p, seen) : 0;
  };
  const withDepth = raw.map((n) => ({ ...n, depth: depthOf(n, new Set()) }));

  const children = new Map<NodeKey | null, ScopeTreeNode[]>();
  for (const n of withDepth) {
    const pk = parentKey(n);
    const list = children.get(pk) ?? [];
    list.push(n);
    children.set(pk, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => compareSiblings(
      { kind: a.node.kind, sequence: a.sequence, id: a.node.id },
      { kind: b.node.kind, sequence: b.sequence, id: b.node.id },
    ));
  }

  const out: ScopeTreeNode[] = [];
  const walk = (pk: NodeKey | null): void => {
    for (const n of children.get(pk) ?? []) {
      out.push(n);
      walk(nodeKey(n));
    }
  };
  walk(null);
  return out;
}

export function findRailNode(nodes: readonly ScopeTreeNode[], key: NodeKey | null): ScopeTreeNode | null {
  if (!key) return null;
  return nodes.find((n) => nodeKey(n) === key) ?? null;
}

/** Estate › building › unit — whatever depth is selected, skipping org/portfolio. */
export function pathForFocus(nodes: readonly ScopeTreeNode[], key: NodeKey | null): ScopeRef[] {
  const found = findRailNode(nodes, key);
  if (!found) return [];
  const byKey = indexByKey(nodes);
  const trail: ScopeRef[] = [];
  let cur: ScopeTreeNode | undefined = found;
  const seen = new Set<NodeKey>();
  while (cur) {
    const k = nodeKey(cur);
    if (seen.has(k)) break;
    seen.add(k);
    trail.unshift(cur.node);
    const pk = parentKey(cur);
    cur = pk ? byKey.get(pk) : undefined;
  }
  return trail.filter((n) => RAIL_KINDS.has(n.kind));
}

export function scopePathInFocus(path: ScopePath | null | undefined, focusKey: NodeKey | null): boolean {
  if (!focusKey) return true;
  if (!path || path.unassigned) return false;
  if (focusKeyOf(path.node) === focusKey) return true;
  return path.ancestry.some((a) => focusKeyOf(a) === focusKey);
}

/**
 * Help-desk fixtures carry a unit display string (`A · 12/F A1`), not a ScopePath.
 * Match the already-authored string against the picked node's label.
 */
export function helpdeskUnitInFocus(unit: string, selected: ScopeTreeNode | null): boolean {
  if (!selected) return true;
  const kind = selected.node.kind;
  if (kind === 'estate') return true;
  const en = selected.label.en;
  const zh = selected.label['zh-Hant'];
  const text = unit.trim();
  if (kind === 'building') {
    const letter = en.replace(/^Block\s+/i, '').trim();
    return (
      text.startsWith(`${letter} ·`) ||
      text.startsWith(`${letter}·`) ||
      text.startsWith(`${letter} `) ||
      text.startsWith(`${zh} `) ||
      text.startsWith(zh)
    );
  }
  if (kind === 'floor') {
    return text.includes(en) || text.includes(zh);
  }
  if (kind === 'unit') {
    const flat = en.replace(/^Flat\s+/i, '').trim();
    return text.includes(flat) || text.includes(en) || text.includes(zh);
  }
  if (kind === 'location') {
    return text.includes(en) || text.includes(zh);
  }
  return true;
}

/** Selected node, its ancestors (for orientation), and its descendants. */
export function filterTreeToFocus(
  nodes: readonly ScopeTreeNode[],
  focusKey: NodeKey | null,
): ScopeTreeNode[] {
  if (!focusKey) return [...nodes];
  const byKey = indexByKey(nodes);
  if (!byKey.has(focusKey)) return [...nodes];
  const keep = new Set<NodeKey>();
  let cur: ScopeTreeNode | undefined = byKey.get(focusKey);
  while (cur) {
    keep.add(nodeKey(cur));
    const pk = parentKey(cur);
    cur = pk ? byKey.get(pk) : undefined;
  }
  for (const n of nodes) {
    let p = parentKey(n);
    while (p) {
      if (p === focusKey) {
        keep.add(nodeKey(n));
        break;
      }
      const parent = byKey.get(p);
      p = parent ? parentKey(parent) : null;
    }
  }
  return nodes.filter((n) => keep.has(nodeKey(n)));
}

export function expandedToReveal(nodes: readonly ScopeTreeNode[], focusKey: NodeKey | null): Set<NodeKey> {
  const open = new Set<NodeKey>();
  if (!focusKey) return open;
  const byKey = indexByKey(nodes);
  let cur = byKey.get(focusKey);
  while (cur) {
    const pk = parentKey(cur);
    if (pk) open.add(pk);
    cur = pk ? byKey.get(pk) : undefined;
  }
  return open;
}
