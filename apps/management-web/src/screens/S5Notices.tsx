/**
 * NOTICES — the ADR-019 staff read surface (UI-045), with the acts the server
 * permits rendered beside what they act on (UI-051).
 *
 * Three views over the three reads: the list (`listNotices`), one notice
 * (`getNotice`) and its per-recipient acknowledgement status
 * (`getNoticeOutstanding`, which GEN-047 gave a fixture, so the part-1 stated gap
 * became a renderer here).
 *
 * A CONTROL APPEARS IFF THE SERVER LISTED ITS OPERATIONID. `permittedActions` is a
 * dry run of the acts, computed by the same function the acts call, and this
 * client renders its answer through NoticeActions.tsx and reasons about nothing:
 * not a role, not a grant, not the lifecycle state. The pending notice nobody may
 * approve now says so in the server's words — an empty list — rather than in a
 * panel of deferred names.
 *
 * `stateEnteredAt` sits beside the state as locale-aware relative time, measured
 * from the response's own `meta.generatedAt` so the age is a fact about the
 * response and a fixture renders the same words on every run.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { HintRow, InfoTip, ITDetails } from '../components/FinanceBits.tsx';
import { scopeNodeLabel, unitLabel } from '../data/host-label.ts';
import { noticeTitleFor } from '../data/notice-title.ts';
import { getAdminUserDetail } from '../data/admin-directory-session.ts';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterBar, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';

import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateTime, number, relativeTime } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { ActionBar } from './NoticeActions.tsx';
import { NoticeDeliveryPanel, NoticeDueDeliveriesBar, type LiveNoticeEmail } from './NoticeDelivery.tsx';
import { noticeScopeFor, relatedDocumentId } from '../data/notices-wfg-corpus.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';
import type {
  NoticeOutstandingResponse,
  NoticeTransition,
  StaffNoticeDetail,
  StaffNoticeDetailResponse,
  StaffNoticeListItem,
  StaffNoticeListResponse,
} from '../data/types.ts';

function lifecycleLabel(state: string, locale: Locale): string {
  // Indexed directly on the message map, not through an alias: the inventory scan
  // reads the SOURCE for `MESSAGES.s5.lifecycleState[...]` to prove the map is not
  // dead copy, and an alias hides the lookup from it.
  const entry = MESSAGES.s5.lifecycleState[state as keyof typeof MESSAGES.s5.lifecycleState] as
    | LocalizedText
    | undefined;
  // An unmapped value is rendered as itself rather than as blank. The totality
  // test makes this unreachable while the contract and the copy agree; if they
  // ever stop agreeing, a visible raw value is how a reader finds out.
  return entry ? t(entry, locale) : state;
}

function typeLabel(noticeType: string, locale: Locale): string {
  const entry = MESSAGES.s5.noticeType[noticeType as keyof typeof MESSAGES.s5.noticeType] as
    | LocalizedText
    | undefined;
  return entry ? t(entry, locale) : noticeType;
}

/** The state chip with its entered-at age beside it (GEN-047 D2). */
function StateWithAge({ state, enteredAt, now, locale }: { state: string; enteredAt: string; now: string; locale: Locale }) {
  return (
    <>
      <PlainChip testId="lifecycle-state">{lifecycleLabel(state, locale)}</PlainChip>{' '}
      <span
        className="pemo-meta"
        data-testid="state-entered"
        data-entered-at={enteredAt}
        title={dateTime(enteredAt, locale)}
      >
        {t(MESSAGES.s5.since, locale)} {relativeTime(enteredAt, now, locale)}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ the list */

/**
 * Default order: publish time, newest first, with unscheduled notices last and
 * ties left in the order the server sent them.
 *
 * A-05 asks the approval queue to be OLDEST-FIRST. GEN-047 D2 gave the list the
 * clock it lacked (`stateEnteredAt`), so that ordering is now POSSIBLE; it is not
 * applied by default because the list mixes every state and a queue order on a
 * mixed list is a different screen. The State filter plus the age beside each
 * state is what this surface offers; the queue view is a design question carried
 * to the PO rather than answered here.
 */

/** Overview notices-active: keep non-terminal lifecycle states. */
const TERMINAL_NOTICE_STATES = new Set(['expired', 'withdrawn']);

export type NoticeListFilter = 'active' | undefined;

function noticeMatchesFilter(n: StaffNoticeListItem, filter: NoticeListFilter): boolean {
  if (filter !== 'active') return true;
  return !TERMINAL_NOTICE_STATES.has(n.lifecycleState);
}

export function orderNotices(notices: StaffNoticeListItem[]): StaffNoticeListItem[] {
  return notices
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      const pa = a.n.publishAt;
      const pb = b.n.publishAt;
      if (pa && pb && pa !== pb) return pa < pb ? 1 : -1;
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return a.i - b.i;
    })
    .map((x) => x.n);
}

