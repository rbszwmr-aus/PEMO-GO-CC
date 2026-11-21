/**
 * Administration — Users directory (list → detail), fixture-first.
 *
 * Product IA: name, email, role(s), status, group count; search/filter;
 * detail sections Profile, Roles, Groups, Scope, Effective permissions.
 * Membership add/remove updates the in-memory session store. Creating a
 * user / conferring a live grant stay unnamed here (no live grant API).
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { DetailPanes } from '../components/DetailPanes.tsx';
import { DetailBack, DetailHeadPanel } from '../components/DetailChrome.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FeatureDomainTabs, FeatureGrantMark } from '../components/FeatureDomainTabs.tsx';
import {
  ADMIN_USERS_DETAIL_DEFAULT,
} from '../data/admin-directory-corpus.ts';
import {
  addAdminGroupMember,
  effectiveFeaturesForStaff,
  getAdminUserDetail,
  getAdminUserList,
  groupsEligibleForStaff,
  removeAdminGroupMember,
  subscribeAdminDirectory,
  adminDirectoryRevision,
} from '../data/admin-directory-session.ts';
import {
  FEATURE_DOMAIN_IDS,
  featureLabel,
  featuresForDomain,
  type FeatureDomainId,
} from '../data/feature-domains.ts';
import {
  STAFF_ROLE_IDS,
  type AdminUserDetailResponse,
  type AdminUserListItem,
  type AdminUserListResponse,
  type StaffDirectoryStatus,
  type StaffFeatureId,
  type StaffRoleId,
} from '../data/types.ts';

function useAdminDirectoryRevision(): number {
  const [rev, setRev] = useState(adminDirectoryRevision);
  useEffect(() => subscribeAdminDirectory(() => setRev(adminDirectoryRevision())), []);
  return rev;
}

function roleLabel(role: StaffRoleId, locale: Locale): string {
  return t(MESSAGES.admin.role[role], locale);
}

function statusLabel(status: StaffDirectoryStatus, locale: Locale): string {
  return t(MESSAGES.admin.status[status], locale);
}

type UserTab = 'all' | 'active' | 'inactive';
/** All, active, inactive; every tab opens by name A to Z. */
const STATUSES: readonly StatusDef<AdminUserListItem, UserTab>[] = (['all', 'active', 'inactive'] as UserTab[]).map((id) => ({
  id,
  test: (u: AdminUserListItem) => id === 'all' || u.status === id,
  sort: { key: 'name', dir: 'asc' } as const,
}));
const SEARCH = copy('Search name or email', '搜尋姓名或電郵', '搜索姓名或邮箱');

