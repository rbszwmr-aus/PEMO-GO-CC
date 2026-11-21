/**
 * Residents — WEB-05 directory (list → detail), fixture-first.
 *
 * Design nav note (management-web-6-Sept): resident directory, invitation and
 * verification states, household role assignment. Lives under Properties because
 * a resident only exists in relation to a unit.
 *
 * Property model: Organization / Estate / Building / Floor / Unit (PEMO), never
 * HMS models. Fixtures are UI-owned until listResidents / getResident land in the
 * OpenAPI (see docs/contracts/proposed-residents-read-ops.md). No live client.
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { DetailPanes } from '../components/DetailPanes.tsx';
import { DetailBack, DetailTitle } from '../components/DetailChrome.tsx';
import { useMemo } from 'react';
import { FilterBar, NoMatches } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateOnly, dateTime, number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { Empty } from '../components/StateNotice.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  findResidentDetail,
  RESIDENTS_DETAIL_DEFAULT,
} from '../data/residents-corpus.ts';
import type {
  ResidentDetailResponse,
  ResidentDirectoryState,
  ResidentListResponse,
  ResidentOccupancyRole,
} from '../data/types.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

const DEFERRED = [
  m('Invite a resident', '邀請住戶', '邀请住户'),
  m('Assign household role', '指派住戶角色', '指派住户角色'),
  m('Record occupancy', '登記居住關係', '登记居住关系'),
  m('End occupancy', '結束居住關係', '结束居住关系'),
];

type ResidentFilter = 'all' | 'verified' | 'invited' | 'pending' | 'expired';
const STATE_OF: Record<Exclude<ResidentFilter, 'all'>, ResidentDirectoryState> = {
  verified: 'verified', invited: 'invited', pending: 'pending_verification', expired: 'expired_scope',
};
/** All, then each directory state; every tab opens A to Z by name. */
const STATUSES: readonly StatusDef<ResidentListResponse['residents'][number], ResidentFilter>[] = (['all', 'verified', 'invited', 'pending', 'expired'] as const).map((id) => ({
  id,
  test: (r: ResidentListResponse['residents'][number]) => id === 'all' || r.directoryState === STATE_OF[id],
  sort: { key: 'name', dir: 'asc' } as const,
}));
const SEARCH = copy('Search name or unit', '搜尋姓名或單位', '搜索姓名或单元');

function roleLabel(role: ResidentOccupancyRole | null, locale: Locale): string {
  if (!role) return t(MESSAGES.residents.roleNone, locale);
  return t(MESSAGES.residents.role[role], locale);
}

function stateLabel(state: ResidentDirectoryState, locale: Locale): string {
  return t(MESSAGES.residents.directoryState[state], locale);
}

const PANE_DETAILS = copy('Details', '詳情', '详情');

