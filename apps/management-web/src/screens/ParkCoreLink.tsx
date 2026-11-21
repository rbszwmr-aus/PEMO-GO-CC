/**
 * BUILDING SYSTEMS → Car Park — thin ParkCore connector.
 *
 * PEMO holds the car-park place; ParkCore is the parking + Octopus operator
 * console. This page explains that boundary and opens ParkCore in a new tab.
 * It does not embed ParkCore UI.
 */

import { HintRow } from '../components/FinanceBits.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import {
  PARKCORE_LAN_ORIGIN_PLACEHOLDER,
  PARKCORE_PATHS,
  parkcoreHref,
  parkcoreSsoStubHref,
} from '../data/parkcore-link.ts';

export function ParkCoreLink({ locale }: { locale: Locale }) {
  const M = MESSAGES.carPark;
  return (
    <section className="pemo-panel" data-testid="parkcore-connector">
      <HintRow text={t(M.body, locale)} />
      <HintRow text={t(M.isolationNote, locale)} testId="parkcore-isolation" />
      <HintRow text={`${t(M.lanNote, locale)} ${PARKCORE_LAN_ORIGIN_PLACEHOLDER}`} testId="parkcore-lan-note" />
      <span className="pemo-visually-hidden" data-testid="parkcore-lan-placeholder">{PARKCORE_LAN_ORIGIN_PLACEHOLDER}</span>
      <div className="pemo-actions">
        <a
          className="pemo-button pemo-button--primary"
          href={parkcoreHref(PARKCORE_PATHS.console)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="parkcore-open-console"
          data-read-affordance="navigate"
        >
          {t(M.openConsole, locale)}
        </a>
        <a
          className="pemo-button"
          href={parkcoreHref(PARKCORE_PATHS.counter)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="parkcore-open-counter"
          data-read-affordance="navigate"
        >
          {t(M.openCounter, locale)}
        </a>
        <a
          className="pemo-button"
          href={parkcoreHref(PARKCORE_PATHS.lists)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="parkcore-open-lists"
          data-read-affordance="navigate"
        >
          {t(M.openLists, locale)}
        </a>
        <a
          className="pemo-button"
          href={parkcoreSsoStubHref()}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="parkcore-sso-stub"
          data-read-affordance="navigate"
        >
          {t(M.ssoStub, locale)}
        </a>
      </div>
      <HintRow text={t(M.ssoStubNote, locale)} testId="parkcore-sso-note" />
    </section>
  );
}
