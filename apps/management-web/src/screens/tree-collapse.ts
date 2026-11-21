/**
 * Client chrome for the S3 property tree: which rows are visible.
 *
 * The node list stays in the server nested preorder (PID 055). This module
 * does not sort. Collapse is not a corpus state.
 *
 * Default: estate and buildings stay visible; floors and units wait for a
 * building (or Expand all). Parent pointers come from the payload.
 */

import type { ScopeTreeNode } from '../data/types.ts';

export type NodeKey = string;

export function nodeKey(n: ScopeTreeNode): NodeKey {
  return `${n.node.kind}:${n.node.id}`;
}

export function parentKey(n: ScopeTreeNode): NodeKey | null {
  const p = n.parent;
  if (!p || !p.id) return null;
  return `${p.kind}:${p.id}`;
}

export function indexByKey(nodes: readonly ScopeTreeNode[]): Map<NodeKey, ScopeTreeNode> {
  const map = new Map<NodeKey, ScopeTreeNode>();
  for (const n of nodes) map.set(nodeKey(n), n);
  return map;
}

/** Keys of nodes that have at least one child in this list. */
export function withChildren(nodes: readonly ScopeTreeNode[]): Set<NodeKey> {
  const keys = new Set<NodeKey>();
  for (const n of nodes) {
    const p = parentKey(n);
    if (p) keys.add(p);
  }
  return keys;
}

/** Buildings stay collapsed so floors stay hidden. */
export function defaultExpanded(_nodes?: readonly ScopeTreeNode[]): Set<NodeKey> {
  return new Set();
}

export function expandAll(nodes: readonly ScopeTreeNode[]): Set<NodeKey> {
  return new Set(withChildren(nodes));
}

export function collapseAll(nodes: readonly ScopeTreeNode[]): Set<NodeKey> {
  return defaultExpanded(nodes);
}

export function rowVisible(
  n: ScopeTreeNode,
  byKey: ReadonlyMap<NodeKey, ScopeTreeNode>,
  expanded: ReadonlySet<NodeKey>,
): boolean {
  if (n.node.kind === 'estate' || n.node.kind === 'building') return true;
  let p = parentKey(n);
  while (p) {
    const parent = byKey.get(p);
    if (!parent) return true;
    if (parent.node.kind !== 'estate' && !expanded.has(p)) return false;
    p = parentKey(parent);
  }
  return true;
}

export function visibleNodes(
  nodes: readonly ScopeTreeNode[],
  expanded: ReadonlySet<NodeKey>,
): ScopeTreeNode[] {
  const byKey = indexByKey(nodes);
  return nodes.filter((n) => rowVisible(n, byKey, expanded));
}

export function toggleExpanded(expanded: ReadonlySet<NodeKey>, key: NodeKey): Set<NodeKey> {
  const next = new Set(expanded);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Keys of nodes under `root` (not including `root`). */
export function descendantKeys(
  nodes: readonly ScopeTreeNode[],
  root: NodeKey,
): Set<NodeKey> {
  const byKey = indexByKey(nodes);
  const out = new Set<NodeKey>();
  for (const n of nodes) {
    const key = nodeKey(n);
    if (key === root) continue;
    let p = parentKey(n);
    while (p) {
      if (p === root) {
        out.add(key);
        break;
      }
      const parent = byKey.get(p);
      if (!parent) break;
      p = parentKey(parent);
    }
  }
  return out;
}

/**
 * Open `root` and every descendant that has children, leaving every other
 * node's expand state unchanged. Used by a block's Expand-all control.
 */
export function expandSubtree(
  expanded: ReadonlySet<NodeKey>,
  nodes: readonly ScopeTreeNode[],
  root: NodeKey,
): Set<NodeKey> {
  const next = new Set(expanded);
  const childful = withChildren(nodes);
  if (childful.has(root)) next.add(root);
  for (const k of descendantKeys(nodes, root)) {
    if (childful.has(k)) next.add(k);
  }
  return next;
}

/**
 * Close `root` and drop every descendant key, leaving sibling subtrees
 * untouched. Used by a block's Collapse-all control.
 */
export function collapseSubtree(
  expanded: ReadonlySet<NodeKey>,
  nodes: readonly ScopeTreeNode[],
  root: NodeKey,
): Set<NodeKey> {
  const next = new Set(expanded);
  next.delete(root);
  for (const k of descendantKeys(nodes, root)) next.delete(k);
  return next;
}

/** Trim + case-fold. Empty after trim means "no search". */
export function normalizeTreeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Match estate / block / floor / unit labels in both locales. The rail filter
 * is over nodes the server already returned (grant-limited), so it discloses
 * nothing extra.
 */
export function nodeMatchesQuery(n: ScopeTreeNode, query: string): boolean {
  const q = normalizeTreeQuery(query);
  if (!q) return false;
  const en = n.label.en.toLowerCase();
  const zh = (n.label['zh-Hant'] ?? '').toLowerCase();
  return en.includes(q) || zh.includes(q);
}

/**
 * Matching nodes plus every ancestor needed to keep the hit in context.
 * Empty query yields an empty set — the rail then uses normal visibility.
 */
export function searchKeepKeys(
  nodes: readonly ScopeTreeNode[],
  query: string,
): Set<NodeKey> {
  const q = normalizeTreeQuery(query);
  const keep = new Set<NodeKey>();
  if (!q) return keep;
  const byKey = indexByKey(nodes);
  for (const n of nodes) {
    if (!nodeMatchesQuery(n, q)) continue;
    let cur: ScopeTreeNode | undefined = n;
    const seen = new Set<NodeKey>();
    while (cur) {
      const key = nodeKey(cur);
      if (seen.has(key)) break;
      seen.add(key);
      keep.add(key);
      const pk = parentKey(cur);
      cur = pk ? byKey.get(pk) : undefined;
    }
  }
  return keep;
}

/** Open every ancestor of a match so the hit is actually on screen. */
export function expandedToRevealMatches(
  nodes: readonly ScopeTreeNode[],
  query: string,
): Set<NodeKey> {
  const q = normalizeTreeQuery(query);
  const open = new Set<NodeKey>();
  if (!q) return open;
  const byKey = indexByKey(nodes);
  for (const n of nodes) {
    if (!nodeMatchesQuery(n, q)) continue;
    let cur: ScopeTreeNode | undefined = n;
    const seen = new Set<NodeKey>();
    while (cur) {
      const key = nodeKey(cur);
      if (seen.has(key)) break;
      seen.add(key);
      const pk = parentKey(cur);
      if (pk) open.add(pk);
      cur = pk ? byKey.get(pk) : undefined;
    }
  }
  return open;
}

/**
 * Normal collapse rules, then (when querying) drop branches that are neither
 * a match nor an ancestor of one.
 */
export function visibleNodesForQuery(
  nodes: readonly ScopeTreeNode[],
  expanded: ReadonlySet<NodeKey>,
  query: string,
): ScopeTreeNode[] {
  const q = normalizeTreeQuery(query);
  if (!q) return visibleNodes(nodes, expanded);
  const keep = searchKeepKeys(nodes, query);
  const byKey = indexByKey(nodes);
  return nodes.filter((n) => keep.has(nodeKey(n)) && rowVisible(n, byKey, expanded));
}
