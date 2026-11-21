/**
 * Sibling order for scope/property tree nodes. Facilities and shared areas (kind 'location', e.g. a
 * clubhouse) come first under their parent; everything else (blocks, floors, flats) follows in its
 * existing order, which is sequence then id, never label. One helper, used by every tree renderer.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Facilities and shared areas sort first among siblings (compareSiblings).
 *   0.1.0 New: compareSequenceThenId.
 */

export function compareSequenceThenId(
  a: { sequence?: number | undefined; id: string },
  b: { sequence?: number | undefined; id: string },
): number {
  const sa = a.sequence ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sequence ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Facilities and shared areas: the tree kinds that are places rather than residential structure. */
export const isSharedAreaKind = (kind: string): boolean => kind === 'location';

/** Sibling comparator: facilities and shared areas first, then sequence then id (a stable, label-free order). */
export function compareSiblings(
  a: { kind: string; sequence?: number | undefined; id: string },
  b: { kind: string; sequence?: number | undefined; id: string },
): number {
  const ra = isSharedAreaKind(a.kind) ? 0 : 1;
  const rb = isSharedAreaKind(b.kind) ? 0 : 1;
  if (ra !== rb) return ra - rb;
  return compareSequenceThenId(a, b);
}
