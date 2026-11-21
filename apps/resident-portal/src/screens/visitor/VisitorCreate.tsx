import { useState, type FormEvent } from 'react';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import {
  createMyVisitor,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_ID,
  FIXTURE_UNIT_LABEL,
  type DemoVisitor,
} from '../../data/visitors-client.ts';
import { fillTemplate } from '../../data/visitor-pass.ts';
import { unitLocationLabel } from '../../data/locations.ts';
import { VisitorPassPanel } from './VisitorPassPanel.tsx';

function defaultWindow(): { from: string; to: string } {
  // Starts now (minute precision rounds down), so the issued pass is valid at
  // once; the pass not_before follows expectedFrom.
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return `${shifted.toISOString().slice(0, 16)}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

export function VisitorCreate({
  locale,
  onCancel,
  onCreated,
}: {
  locale: Locale;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const M = MESSAGES.visitorPortal;
  const win = defaultWindow();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedFrom, setExpectedFrom] = useState(win.from);
  const [expectedTo, setExpectedTo] = useState(win.to);
  const [idStub, setIdStub] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<DemoVisitor | null>(null);

  function reset() {
    const next = defaultWindow();
    setCreated(null);
    setName('');
    setPurpose('');
    setIdStub('');
    setExpectedFrom(next.from);
    setExpectedTo(next.to);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !expectedFrom.trim() || !expectedTo.trim()) {
      setError(t(M.validationRequired, locale));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fromIso = expectedFrom.length === 16 ? `${expectedFrom}:00+08:00` : expectedFrom;
      const toIso = expectedTo.length === 16 ? `${expectedTo}:00+08:00` : expectedTo;
      const res = await createMyVisitor({
        name: name.trim(),
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
        expectedFrom: fromIso,
        expectedTo: toIso,
        hostUnitId: FIXTURE_UNIT_ID,
        ...(idStub.trim() ? { idStub: idStub.trim() } : {}),
      });
      if (!res.visitor) {
        setError(t(M.createFailed, locale));
        return;
      }
      setCreated(res.visitor);
    } catch {
      setError(t(M.createFailed, locale));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="pemo-panel" data-testid="portal-visitor-created" data-visitor-id={created.visitorId}>
        <h1 className="pemo-page-title">{t(M.createdTitle, locale)}</h1>
        <p className="pemo-note">{fillTemplate(t(M.createdBody, locale), { name: created.name })}</p>
        <VisitorPassPanel pass={created.pass} visitorId={created.visitorId} locale={locale} />
        <div className="pemo-toolbar">
          <button
            type="button"
            className="pemo-btn pemo-btn--primary"
            data-testid="portal-visitor-created-view"
            onClick={() => onCreated(created.visitorId)}
          >
            {t(M.viewVisitor, locale)}
          </button>
          <button
            type="button"
            className="pemo-btn"
            data-testid="portal-visitor-created-another"
            onClick={reset}
          >
            {t(M.createAnother, locale)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pemo-panel" data-testid="portal-visitor-create">
      <h1 className="pemo-page-title">{t(M.createTitle, locale)}</h1>
      <p className="pemo-note">
        {FIXTURE_RESIDENT_NAME} · {unitLocationLabel(FIXTURE_UNIT_ID, locale) ?? FIXTURE_UNIT_LABEL}
      </p>
      <form className="pemo-form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldName, locale)}</span>
          <input
            data-testid="portal-visitor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldPurpose, locale)}</span>
          <input
            data-testid="portal-visitor-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldExpectedFrom, locale)}</span>
          <input
            type="datetime-local"
            data-testid="portal-visitor-from"
            value={expectedFrom}
            onChange={(e) => setExpectedFrom(e.target.value)}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldExpectedTo, locale)}</span>
          <input
            type="datetime-local"
            data-testid="portal-visitor-to"
            value={expectedTo}
            onChange={(e) => setExpectedTo(e.target.value)}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldHostUnit, locale)}</span>
          <input value={unitLocationLabel(FIXTURE_UNIT_ID, locale) ?? FIXTURE_UNIT_LABEL} readOnly data-testid="portal-visitor-host-unit" />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldIdStub, locale)}</span>
          <input
            data-testid="portal-visitor-id-stub"
            value={idStub}
            onChange={(e) => setIdStub(e.target.value)}
            maxLength={40}
            placeholder={t(M.idStubPlaceholder, locale)}
          />
        </label>
        {error ? (
          <p className="pemo-note" role="alert" data-testid="portal-visitor-create-error">
            {error}
          </p>
        ) : null}
        <div className="pemo-toolbar">
          <button
            type="submit"
            className="pemo-btn pemo-btn--primary"
            disabled={busy}
            data-testid="portal-visitor-submit"
          >
            {t(M.submit, locale)}
          </button>
          <button
            type="button"
            className="pemo-btn"
            onClick={onCancel}
            data-testid="portal-visitor-cancel"
          >
            {t(M.cancel, locale)}
          </button>
        </div>
      </form>
    </div>
  );
}
