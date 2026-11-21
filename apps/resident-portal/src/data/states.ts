/**
 * THE STATE REGISTRY — the specification for state coverage, in one place.
 *
 * PID section 6: loading, empty, error and permission-denied for every pane the
 * shell can open, each proven to FAIL FOR ITS OWN REASON (UI-019's standard).
 *
 * This surface renders NO DATA, so unlike the management web there are no
 * fixture-backed states here. Every content pane a LIVE service opens is one of
 * these client-only states, and `empty` is the DELIVERABLE — a data pane with
 * nothing in it is the honest thing to show, not a placeholder value (trap 7).
 *
 * `offline` is included because a resident device losing connection is real and
 * is NOT a severity (severity.json section 3.1: the server cannot know the
 * client's network state). It is client connectivity, rendered from the browser.
 *
 * Write-dependent states — saving, action failure, success confirmation — are
 * deliberately ABSENT: there are no writes in this PID, and their absence is the
 * correct outcome, not a gap.
 */

export const PANE_STATES = ['empty', 'loading', 'error', 'denied', 'offline'] as const;
export type PaneState = (typeof PANE_STATES)[number];

/** The honest default for a data-free pane: there is genuinely nothing in it. */
export const DEFAULT_STATE: PaneState = 'empty';

export function isPaneState(v: string | null | undefined): v is PaneState {
  return (PANE_STATES as readonly string[]).includes(v ?? '');
}

/** The distinct test id each state carries, so an assertion targets its own
 *  state and cannot pass because the page merely went blank. */
export const STATE_TESTID: Record<PaneState, string> = {
  empty: 'state-empty',
  loading: 'state-loading',
  error: 'state-error',
  denied: 'state-denied',
  offline: 'state-offline',
};
