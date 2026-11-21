/**
 * NOTICES — the write flow (UI-051, part 2): compose, and the seven transitions.
 *
 * FOUR RULES THIS FILE IS BUILT TO.
 *
 *  1. The form is the request. `ComposeNoticeRequest` field for field, and
 *     `NoticeTransitionRequest` field for field: nothing the contract does not
 *     name is asked, and nothing it names is hidden. A test derives the field list
 *     from the contract and compares it with the rendered form.
 *  2. Both languages, always, side by side. The interface locale changes the
 *     labels; it never changes which language is shown. A missing language is a
 *     STATE of the form (its title or body is empty), flagged before any request
 *     and derived from the form's own emptiness — form data, not authority.
 *  3. Never optimistic. A transition is confirmed, sent, and the RESPONSE decides
 *     what happens next. The client holds no belief about the notice's state.
 *  4. No act control is drawn here. The buttons that start a write come from
 *     NoticeActions.tsx, which is the only file allowed to render one.
 */

import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { noticeTitleFor } from '../data/notice-title.ts';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { ActButton } from './NoticeActions.tsx';
import { NOTICE_REASONS, type NoticeReasonCode } from '../data/notice-reasons.g.ts';
import type {
  ComposeNoticeRequest, NoticeActResponse, NoticeTarget, NoticeTransition,
  NoticeTransitionRequest, ScopeRef, StaffNoticeType,
} from '../data/types.ts';

/** The contract's own enums, indexed for the selects. Copy comes from the value maps. */
const NOTICE_TYPES = Object.keys(MESSAGES.s5.noticeType) as StaffNoticeType[];
const NODE_KINDS = ['organization', 'estate', 'building', 'floor', 'unit'] as const;

/* ----------------------------------------------------------- language blocks */

interface LanguageText { title: string; body: string }

function isMissing(x: LanguageText): boolean {
  return x.title.trim().length === 0 || x.body.trim().length === 0;
}

/**
 * One language's title and body. Marked `data-missing` from the form's own
 * emptiness — the pre-act bilingual-missing state (UI-051 D4), decided by what has
 * been typed and by nothing the server said.
 */
function LanguageBlock({
  which, value, onChange, locale, idPrefix,
}: {
  which: 'en' | 'zh-Hant';
  value: LanguageText;
  onChange: (next: LanguageText) => void;
  locale: Locale;
  idPrefix: string;
}) {
  const missing = isMissing(value);
  const suffix = which === 'en' ? 'En' : 'ZhHant';
  return (
    <div
      className="pemo-form__language"
      lang={which}
      data-testid={`language-${which === 'en' ? 'en' : 'zh'}`}
      data-missing={missing}
    >
      <div className="pemo-actions">
        <strong>{which === 'en' ? 'English' : '繁體中文'}</strong>
        <span className="pemo-flag" data-testid="language-flag" data-missing={missing}>
          {missing ? t(MESSAGES.s5.languageMissing, locale) : t(MESSAGES.s5.languagePresent, locale)}
        </span>
      </div>
      <label className="pemo-field" htmlFor={`${idPrefix}-title${suffix}`}>
        {t(MESSAGES.s5.fieldTitle, locale)}
        <input
          id={`${idPrefix}-title${suffix}`}
          name={`title${suffix}`}
          data-form-field="true"
          maxLength={200}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </label>
      <label className="pemo-field" htmlFor={`${idPrefix}-body${suffix}`}>
        {t(MESSAGES.s5.fieldBody, locale)}
        <textarea
          id={`${idPrefix}-body${suffix}`}
          name={`body${suffix}`}
          data-form-field="true"
          maxLength={20000}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </label>
    </div>
  );
}

/* ---------------------------------------------------------- shared fields */

