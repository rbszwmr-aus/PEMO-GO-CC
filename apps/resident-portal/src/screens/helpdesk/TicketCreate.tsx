import { useState, type FormEvent } from 'react';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import {
  createMyTicket,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
} from '../../data/tickets-client.ts';

const CATEGORIES = ['maintenance', 'noise', 'access', 'general', 'billing'] as const;

export function TicketCreate({
  locale,
  onCreated,
  onCancel,
}: {
  locale: Locale;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const M = MESSAGES.helpdeskTickets;
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('maintenance');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError(t(M.validationRequired, locale));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ticket, detail } = await createMyTicket({ subject, body, category });
      const id = detail?.id ?? ticket?.id;
      if (!id) throw new Error('no id');
      onCreated(id);
    } catch {
      setError(t(M.createFailed, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pemo-panel" data-testid="portal-ticket-create">
      <h1 className="pemo-page-title">{t(M.createTitle, locale)}</h1>
      <p className="pemo-note">
        {FIXTURE_RESIDENT_NAME} · {FIXTURE_UNIT_LABEL}
      </p>
      <form className="pemo-form" onSubmit={submit} noValidate>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldSubject, locale)}</span>
          <input
            data-testid="portal-ticket-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldCategory, locale)}</span>
          <select
            data-testid="portal-ticket-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(M.category[c], locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldBody, locale)}</span>
          <textarea
            data-testid="portal-ticket-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
        </label>
        <label className="pemo-field">
          <span className="pemo-field__label">{t(M.fieldUnit, locale)}</span>
          <input value={FIXTURE_UNIT_LABEL} readOnly data-testid="portal-ticket-unit" />
        </label>
        {error ? (
          <p className="pemo-note" role="alert" data-testid="portal-ticket-create-error">
            {error}
          </p>
        ) : null}
        <div className="pemo-toolbar">
          <button type="submit" className="pemo-btn pemo-btn--primary" disabled={busy} data-testid="portal-ticket-submit">
            {t(M.submit, locale)}
          </button>
          <button type="button" className="pemo-btn pemo-btn--secondary" onClick={onCancel} data-testid="portal-ticket-cancel">
            {t(M.cancel, locale)}
          </button>
        </div>
      </form>
    </div>
  );
}
