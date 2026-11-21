/**
 * Households — WEB-04 composition (list → detail), fixture-first.
 *
 * Design nav note (management-web-6-Sept): household composition, effective
 * dates, caregiver authorisation and contact preferences, reached from a unit
 * rather than as an HMS-style flat directory.
 *
 * Property model: Organization / Estate / Building / Floor / Unit (PEMO).
 * Fixtures are UI-owned until listHouseholds / getHousehold are contracted —
 * see docs/contracts/proposed-households-read-ops.md. No live client.
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) With-caregiver card carries an icon; status tabs are CardTabItem (icon required).
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
import { dateOnly, number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  findHouseholdDetail,
  HOUSEHOLDS_DETAIL_DEFAULT,
} from '../data/households-corpus.ts';
import type {
  HouseholdDetailResponse,
  HouseholdListResponse,
  HouseholdOccupancyStatus,
  ResidentOccupancyRole,
  SafetyPermission,
} from '../data/types.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

const DEFERRED = [
  m('Amend household membership', '更改住戶成員', '更改住户成员'),
  m('Record caregiver authorisation', '登記照顧者授權', '登记照顾者授权'),
  m('End household occupancy', '結束住戶佔用', '结束住户占用'),
];

function roleLabel(role: ResidentOccupancyRole, locale: Locale): string {
  return t(MESSAGES.households.role[role], locale);
}

function statusLabel(status: HouseholdOccupancyStatus, locale: Locale): string {
  return t(MESSAGES.households.status[status], locale);
}

function safetyLabel(safety: SafetyPermission, locale: Locale): string {
  return t(MESSAGES.s3.safety[safety.state], locale);
}

/** List rows use `unitSummary`; detail uses `unitLabel`. Either must render. */
function householdUnitTitle(
  h: { unitLabel?: LocalizedText; unitSummary?: LocalizedText },
  locale: Locale,
): string {
  const text = h.unitLabel ?? h.unitSummary;
  return text ? t(text, locale) : '';
}

type HouseholdFilter = 'all' | 'occupied' | 'multiMember';
type HouseholdRow = HouseholdListResponse['households'][number];
/** All, occupied, several members; every tab opens by unit A to Z. */
const STATUSES: readonly StatusDef<HouseholdRow, HouseholdFilter>[] = [
  { id: 'all', test: () => true, sort: { key: 'unit', dir: 'asc' } },
  { id: 'occupied', test: (h) => h.status === 'occupied', sort: { key: 'unit', dir: 'asc' } },
  { id: 'multiMember', test: (h) => h.memberCount > 1, sort: { key: 'unit', dir: 'asc' } },
];
const SEARCH = copy('Search unit or name', '搜尋單位或姓名', '搜索单元或姓名');

const PANE_DETAILS = copy('Details', '詳情', '详情');

