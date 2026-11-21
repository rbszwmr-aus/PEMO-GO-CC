/**
 * An RFC 9457 problem, rendered from the contract body's `residentMessage`
 * (server copy) — not a client-invented error sentence. `role="alert"`, so an
 * error never reads as a normal state. `retryable` is shown as the server states
 * it; nothing is inferred.
 */

import { t, type Locale } from '../i18n/locale.ts';
import type { Problem } from '../data/types.ts';

export function ProblemView({ problem, locale }: { problem: Problem; locale: Locale }) {
  return (
    <section className="pemo-state pemo-state--error" data-testid="problem" data-status={problem.status} role="alert">
      <h2 className="pemo-state__title">{problem.title}</h2>
      {problem.residentMessage
        ? <p className="pemo-state__body">{t(problem.residentMessage, locale)}</p> : null}
    </section>
  );
}