export function AdminUsersList({
  data,
  locale,
  onOpen,
}: {
  data: AdminUserListResponse;
  locale: Locale;
  onOpen: (staffId: string) => void;
}) {
  const M = MESSAGES.admin;
  useAdminDirectoryRevision();
  const directory = data.users.length === 0 ? data : getAdminUserList();
  const spec = useMemo<ViewSpec<AdminUserListItem>>(() => ({
    searchText: (u) => `${u.displayName} ${u.email} ${u.staffId}`,
    filters: {},
    sorts: {
      name: (u) => u.displayName,
      email: (u) => u.email,
      roles: (u) => u.roles.map((r) => roleLabel(r, locale)).join(' '),
      status: (u) => statusLabel(u.status, locale),
      groups: (u) => u.groupCount,
    },
  }), [locale]);
  // A person can hold several roles, so the role dropdown narrows the rows before the status tabs count them.
  const [role, setRole] = useState('');
  const byRole = useMemo(() => (role ? directory.users.filter((u) => u.roles.includes(role as StaffRoleId)) : directory.users), [directory.users, role]);
  const sv = useStatusView(byRole, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<UserTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'active', label: t(M.countActive, locale), icon: 'CircleCheck', count: sv.counts.active },
    { id: 'inactive', label: t(M.countInactive, locale), icon: 'CircleDashed', count: sv.counts.inactive },
  ];
  const filters: FilterDef[] = [
    {
      key: 'role', label: t(M.filterRole, locale), allLabel: t(M.filterAll, locale),
      options: STAFF_ROLE_IDS.map((role) => ({ value: role, label: roleLabel(role, locale) })),
      value: role, onChange: setRole,
    },
  ];

  const columns = [
    { key: 'name', label: t(M.colName, locale), width: '22%', sortable: true },
    { key: 'email', label: t(M.colEmail, locale), width: '24%', sortable: true },
    { key: 'roles', label: t(M.colRoles, locale), width: '22%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '16%', sortable: true },
    { key: 'groups', label: t(M.colGroups, locale), width: '16%', sortable: true },
  ];

  return (
    <>
      <HintRow text={t(M.usersBoundaryNote, locale)} />
      <HintRow text={t(M.fixtureLabel, locale)} testId="admin-users-fixture-label" />
      <StatusHead
        tabs={tabs}
        cardIds={['active', 'inactive']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={directory.users.length}
        locale={locale}
        root="admin-user-status"
        ariaLabel={t(M.countsHeading, locale)}
        cardsTestId="admin-user-stats"
      />

      {directory.users.length === 0 ? (
        <section className="pemo-state" data-testid="state-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyUsersTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyUsersBody, locale)}</p>
        </section>
      ) : (
        <section className="pemo-panel" data-testid="admin-users-filters">
          <FilterBar
            locale={locale}
            testId="admin-users"
            searchLabel={t(SEARCH, locale)}
            query={tv.state.query}
            onQuery={tv.setQuery}
            filters={filters}
            active={tv.active || role !== ''}
            onClear={() => { tv.clear(); setRole(''); }}
          />
          <HintRow text={t(M.filterNote, locale)} testId="admin-users-filter-note" />
          {tv.view.length === 0 ? <NoMatches locale={locale} testId="admin-users-filter-empty" /> : (
          <Table caption={t(M.usersListTitle, locale)} columns={columns} testId="admin-users-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((u) => {
              const status = statusLabel(u.status, locale);
              return (
                <tr key={u.staffId} data-testid="admin-users-row" data-staff-id={u.staffId} data-status={u.status}>
                  <WrapCell title={u.displayName}>
                    <a
                      href={`?screen=adminUsersDetail&state=detail&lang=${locale}&user=${encodeURIComponent(u.staffId)}`}
                      data-testid="admin-user-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpen(u.staffId);
                      }}
                    >
                      {u.displayName}
                    </a>
                  </WrapCell>
                  <WrapCell title={u.email}>{u.email}</WrapCell>
                  <td>
                    <div className="pemo-chip-row">
                      {u.roles.map((r) => (
                        <PlainChip key={r} testId="admin-user-role">{roleLabel(r, locale)}</PlainChip>
                      ))}
                    </div>
                  </td>
                  <DenseCell title={status}>
                    <PlainChip>{status}</PlainChip>
                  </DenseCell>
                  <DenseCell title={String(u.groupCount)}>{number(u.groupCount, locale)}</DenseCell>
                </tr>
              );
            })}
          </Table>
          )}
        </section>
      )}
    </>
  );
}