export function HouseholdsList({
  data,
  locale,
  onOpen,
  focusKey,
}: {
  data: HouseholdListResponse;
  locale: Locale;
  onOpen: (householdId: string) => void;
  focusKey?: NodeKey | null;
}) {
  const M = MESSAGES.households;
  const scoped = focusKey
    ? data.households.filter((h) => scopePathInFocus(h.scope, focusKey))
    : data.households;
  const spec = useMemo<ViewSpec<HouseholdRow>>(() => ({
    searchText: (h) => `${householdUnitTitle(h, locale)} ${h.primaryName}`,
    filters: {},
    sorts: {
      unit: (h) => householdUnitTitle(h, locale),
      primary: (h) => h.primaryName,
      role: (h) => roleLabel(h.primaryRole, locale),
      members: (h) => h.memberCount,
      from: (h) => h.occupancyFrom,
      status: (h) => statusLabel(h.status, locale),
    },
  }), [locale]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<HouseholdFilter>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'occupied', label: t(M.countOccupied, locale), icon: 'Building2', count: sv.counts.occupied },
    { id: 'multiMember', label: t(M.countMultiMember, locale), icon: 'LayoutGrid', count: sv.counts.multiMember },
  ];
  const columns = [
    { key: 'unit', label: t(M.colUnit, locale), width: '30%', sortable: true },
    { key: 'primary', label: t(M.colPrimary, locale), width: '22%', sortable: true },
    { key: 'role', label: t(M.colPrimaryRole, locale), width: '14%', hideBelow: 760, sortable: true },
    { key: 'members', label: t(M.colMembers, locale), width: '12%', sortable: true },
    { key: 'from', label: t(M.colOccupiedFrom, locale), width: '14%', hideBelow: 700, sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '14%', sortable: true },
  ];

  return (
    <>
      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="households">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}
      <HintRow text={t(M.boundaryNote, locale)} />
      <HintRow text={t(M.fixtureLabel, locale)} testId="households-fixture-label" />
      <StatusHead
        tabs={tabs}
        cardIds={['occupied', 'multiMember']}
        // A caregiver is a member role the list rows do not carry, so that card has no rows to filter to: it stays plain.
        plainCards={!focusKey ? [{ id: 'withCaregiver', label: t(M.countWithCaregiver, locale), value: data.counts.withCaregiver, icon: 'Tag' as const }] : []}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="household-status"
        ariaLabel={t(M.countsHeading, locale)}
        cardsTestId="household-stats"
      />

      {scoped.length === 0 ? (
        <section className="pemo-state" data-testid="state-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
        </section>
      ) : (
        <section className="pemo-panel">
          <FilterBar
            locale={locale}
            testId="households-filters"
            searchLabel={t(SEARCH, locale)}
            query={tv.state.query}
            onQuery={tv.setQuery}
            filters={[]}
            active={tv.active}
            onClear={tv.clear}
          />
          {tv.view.length === 0 ? <NoMatches locale={locale} testId="households-no-matches" /> : (
          <Table caption={t(M.listTitle, locale)} columns={columns} testId="households-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((h) => {
              const unitTitle = householdUnitTitle(h, locale);
              const role = roleLabel(h.primaryRole, locale);
              const from = dateOnly(h.occupancyFrom, locale);
              const status = statusLabel(h.status, locale);
              return (
                <tr
                  key={h.householdId}
                  data-testid="households-row"
                  data-household-id={h.householdId}
                  data-status={h.status}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(h.householdId)}
                >
                  <td>
                    <a
                      href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(h.householdId)}`}
                      data-testid="household-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(h.householdId);
                      }}
                    >
                      <span className="pemo-cell--wrap">{unitTitle}</span>
                    </a>
                    <div className="pemo-visually-hidden"><ScopePathCell scope={h.scope} locale={locale} /></div>
                  </td>
                  <WrapCell title={h.primaryName}>
                    {h.primaryName}
                    <div className="pemo-meta" data-alt="role">{role}</div>
                  </WrapCell>
                  <DenseCell title={role}>{role}</DenseCell>
                  <DenseCell title={String(h.memberCount)}>{number(h.memberCount, locale)}</DenseCell>
                  <DenseCell title={from}>{from}</DenseCell>
                  <DenseCell title={status}>
                    <PlainChip>{status}</PlainChip>
                  </DenseCell>
                </tr>
              );
            })}
          </Table>
          )}
        </section>
      )}

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function HouseholdsDetail({
  householdId,
  locale,
  onBack,
  onOpenResident,
  /** Optional corpus payload for the state-matrix `detail` state (no id in URL). */
  data,
}: {
  householdId: string;
  locale: Locale;
  onBack: () => void;
  onOpenResident: (residentId: string) => void;
  data?: HouseholdDetailResponse | undefined;
}) {
  const M = MESSAGES.households;
  const resolved: HouseholdDetailResponse | undefined = householdId
    ? findHouseholdDetail(householdId)
    : (data ?? HOUSEHOLDS_DETAIL_DEFAULT);

  if (!resolved) {
    return (
      <section className="pemo-panel" data-testid="households-detail-missing">
        <p>{t(M.notFound, locale)}</p>
        <a
          href={`?screen=households&state=list&lang=${locale}`}
          data-testid="household-back"
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

  const h = resolved.household;
  const memberColumns = [
    { key: 'name', label: t(M.colMemberName, locale), width: '26%' },
    { key: 'role', label: t(M.colMemberRole, locale), width: '22%' },
    { key: 'from', label: t(M.colFrom, locale), width: '16%' },
    { key: 'to', label: t(M.colTo, locale), width: '14%' },
    { key: 'safety', label: t(M.colSafety, locale), width: '22%' },
    { key: 'auth', label: t(M.colAuthorisation, locale), width: '24%', hideBelow: 700 },
  ];

  return (
    <>
      <section className="pemo-panel" data-testid="households-detail" data-household-id={h.householdId}>
        <DetailTitle title={householdUnitTitle(h, locale)} />
        <DetailBack><p>
          <a
            href={`?screen=households&state=list&lang=${locale}`}
            data-testid="household-back"
            data-read-affordance="navigate"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            {t(M.backToList, locale)}
          </a>
        </p></DetailBack>
        <DetailPanes
          key={h.householdId}
          locale={locale}
          root="household-pane"
          ariaLabel={t(M.detailTitle, locale)}
          panes={[
            { id: 'details', label: t(PANE_DETAILS, locale), icon: 'Info', node: (
              <>
        <dl className="pemo-dl" data-testid="household-facts">
          <dt>{t(M.factUnitRef, locale)}</dt>
          <dd><span className="pemo-identifier">{h.unitReference}</span></dd>
          <dt>{t(MESSAGES.s1.colWhere, locale)}</dt>
          <dd><ScopePathCell scope={h.scope} locale={locale} /></dd>
          <dt>{t(M.colOccupiedFrom, locale)}</dt>
          <dd>{dateOnly(h.occupancyFrom, locale)}</dd>
          <dt>{t(M.colStatus, locale)}</dt>
          <dd><PlainChip>{statusLabel(h.status, locale)}</PlainChip></dd>
          <dt>{t(M.notificationLanguage, locale)}</dt>
          <dd>{h.notificationLanguage === 'zh-Hant' ? t(M.langZh, locale) : t(M.langEn, locale)}</dd>
          <dt>{t(M.factContactEmail, locale)}</dt>
          <dd>
            <span className="pemo-identifier" data-testid="household-contact-email">
              {h.contactEmail ?? '—'}
            </span>
          </dd>
          <dt>{t(M.contactChannels, locale)}</dt>
          <dd>{t(h.contactPreferences.channels, locale)}</dd>
          <dt>{t(M.quietHours, locale)}</dt>
          <dd>{t(h.contactPreferences.quietHours, locale)}</dd>
        </dl>
        <ITDetails locale={locale} testId="household-it-details" rows={[[M.factHouseholdId, h.householdId]]} />
        <HintRow text={t(M.detailNote, locale)} />
        <HintRow text={t(M.fixtureLabel, locale)} testId="households-fixture-label" />
              </>
            ) },
            { id: 'members', label: t(M.membersHeading, locale), icon: 'ClipboardList', count: h.members.length, node: (
              <>
        <HintRow text={t(MESSAGES.s3.safetyGrantedByResident, locale)} />
        {h.members.length === 0 ? (
          <section className="pemo-state" data-testid="state-empty" role="status">
            <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
            <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
          </section>
        ) : (
          <Table caption={t(M.membersHeading, locale)} columns={memberColumns} testId="household-members-table">
            {h.members.map((mem) => {
              const role = roleLabel(mem.role, locale);
              const from = dateOnly(mem.effectiveFrom, locale);
              const to = mem.effectiveTo ? dateOnly(mem.effectiveTo, locale) : t(M.openEnded, locale);
              const safety = safetyLabel(mem.safety, locale);
              const auth = t(mem.authorisation, locale);
              return (
                <tr key={mem.residentId} data-testid="household-member-row" data-resident-id={mem.residentId} data-role={mem.role}>
                  <WrapCell title={mem.name}>
                    <a
                      href={`?screen=residentsDetail&state=detail&lang=${locale}&residentId=${encodeURIComponent(mem.residentId)}`}
                      data-testid="household-member-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenResident(mem.residentId);
                      }}
                    >
                      {mem.name}
                    </a>
                  </WrapCell>
                  <WrapCell title={role}>{role}</WrapCell>
                  <DenseCell title={from}>{from}</DenseCell>
                  <DenseCell title={to}>{to}</DenseCell>
                  <td>
                    <PlainChip testId="safety-state">{safety}</PlainChip>
                    {mem.safety.expiresAt ? (
                      <div className="pemo-meta" data-testid="safety-expiry">
                        {t(MESSAGES.s3.expiresOn, locale)} {dateOnly(mem.safety.expiresAt, locale)}
                      </div>
                    ) : null}
                  </td>
                  <WrapCell title={auth}>{auth}</WrapCell>
                </tr>
              );
            })}
          </Table>
        )}
              </>
            ) },
          ]}
        />
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
