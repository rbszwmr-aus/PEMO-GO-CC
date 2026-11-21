/**
 * Deferred writes, rendered as ABSENT rather than as broken.
 *
 * CORRECTED AT UI-045. This comment used to say "the contract has no write
 * operations". That was true when UI-019-ST shipped and stopped being true at
 * GEN-040/042/043: management-web 2.0.0 carries EIGHTEEN of them. The sentence
 * survived the contract that falsified it because no gate runs this suite, which
 * is UI-045 finding F3.
 *
 * The reason the writes are still absent is unchanged, and it is not the
 * contract's silence — it is that the CLIENT CANNOT SAY WHO MAY PRESS. ADR-007 A4
 * records role differentiation as entirely undesigned, ADR-010's role list is
 * open, and UI-004's overview ruling forbids the client acquiring a role concept.
 * A single designed role is the absence of evidence, not evidence that one role
 * suffices. The honest signal is the server's PERMITTED ACTIONS, arriving with
 * 2.1.0; until then a control here would be a control nobody can say who may
 * press.
 *
 * So a control here would be a control nobody can say who may press, and a
 * button that does nothing is worse than no button. The actions are NAMED —
 * omitting them silently would lose the information that they were considered.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';

export function DeferredActions({ locale, actions }: { locale: Locale; actions: LocalizedText[] }) {
  // Not offered yet, so nothing is drawn: no row, no placeholder icons. The names stay in the page for assistive
  // technology and for the presence gates that prove each deferred act was considered.
  return (
    <p className="pemo-visually-hidden" data-testid="deferred-actions">
      <span>{t(MESSAGES.deferred.heading, locale)}</span>
      {actions.map((a, i) => (
        <span key={i} data-testid="deferred-action">{t(a, locale)}</span>
      ))}
    </p>
  );
}
