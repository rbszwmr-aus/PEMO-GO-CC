/**
 * The states the design export never drew.
 *
 * DOC-014-ST section 2.2 is the specification here. A design deck omits loading,
 * error, offline, permission-denied and session-expired; a real product needs
 * every one of them, and an error must never be allowed to look like a normal
 * state — the same never-render-as-normal rule the resident surface carries.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import type { Problem } from '../data/types.ts';
import { ITDetails } from './FinanceBits.tsx';
import { presentProblem } from '../data/problem-presentation.ts';

function Block({
  kind, title, body, children, testId,
}: {
  kind?: 'gap' | 'deferred';
  title: string;
  body?: string;
  children?: React.ReactNode;
  testId: string;
}) {
  return (
    <section
      className={`pemo-state${kind ? ` pemo-state--${kind}` : ''}`}
      data-testid={testId}
      role={kind ? undefined : 'status'}
    >
      <h2 className="pemo-state__title">{title}</h2>
      {body ? <p className="pemo-state__body">{body}</p> : null}
      {children}
    </section>
  );
}

export function Loading({ locale }: { locale: Locale }) {
  return (
    <Block
      testId="state-loading"
      title={t(MESSAGES.state.loadingTitle, locale)}
      body={t(MESSAGES.state.loadingBody, locale)}
    >
      <div aria-hidden="true">
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
      testId="state-empty"
      title={t(MESSAGES.state.emptyTitle, locale)}
      body={t(MESSAGES.state.emptyBody, locale)}
    />
  );
}

/**
 * Client connectivity. NEVER a severity — severity.json notASeverity: the server
 * cannot know this browser's network state, so it can never emit one, and a
 * connectivity severity would show a severity unrelated to the actual estate.
 */
export function Offline({ locale }: { locale: Locale }) {
  return (
    <Block
      testId="state-offline"
      title={t(MESSAGES.state.offlineTitle, locale)}
      body={t(MESSAGES.state.offlineBody, locale)}
    />
  );
}

export function PartialBanner({ locale, reasons }: { locale: Locale; reasons: LocalizedText[] }) {
  return (
    <Block
      testId="state-partial"
      title={t(MESSAGES.state.partialTitle, locale)}
      body={t(MESSAGES.state.partialBody, locale)}
    >
      <ul>
        {reasons.map((r, i) => (
          <li key={i} className="pemo-state__body">{t(r, locale)}</li>
        ))}
      </ul>
    </Block>
  );
}

/**
 * A Problem, rendered as an explicit failure.
 *
 * The staff message comes from the SERVER and is rendered as received; it is not
 * client-authored copy and is not this app's to reword. The correlation
 * identifier sits in the collapsed IT details (system ids never sit on a main
 * view); a staff member opens it to quote the reference to the office, and design
 * system 4.3 sets it in the monospace face for that reading-aloud case.
 */
export function ProblemState({ problem, locale }: { problem: Problem; locale: Locale }) {
  // Presented by TYPE (problem-presentation.ts): the notices refusals each carry
  // their own title and discriminator, so a half-translated publish never looks
  // like a generic failure.
  const { kind, title } = presentProblem(problem);
  return (
    <section
      className="pemo-state"
      data-testid="state-problem"
      data-problem-status={problem.status}
      data-problem-kind={kind}
      role="alert"
    >
      <h2 className="pemo-state__title">{title ? t(title, locale) : problem.title}</h2>
      {problem.staffMessage ? (
        <p className="pemo-state__body">{t(problem.staffMessage, locale)}</p>
      ) : null}
      <p className="pemo-state__body">
        {problem.retryable ? t(MESSAGES.state.retryable, locale) : t(MESSAGES.state.notRetryable, locale)}
      </p>
      <ITDetails locale={locale} testId="state-it-details" rows={[[MESSAGES.state.correlationLabel, problem.correlationId]]} />
    </section>
  );
}

/**
 * A state the CONTRACT describes and the CORPUS does not carry.
 *
 * Rendered rather than silently skipped. The PID's rule is that a screen needing
 * data no fixture provides is a contract finding worth more reported than worked
 * around, so the gap is made visible in the product and not only in a report.
 */
export function NoFixture({ locale, missing }: { locale: Locale; missing?: LocalizedText | undefined }) {
  return (
    <Block
      kind="gap"
      testId="state-no-fixture"
      title={t(MESSAGES.gap.noFixtureTitle, locale)}
      body={t(MESSAGES.gap.noFixtureBody, locale)}
    >
      {missing ? (
        <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-3)' }}>
          <dt>{t(MESSAGES.gap.noFixtureReasonLabel, locale)}</dt>
          <dd>{t(missing, locale)}</dd>
        </dl>
      ) : null}
    </Block>
  );
}
