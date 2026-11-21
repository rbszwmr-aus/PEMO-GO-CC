/**
 * What the reader sees when a screen's code did not arrive (a dropped connection, a chunk replaced by a newer
 * deploy). `ScreenErrorBoundary` keeps the shell and the nav on screen and shows this in the content area;
 * `BootFailure` is the same message when the page could not start at all (main.tsx).
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-20) Try again is a full reload (Chromium keeps a failed module import for the life of the page, so no in-page retry can succeed); BootFailure has its own body (there is no nav on that page).
 *   0.1.0 (2026-11-20) New (initial-bundle work, R&T P2-1).
 */

import { Component, type ReactNode } from 'react';

import { Icon } from '../components/Icon.tsx';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';

/** Try again reloads the page: the address already names this screen, and a reload is the one retry that works. */
function LoadFailure({ locale, body }: { locale: Locale; body: LocalizedText }) {
  return (
    <section className="pemo-state" data-testid="screen-load-error" role="alert">
      <h2 className="pemo-state__title">
        <Icon name="CircleAlert" /> {t(MESSAGES.state.errorTitle, locale)}
      </h2>
      <p className="pemo-state__body">{t(body, locale)}</p>
      <button type="button" className="pemo-button pemo-button--primary" data-testid="screen-load-retry" onClick={() => window.location.reload()}>
        {t(MESSAGES.state.tryAgain, locale)}
      </button>
    </section>
  );
}

/** The page could not start: no shell to keep, so the message stands alone. */
export function BootFailure({ locale }: { locale: Locale }) {
  return (
    <main className="pemo-main" id="main">
      <LoadFailure locale={locale} body={MESSAGES.state.bootFailedBody} />
    </main>
  );
}

interface Props { locale: Locale; resetKey: string; children: ReactNode }
interface State { failed: boolean; key: string }

/** Catches a failed screen chunk (or a screen that throws) so the shell and nav stay; a new route clears it. */
export class ScreenErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <LoadFailure locale={this.props.locale} body={MESSAGES.state.loadFailedBody} />
    );
  }
}
