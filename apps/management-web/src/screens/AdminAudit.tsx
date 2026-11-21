/**
 * Administration, Audit log (S04).
 *
 * Who did what, to what, where and when, newest first. The log is append-only and the screen only reads it:
 * no control here edits or deletes an entry. Reads go through the audit source, which is Backend’s
 * GET /admin/audit-log when it answers and the contract-shaped fixture when it does not.
 *
 * Names, not ids: the person, a sentence for the action, the kind of record, and the place by its name in
 * the property tree. Event, request, staff, group and record ids, the client address and the browser sit
 * in each entry’s collapsed IT details.
 *
 * Filters go to the server (so a page of results is a page of the filtered log); the dates are Hong Kong
 * days. Export downloads the same filter as a CSV, at most 10,000 entries.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateTime, dateTimeShort } from '../format/datetime.ts';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { useTableView } from '../components/useTableView.ts';
import type { ViewSpec } from '../components/table-view.ts';
import { ITDetails, SourceTag, HintRow } from '../components/FinanceBits.tsx';
import { Loading, ProblemState } from '../components/StateNotice.tsx';
import { scopeNodeLabel, unitLabel } from '../data/host-label.ts';
import type { Problem } from '../data/types.ts';
import { ApiError, type SourceKind } from '../data/sourced.ts';
import { auditSessionRevision, isSessionAuditEvent, subscribeAuditSession } from '../data/audit-session.ts';
import { auditSource } from '../audit/audit-client.ts';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditEntityType, type AuditEvent, type AuditQuery } from '../audit/audit-log.ts';

const ESTATE_ID = 'est_wing_fu_garden';
const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** The sentence for an action. A code the server has added since this build is “Other change”, never a raw code. */
export function actionText(action: string, locale: Locale): string {
  return t(Object.hasOwn(MESSAGES.audit.action, action) ? MESSAGES.audit.action[action as AuditAction] : MESSAGES.audit.unknownAction, locale);
}
export function entityTypeText(type: string, locale: Locale): string {
  return t(Object.hasOwn(MESSAGES.audit.entityType, type) ? MESSAGES.audit.entityType[type as AuditEntityType] : MESSAGES.audit.unknownType, locale);
}
export function roleText(role: string, locale: Locale): string {
  return t(Object.hasOwn(MESSAGES.audit.role, role) ? MESSAGES.audit.role[role as keyof typeof MESSAGES.audit.role] : MESSAGES.audit.unknownRole, locale);
}

/** A place by its name in the tree: a block with its estate, a flat as block, floor, flat, joined with › like the block. Never an id. */
export function placeText(place: AuditEvent['place'], locale: Locale): string {
  const kindName = t((MESSAGES.scopeKind as Readonly<Record<string, LocalizedText>>)[place.nodeKind] ?? MESSAGES.audit.unknownPlace, locale);
  if (place.nodeKind === 'unit') return unitLabel(place.nodeId, locale)?.replace(/ · /g, ' › ') ?? kindName;
  const own = scopeNodeLabel(place.nodeId, locale);
  if (!own) return kindName;
  if (place.nodeKind === 'building') {
    const estate = scopeNodeLabel(ESTATE_ID, locale);
    return estate ? `${estate} › ${own}` : own;
  }
  return own;
}

export function whoText(e: AuditEvent, locale: Locale): string {
  if (e.actor) return e.actor.displayName;
  return t(e.source === 'integration' ? MESSAGES.audit.systemIntegration : MESSAGES.audit.systemSetup, locale);
}

