/**
 * THE FOUR DISCRIMINATED STATES, plus offline.
 *
 * Each renders a DISTINCT data-testid and a role chosen for what it is: an error
 * and a permission denial are `alert`; loading, empty and offline are `status`.
 * The distinctness is the point — PID section 6 requires each state's assertion
 * to fail for its OWN reason, so a broken page that renders nothing must not make
 * the `empty` assertion pass. test/browser/state-matrix.spec.ts proves it by
 * targeting each state's own test id, and the mutation battery proves the
 * assertion goes red for the wrong reason if the page is merely blanked.
 *
 * An error must never be allowed to look like a normal state — the same
 * never-render-as-normal rule the resident mobile surface carries.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { STATE_TESTID } from '../data/states.ts';

function Block({
  testId, role, kind, title, body, children,
}: {
  testId: string;
  role: 'status' | 'alert';
  kind: 'empty' | 'loading' | 'error' | 'denied' | 'offline';
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`pemo-state pemo-state--${kind}`}
      data-testid={testId}
      data-state={kind}
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
    >
      <h2 className="pemo-state__title">{title}</h2>
      <p className="pemo-state__body">{body}</p>
      {children}
    </section>
  );
}

export function Loading({ locale }: { locale: Locale }) {
  return (
    <Block
      testId={STATE_TESTID.loading} role="status" kind="loading"
      title={t(MESSAGES.state.loadingTitle, locale)}
      body={t(MESSAGES.state.loadingBody, locale)}
    >
      <div className="pemo-skeleton-set" aria-hidden="true">
        <div className="pemo-skeleton" />
        <div className="pemo-skeleton" />
        <div className="pemo-skeleton" />
      </div>
    </Block>
  );
}

export function Empty({ locale }: { locale: Locale }) {
  return (
    <Block
      testId={STATE_TESTID.empty} role="status" kind="empty"
      title={t(MESSAGES.state.emptyTitle, locale)}
      body={t(MESSAGES.state.emptyBody, locale)}
    />
  );
}

export function ErrorState({ locale }: { locale: Locale }) {
  return (
    <Block
      testId={STATE_TESTID.error} role="alert" kind="error"
      title={t(MESSAGES.state.errorTitle, locale)}
      body={t(MESSAGES.state.errorBody, locale)}
    />
  );
}

export function PermissionDenied({ locale }: { locale: Locale }) {
  return (
    <Block
      testId={STATE_TESTID.denied} role="alert" kind="denied"
      title={t(MESSAGES.state.deniedTitle, locale)}
      body={t(MESSAGES.state.deniedBody, locale)}
    />
  );
}

/**
 * Client connectivity. NEVER a severity — severity.json section 3.1: the server
 * cannot know this browser's network state, so it can never emit one, and a
 * connectivity severity would show a severity unrelated to the actual estate.
 */
export function Offline({ locale }: { locale: Locale }) {
  return (
    <Block
      testId={STATE_TESTID.offline} role="status" kind="offline"
      title={t(MESSAGES.state.offlineTitle, locale)}
      body={t(MESSAGES.state.offlineBody, locale)}
    />
  );
}
