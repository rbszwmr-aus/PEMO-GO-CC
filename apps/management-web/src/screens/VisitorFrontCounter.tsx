/**
 * Visitors: the front counter. Two paths from one screen.
 *
 *  1. Walk-in (a delivery, a visitor with no pass): name, purpose, host flat from the
 *     location tree, optional phone and ID stub, then Check in. Check in creates a visit,
 *     which shows in today’s log with Check out.
 *  2. Pre-registered: scan the pass QR where the browser can (BarcodeDetector), or type
 *     the pass code. Verify is a dry run and shows a card with one clear state. Check in
 *     redeems one use with an Idempotency-Key, and is offered only on a Valid pass.
 *
 * Everything goes through the front-counter client (fixture today; see
 * data/front-counter-client.ts). Actions that do not apply are not rendered. No system
 * id is shown: hosts read "Block A · 12/F · Flat A1".
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { HostUnitPicker } from '../components/HostUnitPicker.tsx';
import { Icon } from '../components/Icon.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import { distinctOptions, type ViewSpec } from '../components/table-view.ts';
import { useTableView } from '../components/useTableView.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { InfoTip } from '../components/FinanceBits.tsx';
import { clockHHmm, hktStamp } from '../format/datetime.ts';
import type { PropertyTreeResponse, ScopeTreeResponse } from '../data/types.ts';
import { buildRailNodes } from '../shell/scope-focus.ts';
import {
  FrontCounterError,
  getFrontCounterClient,
  newIdempotencyKey,
  type HostRef,
  type PassCard,
  type PassState,
  type RedeemRejection,
  type Visit,
} from '../data/front-counter-client.ts';
import { hostDisplay, locationTree } from '../data/host-label.ts';
import { VISITOR_PURPOSE, activeItems } from '../lookups/lookup-lists.ts';
import { useLookupItems } from '../lookups/lookups-client.ts';
import { deskPurpose, purposeOptionsFor } from '../lookups/purpose-view.ts';
import { browserScanEnv, scanSupported, startScan } from '../data/qr-scan.ts';
import { useDeskVisits, useFrontCounterSource } from './desk-visits.ts';

export type CounterTab = 'walk-in' | 'pass';
type Toast = { tone: 'success' | 'error'; text: string };

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);

const TONE: Record<PassState, 'normal' | 'warning' | 'critical' | 'unknown'> = {
  valid: 'normal',
  expired: 'warning',
  used_up: 'warning',
  revoked: 'critical',
  unknown: 'unknown',
};

/** A pass that is not valid YET is the one fine status worth its own words; the rest read from the group. */
function stateLabel(s: PassState, locale: Locale, status?: string): string {
  const M = MESSAGES.counter.state;
  if (status === 'not_yet_valid') return t(M.notYetValid, locale);
  return t(s === 'valid' ? M.valid : s === 'expired' ? M.expired : s === 'used_up' ? M.used_up : s === 'revoked' ? M.revoked : M.unknown, locale);
}

function stateNote(s: PassState, locale: Locale, status?: string): string {
  const M = MESSAGES.counter.stateNote;
  if (status === 'not_yet_valid') return t(M.notYetValid, locale);
  return t(s === 'valid' ? M.valid : s === 'expired' ? M.expired : s === 'used_up' ? M.used_up : s === 'revoked' ? M.revoked : M.unknown, locale);
}

/** A purpose as the counter reads it: the enum label, or the resident’s own words when it was free text. */
function purposeText(v: Visit | PassCard['visitor'] & {}, locale: Locale): string {
  return deskPurpose(v, locale).label;
}

function failText(err: unknown, locale: Locale): string {
  return err instanceof FrontCounterError && err.status === 401
    ? t(MESSAGES.counter.sessionExpired, locale)
    : t(MESSAGES.counter.checkInFailed, locale);
}

