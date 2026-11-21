import { t, type Locale } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { LanguageTab } from '../shell/LanguageTab.tsx';

export function SignedOut({
  locale,
  onNavigate,
  onSignIn,
}: {
  locale: Locale;
  onNavigate: (next: { locale?: Locale | undefined }) => void;
  onSignIn: () => void;
}) {
  return (
    <div className="pemo-signed-out" data-testid="signed-out">
      <header className="pemo-header">
        <div className="pemo-header__crumb">
          <span className="pemo-header__crumbCurrent">{t(MESSAGES.shell.brandName, locale)}</span>
          <span className="pemo-header__crumbSep">·</span>
          <span className="pemo-header__crumbMuted">{t(MESSAGES.shell.brandSub, locale)}</span>
        </div>
        <div className="pemo-header__spacer" />
        <LanguageTab locale={locale} onNavigate={onNavigate} />
      </header>
      <main className="pemo-signed-out__main" id="main">
        <div className="pemo-panel pemo-signed-out__panel">
          <h1 className="pemo-page-title" data-testid="page-title">
            {t(MESSAGES.account.signedOutTitle, locale)}
          </h1>
          <p className="pemo-note">{t(MESSAGES.account.signedOutBody, locale)}</p>
          <div className="pemo-actions">
            <button
              type="button"
              className="pemo-button pemo-button--primary"
              data-testid="sign-in-fixture"
              onClick={onSignIn}
            >
              {t(MESSAGES.account.signInFixture, locale)}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