function ScheduleFields({
  publishAt, expireAt, mandatoryAck, onChange, locale, idPrefix,
}: {
  publishAt: string;
  expireAt: string;
  mandatoryAck: boolean;
  onChange: (next: { publishAt?: string; expireAt?: string; mandatoryAck?: boolean }) => void;
  locale: Locale;
  idPrefix: string;
}) {
  return (
    <div className="pemo-toolbar">
      <label className="pemo-field" htmlFor={`${idPrefix}-publishAt`}>
        {t(MESSAGES.s5.fieldPublishAt, locale)} <span className="pemo-meta">({t(MESSAGES.s5.optionalField, locale)})</span>
        <input id={`${idPrefix}-publishAt`} name="publishAt" data-form-field="true" value={publishAt} placeholder="2026-09-10T09:00:00+08:00" onChange={(e) => onChange({ publishAt: e.target.value })} />
      </label>
      <label className="pemo-field" htmlFor={`${idPrefix}-expireAt`}>
        {t(MESSAGES.s5.fieldExpireAt, locale)} <span className="pemo-meta">({t(MESSAGES.s5.optionalField, locale)})</span>
        <input id={`${idPrefix}-expireAt`} name="expireAt" data-form-field="true" value={expireAt} placeholder="2026-09-15T00:00:00+08:00" onChange={(e) => onChange({ expireAt: e.target.value })} />
      </label>
      <label className="pemo-check" htmlFor={`${idPrefix}-mandatoryAck`}>
        <input id={`${idPrefix}-mandatoryAck`} type="checkbox" name="mandatoryAck" data-form-field="true" checked={mandatoryAck} onChange={(e) => onChange({ mandatoryAck: e.target.checked })} />
        {t(MESSAGES.s5.fieldMandatoryAck, locale)}
      </label>
    </div>
  );
}

function ResponseOptionsField({
  value, onChange, locale, idPrefix,
}: { value: string; onChange: (v: string) => void; locale: Locale; idPrefix: string }) {
  return (
    <label className="pemo-field" htmlFor={`${idPrefix}-responseOptions`}>
      {t(MESSAGES.s5.fieldResponseOptions, locale)} <span className="pemo-meta">({t(MESSAGES.s5.optionalField, locale)})</span>
      <textarea id={`${idPrefix}-responseOptions`} name="responseOptions" data-form-field="true" value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 56 }} />
      <span className="pemo-meta">{t(MESSAGES.s5.fieldResponseOptionsHint, locale)}</span>
    </label>
  );
}

/** Targets, one row each: a node, a Location, or both — never neither. */
function TargetsField({
  targets, onChange, locale, idPrefix,
}: { targets: NoticeTarget[]; onChange: (next: NoticeTarget[]) => void; locale: Locale; idPrefix: string }) {
  type Kind = Exclude<NoticeTarget['nodeKind'], undefined>;
  const update = (i: number, patch: { nodeKind?: Kind; nodeId?: string | null; locationId?: string | null }) =>
    onChange(targets.map((tg, j) => (j === i ? { ...tg, ...patch } : tg)));
  return (
    <fieldset className="pemo-field" data-testid="targets-field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>{t(MESSAGES.s5.fieldTargets, locale)}</legend>
      {targets.map((tg, i) => (
        <div className="pemo-toolbar" key={i} data-testid="target-row">
          <label className="pemo-field" htmlFor={`${idPrefix}-target-${i}-kind`}>
            {t(MESSAGES.s5.fieldTargetKind, locale)}
            <select id={`${idPrefix}-target-${i}-kind`} name="targets.nodeKind" data-form-field="true" value={tg.nodeKind ?? ''} onChange={(e) => update(i, { nodeKind: e.target.value ? (e.target.value as Kind) : null })}>
              <option value="">—</option>
              {NODE_KINDS.map((k) => <option key={k} value={k}>{t(MESSAGES.scopeKind[k], locale)}</option>)}
            </select>
          </label>
          <label className="pemo-field" htmlFor={`${idPrefix}-target-${i}-node`}>
            {t(MESSAGES.s5.fieldTargetNodeId, locale)}
            <input id={`${idPrefix}-target-${i}-node`} name="targets.nodeId" data-form-field="true" value={tg.nodeId ?? ''} onChange={(e) => update(i, { nodeId: e.target.value || null })} />
          </label>
          <label className="pemo-field" htmlFor={`${idPrefix}-target-${i}-loc`}>
            {t(MESSAGES.s5.fieldTargetLocationId, locale)}
            <input id={`${idPrefix}-target-${i}-loc`} name="targets.locationId" data-form-field="true" value={tg.locationId ?? ''} onChange={(e) => update(i, { locationId: e.target.value || null })} />
          </label>
          {targets.length > 1 ? (
            <button type="button" className="pemo-button" data-form-field="true" data-testid="remove-target" onClick={() => onChange(targets.filter((_, j) => j !== i))}>
              {t(MESSAGES.s5.removeTarget, locale)}
            </button>
          ) : null}
        </div>
      ))}
      <div>
        <button type="button" className="pemo-button" data-form-field="true" data-testid="add-target" onClick={() => onChange([...targets, { nodeKind: null, nodeId: null, locationId: null }])}>
          {t(MESSAGES.s5.addTarget, locale)}
        </button>
      </div>
    </fieldset>
  );
}

