/**
 * The language switch — a segmented control, active language amber-filled.
 *
 * Three languages, shown as 繁 / 简 / EN (never locale codes). `brand.accent` amber is the
 * active fill; it is on-brand only and here it is a GROUND with brand.deep text, its
 * permitted position, never text on a light surface.
 */

import type { Locale } from '../i18n/locale.ts';
import { t } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';

/** Display order, left to right. */
const ORDER: readonly Locale[] = ['zh-Hant', 'zh-Hans', 'en'];

export function LanguageSwitch({
  locale, onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  return (
    <div
      className="pemo-langswitch"
      role="group"
      aria-label={t(MESSAGES.lang.switchLabel, locale)}
      data-testid="lang-switch"
    >
      {ORDER.map((l) => (
        <button
          key={l}
          type="button"
          className={`pemo-langswitch__btn${l === locale ? ' pemo-langswitch__btn--active' : ''}`}
          aria-pressed={l === locale}
          data-locale={l}
          onClick={() => onChange(l)}
        >
          {t(MESSAGES.lang[l], locale)}
        </button>
      ))}
    </div>
  );
}
