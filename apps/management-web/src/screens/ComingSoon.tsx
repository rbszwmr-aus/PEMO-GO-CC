import { t, type Locale } from '../i18n/locale.ts';
import type { LocalizedText } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';

export function ComingSoon({
  title,
  locale,
}: {
  title: LocalizedText;
  locale: Locale;
}) {
  return (
    <div className="pemo-panel" data-testid="coming-soon">
      <h2 className="pemo-panel__title">{t(title, locale)}</h2>
      <p className="pemo-note">{t(MESSAGES.shell.comingSoonBody, locale)}</p>
    </div>
  );
}