/* ---------------------------------------------------------------- compose */

interface ComposeDraft {
  noticeType: StaffNoticeType | '';
  en: LanguageText;
  zh: LanguageText;
  publishAt: string;
  expireAt: string;
  mandatoryAck: boolean;
  incidentRef: string;
  responseOptions: string;
  targets: NoticeTarget[];
}

function draftFrom(initial: ComposeNoticeRequest | null, node: ScopeRef | null): ComposeDraft {
  if (initial) {
    return {
      noticeType: initial.noticeType,
      en: { title: initial.titleEn, body: initial.bodyEn },
      zh: { title: initial.titleZhHant, body: initial.bodyZhHant },
      publishAt: initial.publishAt ?? '',
      expireAt: initial.expireAt ?? '',
      mandatoryAck: initial.mandatoryAck ?? false,
      incidentRef: initial.incidentRef ?? '',
      responseOptions: (initial.responseOptions ?? []).join('\n'),
      targets: initial.targets.map((tg) => ({ nodeKind: tg.nodeKind ?? null, nodeId: tg.nodeId ?? null, locationId: tg.locationId ?? null })),
    };
  }
  // BLANK. The one thing carried in is the node the author pressed Compose on —
  // the scope tree's own kind and id, which is why the entry lives on a node.
  const NOTICE_NODE_KINDS: readonly string[] = NODE_KINDS;
  const target: NoticeTarget =
    node && NOTICE_NODE_KINDS.includes(node.kind)
      ? { nodeKind: node.kind as Exclude<NoticeTarget['nodeKind'], undefined>, nodeId: node.id, locationId: null }
      : node && node.kind === 'location'
        ? { nodeKind: null, nodeId: null, locationId: node.id }
        : { nodeKind: null, nodeId: null, locationId: null };
  return {
    noticeType: '', en: { title: '', body: '' }, zh: { title: '', body: '' },
    publishAt: '', expireAt: '', mandatoryAck: false, incidentRef: '', responseOptions: '',
    targets: [target],
  };
}

function toComposeRequest(d: ComposeDraft): ComposeNoticeRequest {
  const options = d.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    noticeType: d.noticeType as StaffNoticeType,
    titleEn: d.en.title, titleZhHant: d.zh.title, bodyEn: d.en.body, bodyZhHant: d.zh.body,
    publishAt: d.publishAt || null,
    expireAt: d.expireAt || null,
    mandatoryAck: d.mandatoryAck,
    incidentRef: d.incidentRef || null,
    responseOptions: options.length ? options : null,
    targets: d.targets,
  };
}