function reasonText(code: string | null, locale: Locale): string {
  if (!code) return t(MESSAGES.audit.noReason, locale);
  const known = (MESSAGES.s5.reasonCode as Readonly<Record<string, LocalizedText>>)[code];
  if (known) return t(known, locale);
  const words = code.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function useAuditSessionRevision(): number {
  const [rev, setRev] = useState(auditSessionRevision);
  useEffect(() => subscribeAuditSession(() => setRev(auditSessionRevision())), []);
  return rev;
}

const placeKey = (p: AuditEvent['place']) => `${p.nodeKind}:${p.nodeId}`;

type Load =
  | { status: 'loading' }
  | { status: 'problem'; problem: Problem }
  | { status: 'ready'; events: AuditEvent[]; hasMore: boolean; nextCursor: string | null; source: SourceKind };

const asProblem = (err: unknown): Problem => (err instanceof ApiError
  ? err.problem
  : { type: 'https://pemo.local/problems/internal-error', title: 'Something went wrong', status: 0, correlationId: 'none' });

const EMPTY_EVENTS: readonly AuditEvent[] = [];

export function AdminAuditList({ locale }: { locale: Locale }) {
  const M = MESSAGES.audit;
  const revision = useAuditSessionRevision();
  const [query, setQuery] = useState<AuditQuery>({});
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [more, setMore] = useState<'idle' | 'busy'>('idle');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [exportState, setExportState] = useState<{ busy: boolean; failed: boolean; truncated: boolean }>({ busy: false, failed: false, truncated: false });
  // Everyone and every place seen in any page so far, so a filter does not take its own options away.
  const seenActors = useRef(new Map<string, string>());
  const seenPlaces = useRef(new Map<string, AuditEvent['place']>());
  const run = useRef(0);

  const remember = (events: readonly AuditEvent[]) => {
    for (const e of events) {
      if (e.actor) seenActors.current.set(e.actor.principalId, e.actor.displayName);
      seenPlaces.current.set(placeKey(e.place), e.place);
    }
  };

  useEffect(() => {
    const mine = ++run.current;
    void auditSource().read(query).then(
      (r) => {
        if (mine !== run.current) return;
        remember(r.response.events);
        setLoad({ status: 'ready', events: r.response.events, hasMore: r.response.page.hasMore, nextCursor: r.response.page.nextCursor, source: r.source });
        setOpen(new Set());
      },
      (err: unknown) => { if (mine === run.current) setLoad({ status: 'problem', problem: asProblem(err) }); },
    );
  }, [query, revision]);

  const loadMore = () => {
    if (load.status !== 'ready' || !load.nextCursor) return;
    const mine = run.current;
    setMore('busy');
    void auditSource().read({ ...query, cursor: load.nextCursor }).then(
      (r) => {
        if (mine !== run.current) return;
        remember(r.response.events);
        setLoad({ status: 'ready', events: [...load.events, ...r.response.events], hasMore: r.response.page.hasMore, nextCursor: r.response.page.nextCursor, source: r.source });
        setMore('idle');
      },
      (err: unknown) => { setMore('idle'); setLoad({ status: 'problem', problem: asProblem(err) }); },
    );
  };

  const exportCsv = async () => {
    setExportState({ busy: true, failed: false, truncated: false });
    try {
      const file = await auditSource().exportCsv(query);
      const url = URL.createObjectURL(new Blob([file.text], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState({ busy: false, failed: false, truncated: file.truncated });
    } catch {
      setExportState({ busy: false, failed: true, truncated: false });
    }
  };

  const actors = useMemo(
    () => [...seenActors.current.entries()].sort((a, b) => a[1].localeCompare(b[1], 'en')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );
  const places = useMemo(
    () => [...seenPlaces.current.entries()].map(([k, p]) => [k, p, placeText(p, locale)] as const).sort((a, b) => a[2].localeCompare(b[2], locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, locale],
  );

  const set = (patch: { [K in keyof AuditQuery]?: AuditQuery[K] | undefined }) => setQuery((q) => {
    const next: Record<string, unknown> = { ...q, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
    return next as AuditQuery;
  });
  const filtered = Object.keys(query).length > 0;
  const placeValue = query.nodeKind && query.nodeId ? `${query.nodeKind}:${query.nodeId}` : '';
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Newest first; a header click re-orders the entries loaded so far (the server query does the filtering).
  const sortSpec = useMemo<ViewSpec<AuditEvent>>(() => ({
    searchText: () => '',
    filters: {},
    sorts: {
      when: (e) => e.occurredAt,
      who: (e) => whoText(e, locale),
      what: (e) => actionText(e.action, locale),
      on: (e) => entityTypeText(e.entity.type, locale),
      where: (e) => placeText(e.place, locale),
    },
  }), [locale]);
  const loaded = load.status === 'ready' ? load.events : EMPTY_EVENTS;
  const tv = useTableView(loaded, sortSpec, { key: 'when', dir: 'desc' }, locale);

  if (load.status === 'problem') return <ProblemState problem={load.problem} locale={locale} />;

  const columns = [
    { key: 'when', label: t(M.colWhen, locale), width: '17%', sortable: true },
    { key: 'who', label: t(M.colWho, locale), width: '19%', sortable: true },
    { key: 'what', label: t(M.colWhat, locale), width: '24%', sortable: true },
    { key: 'on', label: t(M.colOn, locale), width: '12%', sortable: true },
    { key: 'where', label: t(M.colWhere, locale), width: '19%', sortable: true },
    { key: 'details', label: t(M.details, locale), width: '9%' },
  ];

  return (
    <section className="pemo-panel" data-testid="admin-audit">
      <HintRow text={t(M.intro, locale)} testId="admin-audit-intro" />

      <div className="pemo-toolbar pemo-audit-filters" data-testid="admin-audit-filters" role="search">
        <label className="pemo-field">
          {t(M.filterFrom, locale)}
          <input type="date" value={query.fromDay ?? ''} max={query.toDay ?? ''} data-read-affordance="filter" data-testid="admin-audit-filter-from" onChange={(e) => set({ fromDay: e.target.value })} />
        </label>
        <label className="pemo-field">
          {t(M.filterTo, locale)}
          <input type="date" value={query.toDay ?? ''} min={query.fromDay ?? ''} data-read-affordance="filter" data-testid="admin-audit-filter-to" onChange={(e) => set({ toDay: e.target.value })} />
        </label>
        <label className="pemo-field">
          {t(M.filterWho, locale)}
          <select value={query.actor ?? ''} data-read-affordance="filter" data-testid="admin-audit-filter-actor" onChange={(e) => set({ actor: e.target.value })}>
            <option value="">{t(M.anyone, locale)}</option>
            {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="pemo-field">
          {t(M.filterWhat, locale)}
          <select value={query.action ?? ''} data-read-affordance="filter" data-testid="admin-audit-filter-action" onChange={(e) => set({ action: e.target.value })}>
            <option value="">{t(M.anyAction, locale)}</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionText(a, locale)}</option>)}
          </select>
        </label>
        <label className="pemo-field">
          {t(M.filterOn, locale)}
          <select value={query.entityType ?? ''} data-read-affordance="filter" data-testid="admin-audit-filter-type" onChange={(e) => set({ entityType: e.target.value })}>
            <option value="">{t(M.anyType, locale)}</option>
            {AUDIT_ENTITY_TYPES.map((x) => <option key={x} value={x}>{entityTypeText(x, locale)}</option>)}
          </select>
        </label>
        <label className="pemo-field">
          {t(M.filterWhere, locale)}
          <select
            value={placeValue}
            data-read-affordance="filter"
            data-testid="admin-audit-filter-place"
            onChange={(e) => {
              const p = seenPlaces.current.get(e.target.value);
              set(p ? { nodeKind: p.nodeKind, nodeId: p.nodeId } : { nodeKind: undefined, nodeId: undefined });
            }}
          >
            <option value="">{t(M.anyPlace, locale)}</option>
            {places.map(([k, , label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <div className="pemo-audit-filters__end">
          {filtered ? (
            <button type="button" className="pemo-button pemo-button--quiet" data-read-affordance="filter" data-testid="admin-audit-clear" onClick={() => setQuery({})}>
              {t(M.clear, locale)}
            </button>
          ) : null}
          {load.status === 'ready' && load.events.length > 0 ? (
            <button type="button" className="pemo-button" data-read-affordance="download" data-testid="admin-audit-export" disabled={exportState.busy} onClick={() => void exportCsv()}>
              {t(exportState.busy ? M.exporting : M.exportCsv, locale)}
            </button>
          ) : null}
          {load.status === 'ready' ? <SourceTag live={load.source === 'live'} locale={locale} testId="admin-audit-source" /> : null}
        </div>
      </div>
      {exportState.truncated ? <p className="pemo-note" role="status" data-testid="admin-audit-export-truncated">{t(M.exportTruncated, locale)}</p> : null}
      {exportState.failed ? <p className="pemo-note" role="alert" data-testid="admin-audit-export-failed">{t(M.exportFailed, locale)}</p> : null}

      {load.status === 'loading' ? <Loading locale={locale} /> : null}

      {load.status === 'ready' && load.events.length === 0 ? (
        <div className="pemo-state" role="status" data-testid={filtered ? 'admin-audit-filter-empty' : 'admin-audit-empty'}>
          <h2 className="pemo-state__title">{t(filtered ? M.emptyTitle : M.noEntriesTitle, locale)}</h2>
          <p className="pemo-state__body">{t(filtered ? M.emptyBody : M.noEntriesBody, locale)}</p>
        </div>
      ) : null}

      {load.status === 'ready' && load.events.length > 0 ? (
        <>
          <p className="pemo-meta" data-testid="admin-audit-count" data-count={load.events.length}>
            {fill(t(M.showing, locale), { n: load.events.length })}
          </p>
          <Table caption={t(MESSAGES.admin.auditListTitle, locale)} columns={columns} testId="admin-audit-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((e) => {
              const isOpen = open.has(e.eventId);
              const when = dateTime(e.occurredAt, locale);
              return (
                <Fragment key={e.eventId}>
                  <tr
                    data-testid="admin-audit-row"
                    data-event-id={e.eventId}
                    data-actor={e.actor?.principalId ?? ''}
                    data-action={e.action}
                    data-session={isSessionAuditEvent(e.eventId) ? 'true' : 'false'}
                  >
                    <DenseCell title={when}>{dateTimeShort(e.occurredAt, locale)}</DenseCell>
                    <WrapCell title={whoText(e, locale)}>{whoText(e, locale)}</WrapCell>
                    <WrapCell title={actionText(e.action, locale)}>{actionText(e.action, locale)}</WrapCell>
                    <WrapCell title={entityTypeText(e.entity.type, locale)}>{entityTypeText(e.entity.type, locale)}</WrapCell>
                    <WrapCell title={placeText(e.place, locale)}>{placeText(e.place, locale)}</WrapCell>
                    <td>
                      <button
                        type="button"
                        className="pemo-link-button"
                        aria-expanded={isOpen}
                        data-read-affordance="disclose"
                        data-testid="admin-audit-toggle"
                        onClick={() => toggle(e.eventId)}
                      >
                        {t(isOpen ? M.hideDetails : M.details, locale)}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="pemo-audit-detail" data-testid="admin-audit-detail" data-event-id={e.eventId}>
                      <td colSpan={columns.length}>
                        <dl className="pemo-dl">
                          {e.authority ? (<><dt>{t(M.actedAs, locale)}</dt><dd>{roleText(e.authority.role, locale)}</dd></>) : null}
                          <dt>{t(M.reason, locale)}</dt><dd>{reasonText(e.reasonCode, locale)}</dd>
                          <dt>{t(M.recorded, locale)}</dt><dd>{dateTime(e.recordedAt, locale)}</dd>
                        </dl>
                        <ITDetails
                          locale={locale}
                          testId="admin-audit-it-details"
                          rows={[
                            [M.factEvent, e.eventId],
                            [M.factRequest, e.requestId],
                            ...(e.actor ? [[M.factStaff, e.actor.principalId] as const] : []),
                            ...(e.authority ? [[M.factGroup, e.authority.groupId] as const] : []),
                            [M.factRecord, e.entity.id],
                            [M.factSource, e.source],
                            ...(e.clientIp ? [[M.factAddress, e.clientIp] as const] : []),
                            ...(e.userAgent ? [[M.factBrowser, e.userAgent] as const] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table>
          {load.hasMore ? (
            <div className="pemo-audit-more">
              <button type="button" className="pemo-button" data-read-affordance="page" data-testid="admin-audit-more" disabled={more === 'busy'} onClick={loadMore}>
                {t(more === 'busy' ? M.loadingMore : M.loadMore, locale)}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
