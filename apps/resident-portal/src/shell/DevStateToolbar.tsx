/**
 * DEVELOPMENT AFFORDANCE — EXCLUDED FROM THE PRODUCTION BUILD.
 *
 * The service and state pickers exist so every state in the matrix is reachable
 * by hand while building — this surface renders no data, so the four states are
 * reached here, not driven to by data. They are not product UI: no design shows
 * them, and a control that lets anyone select "session error" or "permission
 * denied" is a capability nobody should be able to reach.
 *
 * BUILD-EXCLUDED, NOT RUN-TIME-DISABLED, and the distinction is the point.
 *
 * GEN-013-ST's B6: the `x-pemo-dev-now` seam was demonstrated to reach verify()
 * and accept an expired credential. It was "off" in production. A dev affordance
 * that is merely switched off is one flag, one misconfiguration or one refactor
 * from being live — because the code is still there, and something still decides
 * at run time whether to run it.
 *
 * Nothing decides here. `__PEMO_DEV_TOOLBAR__` is replaced by the literal
 * `false` at build time, the branch folds, this module becomes unreferenced and
 * is dropped from the bundle. There is no flag in the artefact to flip.
 *
 * PROVEN over the build OUTPUT by test/artefact/dev-affordance-excluded.test.ts.
 * A test that the component renders nothing would be a run-time claim about a
 * build-time fact — the same category error as the seam it exists to avoid.
 */

import { SERVICE_IDS, type ServiceId } from '../data/services.ts';
import { DEV_TOOLBAR_SENTINEL } from './dev-toolbar-sentinel.ts';

export function DevStateToolbar({
  service, state, stateOptions, onNavigate,
}: {
  service: ServiceId;
  state: string;
  stateOptions: readonly string[];
  onNavigate: (next: { service?: ServiceId; state?: string }) => void;
}) {
  return (
    <div className="pemo-devbar" data-dev={DEV_TOOLBAR_SENTINEL} data-testid="dev-toolbar">
      <label className="pemo-devbar__field">
        Service
        <select
          data-testid="dev-service-select"
          value={service}
          onChange={(e) => onNavigate({ service: e.target.value as ServiceId })}
        >
          {SERVICE_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="pemo-devbar__field">
        State
        <select
          data-testid="dev-state-select"
          value={state}
          onChange={(e) => onNavigate({ state: e.target.value })}
        >
          {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}