export function ComposeForm({
  initial, node, locale, onSubmit, busy, children,
}: {
  initial: ComposeNoticeRequest | null;
  node: { ref: ScopeRef; label: string } | null;
  locale: Locale;
  onSubmit: (body: ComposeNoticeRequest, clientKey: string) => void;
  busy: boolean;
  children?: ReactNode;
}) {
  const M = MESSAGES.s5;
  const [d, setD] = useState<ComposeDraft>(() => draftFrom(initial, node?.ref ?? null));
  useEffect(() => setD(draftFrom(initial, node?.ref ?? null)), [initial, node?.ref.kind, node?.ref.id]);
  // The client-chosen key that makes a retry safe (ADR-015 D1). One per form
  // instance, held in memory only; never stored.
  const clientKey = useMemo(() => crypto.randomUUID(), []);
  const id = 'compose';

  return (
    <form
      className="pemo-panel pemo-form"
      data-testid="compose-form"
      data-form-act="composeNotice"
      data-prefilled={initial !== null}
      onSubmit={(e) => { e.preventDefault(); onSubmit(toComposeRequest(d), clientKey); }}
    >
      <h2 className="pemo-panel__title">
        {t(M.composeAt, locale)}: {node ? `${t(MESSAGES.scopeKind[node.ref.kind], locale)}: ${node.label}` : (d.targets[0]?.nodeId ?? d.targets[0]?.locationId ?? '')}
      </h2>
      <HintRow text={t(M.composeFormNote, locale)} />
      {children}

      <label className="pemo-field" htmlFor={`${id}-noticeType`}>
        {t(M.fieldNoticeType, locale)}
        <select id={`${id}-noticeType`} name="noticeType" data-form-field="true" required value={d.noticeType} onChange={(e) => setD({ ...d, noticeType: e.target.value as StaffNoticeType | '' })}>
          <option value="">—</option>
          {NOTICE_TYPES.map((ty) => <option key={ty} value={ty}>{t(M.noticeType[ty], locale)}</option>)}
        </select>
      </label>

      <HintRow text={t(M.authoringNote, locale)} />
      <div className="pemo-form__languages">
        <LanguageBlock which="en" value={d.en} onChange={(en) => setD({ ...d, en })} locale={locale} idPrefix={id} />
        <LanguageBlock which="zh-Hant" value={d.zh} onChange={(zh) => setD({ ...d, zh })} locale={locale} idPrefix={id} />
      </div>

      <ScheduleFields publishAt={d.publishAt} expireAt={d.expireAt} mandatoryAck={d.mandatoryAck} onChange={(p) => setD({ ...d, ...p })} locale={locale} idPrefix={id} />

      <label className="pemo-field" htmlFor={`${id}-incidentRef`}>
        {t(M.fieldIncidentRef, locale)} <span className="pemo-meta">({t(M.optionalField, locale)})</span>
        <input id={`${id}-incidentRef`} name="incidentRef" data-form-field="true" value={d.incidentRef} onChange={(e) => setD({ ...d, incidentRef: e.target.value })} />
      </label>

      <ResponseOptionsField value={d.responseOptions} onChange={(responseOptions) => setD({ ...d, responseOptions })} locale={locale} idPrefix={id} />

      <TargetsField targets={d.targets} onChange={(targets) => setD({ ...d, targets })} locale={locale} idPrefix={id} />

      <div className="pemo-actions">
        <ActButton op="composeNotice" locale={locale} submit primary busy={busy} testId="compose-submit" />
      </div>
    </form>
  );
}

/* ---------------------------------------------------------- the recorded act */

