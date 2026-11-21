/**
 * Visitors P0 — Register / pre-register form.
 *
 * Fields: visitor name, host unit (optional), host resident (optional), purpose,
 * expected window, ID stub. Submit is a fixture stub — no write API in v0 freeze.
 * No BMS door unlock.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Pop-up is wide and the form is a two-column FormGrid: name | host unit, host resident | purpose, expected from | until, ID stub; hints take the row.
 */

import { HintRow } from '../components/FinanceBits.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { FormGrid, SPAN } from '../components/FormGrid.tsx';
import { useState, type FormEvent } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { VISITOR_PURPOSE, activeItems } from '../lookups/lookup-lists.ts';
import { useLookupItems } from '../lookups/lookups-client.ts';

export function VisitorRegister({
  locale,
  onBackToLog,
}: {
  locale: Locale;
  onBackToLog: () => void;
}) {
  const M = MESSAGES.visitor;
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [hostUnit, setHostUnit] = useState('');
  const [hostResident, setHostResident] = useState('');
  const purposes = activeItems(useLookupItems(VISITOR_PURPOSE));
  const [purpose, setPurpose] = useState('visit');
  // A type switched off since the form opened is no longer offered: show the first one that is.
  const chosen = purposes.some((p) => p.code === purpose) ? purpose : (purposes[0]?.code ?? '');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [idStub, setIdStub] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Dialog title={t(M.invitationTitle, locale)} locale={locale} onClose={onBackToLog} testId="visitor-invitation">
      <section className="pemo-state pemo-state--recorded" data-testid="visitor-register-stub" role="status">
        <h2 className="pemo-state__title">{t(M.registerStubTitle, locale)}</h2>
        <p className="pemo-state__body">{t(M.registerStubBody, locale)}</p>
        <HintRow text={t(M.fixtureLabel, locale)} />
        <div className="pemo-actions" style={{ marginTop: 'var(--pemo-space-3)' }}>
          <button type="button" className="pemo-button pemo-button--primary" onClick={onBackToLog}>
            {t(M.backToList, locale)}
          </button>
          <button type="button" className="pemo-button" onClick={() => setSubmitted(false)}>
            {t(M.registerAnother, locale)}
          </button>
        </div>
      </section>
      </Dialog>
    );
  }

  return (
    <Dialog title={t(M.invitationTitle, locale)} locale={locale} onClose={onBackToLog} wide testId="visitor-invitation">
    <form
      className="pemo-form"
      data-testid="visitor-register-form"
      onSubmit={onSubmit}
    >
      <FormGrid testId="visitor-register-grid">
      <div className={SPAN}><HintRow text={t(M.registerFormNote, locale)} /></div>

      <label className="pemo-field" htmlFor="vis-name">
        {t(M.fieldVisitorName, locale)}
        <input
          id="vis-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="vis-name"
          autoComplete="off"
        />
      </label>

      <label className="pemo-field" htmlFor="vis-host-unit">
        {t(M.fieldHostUnit, locale)}{' '}
        <span className="pemo-meta">({t(M.optionalField, locale)})</span>
        <input
          id="vis-host-unit"
          value={hostUnit}
          onChange={(e) => setHostUnit(e.target.value)}
          placeholder={t(M.hostUnitPlaceholder, locale)}
          data-testid="vis-host-unit"
          autoComplete="off"
        />
      </label>

      <label className="pemo-field" htmlFor="vis-host-resident">
        {t(M.fieldHostResident, locale)}{' '}
        <span className="pemo-meta">({t(M.optionalField, locale)})</span>
        <input
          id="vis-host-resident"
          value={hostResident}
          onChange={(e) => setHostResident(e.target.value)}
          data-testid="vis-host-resident"
          autoComplete="off"
        />
      </label>

      <label className="pemo-field" htmlFor="vis-purpose">
        {t(M.fieldPurpose, locale)}
        <select
          id="vis-purpose"
          value={chosen}
          onChange={(e) => setPurpose(e.target.value)}
          data-testid="vis-purpose"
        >
          {purposes.map((p) => <option key={p.code} value={p.code}>{p.labels[locale]}</option>)}
        </select>
      </label>

        <label className="pemo-field" htmlFor="vis-window-start">
          {t(M.fieldWindowStart, locale)}
          <input
            id="vis-window-start"
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            data-testid="vis-window-start"
          />
        </label>
        <label className="pemo-field" htmlFor="vis-window-end">
          {t(M.fieldWindowEnd, locale)}
          <input
            id="vis-window-end"
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            data-testid="vis-window-end"
          />
        </label>

      <label className="pemo-field" htmlFor="vis-id-stub">
        {t(M.fieldIdStub, locale)}{' '}
        <span className="pemo-meta">({t(M.optionalField, locale)})</span>
        <input
          id="vis-id-stub"
          value={idStub}
          onChange={(e) => setIdStub(e.target.value)}
          placeholder={t(M.idStubPlaceholder, locale)}
          data-testid="vis-id-stub"
          autoComplete="off"
        />
      </label>

      <div className={SPAN}>
        <HintRow text={t(M.noDoorUnlock, locale)} />
        <HintRow text={t(M.fixtureLabel, locale)} />
      </div>
      </FormGrid>

      <div className="pemo-actions">
        <button type="submit" className="pemo-button pemo-button--primary" data-testid="vis-submit">
          {t(M.submitRegister, locale)}
        </button>
        <button type="button" className="pemo-button" onClick={onBackToLog}>
          {t(M.cancel, locale)}
        </button>
      </div>
    </form>
    </Dialog>
  );
}
