/**
 * The coming-soon state a SOON service opens.
 *
 * A SOON service is present, dimmed and tappable, and opens THIS — never a
 * disabled menu item. A disabled control asserts a capability that does not
 * exist (UI-019); a coming-soon panel states, truthfully, that this estate does
 * not have the service yet.
 *
 * Title and body only. The export's RESERVED `inherits[]` list is NOT rendered
 * (Ruling 8): read as resident copy it asserts capabilities that do not exist —
 * "the QR pass component", "the payment gateway", "the booking wizard" — which
 * is the UI-022-ST copy-claims class. Those lines live in DIVERGENCES.md as the
 * engineering dependency map they are.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { ReservedId } from '../data/services.ts';

export function ComingSoonPanel({ id, locale }: { id: ReservedId; locale: Locale }) {
  const panel = MESSAGES.reserved[id];
  const titleId = `coming-soon-${id}`;
  return (
    <section
      className="pemo-coming-soon"
      data-testid="coming-soon"
      data-service={id}
      role="region"
      aria-labelledby={titleId}
    >
      <p className="pemo-coming-soon__eyebrow">{t(MESSAGES.comingSoon.eyebrow, locale)}</p>
      <h1 id={titleId} className="pemo-page-title pemo-coming-soon__title">{t(panel.title, locale)}</h1>
      <p className="pemo-coming-soon__body">{t(panel.body, locale)}</p>
    </section>
  );
}
