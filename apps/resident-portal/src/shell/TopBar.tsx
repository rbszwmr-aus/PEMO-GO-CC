/**
 * The top bar carries NO navigation — logo, language switch, notification bell.
 *
 * The account menu is DELIBERATELY ABSENT (Ruling 4). It has no screen behind it
 * (profile is U-14, a screen the export does not cover), and giving it a
 * coming-soon state would make SOON mean two things — "this estate does not have
 * it yet" and "we have not built it" — and a resident could not tell them apart.
 * An affordance that opens nothing is a dead control; UI-019's rule is that a
 * capability which does not exist renders as ABSENT. Recorded in DIVERGENCES.md.
 *
 * The notification bell is different and is kept: Notifications (INBOX) is a LIVE
 * service, and its empty state is an honest statement about a service that
 * exists and has nothing in it. The count is data and is not rendered; the badge
 * slot reserves its space.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { Badge } from '../components/Badge.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';

export function TopBar({
  locale, showMenuButton, onToggleMenu, onLocale, onOpenNotifications,
}: {
  locale: Locale;
  showMenuButton: boolean;
  onToggleMenu: () => void;
  onLocale: (l: Locale) => void;
  onOpenNotifications: () => void;
}) {
  return (
    <header className="pemo-topbar" data-testid="topbar">
      {showMenuButton ? (
        <button
          type="button"
          className="pemo-topbar__menu"
          data-testid="menu-button"
          aria-label={t(MESSAGES.shell.openMenu, locale)}
          onClick={onToggleMenu}
        >
          <span className="pemo-topbar__menu-glyph" aria-hidden="true">☰</span>
        </button>
      ) : null}

      <a className="pemo-topbar__brand pemo-mono" href="?" aria-label={t(MESSAGES.topbar.homeLabel, locale)}>
        {t(MESSAGES.app.name, locale)}
      </a>

      <div className="pemo-topbar__spacer" />

      <LanguageSwitch locale={locale} onChange={onLocale} />

      <button
        type="button"
        className="pemo-topbar__bell"
        data-testid="notification-bell"
        aria-label={t(MESSAGES.topbar.notifications, locale)}
        onClick={onOpenNotifications}
      >
        <span className="pemo-topbar__bell-glyph" aria-hidden="true">◔</span>
        <Badge present />
      </button>
    </header>
  );
}
