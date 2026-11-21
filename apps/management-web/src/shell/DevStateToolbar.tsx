/**
 * DEVELOPMENT AFFORDANCE — EXCLUDED FROM THE PRODUCTION BUILD.
 *
 * The screen and state pickers exist so every state in the matrix is reachable
 * by hand while building. They are not product UI: no design shows them, and a
 * control that lets anyone select "session expired" or "internal error" is a
 * capability nobody should be able to reach.
 *
 * BUILD-EXCLUDED, NOT RUN-TIME-DISABLED, and the distinction is the point.
 *
 * GEN-013-ST's B6 is the reason: the `x-pemo-dev-now` seam was demonstrated to
 * reach `verify()` and accept an expired credential. It was "off" in production.
 * A dev affordance that is merely switched off is one flag, one misconfiguration
 * or one refactor from being live — because the code is still there, and
 * something still decides at run time whether to run it.
 *
 * Nothing decides here. `__PEMO_DEV_TOOLBAR__` is replaced by the literal
 * `false` unless the server is started with `PEMO_DEV_TOOLBAR=1`. The default
 * `vite` serve on :5175 therefore has no Screen/State pickers — navigation is
 * the left rail, and Playwright still constructs states from `?screen=&state=`.
 * The production bundle stays `false`, the branch folds, this module becomes
 * unreferenced and is dropped. There is no flag in the artefact to flip.
 *
 * PROVEN over the build OUTPUT by test/build/dev-affordance-excluded.test.ts —
 * a build-time property needs a build-time assertion. A test that the component
 * renders nothing would be a run-time claim about a build-time fact, which is
 * the same category error as the seam it exists to avoid.
 *
 * The sentinel below is what that assertion looks for.
 */

import { SCREEN_IDS, statesFor, type ScreenId } from '../data/states.ts';
import { DEV_TOOLBAR_SENTINEL } from './dev-toolbar-sentinel.ts';

export function DevStateToolbar({
  screen, state, onNavigate,
}: {
  screen: ScreenId;
  state: string;
  onNavigate: (next: { screen?: ScreenId | undefined; state?: string | undefined }) => void;
}) {
  return (
    <>
      <label className="pemo-field" data-dev={DEV_TOOLBAR_SENTINEL}>
        Screen
        <select
          data-testid="screen-select"
          value={screen}
          onChange={(e) => onNavigate({ screen: e.target.value as ScreenId, state: undefined })}
        >
          {SCREEN_IDS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
      </label>

      <label className="pemo-field">
        State
        <select
          data-testid="state-select"
          value={state}
          onChange={(e) => onNavigate({ state: e.target.value })}
        >
          {statesFor(screen).map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
        </select>
      </label>
    </>
  );
}
