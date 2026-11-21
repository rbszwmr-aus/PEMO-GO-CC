import type { Locale } from '../i18n/locale.ts';

/** The switcher shows endonyms, never locale codes: 繁 / 简 / EN. */
const LANG_SEGS: Array<{ label: string; locale: Locale }> = [
  { label: '繁', locale: 'zh-Hant' },
  { label: '简', locale: 'zh-Hans' },
  { label: 'EN', locale: 'en' },
];

export function LanguageTab({
  locale,
  onNavigate,
}: {
  locale: Locale;
  onNavigate: (next: { locale?: Locale | undefined }) => void;
}) {
  return (
    <div className="pemo-lang" data-testid="locale-tab" role="group">
      {LANG_SEGS.map((seg) => (
        <button
          key={seg.locale}
          type="button"
          className="pemo-lang__seg"
          data-testid="locale-seg"
          data-locale={seg.locale}
          aria-pressed={seg.locale === locale}
          onClick={() => onNavigate({ locale: seg.locale })}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