export function AdminUsersDetail({
  staffId,
  locale,
  onBack,
  onOpenGroup,
  data,
}: {
  staffId: string;
  locale: Locale;
  onBack: () => void;
  onOpenGroup: (groupId: string) => void;
  data?: AdminUserDetailResponse | undefined;
}) {
  const M = MESSAGES.admin;
  useAdminDirectoryRevision();
  const [pickedGroup, setPickedGroup] = useState('');
  const fallbackId = staffId || (data ?? ADMIN_USERS_DETAIL_DEFAULT).user.staffId;
  const resolved: AdminUserDetailResponse | undefined =
    getAdminUserDetail(fallbackId) ?? (staffId ? undefined : (data ?? ADMIN_USERS_DETAIL_DEFAULT));

  if (!resolved) {
    return (
      <section className="pemo-panel" data-testid="admin-users-detail-missing">
        <p>{t(M.notFoundUser, locale)}</p>
        <a
          href={`?screen=adminUsers&state=list&lang=${locale}`}
          data-testid="admin-user-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToUsers, locale)}
        </a>
      </section>
    );
  }

  const u = resolved.user;
  const eligible = groupsEligibleForStaff(u.staffId);
  const granted = effectiveFeaturesForStaff(u.staffId);
  const groupColumns = [
    { key: 'name', label: t(M.colGroupName, locale), width: '70%' },
    { key: 'actions', label: t(M.colActions, locale), width: '30%' },
  ];

  const addToGroup = () => {
    if (!pickedGroup) return;
    addAdminGroupMember(pickedGroup, u.staffId);
    setPickedGroup('');
  };

  return (
    <>
      <DetailHeadPanel title={u.displayName} testId="admin-users-detail">
        <HintRow text={t(M.fixtureLabel, locale)} testId="admin-users-fixture-label" />
        <HintRow text={t(M.membershipSessionNote, locale)} testId="admin-membership-session-note" />
      </DetailHeadPanel>

      <DetailPanes
        key={u.staffId}
        locale={locale}
        root="admin-user-pane"
        ariaLabel={u.displayName}
        panes={[
          { id: 'profile', label: t(M.profileHeading, locale), icon: 'Info', node: (
            <>
      <section className="pemo-panel" data-testid="admin-user-profile">
        <h3 className="pemo-panel__title">{t(M.profileHeading, locale)}</h3>
        <DetailBack><p>
          <a
            href={`?screen=adminUsers&state=list&lang=${locale}`}
            data-testid="admin-user-back"
            data-read-affordance="navigate"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            {t(M.backToUsers, locale)}
          </a>
        </p></DetailBack>
        <dl className="pemo-dl">
          <dt>{t(M.factEmail, locale)}</dt>
          <dd>{u.email}</dd>
          <dt>{t(M.factJobTitle, locale)}</dt>
          <dd>{t(u.jobTitle, locale)}</dd>
          <dt>{t(M.factStatus, locale)}</dt>
          <dd><PlainChip>{statusLabel(u.status, locale)}</PlainChip></dd>
        </dl>
        <ITDetails locale={locale} testId="admin-user-it-details" rows={[[M.factStaffId, u.staffId]]} />
      </section>

      <section className="pemo-panel" data-testid="admin-user-roles">
        <h3 className="pemo-panel__title">{t(M.rolesHeading, locale)}</h3>
        <div className="pemo-chip-row">
          {u.roles.map((r) => (
            <PlainChip key={r} testId="admin-user-role">{roleLabel(r, locale)}</PlainChip>
          ))}
        </div>
      </section>

      <section className="pemo-panel" data-testid="admin-user-scope">
        <h3 className="pemo-panel__title">{t(M.scopeHeading, locale)}</h3>
        <p>{t(u.scopeSummary, locale)}</p>
      </section>
            </>
          ) },
          { id: 'groups', label: t(M.groupsHeading, locale), icon: 'ClipboardList', count: u.groups.length, node: (
            <>
      <section className="pemo-panel" data-testid="admin-user-groups">
        <h3 className="pemo-panel__title">{t(M.groupsHeading, locale)}</h3>
        {eligible.length > 0 ? (
          <div className="pemo-toolbar pemo-toolbar--membership" data-testid="admin-user-add-group-toolbar">
            <label className="pemo-field">
              {t(M.addGroupPicker, locale)}
              <select
                data-testid="admin-user-add-group"
                data-read-affordance="fixture"
                value={pickedGroup}
                onChange={(e) => setPickedGroup(e.target.value)}
              >
                <option value="">{t(M.addGroupPlaceholder, locale)}</option>
                {eligible.map((g) => (
                  <option key={g.groupId} value={g.groupId}>{t(g.name, locale)}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pemo-button pemo-button--primary"
              data-testid="admin-user-add-group-submit"
              data-read-affordance="fixture"
              disabled={!pickedGroup}
              onClick={addToGroup}
            >
              {t(M.addToGroup, locale)}
            </button>
          </div>
        ) : (
          <p className="pemo-note" data-testid="admin-user-no-eligible-groups">{t(M.noEligibleGroups, locale)}</p>
        )}
        {u.groups.length === 0 ? (
          <p className="pemo-note" data-testid="admin-user-groups-empty">{t(M.emptyUserGroups, locale)}</p>
        ) : (
          <Table caption={t(M.groupsHeading, locale)} columns={groupColumns} testId="admin-user-groups-table">
            {u.groups.map((g) => {
              const name = t(g.name, locale);
              return (
                <tr key={g.groupId} data-testid="admin-user-group-row" data-group-id={g.groupId}>
                  <WrapCell title={name}>
                    <a
                      href={`?screen=adminGroupsDetail&state=detail&lang=${locale}&group=${encodeURIComponent(g.groupId)}`}
                      data-testid="admin-user-group-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenGroup(g.groupId);
                      }}
                    >
                      {name}
                    </a>
                  </WrapCell>
                  <td className="pemo-cell--actions">
                    <div className="pemo-actions pemo-actions--row">
                      <button
                        type="button"
                        className="pemo-button"
                        data-testid="admin-user-remove-group"
                        data-group-id={g.groupId}
                        data-read-affordance="fixture"
                        onClick={() => removeAdminGroupMember(g.groupId, u.staffId)}
                      >
                        {t(M.removeFromGroup, locale)}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>

            </>
          ) },
          { id: 'effective', label: t(M.effectiveHeading, locale), icon: 'CircleCheck', node: (
            <UserEffectivePanel staffId={u.staffId} granted={granted} locale={locale} />
          ) },
        ]}
      />
    </>
  );
}

function UserEffectivePanel({
  staffId,
  granted,
  locale,
}: {
  staffId: string;
  granted: ReadonlySet<StaffFeatureId>;
  locale: Locale;
}) {
  const M = MESSAGES.admin;
  const [domain, setDomain] = useState<FeatureDomainId>(FEATURE_DOMAIN_IDS[0]!);
  const features = featuresForDomain(domain);
  const columns = [
    { key: 'feature', label: t(M.colFeature, locale), width: '70%' },
    { key: 'granted', label: t(M.colGranted, locale), width: '30%' },
  ];

  return (
    <section className="pemo-panel" data-testid="admin-user-effective" data-staff-id={staffId}>
      <h3 className="pemo-panel__title">{t(M.effectiveHeading, locale)}</h3>
      <HintRow text={t(M.effectiveNote, locale)} testId="admin-user-effective-note" />
      <FeatureDomainTabs
        active={domain}
        locale={locale}
        onChange={setDomain}
        idPrefix="admin-user-effective"
      />
      <div
        role="tabpanel"
        id="admin-user-effective-panel"
        data-testid="admin-function-tabpanel"
        data-domain={domain}
        aria-labelledby={`admin-user-effective-tab-${domain}`}
      >
        <Table caption={t(M.effectiveHeading, locale)} columns={columns} testId="admin-user-effective-table">
          {features.map((feature) => {
            const on = granted.has(feature);
            const label = featureLabel(feature, locale);
            return (
              <tr key={feature} data-testid="admin-user-effective-row" data-feature={feature}>
                <th scope="row">{label}</th>
                <td
                  className="pemo-matrix-cell"
                  data-testid="admin-user-effective-right"
                  data-feature={feature}
                  data-granted={on ? 'true' : 'false'}
                >
                  <FeatureGrantMark
                    granted={on}
                    locale={locale}
                    title={`${label} — ${on ? t(M.granted, locale) : t(M.notGranted, locale)}`}
                  />
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </section>
  );
}
