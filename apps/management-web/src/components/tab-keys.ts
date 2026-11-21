/**
 * Arrow-key roving for tab strips (WAI-ARIA tabs pattern).
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New. Pure so the key map is node-testable; LineTabs and
 *     ButtonTabs both use it.
 */

/** Which tab a key moves to, or null when the key is not a tab-strip key. */
export function nextTabId<Id extends string>(
  ids: readonly Id[],
  current: Id | null,
  key: string,
  rtl = false,
): Id | null {
  if (ids.length === 0) return null;
  const at = current === null ? -1 : ids.indexOf(current);
  const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === 'Home') return ids[0] as Id;
  if (key === 'End') return ids[ids.length - 1] as Id;
  if (key === fwd) return ids[(at + 1) % ids.length] as Id;
  if (key === back) return ids[(at - 1 + ids.length) % ids.length] as Id;
  return null;
}
