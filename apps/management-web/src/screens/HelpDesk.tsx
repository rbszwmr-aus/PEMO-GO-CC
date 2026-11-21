/**
 * Help desk — OPERATE queue (list → contact detail), fixture-first.
 *
 * Design (management-web-6-Sept): one queue for app / phone / counter contacts,
 * office hours 08:00–20:00, stats + live queue + relation-to-cases notes.
 * Default remains the page fixture corpus. When `?source=live`, App wires
 * listHelpdeskQueue / getHelpdeskContact and passes mapped UI models here —
 * never invent empty queues on failure (problem / offline render instead).
 * See docs/contracts/proposed-helpdesk-read-ops.md.
 *
 * Write acts are named under DeferredActions only — never disabled primary
 * buttons (GEN-047 A4 / UI-051 D1). Channel + state filters explore the loaded
 * fixture set (same shape as S5 notice filters); they are not a live query.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Desk stat cards pass an icon (fallback glyph for an unknown API stat id).
 */

import { DetailBack, DetailTitle } from '../components/DetailChrome.tsx';
import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { StatCard } from '../components/StatCard.tsx';
import type { IconName } from '../components/Icon.tsx';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { hktStamp } from '../format/datetime.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { Empty, PartialBanner } from '../components/StateNotice.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  HELPDESK_DETAIL_DEFAULT,
  HELPDESK_NOTES,
  HELPDESK_PARTIAL_REASONS,
  helpdeskContact,
  helpdeskFixtureView,
  type HelpdeskChannel,
  type HelpdeskContactDetail,
  type HelpdeskContactState,
  type HelpdeskQueueRow,
  type HelpdeskStat,
  type HelpdeskTone,
} from '../data/helpdesk-fixtures.ts';
import { PortalTicketsQueue } from './PortalTicketsPanel.tsx';
import { listPortalTickets } from '../data/portal-tickets-client.ts';
import { deskStatCards } from '../data/helpdesk-desk-stats.ts';
import type { ScopeTreeNode } from '../data/types.ts';
import { helpdeskUnitInFocus } from '../shell/scope-focus.ts';

const m = copy;

const DEFERRED = [
  m('Answer next in queue (live)', '接下一位（即時）', '接下一位（即时）'),
  m('Log a call (write)', '登記來電（寫入）', '登记来电（写入）'),
  m('Log a counter visit (write)', '登記櫃台來訪（寫入）', '登记柜台来访（写入）'),
  m('Raise contact as case', '將聯絡轉為個案', '将联络转为案件'),
];

const TONE_EDGE: Record<HelpdeskTone, string> = {
  // Soft edge = 40% of the severity border token over white (palette-derived,
  // no one-off colours); unknown is the neutral-300 token itself.
  critical: 'color-mix(in srgb, var(--pemo-sev-critical-border) 40%, var(--pemo-common-white))',
  warning: 'color-mix(in srgb, var(--pemo-sev-warning-border) 40%, var(--pemo-common-white))',
  info: 'color-mix(in srgb, var(--pemo-sev-information-border) 40%, var(--pemo-common-white))',
  normal: 'color-mix(in srgb, var(--pemo-sev-normal-border) 40%, var(--pemo-common-white))',
  unknown: 'var(--pemo-neutral-300)',
};

const CHANNELS: readonly HelpdeskChannel[] = ['app', 'phone', 'counter'];
const STATES: readonly HelpdeskContactState[] = ['waiting', 'in_progress', 'overdue', 'closed'];

function channelLabel(ch: HelpdeskChannel, locale: Locale): string {
  return t(MESSAGES.helpdesk.channel[ch], locale);
}

function stateLabel(state: HelpdeskContactState, locale: Locale): string {
  return t(MESSAGES.helpdesk.contactState[state], locale);
}

function seedChannel(filter: string | undefined): string {
  if (filter && (CHANNELS as readonly string[]).includes(filter)) return filter;
  return 'all';
}