type NoticeState = StaffNoticeListItem['lifecycleState'];
type NoticeTab = 'all' | NoticeState;
const NOTICE_STATES: readonly NoticeState[] = ['draft', 'pending_approval', 'approved', 'scheduled', 'live', 'expired', 'withdrawn'];
/** All, then each lifecycle state; every tab opens newest publish first (unscheduled last). */
const STATUSES: readonly StatusDef<StaffNoticeListItem, NoticeTab>[] = (['all', ...NOTICE_STATES] as NoticeTab[]).map((id) => ({
  id,
  test: (n: StaffNoticeListItem) => id === 'all' || n.lifecycleState === id,
  sort: { key: 'pub', dir: 'desc' } as const,
}));
const NOTICE_ICON: Record<NoticeState, IconName> = {
  draft: 'NotebookPen', pending_approval: 'Hourglass', approved: 'FileCheck', scheduled: 'CalendarCheck', live: 'Radio', expired: 'Clock', withdrawn: 'Undo2',
};
const COMPOSE_SHORT = copy('Compose', '撰寫', '撰写');
const SEARCH = copy('Search title or type', '搜尋標題或類型', '搜索标题或类型');

export function S5List({
  data, locale, onOpen, onAct, onGoToTree, filter, focusKey, corpusLabel,
}: {
  data: StaffNoticeListResponse;
  locale: Locale;
  onOpen?: ((noticeId: string) => void) | undefined;
  onAct?: ((noticeId: string, op: NoticeTransition) => void) | undefined;
  /** Compose starts in the property tree (UI-051 G6, ruled); the list only points there. */
  onGoToTree?: (() => void) | undefined;
  /** URL-carried; `active` hides expired / withdrawn. */
  filter?: NoticeListFilter;
  /** Picked place in the SCOPE rail — rows already carrying a path are kept. */
  focusKey?: NodeKey | null;
  /** When set, the list is the UI-owned Wing Fu Garden overlay. */
  corpusLabel?: boolean;
}) {
  const M = MESSAGES.s5;
  const [cursor, setCursor] = useState(0);
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);

  const ordered = useMemo(() => {
    const scoped = data.notices.filter((n) => !focusKey || scopePathInFocus(noticeScopeFor(n.noticeId), focusKey));
    return orderNotices(scoped.filter((n) => noticeMatchesFilter(n, filter)));
  }, [data.notices, focusKey, filter]);
  const spec = useMemo<ViewSpec<StaffNoticeListItem>>(() => ({
    searchText: (n) => `${n.titleEn} ${n.titleZhHant} ${typeLabel(n.noticeType, locale)}`,
    filters: { type: (n) => n.noticeType },
    sorts: {
      title: (n) => t({ en: n.titleEn, 'zh-Hant': n.titleZhHant }, locale),
      type: (n) => typeLabel(n.noticeType, locale),
      state: (n) => lifecycleLabel(n.lifecycleState, locale),
      pub: (n) => n.publishAt ?? null,
      exp: (n) => n.expireAt ?? null,
      ack: (n) => (n.mandatoryAck ? 1 : 0),
    },
  }), [locale]);
  const sv = useStatusView(ordered, STATUSES, spec, locale);
  const { tv } = sv;
  const rows = tv.view;

  // The states and types offered are the ones PRESENT IN THE PAYLOAD, not the
  // contract's full enums: offering a filter for a value the response cannot
  // contain invites the reader to conclude there are none of that kind, which is
  // a claim about data this screen has not got.
  const statesPresent = NOTICE_STATES.filter((x) => sv.counts[x] > 0 || sv.filter === x);
  const typesPresent = [...new Set(ordered.map((n) => n.noticeType))];
  const tabs: CardTabItem<NoticeTab>[] = [
    { id: 'all', label: t(M.filterAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    ...statesPresent.map((x) => ({ id: x as NoticeTab, label: lifecycleLabel(x, locale), icon: NOTICE_ICON[x], count: sv.counts[x] })),
  ];
  const cardIds = (['live', 'scheduled', 'draft'] as const).filter((x) => statesPresent.includes(x));
  const typeFilters: FilterDef[] = [
    {
      key: 'type', label: t(M.filterType, locale), allLabel: t(M.filterAll, locale),
      options: typesPresent.map((ty) => ({ value: ty, label: typeLabel(ty, locale) })),
      value: tv.state.filters['type'] ?? '', onChange: (v) => tv.setFilter('type', v),
    },
  ];

  useEffect(() => {
    setCursor(0);
  }, [sv.filter, tv.state, focusKey, filter]);

  /** A-05's J/K traversal. A and D are NOT bound: an act starts from its control, never from a key with no confirm. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      if (rows.length === 0) return;
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'arrowdown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      } else if (key === 'k' || key === 'arrowup') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (key === 'enter' || key === ' ') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault();
        const row = rows[cursor];
        if (row && onOpen) onOpen(row.noticeId);
      }
    },
    [rows, cursor, onOpen],
  );

  useEffect(() => {
    const el = bodyRef.current?.querySelectorAll('tr')[cursor] as HTMLElement | undefined;
    el?.focus?.();
  }, [cursor, rows.length]);

  // Widths sum to 100%. ACKNOWLEDGEMENT / ACTIONS need real floors so
  // uppercase sticky headers stay readable and outline buttons are usable;
  // TITLE keeps enough share for the 2-line clamp (base.css min-width 12rem).
  const columns = [
    { key: 'title', label: t(M.colTitle, locale), width: '18%', sortable: true },
    { key: 'type', label: t(M.colType, locale), width: '12%', hideBelow: 700, sortable: true },
    { key: 'state', label: t(M.colState, locale), width: '13%', sortable: true },
    { key: 'pub', label: t(M.colPublish, locale), width: '10%', hideBelow: 700, sortable: true },
    { key: 'exp', label: t(M.colExpire, locale), width: '10%', hideBelow: 700, sortable: true },
    { key: 'ack', label: t(M.colAck, locale), width: '19%', hideBelow: 780, sortable: true },
    { key: 'actions', label: t(M.colActions, locale), width: '18%' },
  ];

  return (
    <>
      {corpusLabel ? (
        <HintRow text={t(M.wfgFixtureLabel, locale)} testId="s5-wfg-fixture-label" />
      ) : null}

      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="s5">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}

      {filter === 'active' ? (
        <p className="pemo-note" data-testid="s5-filter-note" data-filter="active">
          {t(M.filterActiveNote, locale)}
        </p>
      ) : null}

      <HintRow text={t(M.readInclusiveNote, locale)} testId="read-inclusive-note" />
      <StatusHead
        tabs={tabs}
        cardIds={cardIds}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={rows.length}
        total={ordered.length}
        locale={locale}
        root="s5-status"
        ariaLabel={t(M.statusChipsHeading, locale)}
        cardsTestId="s5-stats"
      />

      {corpusLabel || onGoToTree ? (
        <div className="pemo-tabrow__actions" data-testid="notice-tools">
          {onGoToTree ? (
            <span className="pemo-tabrow__counter" data-testid="compose-pointer">
              <a
                href={`?screen=s3&state=tree&lang=${locale}`}
                className="pemo-button"
                data-testid="compose-from-tree"
                data-read-affordance="navigate"
                title={t(M.composeFromTree, locale)}
                aria-label={t(M.composeFromTree, locale)}
                onClick={(e) => { e.preventDefault(); onGoToTree(); }}
              >
                <Icon name="Plus" size={15} /> {t(COMPOSE_SHORT, locale)}
              </a>
              <InfoTip text={t(M.composeFromTreeNote, locale)} />
            </span>
          ) : null}
          {corpusLabel ? <NoticeDueDeliveriesBar locale={locale} /> : null}
        </div>
      ) : null}

      <section className="pemo-panel" data-testid="notice-filters">
        <FilterBar
          locale={locale}
          testId="s5-filters"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={typeFilters}
          active={tv.active}
          onClear={tv.clear}
        />
        <HintRow text={t(M.filterNote, locale)} testId="filter-note" />
      </section>

      <section className="pemo-panel">
        <HintRow text={t(M.permittedNote, locale)} testId="permitted-note" />
        {rows.length === 0 ? (
          // Gated on the filtered set, and it says FILTER, not "no notices" — the
          // server returned some; this view is hiding them.
          <p className="pemo-state__body" data-testid="filter-no-match">{t(M.filterNoMatch, locale)}</p>
        ) : (
          <Table
            caption={t(M.listTitle, locale)}
            columns={columns}
            testId="s5-table"
            bodyRef={bodyRef}
            onBodyKeyDown={onKeyDown}
            bodyTestId="s5-rows"
            sorting={{ sort: tv.state.sort, onSort: tv.onSort }}
          >
              {rows.map((n, idx) => (
                <tr
                  key={n.noticeId}
                  data-testid="s5-row"
                  data-notice-id={n.noticeId}
                  data-lifecycle-state={n.lifecycleState}
                  data-notice-type={n.noticeType}
                  tabIndex={idx === cursor ? 0 : -1}
                  aria-selected={idx === cursor}
                  onFocus={() => setCursor(idx)}
                >
                  <WrapCell title={t({ en: n.titleEn, 'zh-Hant': n.titleZhHant }, locale)}>
                    {/* The title in the CURRENT locale — G2 closed at 2.1.0; both
                        languages are on the row. The other one is one click away
                        in the detail. */}
                    {onOpen ? (
                      <a
                        href={`?screen=s5detail&state=detail&lang=${locale}&notice=${encodeURIComponent(n.noticeId)}`}
                        data-testid="s5-open"
                        data-read-affordance="navigate"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpen(n.noticeId);
                        }}
                      >
                        {t({ en: n.titleEn, 'zh-Hant': n.titleZhHant }, locale)}
                      </a>
                    ) : (
                      t({ en: n.titleEn, 'zh-Hant': n.titleZhHant }, locale)
                    )}
                    {noticeScopeFor(n.noticeId) ? (
                      <div className="pemo-meta" data-testid="notice-scope">
                        <ScopePathCell scope={noticeScopeFor(n.noticeId)!} locale={locale} />
                      </div>
                    ) : null}
                    <div className="pemo-meta" data-alt="type">{typeLabel(n.noticeType, locale)}</div>
                    <div className="pemo-meta" data-alt="pub">
                      {t(M.colPublish, locale)}: {n.publishAt ? dateTime(n.publishAt, locale) : t(M.notScheduled, locale)}
                      {' · '}
                      {t(M.colExpire, locale)}: {n.expireAt ? dateTime(n.expireAt, locale) : t(M.noExpiry, locale)}
                    </div>
                    <div className="pemo-meta" data-alt="ack">
                      {t(M.colAck, locale)}: {t(n.mandatoryAck ? M.ackRequired : M.ackNotRequired, locale)}
                    </div>
                  </WrapCell>
                  <DenseCell title={typeLabel(n.noticeType, locale)}>{typeLabel(n.noticeType, locale)}</DenseCell>
                  <td>
                    <StateWithAge state={n.lifecycleState} enteredAt={n.stateEnteredAt} now={data.meta.generatedAt} locale={locale} />
                  </td>
                  <DenseCell title={n.publishAt ? dateTime(n.publishAt, locale) : t(M.notScheduled, locale)}>
                    {n.publishAt ? dateTime(n.publishAt, locale) : (
                      <span className="pemo-meta">{t(M.notScheduled, locale)}</span>
                    )}
                  </DenseCell>
                  <DenseCell title={n.expireAt ? dateTime(n.expireAt, locale) : t(M.noExpiry, locale)}>
                    {n.expireAt ? dateTime(n.expireAt, locale) : (
                      <span className="pemo-meta">{t(M.noExpiry, locale)}</span>
                    )}
                  </DenseCell>
                  <DenseCell title={t(n.mandatoryAck ? M.ackRequired : M.ackNotRequired, locale)}>
                    <span data-testid="mandatory-ack" data-required={n.mandatoryAck}>
                      {t(n.mandatoryAck ? M.ackRequired : M.ackNotRequired, locale)}
                    </span>
                  </DenseCell>
                  <td className="pemo-cell--actions">
                    {/* The server's permitted acts for THIS row. Empty says so. */}
                    <ActionBar target={n} locale={locale} dense noticeId={n.noticeId} onAct={(op) => onAct?.(n.noticeId, op)} />
                  </td>
                </tr>
              ))}
          </Table>
        )}
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- the detail */