function blockedText(reason: RedeemRejection, locale: Locale): string | null {
  const M = MESSAGES.counter.visitBlocked;
  if (reason === 'visit-not-linked') return t(M.notLinked, locale);
  if (reason === 'visit-cancelled') return t(M.cancelled, locale);
  if (reason === 'visit-already-checked-out') return t(M.alreadyOut, locale);
  return null;
}

/** The verify card: the visitor, the host flat, the window, uses, and one clear state. */
export function PassVerifyCard({ card, locale, children }: { card: PassCard; locale: Locale; children?: React.ReactNode }) {
  const M = MESSAGES.counter;
  const tone = TONE[card.status_group];
  const none = t(M.cardUnknownHost, locale);
  const uses = card.uses_seen === null || card.use_limit === null
    ? none
    : card.use_limit > 0 && card.uses_remaining !== null
    ? fill(t(M.usesValue, locale), { seen: String(card.uses_seen), limit: String(card.use_limit), remaining: String(card.uses_remaining) })
    : fill(t(M.usesUnlimited, locale), { seen: String(card.uses_seen ?? 0) });
  return (
    <div
      className="pemo-verifycard"
      data-testid="verify-card"
      data-state={card.status_group}
      data-status={card.status}
      role="status"
      style={{
        borderLeft: `4px solid var(--pemo-sev-${tone}-border)`,
        background: `var(--pemo-sev-${tone}-surface)`,
      }}
    >
      <p className="pemo-verifycard__state" style={{ color: `var(--pemo-sev-${tone}-strong)` }}>
        <strong data-testid="verify-state">{stateLabel(card.status_group, locale, card.status)}</strong>
        <span data-testid="verify-state-note">{stateNote(card.status_group, locale, card.status)}</span>
      </p>
      {card.visitor || card.window ? (
        <dl className="pemo-dl" data-testid="verify-facts">
          <dt>{t(M.cardVisitor, locale)}</dt>
          <dd data-testid="verify-visitor">{card.visitor ? card.visitor.name : none}</dd>
          <dt>{t(M.cardHost, locale)}</dt>
          <dd data-testid="verify-host">{hostDisplay(card.host, locale) ?? none}</dd>
          {card.visitor ? (
            <>
              <dt>{t(M.fieldPurpose, locale)}</dt>
              <dd data-testid="verify-purpose">{purposeText(card.visitor, locale)}</dd>
            </>
          ) : null}
          <dt>{t(M.cardValid, locale)}</dt>
          <dd data-testid="verify-window">
            {card.window ? `${hktStamp(card.window.not_before, locale)} → ${hktStamp(card.window.expires_at, locale)}` : none}
          </dd>
          <dt>{t(M.cardUses, locale)}</dt>
          <dd data-testid="verify-uses">{uses}</dd>
        </dl>
      ) : null}
      {children}
    </div>
  );
}