function seedState(filter: string | undefined): string {
  if (filter && (STATES as readonly string[]).includes(filter)) return filter;
  if (filter === 'open') return 'waiting';
  return 'all';
}

type QueueTab = 'all' | HelpdeskContactState;
/** All, then each contact state; the queue keeps its own order until a header is clicked. */
const STATUSES: readonly StatusDef<HelpdeskQueueRow, QueueTab>[] = (['all', ...STATES] as QueueTab[]).map((id) => ({
  id,
  test: (r: HelpdeskQueueRow) => id === 'all' || r.state === id,
  sort: null,
}));
const STATE_ICON: Record<HelpdeskContactState, IconName> = { waiting: 'Hourglass', in_progress: 'ClipboardList', overdue: 'CircleAlert', closed: 'CircleCheck' };
const STAT_ICON: Record<string, IconName> = { waiting: 'Hourglass', answered: 'CircleCheck', raised: 'Inbox', hours: 'Clock' };
const QUEUE_SEARCH = copy('Search resident, unit or subject', '搜尋住戶、單位或主旨', '搜索住户、单元或主旨');

export function HelpDeskQueue({
  locale,
  onOpen,
  empty = false,
  partial = false,
  /** URL-carried seed for channel or state filter (fixture exploration). */
  filter,
  liveView = null,
  focusNode = null,
}: {
  locale: Locale;
  onOpen: (contactId: string) => void;
  empty?: boolean;
  partial?: boolean;
  filter?: string | undefined;
  /** When set (live mode loaded), render this instead of the page fixture. */
  liveView?: { stats: readonly HelpdeskStat[]; rows: readonly HelpdeskQueueRow[] } | null;
  /** Picked rail node — matches the authored unit string on each row. */
  focusNode?: ScopeTreeNode | null;
}) {
  const M = MESSAGES.helpdesk;
  const fromLive = liveView != null;
  const mode = empty ? 'empty' : partial ? 'partial' : 'queue';
  const fixture = helpdeskFixtureView(mode);
  const baseRows: readonly HelpdeskQueueRow[] = fromLive ? liveView.rows : fixture.rows;
  const stats: readonly HelpdeskStat[] = fromLive ? liveView.stats : fixture.stats;
  const showPartial = !fromLive && fixture.partial;

  const [channelFilter, setChannelFilter] = useState(() => seedChannel(filter));

  type DeskDrill = 'waiting' | 'answered' | 'raised' | null;
  const [deskDrill, setDeskDrill] = useState<DeskDrill>(null);
  const [portalCounts, setPortalCounts] = useState<{ waiting: number; answered: number; raised: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void listPortalTickets().then((res) => {
      if (cancelled) return;
      let waiting = 0;
      let answered = 0;
      let raised = 0;
      const todayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const onHongKongDay = (iso: string | null | undefined): boolean => {
        if (!iso) return false;
        const t = Date.parse(iso);
        if (!Number.isFinite(t)) return false;
        return (
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Hong_Kong',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(t)) === todayKey
        );
      };
      for (const ticket of res.tickets) {
        if (ticket.status === 'open' || ticket.status === 'triaged') waiting += 1;
        if (ticket.status === 'in_progress' || ticket.status === 'awaiting_resident') raised += 1;
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          if (onHongKongDay(ticket.updatedAt)) answered += 1;
          else {
            const lastStatus = [...ticket.timeline]
              .reverse()
              .find((ev) => ev.kind === 'status' && (ev.status === 'resolved' || ev.status === 'closed'));
            if (onHongKongDay(lastStatus?.at)) answered += 1;
          }
        }
      }
      setPortalCounts({ waiting, answered, raised });
    });
    return () => {
      cancelled = true;
    };
  }, []);


  // The rail's place and the channel dropdown narrow the rows before the state tabs count them.
  const scoped = useMemo(
    () => baseRows.filter((r) => (channelFilter === 'all' || r.channel === channelFilter) && helpdeskUnitInFocus(r.unit, focusNode)),
    [baseRows, channelFilter, focusNode],
  );
  const spec = useMemo<ViewSpec<HelpdeskQueueRow>>(() => ({
    searchText: (r) => `${r.who} ${r.unit} ${t(r.subject, locale)}`,
    filters: {},
    sorts: {
      ch: (r) => channelLabel(r.channel, locale),
      who: (r) => r.who,
      subject: (r) => t(r.subject, locale),
      wait: (r) => t(r.wait, locale),
      state: (r) => stateLabel(r.state, locale),
    },
  }), [locale]);
  const initialTab = seedState(filter) as QueueTab;
  const sv = useStatusView(scoped, STATUSES, spec, locale, initialTab);
  const { tv } = sv;
  const statesPresentAll = useMemo(() => {
    const set = new Set(baseRows.map((r) => r.state));
    return STATES.filter((x) => set.has(x));
  }, [baseRows]);
  const tabs: CardTabItem<QueueTab>[] = [
    { id: 'all', label: t(M.filterAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    ...statesPresentAll.map((x) => ({ id: x as QueueTab, label: stateLabel(x, locale), icon: STATE_ICON[x], count: sv.counts[x], alert: x === 'overdue' })),
  ];
  const channelsPresent = useMemo(() => {
    const set = new Set(baseRows.map((r) => r.channel));
    return CHANNELS.filter((c) => set.has(c));
  }, [baseRows]);
  const channelFilters: FilterDef[] = [
    {
      key: 'channel', label: t(M.filterChannel, locale), allLabel: t(M.filterAll, locale),
      options: channelsPresent.map((c) => ({ value: c, label: channelLabel(c, locale) })),
      value: channelFilter === 'all' ? '' : channelFilter, onChange: (v) => setChannelFilter(v === '' ? 'all' : v),
    },
  ];

  // One source per card: API stat verbatim in live mode, page label + page
  // count in fixture mode (src/data/helpdesk-desk-stats.ts).
  const deskCards = useMemo(() => deskStatCards(stats, portalCounts, fromLive), [stats, portalCounts, fromLive]);

  const columns = [
    { key: 'ch', label: t(M.colChannel, locale), width: '10%', hideBelow: 620, sortable: true },
    { key: 'who', label: t(M.colResident, locale), width: '18%', sortable: true },
    { key: 'subject', label: t(M.colSubject, locale), width: '36%', sortable: true },
    { key: 'wait', label: t(M.colWaiting, locale), width: '14%', hideBelow: 620, sortable: true },
    { key: 'state', label: t(M.colState, locale), width: '12%', sortable: true },
  ];

  return (
    <>
      {showPartial ? (
        <PartialBanner locale={locale} reasons={[...HELPDESK_PARTIAL_REASONS]} />
      ) : null}

      {focusNode ? (
        <section className="pemo-panel" data-testid="helpdesk-header">
          <p className="pemo-note" data-testid="scope-filter-note" data-screen="helpdesk">
            {t(MESSAGES.shell.filterNote, locale)}
          </p>
        </section>
      ) : null}

      <HintRow text={t(M.subtitle, locale)} />
      {!fromLive ? <HintRow text={t(M.fixtureLabel, locale)} testId="helpdesk-fixture-label" /> : null}
      <HintRow text={HELPDESK_NOTES.map((n) => `${t(n.k, locale)}: ${t(n.v, locale)}`).join('\n')} testId="helpdesk-notes" />

      <div className="pemo-statcards" data-testid="helpdesk-stats">
        {deskCards.map(({ stat: s, drill, hint: hintSource }) => {
          const tip =
            hintSource === 'stat'
              ? t(s.note, locale)
              : drill === 'waiting'
                ? t(M.waitingStatHint, locale)
                : drill === 'answered'
                  ? t(M.answeredStatHint, locale)
                  : t(M.raisedStatHint, locale);
          const tone = s.tone === 'critical' ? 'critical' : s.tone === 'warning' ? 'warning' : undefined;
          return (
            <StatCard
              key={s.id}
              id={s.id}
              label={t(s.label, locale)}
              value={s.value}
              icon={STAT_ICON[s.id] ?? 'Info'}
              tone={tone}
              tip={tip}
              note={tip}
              locale={locale}
              active={drill != null && deskDrill === s.id}
              onPress={drill != null ? () => {
                const next = deskDrill === s.id ? null : drill;
                setDeskDrill(next);
                // All three desk cards drill the portal-tickets list (live store).
                sv.choose('all');
                window.requestAnimationFrame(() => {
                  document.getElementById('portal-tickets-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              } : undefined}
            />
          );
        })}
      </div>

      <PortalTicketsQueue
        locale={locale}
        onOpen={onOpen}
        drill={deskDrill}
        onClearDrill={() => {
          setDeskDrill(null);
          sv.choose('all');
        }}
      />

      {deskDrill != null ? null : baseRows.length === 0 ? (
        <section className="pemo-state" data-testid="state-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
        </section>
      ) : (
        <>
          <StatusHead
            tabs={tabs}
            cardIds={[]}
            filter={sv.filter}
            onChoose={sv.choose}
            onPress={sv.press}
            shown={tv.view.length}
            total={scoped.length}
            locale={locale}
            root="helpdesk-status"
            ariaLabel={t(M.queueHeading, locale)}
            cardsTestId="helpdesk-queue-stats"
          />
          <section className="pemo-panel" data-testid="helpdesk-filters">
            <FilterBar
              locale={locale}
              testId="helpdesk-bar"
              searchLabel={t(QUEUE_SEARCH, locale)}
              query={tv.state.query}
              onQuery={tv.setQuery}
              filters={channelFilters}
              active={tv.active || channelFilter !== 'all'}
              onClear={() => { tv.clear(); setChannelFilter('all'); }}
            />
            <HintRow text={t(M.filterNote, locale)} testId="helpdesk-filter-note" />
            {tv.view.length === 0 ? (
              <p className="pemo-state__body" data-testid="helpdesk-filter-no-match">{t(M.filterNoMatch, locale)}</p>
            ) : (
              <Table caption={t(M.queueHeading, locale)} columns={columns} testId="helpdesk-queue" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
                {tv.view.map((q) => {
                  const ch = channelLabel(q.channel, locale);
                  const subject = t(q.subject, locale);
                  const wait = t(q.wait, locale);
                  const st = stateLabel(q.state, locale);
                  return (
                    <tr
                      key={q.id}
                      data-testid="helpdesk-row"
                      data-contact-id={q.id}
                      data-tone={q.tone}
                      data-channel={q.channel}
                      data-state={q.state}
                      style={{ borderLeft: `3px solid ${TONE_EDGE[q.tone]}` }}
                    >
                      <DenseCell title={ch}>
                        <span className="pemo-identifier">{ch}</span>
                      </DenseCell>
                      <td>
                        <a
                          href={`?screen=helpdeskDetail&state=detail&lang=${locale}&contact=${encodeURIComponent(q.id)}`}
                          data-testid="helpdesk-open"
                          data-read-affordance="navigate"
                          onClick={(e) => {
                            e.preventDefault();
                            onOpen(q.id);
                          }}
                        >
                          <span className="pemo-cell--wrap">{q.who}</span>
                        </a>
                        <div className="pemo-meta">{q.unit}</div>
                        <div className="pemo-meta" data-alt="ch">{ch} · {wait}</div>
                      </td>
                      <WrapCell title={subject}>{subject}</WrapCell>
                      <DenseCell title={wait}>{wait}</DenseCell>
                      <DenseCell title={st}>
                        <PlainChip>{st}</PlainChip>
                      </DenseCell>
                    </tr>
                  );
                })}
              </Table>
            )}
            <HintRow text={t(M.waitNote, locale)} />
          </section>
        </>
      )}

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function HelpDeskDetail({
  contactId,
  locale,
  onBack,
  liveDetail = null,
  liveMode = false,
}: {
  contactId: string;
  locale: Locale;
  onBack: () => void;
  /** When set (live mode loaded), render this instead of the page fixture. */
  liveDetail?: HelpdeskContactDetail | null;
  liveMode?: boolean;
}) {
  const M = MESSAGES.helpdesk;
  const detail = liveMode
    ? liveDetail
    : contactId
      ? helpdeskContact(contactId)
      : HELPDESK_DETAIL_DEFAULT;

  if (!detail) {
    return (
      <section className="pemo-panel" data-testid="helpdesk-detail-missing">
        <p>{t(M.notFound, locale)}</p>
        <a
          href={`?screen=helpdesk&state=queue&lang=${locale}`}
          data-testid="helpdesk-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToQueue, locale)}
        </a>
      </section>
    );
  }

  return (
    <>
      <section className="pemo-panel" data-testid="helpdesk-detail">
        <DetailBack><p>
          <a
            href={`?screen=helpdesk&state=queue&lang=${locale}`}
            data-testid="helpdesk-back"
            data-read-affordance="navigate"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            {t(M.backToQueue, locale)}
          </a>
        </p></DetailBack>
        <DetailTitle title={t(detail.subject, locale)} />
        <dl className="pemo-dl" data-testid="helpdesk-contact-facts">
          <dt>{t(M.colChannel, locale)}</dt>
          <dd>{channelLabel(detail.channel, locale)}</dd>
          <dt>{t(M.colResident, locale)}</dt>
          <dd>
            {detail.who}
            <div className="pemo-meta">{detail.unit}</div>
          </dd>
          <dt>{t(M.colWaiting, locale)}</dt>
          <dd>{t(detail.wait, locale)}</dd>
          <dt>{t(M.colState, locale)}</dt>
          <dd>
            <PlainChip>{stateLabel(detail.state, locale)}</PlainChip>
          </dd>
          <dt>{t(M.factOpenedAt, locale)}</dt>
          <dd>{detail.openedAt}</dd>
          <dt>{t(M.factLinkedCase, locale)}</dt>
          <dd>
            {detail.linkedCaseRef ? (
              <span className="pemo-identifier">{detail.linkedCaseRef}</span>
            ) : (
              t(M.noLinkedCase, locale)
            )}
          </dd>
          <dt>{t(M.factDisposition, locale)}</dt>
          <dd>{t(detail.disposition, locale)}</dd>
        </dl>
        <ITDetails locale={locale} testId="helpdesk-it-details" rows={[[M.factContactId, detail.id]]} />
        {!liveMode ? (
          <HintRow text={t(M.fixtureLabel, locale)} testId="helpdesk-fixture-label" />
        ) : null}
      </section>

      <section className="pemo-panel">
        <h3 className="pemo-panel__title">{t(M.timelineHeading, locale)}</h3>
        {detail.timeline.length === 0 ? (
          <Empty locale={locale} />
        ) : (
          <ol className="pemo-helpdesk-timeline" data-testid="helpdesk-timeline">
            {detail.timeline.map((turn, i) => (
              <li key={i} data-testid="helpdesk-timeline-turn">
                <div className="pemo-meta">
                  <span data-testid="helpdesk-timeline-time">{hktStamp(turn.at, locale)}</span>
                  {' · '}
                  {t(turn.who, locale)}
                  {' · '}
                  {turn.channel === 'system'
                    ? t(M.channelSystem, locale)
                    : channelLabel(turn.channel, locale)}
                </div>
                <div>{t(turn.body, locale)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