/** "Block: Block A" when the tree knows the node; just the kind when it does not. The id stays in IT details. */
function targetText(kind: string, id: string | null | undefined, locale: Locale): string {
  const label = scopeNodeLabel(id, locale);
  return label ? `${kind}: ${label}` : kind;
}

/** A staff member’s name from the directory, or null: the raw staff id is not shown. */
function staffName(staffId: string): string | null {
  return getAdminUserDetail(staffId)?.user.displayName ?? null;
}

export function S5Detail({
  data, locale, onAct, onOutstanding, onOpenDocument, liveEmail,
}: {
  data: StaffNoticeDetailResponse;
  locale: Locale;
  onAct?: ((noticeId: string, op: NoticeTransition) => void) | undefined;
  onOutstanding?: ((noticeId: string) => void) | undefined;
  onOpenDocument?: ((documentId: string) => void) | undefined;
  liveEmail?: LiveNoticeEmail;
}) {
  const M = MESSAGES.s5;
  const n: StaffNoticeDetail = data.notice;
  // Locale first, the other language one click away. Both are always PRESENT in
  // the markup — a reviewer checking a bilingual notice must be able to reach
  // both, and ADR-019 OQ3 puts them on one assertion.
  // Notice content is authored in en + zh-Hant only, so a Simplified Chinese UI shows the Traditional text.
  const contentOf = (l: Locale): 'en' | 'zh-Hant' => (l === 'en' ? 'en' : 'zh-Hant');
  const [showing, setShowing] = useState<'en' | 'zh-Hant'>(contentOf(locale));
  useEffect(() => setShowing(contentOf(locale)), [locale]);
  const other: 'en' | 'zh-Hant' = showing === 'en' ? 'zh-Hant' : 'en';
  // A draft's detail IS the COM-05 preview. A note, not a control: the acts on a
  // draft are whatever the server listed, decided in NoticeActions.tsx.
  const isDraft = n.lifecycleState === 'draft';
  const relatedDoc = relatedDocumentId(n.noticeId);
  const detailScope = noticeScopeFor(n.noticeId);

  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title" data-testid="notice-title">
          {showing === 'en' ? n.titleEn : n.titleZhHant}
        </h2>
        <dl className="pemo-dl">
          <dt>{t(M.colType, locale)}</dt>
          <dd data-testid="notice-type">{typeLabel(n.noticeType, locale)}</dd>
          <dt>{t(M.colState, locale)}</dt>
          <dd>
            <StateWithAge state={n.lifecycleState} enteredAt={n.stateEnteredAt} now={data.meta.generatedAt} locale={locale} />
          </dd>
          <dt>{t(M.colPublish, locale)}</dt>
          <dd data-testid="notice-publish">
            {n.publishAt ? dateTime(n.publishAt, locale) : (
              <span className="pemo-meta">{t(M.notScheduled, locale)}</span>
            )}
          </dd>
          <dt>{t(M.colExpire, locale)}</dt>
          <dd data-testid="notice-expire">
            {n.expireAt ? dateTime(n.expireAt, locale) : (
              <span className="pemo-meta">{t(M.noExpiry, locale)}</span>
            )}
          </dd>
          <dt>{t(M.colAck, locale)}</dt>
          <dd data-testid="notice-ack">
            {t(n.mandatoryAck ? M.ackRequired : M.ackNotRequired, locale)}
            {onOutstanding ? (
              <>
                {' · '}
                <a
                  href={`?screen=s5ack&state=outstanding&lang=${locale}&notice=${encodeURIComponent(n.noticeId)}`}
                  data-testid="open-outstanding"
                  data-read-affordance="navigate"
                  onClick={(e) => { e.preventDefault(); onOutstanding(n.noticeId); }}
                >
                  {t(M.ackTitle, locale)}
                </a>
              </>
            ) : null}
          </dd>
          <dt>{t(M.versionLabel, locale)}</dt>
          <dd data-testid="notice-version">{n.version}</dd>
          {detailScope ? (
            <>
              <dt>{t(M.colWhere, locale)}</dt>
              <dd data-testid="notice-scope"><ScopePathCell scope={detailScope} locale={locale} /></dd>
            </>
          ) : null}
          {relatedDoc && onOpenDocument ? (
            <>
              <dt>{t(M.relatedDocument, locale)}</dt>
              <dd>
                <a
                  href={`?screen=documentsDetail&state=detail&lang=${locale}&document=${encodeURIComponent(relatedDoc)}`}
                  data-testid="related-document"
                  data-read-affordance="navigate"
                  onClick={(e) => { e.preventDefault(); onOpenDocument(relatedDoc); }}
                >
                  {t(M.openRelatedDocument, locale)}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="pemo-panel" data-testid="notice-actions">
        <h2 className="pemo-panel__title">{t(M.actionsHeading, locale)}</h2>
        <HintRow text={t(M.permittedNote, locale)} testId="permitted-note" />
        <div style={{ marginTop: 'var(--pemo-space-3)' }}>
          <ActionBar target={n} locale={locale} noticeId={n.noticeId} onAct={(op) => onAct?.(n.noticeId, op)} />
        </div>
      </section>

      <NoticeDeliveryPanel notice={n} locale={locale} {...(liveEmail ? { liveEmail } : {})} />

      {isDraft ? (
        <section className="pemo-state pemo-state--gap" data-testid="draft-preview" role="note">
          <h2 className="pemo-state__title">{t(M.previewTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.previewBody, locale)}</p>
        </section>
      ) : null}

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.detailHeading, locale)}</h2>
        <HintRow text={t(M.bothLanguagesNote, locale)} />
        <p className="pemo-meta" data-testid="showing-language">
          {t(showing === 'en' ? M.showingEnglish : M.showingChinese, locale)}
        </p>
        <button
          type="button"
          data-testid="toggle-language"
          data-read-affordance="locale"
          className="pemo-nav__item"
          onClick={() => setShowing(other)}
        >
          {t(M.otherLanguage, locale)}
        </button>
        {/* BOTH LANGUAGES ARE ALWAYS RENDERED AND ALWAYS VISIBLE. The toggle
            changes which one LEADS, not which one exists. Hiding the other language
            blinded the CJK dense-cell measurement once (UI-045); it is not repeated. */}
        <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-3)' }} data-leading={showing}>
          {(showing === 'en'
            ? (['en', 'zh-Hant'] as const)
            : (['zh-Hant', 'en'] as const)
          ).map((which) => (
            <Fragment key={which}>
              <dt lang={which} data-testid={`label-${which === 'en' ? 'en' : 'zh'}`}>
                {which === 'en' ? 'English' : '繁體中文'}
              </dt>
              <dd
                lang={which}
                data-testid={which === 'en' ? 'body-en' : 'body-zh'}
                data-leading={which === showing}
                className="pemo-cell--wrap"
              >
                {which === 'en' ? n.bodyEn : n.bodyZhHant}
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.targetingHeading, locale)}</h2>
        <HintRow text={t(M.targetingNote, locale)} />
        <div data-testid="notice-targets" style={{ marginTop: 'var(--pemo-space-3)' }}>
          {n.targets.length === 0 ? (
            <span className="pemo-meta" data-testid="targets-none">{t(M.targetNone, locale)}</span>
          ) : (
            n.targets.map((tg, i) => (
              <PlainChip key={`${tg.nodeKind ?? 'loc'}:${tg.nodeId ?? tg.locationId ?? i}`}>
                {tg.nodeKind
                  ? targetText(t(MESSAGES.scopeKind[tg.nodeKind], locale), tg.nodeId, locale)
                  : targetText(t(M.targetLocation, locale), tg.locationId, locale)}
              </PlainChip>
            ))
          )}
        </div>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.responseOptionsHeading, locale)}</h2>
        {n.responseOptions && n.responseOptions.length > 0 ? (
          <div data-testid="response-options">
            {n.responseOptions.map((o) => <PlainChip key={o}>{o}</PlainChip>)}
          </div>
        ) : (
          <p className="pemo-meta" data-testid="response-options-none">{t(M.responseOptionsNone, locale)}</p>
        )}
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.historyHeading, locale)}</h2>
        <HintRow text={t(M.historyNote, locale)} />
        <ol className="pemo-steps" data-testid="notice-history">
          {n.history.map((h) => (
            <li
              key={`${h.version}:${h.disposition}`}
              className="pemo-step"
              data-testid="history-entry"
              data-disposition={h.disposition}
              data-version={h.version}
            >
              <span style={{ flex: 1, minWidth: 0 }} className="pemo-cell--wrap">
                {t(MESSAGES.s5.disposition[h.disposition], locale)}
              </span>
              <span className="pemo-meta">{dateTime(h.recordedAt, locale)}</span>
              {staffName(h.recordedBy) ? <span className="pemo-meta">{t(M.historyBy, locale)}: {staffName(h.recordedBy)}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <ITDetails
        locale={locale}
        testId="notice-it-details"
        rows={[
          [M.factNoticeId, n.noticeId],
          [M.factTargetIds, n.targets.map((tg) => tg.nodeId ?? tg.locationId ?? '').filter(Boolean).join(', ') || '—'],
          [M.factStaffIds, [...new Set(n.history.map((h) => h.recordedBy))].join(', ') || '—'],
        ]}
      />
    </>
  );
}

/* ----------------------------------------------------- outstanding acks (R3) */

/**
 * Per-recipient acknowledgement status. Rendered in the SERVER'S order — the
 * contract puts unacknowledged recipients first because the list exists to be
 * worked through, and re-sorting here would replace that rule with a copy of it.
 *
 * THE IDENTITY COLUMN IS A NAMED DEFERRAL. Whether staff see a resident's name or
 * only unit and resident id is the PO's G7 ruling, still held. The column shows
 * the resident id the contract carries and says so on screen — a named deferral,
 * not a placeholder column waiting to be filled.
 */
export function S5Outstanding({ data, locale, onBack }: {
  data: NoticeOutstandingResponse;
  locale: Locale;
  onBack?: ((noticeId: string) => void) | undefined;
}) {
  const M = MESSAGES.s5;
  const acknowledged = data.recipients.filter((r) => r.acknowledged).length;
  const columns = [
    { key: 'unit', label: t(M.colUnit, locale), width: '34%' },
    { key: 'read', label: t(M.colRead, locale), width: '20%' },
    { key: 'ack', label: t(M.colAcknowledged, locale), width: '20%' },
    { key: 'response', label: t(M.colResponse, locale), width: '26%' },
  ];
  return (
    <>
      <section className="pemo-panel">
        <dl className="pemo-dl">
          <dt>{t(M.colTitle, locale)}</dt>
          <dd>
            {noticeTitleFor(data.noticeId, locale) ? <span data-testid="outstanding-notice-title">{noticeTitleFor(data.noticeId, locale)}</span> : null}
            {onBack ? (
              <>
                {noticeTitleFor(data.noticeId, locale) ? ' · ' : null}
                <a
                  href={`?screen=s5detail&state=detail&lang=${locale}&notice=${encodeURIComponent(data.noticeId)}`}
                  data-testid="back-to-notice"
                  data-read-affordance="navigate"
                  onClick={(e) => { e.preventDefault(); onBack(data.noticeId); }}
                >
                  {t(M.backToNotice, locale)}
                </a>
              </>
            ) : null}
          </dd>
          <dt>{t(M.colAck, locale)}</dt>
          <dd data-testid="outstanding-ack">{t(data.mandatoryAck ? M.ackRequired : M.ackNotRequired, locale)}</dd>
          <dt>{t(M.ackSummary, locale)}</dt>
          <dd data-testid="ack-summary" data-acknowledged={acknowledged} data-total={data.recipients.length}>
            {number(acknowledged, locale)} {t(M.ackOf, locale)} {number(data.recipients.length, locale)}
          </dd>
        </dl>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.ackHeading, locale)}</h2>
        <HintRow text={t(M.ackOrderNote, locale)} testId="ack-order-note" />
        <p className="pemo-note" data-testid="identity-deferral">{t(M.identityDeferral, locale)}</p>
        {data.recipients.length === 0 ? (
          <p className="pemo-state__body" data-testid="ack-none">{t(M.ackNone, locale)}</p>
        ) : (
          <Table caption={t(M.ackHeading, locale)} columns={columns} testId="s5ack-table">
            {data.recipients.map((r) => (
              <tr key={`${r.residentId}:${r.unitId}`} data-testid="recipient-row" data-resident-id={r.residentId} data-acknowledged={Boolean(r.acknowledged)}>
                <DenseCell title={unitLabel(r.unitId, locale) ?? ''}>{unitLabel(r.unitId, locale) ?? '—'}</DenseCell>
                <DenseCell title={r.read ? dateTime(r.read, locale) : t(M.ackNotYet, locale)}>
                  {r.read ? dateTime(r.read, locale) : <span className="pemo-meta">{t(M.ackNotYet, locale)}</span>}
                </DenseCell>
                <DenseCell title={r.acknowledged ? dateTime(r.acknowledged, locale) : t(M.ackNotYet, locale)}>
                  {r.acknowledged ? dateTime(r.acknowledged, locale) : <span className="pemo-meta">{t(M.ackNotYet, locale)}</span>}
                </DenseCell>
                <DenseCell title={r.response ?? t(M.ackNoResponse, locale)}>
                  {r.response ? r.response : <span className="pemo-meta">{t(M.ackNoResponse, locale)}</span>}
                </DenseCell>
              </tr>
            ))}
          </Table>
        )}
        <ITDetails
          locale={locale}
          testId="outstanding-it-details"
          rows={[
            [M.factNoticeId, data.noticeId],
            [M.factResidentIds, data.recipients.map((r) => `${r.residentId} (${r.unitId})`).join(', ') || '—'],
          ]}
        />
      </section>
    </>
  );
}
