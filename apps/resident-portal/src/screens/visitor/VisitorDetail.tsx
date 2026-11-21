import { HelpBubble } from '../../components/HelpBubble.tsx';
import { useState } from 'react';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import { formatHktStamp } from '../../format/datetime.ts';
import { unitLocationLabel } from '../../data/locations.ts';
import { checkOutMyVisitor, type DemoVisitor } from '../../data/visitors-client.ts';
import { VisitorPassPanel } from './VisitorPassPanel.tsx';

export function VisitorDetail({
  visitor,
  source,
  locale,
  onBack,
  onUpdated,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionLabel,
}: {
  visitor: DemoVisitor;
  source: 'api' | 'local';
  locale: Locale;
  onBack: () => void;
  onUpdated: (next: DemoVisitor) => void;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string | undefined;
}) {
  const M = MESSAGES.visitorPortal;
  const [busy, setBusy] = useState(false);
  const canCheckOut = visitor.status === 'expected' || visitor.status === 'checked_in';

  async function onCheckOut() {
    setBusy(true);
    try {
      const res = await checkOutMyVisitor(visitor.visitorId);
      const next = res.visitor;
      if (next) onUpdated(next.pass === undefined && visitor.pass !== undefined ? { ...next, pass: visitor.pass } : next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pemo-panel" data-testid="portal-visitor-detail" data-visitor-id={visitor.visitorId}>
      <p className="pemo-note" data-testid="portal-visitor-nav">
        <button type="button" className="pemo-btn" data-testid="portal-visitor-back" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
        {positionLabel ? (
          <span className="pemo-meta" data-testid="portal-visitor-position">{positionLabel}</span>
        ) : null}
      </p>

      <div className="pemo-title-row" data-testid="portal-visitor-title-row">
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-visitor-prev"
          aria-label={t(M.prevVisitor, locale)}
          disabled={!hasPrev || !onPrev}
          onClick={() => onPrev?.()}
        >
          ‹
        </button>
        <h1 className="pemo-page-title">{visitor.name}</h1>
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-visitor-next"
          aria-label={t(M.nextVisitor, locale)}
          disabled={!hasNext || !onNext}
          onClick={() => onNext?.()}
        >
          ›
        </button>
      </div>

      <HelpBubble testId="portal-visitor-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      <dl className="pemo-dl">
        <dt>{t(M.fieldStatus, locale)}</dt>
        <dd>
          <span className="pemo-chip" data-testid="portal-visitor-status">
            {t(M.status[visitor.status as keyof typeof M.status], locale)}
          </span>
        </dd>
        <dt>{t(M.fieldPurpose, locale)}</dt>
        <dd>{visitor.purpose ?? t(M.purposeNone, locale)}</dd>
        <dt>{t(M.fieldExpectedFrom, locale)}</dt>
        <dd data-testid="portal-visitor-from">{formatHktStamp(visitor.expectedFrom, locale)}</dd>
        <dt>{t(M.fieldExpectedTo, locale)}</dt>
        <dd data-testid="portal-visitor-to">{formatHktStamp(visitor.expectedTo, locale)}</dd>
        <dt>{t(M.fieldHostUnit, locale)}</dt>
        <dd data-testid="portal-visitor-host-unit">{unitLocationLabel(visitor.hostUnitId, locale) ?? t(M.hostUnitUnknown, locale)}</dd>
        <dt>{t(M.fieldIdStub, locale)}</dt>
        <dd>{visitor.idStub ?? t(M.idStubNone, locale)}</dd>
        <dt>{t(M.fieldCheckedOut, locale)}</dt>
        <dd data-testid="portal-visitor-checked-out">{visitor.checkedOutAt ? formatHktStamp(visitor.checkedOutAt, locale) : '—'}</dd>
      </dl>
      <VisitorPassPanel pass={visitor.pass} visitorId={visitor.visitorId} locale={locale} />
      {canCheckOut ? (
        <div className="pemo-toolbar">
          <button
            type="button"
            className="pemo-btn"
            data-testid="portal-visitor-checkout"
            disabled={busy}
            onClick={() => void onCheckOut()}
          >
            {t(M.checkOutAction, locale)}
          </button>
          <p className="pemo-note">{t(M.noUnlockNote, locale)}</p>
        </div>
      ) : null}
    </div>
  );
}
