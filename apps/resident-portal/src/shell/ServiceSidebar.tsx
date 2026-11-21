/**
 * The sidebar — "All Services", the single global navigation surface.
 *
 * Every service is present with its mark, label and a LIVE/SOON tag. SOON
 * services are dimmed but present and tappable (they open a coming-soon panel) —
 * never disabled. A flat list, not the management web's OPERATE/SAFETY grouping
 * (B1 does not recur). Active item on brand.primary with brand.deep text.
 *
 * The same list is rendered in the desktop/tablet rail and inside the mobile
 * drawer; only the wrapper differs (see Shell).
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { SERVICES, type ServiceId } from '../data/services.ts';
import { ServiceIcon } from '../components/ServiceIcon.tsx';

export function ServiceSidebar({
  active, locale, onSelect, idPrefix,
}: {
  active: ServiceId;
  locale: Locale;
  onSelect: (id: ServiceId) => void;
  /** Distinguishes the rail's and the drawer's copies for stable test ids. */
  idPrefix: string;
}) {
  return (
    <nav className="pemo-sidebar" aria-label={t(MESSAGES.shell.navSectionLabel, locale)}>
      <ul className="pemo-sidebar__list">
        {SERVICES.map((s) => {
          const on = s.id === active;
          const tag = s.tag === 'live' ? MESSAGES.tag.live : MESSAGES.tag.soon;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`pemo-nav-item pemo-nav-item--${s.tag}${on ? ' pemo-nav-item--active' : ''}`}
                aria-current={on ? 'page' : undefined}
                data-testid={`${idPrefix}-nav-item`}
                data-service={s.id}
                data-tag={s.tag}
                onClick={() => onSelect(s.id)}
              >
                <ServiceIcon service={s} active={on} />
                <span className="pemo-nav-item__label">{t(MESSAGES.services[s.id].name, locale)}</span>
                <span className={`pemo-tag pemo-tag--${s.tag}`} data-testid="service-tag">
                  {t(tag, locale)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