export function ActRecorded({
  op, data, locale, corpusMode, onOpen, onBack,
}: {
  op: NoticeTransition | 'composeNotice';
  data: NoticeActResponse;
  locale: Locale;
  corpusMode: boolean;
  onOpen: (noticeId: string) => void;
  onBack: () => void;
}) {
  const M = MESSAGES.s5;
  return (
    <section className="pemo-state pemo-state--recorded" data-testid="act-recorded" data-act-recorded={op} role="status">
      <h2 className="pemo-state__title">{t(M.recordedTitle, locale)}: {t(M.act[op], locale)}</h2>
      <p className="pemo-state__body">{t(M.recordedNote, locale)}</p>
      {corpusMode ? <p className="pemo-meta" data-testid="recorded-response-note">{t(M.recordedResponseNote, locale)}</p> : null}
      <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-3)' }}>
        {noticeTitleFor(data.noticeId, locale) ? (
          <>
            <dt>{t(M.colTitle, locale)}</dt>
            <dd data-testid="recorded-notice-title">{noticeTitleFor(data.noticeId, locale)}</dd>
          </>
        ) : null}
        <dt>{t(M.newVersion, locale)}</dt>
        <dd data-testid="recorded-version">{data.version}</dd>
      </dl>
      <ITDetails
        locale={locale}
        testId="recorded-it-details"
        rows={[
          [M.factNoticeId, <span data-testid="recorded-notice-id" key="n">{data.noticeId}</span>],
          [MESSAGES.state.correlationLabel, data.meta.correlationId],
        ]}
      />
      <div className="pemo-actions" style={{ marginTop: 'var(--pemo-space-3)' }}>
        <a
          href={`?screen=s5detail&state=detail&lang=${locale}&notice=${encodeURIComponent(data.noticeId)}`}
          className="pemo-button pemo-button--primary"
          data-testid="open-notice"
          data-read-affordance="navigate"
          onClick={(e) => { e.preventDefault(); onOpen(data.noticeId); }}
        >
          {t(M.openNotice, locale)}
        </a>
        <button type="button" className="pemo-button" data-read-affordance="navigate" data-testid="back-to-list" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ transitions */

/** The acts whose request carries the notice's CONTENT: revise (a draft) and correct (a published one). */
const CONTENT_ACTS: readonly NoticeTransition[] = ['reviseNotice', 'correctNotice'];

interface TransitionDraft {
  fromVersion: string;
  reasonCode: string;
  en: LanguageText;
  zh: LanguageText;
  publishAt: string;
  expireAt: string;
  mandatoryAck: boolean;
  responseOptions: string;
  targets: NoticeTarget[];
}

function transitionDraftFrom(r: NoticeTransitionRequest): TransitionDraft {
  return {
    fromVersion: String(r.fromVersion),
    reasonCode: r.reasonCode ?? '',
    en: { title: r.titleEn ?? '', body: r.bodyEn ?? '' },
    zh: { title: r.titleZhHant ?? '', body: r.bodyZhHant ?? '' },
    publishAt: r.publishAt ?? '',
    expireAt: r.expireAt ?? '',
    mandatoryAck: r.mandatoryAck ?? false,
    responseOptions: (r.responseOptions ?? []).join('\n'),
    targets: (r.targets ?? []).map((tg) => ({ nodeKind: tg.nodeKind ?? null, nodeId: tg.nodeId ?? null, locationId: tg.locationId ?? null })),
  };
}

/**
 * Only the fields the author TOUCHED are sent — the request the corpus recorded
 * for revise carries one title and nothing else, and a form that sent every field
 * back would turn "revise the title" into "restate the whole notice". An empty
 * field is absent from the request, never sent as an empty string.
 */
function toTransitionRequest(d: TransitionDraft, content: boolean): NoticeTransitionRequest {
  const out: NoticeTransitionRequest = { fromVersion: Number(d.fromVersion) };
  if (d.reasonCode.trim()) out.reasonCode = d.reasonCode.trim();
  if (content) {
    if (d.en.title) out.titleEn = d.en.title;
    if (d.zh.title) out.titleZhHant = d.zh.title;
    if (d.en.body) out.bodyEn = d.en.body;
    if (d.zh.body) out.bodyZhHant = d.zh.body;
    if (d.publishAt) out.publishAt = d.publishAt;
    if (d.expireAt) out.expireAt = d.expireAt;
    if (d.mandatoryAck) out.mandatoryAck = true;
    const options = d.responseOptions.split('\n').map((s) => s.trim()).filter(Boolean);
    if (options.length) out.responseOptions = options;
    if (d.targets.length) out.targets = d.targets;
  }
  return out;
}

export function ActConfirm({
  op, noticeId, initial, locale, onConfirm, onBack, busy, children,
}: {
  op: NoticeTransition;
  noticeId: string;
  initial: NoticeTransitionRequest;
  locale: Locale;
  onConfirm: (body: NoticeTransitionRequest) => void;
  onBack: () => void;
  busy: boolean;
  children?: ReactNode;
}) {
  const M = MESSAGES.s5;
  const content = CONTENT_ACTS.includes(op);
  /** The acts that take a reason, and which codes — from the generated registry, never typed here. */
  const reasons = NOTICE_REASONS[op];
  const [d, setD] = useState<TransitionDraft>(() => transitionDraftFrom(initial));
  useEffect(() => setD(transitionDraftFrom(initial)), [initial]);
  const id = `act-${op}`;

  return (
    <form
      className="pemo-panel pemo-form"
      data-testid="act-confirm"
      data-form-act={op}
      data-notice-id={noticeId}
      data-content-act={content}
      onSubmit={(e) => { e.preventDefault(); onConfirm(toTransitionRequest(d, content)); }}
    >
      <h2 className="pemo-panel__title">{t(M.confirmHeading, locale)}: {t(M.act[op], locale)}</h2>
      <p className="pemo-note">{t(M.confirmNote, locale)}</p>
      {children}

      {noticeTitleFor(noticeId, locale) ? (
        <dl className="pemo-dl">
          <dt>{t(M.colTitle, locale)}</dt>
          <dd data-testid="confirm-notice-title">{noticeTitleFor(noticeId, locale)}</dd>
        </dl>
      ) : null}
      <ITDetails locale={locale} testId="confirm-it-details" rows={[[M.factNoticeId, <span data-testid="confirm-notice-id" key="n">{noticeId}</span>]]} />

      <h3 className="pemo-panel__title" style={{ fontSize: 15 }}>{t(M.requestHeading, locale)}</h3>
      <div className="pemo-toolbar">
        <label className="pemo-field" htmlFor={`${id}-fromVersion`}>
          {t(M.fieldFromVersion, locale)}
          <input id={`${id}-fromVersion`} name="fromVersion" data-form-field="true" type="number" min={1} required value={d.fromVersion} onChange={(e) => setD({ ...d, fromVersion: e.target.value })} />
        </label>
        {reasons ? (
          <label className="pemo-field" htmlFor={`${id}-reasonCode`}>
            {t(M.fieldReasonCode, locale)}
            {reasons.required ? null : <span className="pemo-meta"> ({t(M.optionalField, locale)})</span>}
            {/* THE OPTIONS ARE THE ACT'S OWN SUBSET, generated from the contract's
                reason registry (GEN-052 D3). A code outside the union is a type
                error here; a subset typed by hand is what the generator exists to
                prevent. `required` is the act's rule, mirrored on the control only
                as the presence of a blank option. */}
            <select
              id={`${id}-reasonCode`}
              name="reasonCode"
              data-form-field="true"
              data-reason-required={reasons.required}
              value={d.reasonCode}
              onChange={(e) => setD({ ...d, reasonCode: e.target.value })}
            >
              {reasons.required ? null : <option value="">{t(M.reasonNone, locale)}</option>}
              {reasons.codes.map((c: NoticeReasonCode) => (
                <option key={c} value={c}>{t(M.reasonCode[c], locale)}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <HintRow text={t(M.reasonNote, locale)} testId="reason-note" />

      {content ? (
        <>
          <HintRow text={t(M.authoringNote, locale)} />
          <div className="pemo-form__languages">
            <LanguageBlock which="en" value={d.en} onChange={(en) => setD({ ...d, en })} locale={locale} idPrefix={id} />
            <LanguageBlock which="zh-Hant" value={d.zh} onChange={(zh) => setD({ ...d, zh })} locale={locale} idPrefix={id} />
          </div>
          <ScheduleFields publishAt={d.publishAt} expireAt={d.expireAt} mandatoryAck={d.mandatoryAck} onChange={(p) => setD({ ...d, ...p })} locale={locale} idPrefix={id} />
          <ResponseOptionsField value={d.responseOptions} onChange={(responseOptions) => setD({ ...d, responseOptions })} locale={locale} idPrefix={id} />
          <TargetsField targets={d.targets} onChange={(targets) => setD({ ...d, targets })} locale={locale} idPrefix={id} />
        </>
      ) : null}

      <div className="pemo-actions">
        <ActButton op={op} locale={locale} submit primary busy={busy} testId="act-confirm-submit" />
        <button type="button" className="pemo-button" data-read-affordance="navigate" data-testid="back-to-notice" onClick={onBack}>
          {t(M.backToNotice, locale)}
        </button>
      </div>
    </form>
  );
}