function WalkIn({ locale, nodes, say }: { locale: Locale; nodes: ReturnType<typeof buildRailNodes>; say: (t: Toast) => void }) {
  const M = MESSAGES.counter;
  const client = getFrontCounterClient();
  const [name, setName] = useState('');
  const purposes = activeItems(useLookupItems(VISITOR_PURPOSE));
  const [purpose, setPurpose] = useState('visit');
  // A type staff switched off since the last entry is no longer offered: fall back to the first one that is.
  const chosen = purposes.some((p) => p.code === purpose) ? purpose : (purposes[0]?.code ?? 'other');
  const [host, setHost] = useState<HostRef | null>(null);
  const [phone, setPhone] = useState('');
  const [idStub, setIdStub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(t(M.nameRequired, locale)); return; }
    if (!host) { setError(t(M.hostRequired, locale)); return; }
    setError(null);
    setBusy(true);
    try {
      const visit = await client.createWalkIn({
        name, purpose: chosen, host_unit_id: host.unit_id,
        phone: phone.trim() || undefined,
        id_stub: idStub.trim() || undefined,
      });
      say({ tone: 'success', text: fill(t(M.walkInDone, locale), { name: visit.name, unit: host.unit_label }) });
      setName(''); setPurpose('visit'); setHost(null); setPhone(''); setIdStub('');
    } catch (err) {
      say({ tone: 'error', text: failText(err, locale) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pemo-panel pemo-form pemo-counter-form" data-testid="walkin-form" data-form-act="walkInCheckIn" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="pemo-panel__title">{t(M.walkInHeading, locale)}</h2>
      <label className="pemo-field" htmlFor="walkin-name">
        {t(M.fieldName, locale)}
        <input id="walkin-name" autoComplete="off" value={name} data-form-field="true" data-testid="walkin-name" onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset className="pemo-field pemo-field--chips">
        <legend>{t(M.fieldPurpose, locale)}</legend>
        <div className="pemo-chiprow" role="radiogroup" aria-label={t(M.fieldPurpose, locale)}>
          {purposes.map(({ code: p, labels }) => (
            <label key={p} className="pemo-choicechip" data-checked={chosen === p}>
              <input type="radio" name="walkin-purpose" value={p} checked={chosen === p} data-form-field="true" data-testid={`walkin-purpose-${p}`} onChange={() => setPurpose(p)} />
              <span>{labels[locale]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="pemo-field" role="group" aria-label={t(M.fieldHost, locale)}>
        <span>{t(M.fieldHost, locale)}</span>
        <HostUnitPicker nodes={nodes} value={host} onChange={setHost} locale={locale} />
      </div>
      <div className="pemo-counter-form__pair">
        <label className="pemo-field" htmlFor="walkin-phone">
          {t(M.fieldPhone, locale)}
          <input id="walkin-phone" type="tel" autoComplete="off" value={phone} data-form-field="true" data-testid="walkin-phone" onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="pemo-field" htmlFor="walkin-idstub">
          {t(M.fieldIdStub, locale)}
          <input id="walkin-idstub" autoComplete="off" maxLength={40} value={idStub} placeholder={t(M.idStubPlaceholder, locale)} data-form-field="true" data-testid="walkin-idstub" onChange={(e) => setIdStub(e.target.value)} />
        </label>
      </div>
      {error ? <p className="pemo-note pemo-note--error" role="alert" data-testid="walkin-error">{error}</p> : null}
      <div className="pemo-toolbar">
        <button type="submit" className="pemo-button pemo-button--primary" data-form-field="true" data-testid="walkin-checkin">
          {busy ? t(M.busy, locale) : t(M.checkIn, locale)}
        </button>
      </div>
    </form>
  );
}

function PreRegistered({ locale, say }: { locale: Locale; say: (t: Toast) => void }) {
  const M = MESSAGES.counter;
  const client = getFrontCounterClient();
  const [code, setCode] = useState('');
  const [card, setCard] = useState<PassCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const idemKey = useRef<string>(newIdempotencyKey());
  const video = useRef<HTMLVideoElement>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const canScan = useMemo(() => scanSupported(browserScanEnv()), []);
  const source = useFrontCounterSource(); // demo codes only once the source is known to be the fixture

  useEffect(() => () => { stopScan.current?.(); }, []);

  async function verify(raw: string) {
    if (!raw.trim()) { setError(t(M.codeRequired, locale)); setCard(null); return; }
    setError(null);
    setBlocked(null);
    setBusy(true);
    try {
      setCard(await client.verify(raw.trim()));
      idemKey.current = newIdempotencyKey(); // one key per verified card; a retry of Check in reuses it
    } catch (err) {
      setCard(null);
      setError(err instanceof FrontCounterError && err.status === 401 ? t(M.sessionExpired, locale) : t(M.verifyFailed, locale));
    } finally {
      setBusy(false);
    }
  }

  async function beginScan() {
    setScanning(true);
    await new Promise((r) => window.setTimeout(r, 0));
    if (!video.current) return;
    stopScan.current = await startScan(
      video.current,
      (value) => { setScanning(false); setCode(value); void verify(value); },
      () => { setScanning(false); setError(t(M.scanFailed, locale)); },
    );
  }
  function endScan() { stopScan.current?.(); stopScan.current = null; setScanning(false); }

  async function redeem(e: FormEvent) {
    e.preventDefault();
    if (busy || !card || card.status_group !== 'valid' || blocked) return;
    setBusy(true);
    try {
      const res = await client.redeem(code.trim(), idemKey.current);
      const who = card.visitor?.name ?? t(M.cardUnknownHost, locale);
      if (res.outcome === 'checked_in') {
        say({
          tone: 'success',
          text: res.uses_remaining === null
            ? fill(t(M.passCheckedInNoLimit, locale), { name: who })
            : fill(t(M.passCheckedIn, locale), { name: who, remaining: String(res.uses_remaining) }),
        });
        setCode(''); setCard(null);
        idemKey.current = newIdempotencyKey();
      } else if (res.reason === 'pass' && res.status && res.status_group) {
        // The Backend knows better than the card did: show what it says, and stop offering Check in.
        setCard({ ...card, status: res.status, status_group: res.status_group });
        say({ tone: 'error', text: fill(t(M.passRejected, locale), { state: stateLabel(res.status_group, locale, res.status) }) });
      } else {
        const why = blockedText(res.reason, locale);
        if (why) { setBlocked(why); say({ tone: 'error', text: why }); } else { say({ tone: 'error', text: t(M.checkInFailed, locale) }); idemKey.current = newIdempotencyKey(); }
      }
    } catch (err) {
      say({ tone: 'error', text: failText(err, locale) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pemo-panel pemo-counter-form" data-testid="pass-panel">
      <h2 className="pemo-panel__title">{t(M.passHeading, locale)}</h2>
      <form
        className="pemo-form"
        data-testid="pass-form"
        data-form-act="verifyPass"
        onSubmit={(e) => { e.preventDefault(); void verify(code); }}
        noValidate
      >
        <label className="pemo-field" htmlFor="pass-code">
          {t(M.codeLabel, locale)}
          <input
            id="pass-code"
            autoComplete="off"
            spellCheck={false}
            value={code}
            placeholder={t(M.codePlaceholder, locale)}
            data-form-field="true"
            data-testid="pass-code"
            onChange={(e) => { setCode(e.target.value); setCard(null); setError(null); setBlocked(null); }}
          />
        </label>
        {scanning ? (
          <div className="pemo-scan" data-testid="scan-view">
            <video ref={video} className="pemo-scan__video" muted playsInline />
            <p className="pemo-meta">{t(M.scanHint, locale)}</p>
          </div>
        ) : null}
        <div className="pemo-toolbar">
          <button type="submit" className="pemo-button pemo-button--primary" data-form-field="true" data-testid="pass-verify">
            {t(M.verify, locale)}
          </button>
          {canScan && !scanning ? (
            <button type="button" className="pemo-button" data-form-field="true" data-testid="pass-scan" onClick={() => void beginScan()}>
              <Icon name="ScanLine" size={16} /> {t(M.scan, locale)}
            </button>
          ) : null}
          {scanning ? (
            <button type="button" className="pemo-button" data-form-field="true" data-testid="pass-scan-stop" onClick={endScan}>
              {t(M.scanStop, locale)}
            </button>
          ) : null}
        </div>
        {source === 'fixture' && client.demoCodes.length > 0 ? (
          <div className="pemo-democodes" data-testid="demo-codes">
            <span className="pemo-meta">{t(M.demoCodes, locale)}</span>
            {client.demoCodes.map((d) => (
              <button
                key={d.code}
                type="button"
                className="pemo-hostpick__block"
                data-form-field="true"
                data-testid="demo-code"
                data-state={d.state}
                onClick={() => { setCode(d.code); void verify(d.code); }}
              >
                {d.code}
              </button>
            ))}
          </div>
        ) : null}
        <p className="pemo-meta">{t(M.verifyNote, locale)}</p>
      </form>
      {error ? <p className="pemo-note pemo-note--error" role="alert" data-testid="pass-error">{error}</p> : null}
      {card ? (
        <PassVerifyCard card={card} locale={locale}>
          {blocked ? <p className="pemo-note pemo-note--error" role="alert" data-testid="pass-blocked">{blocked}</p> : null}
          {card.status_group === 'valid' && !blocked ? (
            <form className="pemo-toolbar" data-testid="redeem-form" data-form-act="redeemPass" onSubmit={(e) => void redeem(e)}>
              <button type="submit" className="pemo-button pemo-button--primary" data-form-field="true" data-testid="pass-checkin">
                {busy ? t(M.busy, locale) : t(M.checkIn, locale)}
              </button>
            </form>
          ) : null}
        </PassVerifyCard>
      ) : null}
    </section>
  );
}

/** A closed row reads from the Backend’s outcome: visited, or closed as a no-show. An outcome we do not know shows its own label. */
function closedLabel(v: Visit, locale: Locale): string {
  const M = MESSAGES.counter;
  if (v.outcome === 'no_show') return t(M.noShow, locale);
  if (v.outcome === 'visited' || !v.outcome_label) return t(M.checkedOut, locale);
  return v.outcome_label;
}

/** The status a row shows, in words: On site, Expected, or how it closed. */
export function deskStatusText(v: Visit, locale: Locale): string {
  const M = MESSAGES.counter;
  return v.status === 'on_site' ? t(M.onSite, locale) : v.status === 'expected' ? t(M.expected, locale) : closedLabel(v, locale);
}

/** Minutes after midnight of a +08:00 timestamp such as 2026-11-18T17:05:00+08:00 (the log is one day). */
export function hkMinutes(iso: string | null | undefined): number | null {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Search, filter and sort rules for front-counter visits: the counter log and the Visitor log desk rows share them. */
export function deskViewSpec(locale: Locale): ViewSpec<Visit> {
  return {
    searchText: (v) => `${v.name} ${hostDisplay(v.host, locale) ?? ''}`,
    filters: {
      purpose: (v) => deskPurpose(v, locale).code,
      pass: (v) => (v.pass_id ? 'with' : 'none'),
      state: (v) => deskStatusText(v, locale),
      registered: (v) => v.source,
    },
    sorts: {
      visitor: (v) => v.name,
      purpose: (v) => purposeText(v, locale),
      host: (v) => hostDisplay(v.host, locale) ?? null,
      in: (v) => { const ms = v.checked_in_at ? Date.parse(v.checked_in_at) : NaN; return Number.isNaN(ms) ? null : ms; },
      via: (v) => deskVia(v, locale),
      status: (v) => deskStatusText(v, locale),
    },
  };
}

/** Newest first by the time shown in the In column. */
export const NEWEST_FIRST = { key: 'in', dir: 'desc' } as const;

export function deskVia(v: Visit, locale: Locale): string {
  return t(v.source === 'pre_registered' ? MESSAGES.counter.viaPass : MESSAGES.counter.viaWalkIn, locale);
}

/** The status chip, with Check out only for someone on site. Used by the counter log and the Visitor log. */
export function DeskStatusCell({ v, locale, onOut, testPrefix }: { v: Visit; locale: Locale; onOut: (v: Visit) => void; testPrefix: string }) {
  const M = MESSAGES.counter;
  const chip = (
    <span className="pemo-chip" data-testid={`${testPrefix}-status`} data-status={v.status}>
      {v.status === 'on_site' ? t(M.onSite, locale) : v.status === 'expected' ? t(M.expected, locale) : closedLabel(v, locale)}
    </span>
  );
  // Check out for someone on site; No-show for someone still expected (the Backend closes it as a no-show).
  // Nothing for a closed row: the action does not apply, so it is not there.
  if (v.status === 'checked_out') return chip;
  const noShow = v.status === 'expected';
  return (
    <form className="pemo-inlineform" data-form-act="checkOutVisit" onSubmit={(e) => { e.preventDefault(); onOut(v); }}>
      {chip}{' '}
      <button type="submit" className="pemo-button" data-form-field="true" data-testid={`${testPrefix}-${noShow ? 'noshow' : 'checkout'}`}>
        {t(noShow ? M.noShowAction : M.checkOut, locale)}
      </button>
    </form>
  );
}

/** A small note, only while the counter is on the contract fixture (the API did not answer, or ?source=fixture). */
export function SampleDataNote({ locale }: { locale: Locale }) {
  const source = useFrontCounterSource();
  if (source !== 'fixture') return null;
  return <InfoTip text={t(MESSAGES.counter.fixtureNote, locale)} testId="sample-data-note" />;
}

/** The dropdown filters over front-counter visits: Purpose, Pass, State and Registered. */
export function deskFilterDefs(
  locale: Locale,
  rows: readonly Visit[],
  values: Record<string, string>,
  set: (key: string, value: string) => void,
): FilterDef[] {
  const T = MESSAGES.tableView;
  const spec = deskViewSpec(locale);
  return [
    { key: 'purpose', label: t(T.filterPurpose, locale), allLabel: t(T.allPurposes, locale), options: purposeOptionsFor(rows.map((v) => deskPurpose(v, locale)), locale), value: values['purpose'] ?? '', onChange: (v) => set('purpose', v) },
    { key: 'pass', label: t(T.filterPass, locale), allLabel: t(T.allPasses, locale), options: [{ value: 'with', label: t(T.withPass, locale) }, { value: 'none', label: t(T.noPass, locale) }], value: values['pass'] ?? '', onChange: (v) => set('pass', v) },
    { key: 'state', label: t(T.filterState, locale), allLabel: t(T.allStates, locale), options: distinctOptions(rows, spec.filters!['state']!, locale), value: values['state'] ?? '', onChange: (v) => set('state', v) },
    { key: 'registered', label: t(T.filterRegistered, locale), allLabel: t(T.allRegistered, locale), options: [{ value: 'walk_in', label: t(MESSAGES.counter.viaWalkIn, locale) }, { value: 'pre_registered', label: t(MESSAGES.counter.viaPass, locale) }], value: values['registered'] ?? '', onChange: (v) => set('registered', v) },
  ];
}

/** Today’s front-counter visits, newest first by default; headers sort, the bar filters. Check out for anyone still on site. */
export function DeskLog({ locale, say }: { locale: Locale; say?: ((t: Toast) => void) | undefined }) {
  const M = MESSAGES.counter;
  const desk = useDeskVisits();
  const spec = useMemo(() => deskViewSpec(locale), [locale]);
  const tv = useTableView(desk.visits, spec, NEWEST_FIRST, locale);
  const visits = tv.view;
  const columns = [
    { key: 'visitor', label: t(M.colVisitor, locale), width: '22%', sortable: true },
    { key: 'purpose', label: t(M.colPurpose, locale), width: '12%', hideBelow: 560, sortable: true },
    { key: 'host', label: t(M.colHost, locale), width: '22%', sortable: true },
    { key: 'in', label: t(M.colIn, locale), width: '9%', sortable: true },
    { key: 'via', label: t(M.colVia, locale), width: '15%', hideBelow: 640, sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '20%', sortable: true },
  ];
  const filterDefs: FilterDef[] = deskFilterDefs(locale, desk.visits, tv.state.filters, tv.setFilter);
  async function out(v: Visit) {
    const done = await getFrontCounterClient().checkOut(v.visit_id).catch((err: unknown) => { if (say) say({ tone: 'error', text: failText(err, locale) }); return null; });
    if (done && say) say({ tone: 'success', text: fill(t(done.outcome === 'no_show' ? M.noShowDone : M.checkOutDone, locale), { name: done.name }) });
  }
  return (
    <section className="pemo-panel" data-testid="desk-log">
      <h2 className="pemo-panel__title">{t(M.logHeading, locale)}</h2>
      {desk.failure ? (
        <p className="pemo-note pemo-note--error" role="alert" data-testid="desk-log-failed">
          {t(desk.failure === 'session' ? M.sessionExpired : M.logFailed, locale)}
        </p>
      ) : desk.visits.length === 0 ? (
        <p className="pemo-note" data-testid="desk-log-empty">{t(M.logEmpty, locale)}</p>
      ) : (
        <>
        <FilterBar
          locale={locale}
          testId="desk-filters"
          searchLabel={t(MESSAGES.tableView.searchVisitors, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={filterDefs}
          active={tv.active}
          onClear={tv.clear}
        />
        {visits.length === 0 ? <NoMatches locale={locale} testId="desk-log-no-matches" /> : (
        <Table caption={t(M.logHeading, locale)} columns={columns} testId="desk-log-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
          {visits.map((v) => (
            <tr key={v.visit_id} data-testid="desk-log-row" data-status={v.status} data-source={v.source}>
              <WrapCell title={v.name}>
                <span style={{ fontWeight: 600 }}>{v.name}</span>
                <div className="pemo-meta" data-alt="purpose">{purposeText(v, locale)}</div>
              </WrapCell>
              <DenseCell title={purposeText(v, locale)}>{purposeText(v, locale)}</DenseCell>
              <DenseCell title={hostDisplay(v.host, locale) ?? '—'}>{hostDisplay(v.host, locale) ?? '—'}</DenseCell>
              <DenseCell title={v.checked_in_at ? hktStamp(v.checked_in_at, locale) : '–'}><span data-testid="desk-in-time">{clockHHmm(v.checked_in_at)}</span></DenseCell>
              <DenseCell title={deskVia(v, locale)}>{deskVia(v, locale)}</DenseCell>
              <td>
                <DeskStatusCell v={v} locale={locale} onOut={(x) => void out(x)} testPrefix="desk" />
              </td>
            </tr>
          ))}
        </Table>
        )}
        </>
      )}
    </section>
  );
}

export function VisitorFrontCounter({
  locale,
  tab,
  onTab,
  scope,
}: {
  locale: Locale;
  tab: CounterTab;
  onTab: (next: CounterTab) => void;
  scope: ScopeTreeResponse | null;
}) {
  const M = MESSAGES.counter;
  const nodes = useMemo(
    () => buildRailNodes(locationTree(), scope),
    [scope],
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const say = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast((c) => (c === next ? null : c)), 6000);
  };
  return (
    <div className="pemo-counter" data-testid="front-counter" data-tab={tab}>
      <div className="pemo-tabs" role="tablist" aria-label={t(M.tabsLabel, locale)}>
        {(['walk-in', 'pass'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="pemo-tab"
            data-tree-chrome="true"
            data-testid={`counter-tab-${id}`}
            onClick={() => onTab(id)}
          >
            {t(id === 'walk-in' ? M.tabWalkIn : M.tabPass, locale)}
          </button>
        ))}
      </div>
      <div role="status" aria-live="polite" data-testid="counter-toast-region">
        {toast ? (
          <p className={`pemo-counter__toast pemo-counter__toast--${toast.tone}`} data-testid="counter-toast" data-tone={toast.tone}>
            {toast.text}
          </p>
        ) : null}
      </div>
      {tab === 'walk-in' ? <WalkIn locale={locale} nodes={nodes} say={say} /> : <PreRegistered locale={locale} say={say} />}
      <DeskLog locale={locale} say={say} />
      <SampleDataNote locale={locale} />
    </div>
  );
}