export function ResidentsList({
  data,
  locale,
  onOpen,
  focusKey,
}: {
  data: ResidentListResponse;
  locale: Locale;
  onOpen: (residentId: string) => void;
  focusKey?: NodeKey | null;
}) {
  const M = MESSAGES.residents;
  const scoped = focusKey
    ? data.residents.filter((r) => scopePathInFocus(r.scope, focusKey))
    : data.residents;
  const spec = useMemo<ViewSpec<ResidentListResponse['residents'][number]>>(() => ({
    searchText: (r) => `${r.displayName} ${r.unitSummary ? t(r.unitSummary, locale) : ''}`,
    filters: {},
    sorts: {
      name: (r) => r.displayName,
      unit: (r) => (r.unitSummary ? t(r.unitSummary, locale) : null),
      role: (r) => roleLabel(r.primaryRole, locale),
      directory: (r) => stateLabel(r.directoryState, locale),
      invite: (r) => (r.invitation ? t(M.invitationState[r.invitation.state], locale) : t(M.invitationNone, locale)),
      verify: (r) => t(M.verificationState[r.verification.state], locale),
    },
  }), [locale, M]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<ResidentFilter>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'verified', label: t(M.countVerified, locale), icon: 'CircleCheck', count: sv.counts.verified },
    { id: 'invited', label: t(M.countInvited, locale), icon: 'Send', count: sv.counts.invited },
    { id: 'pending', label: t(M.countPending, locale), icon: 'Hourglass', count: sv.counts.pending, alert: true },
    { id: 'expired', label: t(M.countExpired, locale), icon: 'CircleAlert', count: sv.counts.expired, alert: true },
  ];
  const columns = [
    { key: 'name', label: t(M.colName, locale), width: '22%' , sortable: true },
    { key: 'unit', label: t(M.colUnit, locale), width: '24%' , sortable: true },
    { key: 'role', label: t(M.colRole, locale), width: '14%', hideBelow: 720 , sortable: true },
    { key: 'directory', label: t(M.colDirectory, locale), width: '16%' , sortable: true },
    { key: 'invite', label: t(M.colInvitation, locale), width: '12%', hideBelow: 660 , sortable: true },
    { key: 'verify', label: t(M.colVerification, locale), width: '12%', hideBelow: 540 , sortable: true },
  ];

  return (
    <>
      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="residents">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}
      <HintRow text={t(M.boundaryNote, locale)} />
      <StatusHead
        tabs={tabs}
        cardIds={['verified', 'invited', 'pending', 'expired']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="resident-status"
        ariaLabel={t(M.countsHeading, locale)}
        cardsTestId="resident-stats"
      />

      {scoped.length === 0 ? (
        <Empty locale={locale} />
      ) : (
        <section className="pemo-panel">
          <FilterBar
            locale={locale}
            testId="residents-filters"
            searchLabel={t(SEARCH, locale)}
            query={tv.state.query}
            onQuery={tv.setQuery}
            filters={[]}
            active={tv.active}
            onClear={tv.clear}
          />
          {tv.view.length === 0 ? <NoMatches locale={locale} testId="residents-no-matches" /> : (
          <Table caption={t(M.listTitle, locale)} columns={columns} testId="residents-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((r) => {
              const unitTitle = r.unitSummary ? t(r.unitSummary, locale) : t(M.noUnit, locale);
              const role = roleLabel(r.primaryRole, locale);
              const dir = stateLabel(r.directoryState, locale);
              const invite = r.invitation
                ? t(M.invitationState[r.invitation.state], locale)
                : t(M.invitationNone, locale);
              const verify = t(M.verificationState[r.verification.state], locale);
              return (
                <tr
                  key={r.residentId}
                  data-testid="residents-row"
                  data-resident-id={r.residentId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(r.residentId)}
                >
                  <WrapCell title={r.displayName}>
                    <a
                      href={`?screen=residentsDetail&state=detail&lang=${locale}&residentId=${encodeURIComponent(r.residentId)}`}
                      data-testid="resident-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(r.residentId);
                      }}
                    >
                      {r.displayName}
                    </a>
                    <div className="pemo-meta" data-alt="role">{t(M.colRole, locale)}: {role}</div>
                    <div className="pemo-meta" data-alt="invite">{t(M.colInvitation, locale)}: {invite}</div>
                    <div className="pemo-meta" data-alt="verify">{t(M.colVerification, locale)}: {verify}</div>
                  </WrapCell>
                  <td>
                    {r.scope ? (
                      <ScopePathCell scope={r.scope} locale={locale} short />
                    ) : (
                      <PlainChip testId="no-unit">{t(M.noUnit, locale)}</PlainChip>
                    )}
                    {r.unitSummary ? <span className="pemo-visually-hidden">{unitTitle}</span> : null}
                  </td>
                  <DenseCell title={role}>{role}</DenseCell>
                  <DenseCell title={dir}>
                    <span data-directory-state={r.directoryState}>{dir}</span>
                  </DenseCell>
                  <DenseCell title={invite}>{invite}</DenseCell>
                  <DenseCell title={verify}>{verify}</DenseCell>
                </tr>
              );
            })}
          </Table>
          )}
          <HintRow text={t(M.tableNote, locale)} />
        </section>
      )}

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function ResidentsDetail({
  residentId,
  locale,
  onBack,
  /** Optional corpus payload for the state-matrix `detail` state (no id in URL). */
  data,
}: {
  residentId: string;
  locale: Locale;
  onBack: () => void;
  data?: ResidentDetailResponse | undefined;
}) {
  const M = MESSAGES.residents;
  const resolved: ResidentDetailResponse | undefined = residentId
    ? findResidentDetail(residentId)
    : (data ?? RESIDENTS_DETAIL_DEFAULT);

  if (!resolved) {
    return (
      <section className="pemo-panel" data-testid="residents-detail-missing">
        <p>{t(M.notFound, locale)}</p>
        <a
          href={`?screen=residents&state=list&lang=${locale}`}
          data-testid="resident-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToList, locale)}
        </a>
      </section>
    );
  }

  const r = resolved.resident;
  const columns = [
    { key: 'unit', label: t(M.colUnit, locale), width: '28%' },
    { key: 'role', label: t(M.colRole, locale), width: '18%' },
    { key: 'class', label: t(M.colUnitClass, locale), width: '12%', hideBelow: 600 },
    { key: 'from', label: t(M.colFrom, locale), width: '16%' },
    { key: 'to', label: t(M.colTo, locale), width: '14%' },
    { key: 'status', label: t(M.colOccupancyStatus, locale), width: '12%' },
  ];

  return (
    <>
      <section className="pemo-panel" data-testid="residents-detail" data-resident-id={r.residentId}>
        <DetailTitle title={r.displayName} />
        <DetailBack><p>
          <a
            href={`?screen=residents&state=list&lang=${locale}`}
            data-testid="resident-back"
            data-read-affordance="navigate"
            onClick={(e) => { e.preventDefault(); onBack(); }}
          >
            {t(M.backToList, locale)}
          </a>
        </p></DetailBack>
        <DetailPanes
          key={r.residentId}
          locale={locale}
          root="resident-pane"
          ariaLabel={t(M.detailTitle, locale)}
          panes={[
            { id: 'details', label: t(PANE_DETAILS, locale), icon: 'Info', node: (
              <>
        <dl className="pemo-dl" data-testid="resident-facts">
          <dt>{t(M.colDirectory, locale)}</dt>
          <dd>{stateLabel(r.directoryState, locale)}</dd>
          <dt>{t(M.colVerification, locale)}</dt>
          <dd>
            {t(M.verificationState[r.verification.state], locale)}
            {r.verification.verifiedAt ? (
              <div className="pemo-meta">{dateTime(r.verification.verifiedAt, locale)}</div>
            ) : null}
          </dd>
          <dt>{t(M.factPass, locale)}</dt>
          <dd>
            {r.passReference
              ? <span className="pemo-identifier">{r.passReference}</span>
              : t(M.passNone, locale)}
          </dd>
          <dt>{t(M.factLanguage, locale)}</dt>
          <dd>{r.preferredLanguage === 'zh-Hant' ? t(M.langZh, locale) : t(M.langEn, locale)}</dd>
        </dl>
        <ITDetails locale={locale} testId="resident-it-details" rows={[[M.factId, r.residentId]]} />
        <HintRow text={t(M.detailNote, locale)} />
              </>
            ) },
            { id: 'units', label: t(M.occupanciesHeading, locale), icon: 'Building2', count: r.occupancies.length, node: (
              <>
        {r.occupancies.length === 0 ? (
          <Empty locale={locale} />
        ) : (
          <Table caption={t(M.occupanciesHeading, locale)} columns={columns} testId="resident-occupancies-table">
            {r.occupancies.map((o) => {
              const role = roleLabel(o.role, locale);
              const klass = t(M.unitClass[o.unitClass], locale);
              const status = t(M.occupancyStatus[o.status], locale);
              const from = dateOnly(o.effectiveFrom, locale);
              const to = o.effectiveTo ? dateOnly(o.effectiveTo, locale) : t(M.openEnded, locale);
              return (
                <tr key={o.occupancyId} data-testid="occupancy-row" data-unit-class={o.unitClass}>
                  <td><ScopePathCell scope={o.scope} locale={locale} short /></td>
                  <DenseCell title={role}>{role}</DenseCell>
                  <DenseCell title={klass}>{klass}</DenseCell>
                  <DenseCell title={from}>{from}</DenseCell>
                  <DenseCell title={to}>{to}</DenseCell>
                  <DenseCell title={status}>{status}</DenseCell>
                </tr>
              );
            })}
          </Table>
        )}
        <HintRow text={t(M.parkingNote, locale)} />
              </>
            ) },
          ]}
        />
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
