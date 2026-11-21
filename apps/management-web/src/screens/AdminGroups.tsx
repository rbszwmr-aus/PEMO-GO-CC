/**
 * Administration — Groups as teams (list → detail), fixture-first.
 *
 * Detail: description, members (add/remove for this session), default roles,
 * default scope stub, and Rights / permissions grouped by a PEMO | ParkCore
 * module switcher and function-domain tabs. Grant checkboxes update the
 * in-memory group stub (pemo_features / parkcore_actions and role-derived
 * ungrants). Creating a group and saving grants to the server stay named
 * under DeferredActions. No live grant API.
 */

import { DetailPanes } from '../components/DetailPanes.tsx';
import { DetailHeadPanel } from '../components/DetailChrome.tsx';
import { FilterBar, NoMatches } from '../components/TableControls.tsx';
import { useTableView } from '../components/useTableView.ts';
import type { ViewSpec } from '../components/table-view.ts';
import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import { DomainTabBar, FeatureDomainTabs, FeatureGrantToggle } from '../components/FeatureDomainTabs.tsx';
import {
  ADMIN_GROUPS_DETAIL_DEFAULT,
  ADMIN_ROLES_MATRIX,
} from '../data/admin-directory-corpus.ts';
import {
  addAdminGroupMember,
  adminDirectoryRevision,
  getAdminGroupDetail,
  getAdminGroupList,
  removeAdminGroupMember,
  setAdminGroupParkcoreAction,
  setAdminGroupPemoFeature,
  staffEligibleForGroup,
  subscribeAdminDirectory,
} from '../data/admin-directory-session.ts';
import {
  FEATURE_DOMAIN_IDS,
  effectiveGroupPemoFeatures,
  featureDomainGrantCounts,
  featureLabel,
  featuresForDomain,
  type FeatureDomainId,
} from '../data/feature-domains.ts';
import {
  PARKCORE_DOMAIN_IDS,
  actionsForParkCoreDomain,
  isParkCoreRoleId,
  parkcoreActionLabel,
  parkcoreDomainGrantCounts,
  parkcoreDomainLabel,
  parkcoreRoleLabel,
  sessionParkcoreAllowed,
  type ParkCoreActionId,
  type ParkCoreDomainId,
} from '../data/parkcore-domains.ts';
import type {
  AdminGroupDetailResponse,
  AdminGroupListResponse,
  StaffDirectoryStatus,
  StaffRoleId,
} from '../data/types.ts';

const m = copy;

const DEFERRED = [
  m('Create a group', '新增群組', '新增群组'),
];

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

const PANE_DETAILS = copy('Details', '詳情', '详情');
const GROUPS_SEARCH = copy('Search group or scope', '搜尋群組或範圍', '搜索群组或范围');

export function AdminGroupsList({
  data,
  locale,
  onOpen,
}: {
  data: AdminGroupListResponse;
  locale: Locale;
  onOpen: (groupId: string) => void;
}) {
  const M = MESSAGES.admin;
  useAdminDirectoryRevision();
  const directory = data.groups.length === 0 ? data : getAdminGroupList();
  const spec = useMemo<ViewSpec<(typeof directory.groups)[number]>>(() => ({
    searchText: (g) => `${t(g.name, locale)} ${t(g.description, locale)} ${t(g.defaultScope, locale)}`,
    filters: {},
    sorts: {
      name: (g) => t(g.name, locale),
      desc: (g) => t(g.description, locale),
      members: (g) => g.memberCount,
      roles: (g) => g.defaultRoles.map((r) => roleLabel(r, locale)).join(' '),
      scope: (g) => t(g.defaultScope, locale),
    },
  }), [locale]);
  const tv = useTableView(directory.groups, spec, { key: 'name', dir: 'asc' }, locale);
  const columns = [
    { key: 'name', label: t(M.colGroupName, locale), width: '22%', sortable: true },
    { key: 'desc', label: t(M.descriptionHeading, locale), width: '30%', sortable: true },
    { key: 'members', label: t(M.colMembers, locale), width: '12%', sortable: true },
    { key: 'roles', label: t(M.colDefaultRoles, locale), width: '18%', sortable: true },
    { key: 'scope', label: t(M.colDefaultScope, locale), width: '18%', sortable: true },
  ];

  return (
    <>
      <HintRow text={t(M.groupsBoundaryNote, locale)} />
      <HintRow text={t(M.fixtureLabel, locale)} testId="admin-groups-fixture-label" />

      {directory.groups.length === 0 ? (
        <section className="pemo-state" data-testid="state-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyGroupsTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyGroupsBody, locale)}</p>
        </section>
      ) : (
        <section className="pemo-panel">
          <FilterBar
            locale={locale}
            testId="admin-groups"
            searchLabel={t(GROUPS_SEARCH, locale)}
            query={tv.state.query}
            onQuery={tv.setQuery}
            filters={[]}
            active={tv.active}
            onClear={tv.clear}
          />
          {tv.view.length === 0 ? <NoMatches locale={locale} testId="admin-groups-no-matches" /> : (
          <Table caption={t(M.groupsListTitle, locale)} columns={columns} testId="admin-groups-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((g) => {
              const name = t(g.name, locale);
              const desc = t(g.description, locale);
              const scope = t(g.defaultScope, locale);
              return (
                <tr key={g.groupId} data-testid="admin-groups-row" data-group-id={g.groupId}>
                  <WrapCell title={name}>
                    <a
                      href={`?screen=adminGroupsDetail&state=detail&lang=${locale}&group=${encodeURIComponent(g.groupId)}`}
                      data-testid="admin-group-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpen(g.groupId);
                      }}
                    >
                      {name}
                    </a>
                  </WrapCell>
                  <WrapCell title={desc}>{desc}</WrapCell>
                  <DenseCell title={String(g.memberCount)}>{number(g.memberCount, locale)}</DenseCell>
                  <td>
                    <div className="pemo-chip-row">
                      {g.defaultRoles.map((r) => (
                        <PlainChip key={r}>{roleLabel(r, locale)}</PlainChip>
                      ))}
                    </div>
                  </td>
                  <WrapCell title={scope}>{scope}</WrapCell>
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

export function AdminGroupsDetail({
  groupId,
  locale,
  onBack,
  onOpenUser,
  data,
  parkcoreLicensed,
}: {
  groupId: string;
  locale: Locale;
  onBack: () => void;
  onOpenUser: (staffId: string) => void;
  data?: AdminGroupDetailResponse | undefined;
  /** Default demo estate is dual-buy. Pass false when the fixture license excludes parkcore. */
  parkcoreLicensed?: boolean;
}) {
  const M = MESSAGES.admin;
  useAdminDirectoryRevision();
  const [pickedStaff, setPickedStaff] = useState('');
  const fallbackId = groupId || (data ?? ADMIN_GROUPS_DETAIL_DEFAULT).group.groupId;
  const resolved: AdminGroupDetailResponse | undefined =
    getAdminGroupDetail(fallbackId) ?? (groupId ? undefined : (data ?? ADMIN_GROUPS_DETAIL_DEFAULT));
  const showParkCore = parkcoreLicensed !== false;

  if (!resolved) {
    return (
      <section className="pemo-panel" data-testid="admin-groups-detail-missing">
        <p>{t(M.notFoundGroup, locale)}</p>
        <a
          href={`?screen=adminGroups&state=list&lang=${locale}`}
          data-testid="admin-group-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToGroups, locale)}
        </a>
      </section>
    );
  }

  const g = resolved.group;
  const eligible = staffEligibleForGroup(g.groupId);
  const memberColumns = [
    { key: 'name', label: t(M.colMemberName, locale), width: '40%' },
    { key: 'status', label: t(M.colStatus, locale), width: '30%' },
    { key: 'actions', label: t(M.colActions, locale), width: '30%' },
  ];

  const addMember = () => {
    if (!pickedStaff) return;
    addAdminGroupMember(g.groupId, pickedStaff);
    setPickedStaff('');
  };

  return (
    <>
      <DetailHeadPanel title={t(g.name, locale)} testId="admin-groups-detail">
        <HintRow text={t(M.fixtureLabel, locale)} testId="admin-groups-fixture-label" />
        <HintRow text={t(M.membershipSessionNote, locale)} testId="admin-membership-session-note" />
        <ITDetails locale={locale} testId="admin-group-it-details" rows={[[M.factGroupId, g.groupId]]} />
      </DetailHeadPanel>

      <DetailPanes
        key={g.groupId}
        locale={locale}
        root="admin-group-pane"
        ariaLabel={t(g.name, locale)}
        panes={[
          { id: 'details', label: t(PANE_DETAILS, locale), icon: 'Info', node: (
            <>
      <section className="pemo-panel" data-testid="admin-group-description">
        <h3 className="pemo-panel__title">{t(M.descriptionHeading, locale)}</h3>
        <p>{t(g.description, locale)}</p>
      </section>

      <section className="pemo-panel" data-testid="admin-group-defaults">
        <h3 className="pemo-panel__title">{t(M.defaultRolesHeading, locale)}</h3>
        <div className="pemo-chip-row">
          {g.defaultRoles.map((r) => (
            <PlainChip key={r} testId="admin-group-default-role">{roleLabel(r, locale)}</PlainChip>
          ))}
        </div>
        <h3 className="pemo-panel__title" style={{ marginTop: 'var(--pemo-space-4)' }}>
          {t(M.defaultScopeHeading, locale)}
        </h3>
        <p data-testid="admin-group-default-scope">{t(g.defaultScope, locale)}</p>
      </section>

            </>
          ) },
          { id: 'rights', label: t(M.rightsHeading, locale), icon: 'CircleCheck', node: (
            <GroupRightsPanel
        groupId={g.groupId}
        defaultRoles={g.defaultRoles}
        pemoFeatures={g.pemo_features}
        pemoDenied={g.pemo_denied}
        parkcoreRole={g.parkcore_role}
        parkcoreActions={g.parkcore_actions}
        parkcoreDenied={g.parkcore_denied}
        parkcoreLicensed={showParkCore}
        locale={locale}
      />
          ) },
          { id: 'members', label: t(M.membersHeading, locale), icon: 'ClipboardList', count: g.members.length, node: (
            <>
      <section className="pemo-panel" data-testid="admin-group-members">
        <h3 className="pemo-panel__title">{t(M.membersHeading, locale)}</h3>
        {eligible.length > 0 ? (
          <div className="pemo-toolbar pemo-toolbar--membership" data-testid="admin-group-add-member-toolbar">
            <label className="pemo-field">
              {t(M.addMemberPicker, locale)}
              <select
                data-testid="admin-group-add-member"
                data-read-affordance="fixture"
                value={pickedStaff}
                onChange={(e) => setPickedStaff(e.target.value)}
              >
                <option value="">{t(M.addMemberPlaceholder, locale)}</option>
                {eligible.map((u) => (
                  <option key={u.staffId} value={u.staffId}>{u.displayName}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pemo-button pemo-button--primary"
              data-testid="admin-group-add-member-submit"
              data-read-affordance="fixture"
              disabled={!pickedStaff}
              onClick={addMember}
            >
              {t(M.addMember, locale)}
            </button>
          </div>
        ) : (
          <p className="pemo-note" data-testid="admin-group-no-eligible-members">{t(M.noEligibleMembers, locale)}</p>
        )}
        {g.members.length === 0 ? (
          <p className="pemo-note" data-testid="admin-group-members-empty">{t(M.emptyMembers, locale)}</p>
        ) : (
          <Table caption={t(M.membersHeading, locale)} columns={memberColumns} testId="admin-group-members-table">
            {g.members.map((mem) => {
              const status = statusLabel(mem.status, locale);
              return (
                <tr key={mem.staffId} data-testid="admin-group-member-row" data-staff-id={mem.staffId}>
                  <WrapCell title={mem.displayName}>
                    <a
                      href={`?screen=adminUsersDetail&state=detail&lang=${locale}&user=${encodeURIComponent(mem.staffId)}`}
                      data-testid="admin-group-member-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenUser(mem.staffId);
                      }}
                    >
                      {mem.displayName}
                    </a>
                  </WrapCell>
                  <DenseCell title={status}>
                    <PlainChip>{status}</PlainChip>
                  </DenseCell>
                  <td className="pemo-cell--actions">
                    <div className="pemo-actions pemo-actions--row">
                      <button
                        type="button"
                        className="pemo-button"
                        data-testid="admin-group-remove-member"
                        data-staff-id={mem.staffId}
                        data-read-affordance="fixture"
                        onClick={() => removeAdminGroupMember(g.groupId, mem.staffId)}
                      >
                        {t(M.removeMember, locale)}
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
        ]}
      />
    </>
  );
}

type RightsModule = 'pemo' | 'parkcore';

const PARKCORE_DEFERRED = [
  m('Change this group’s ParkCore role or actions', '變更此群組的 ParkCore 角色或操作', '变更此群组的 ParkCore 角色或操作'),
];

function GroupRightsPanel({
  groupId,
  defaultRoles,
  pemoFeatures,
  pemoDenied,
  parkcoreRole,
  parkcoreActions,
  parkcoreDenied,
  parkcoreLicensed,
  locale,
}: {
  groupId: string;
  defaultRoles: readonly StaffRoleId[];
  pemoFeatures: readonly string[] | undefined;
  pemoDenied: readonly string[] | undefined;
  parkcoreRole: string | undefined;
  parkcoreActions: readonly string[] | undefined;
  parkcoreDenied: readonly string[] | undefined;
  parkcoreLicensed: boolean;
  locale: Locale;
}) {
  const M = MESSAGES.admin;
  const [module, setModule] = useState<RightsModule>('pemo');
  const [pemoDomain, setPemoDomain] = useState<FeatureDomainId>(FEATURE_DOMAIN_IDS[0]!);
  const [parkcoreDomain, setParkcoreDomain] = useState<ParkCoreDomainId>(PARKCORE_DOMAIN_IDS[0]!);
  const activeModule: RightsModule = parkcoreLicensed ? module : 'pemo';

  const granted = useMemo(
    () => effectiveGroupPemoFeatures(defaultRoles, pemoFeatures, pemoDenied, ADMIN_ROLES_MATRIX),
    [defaultRoles, pemoFeatures, pemoDenied],
  );
  const parkcoreGranted = useMemo(
    () => sessionParkcoreAllowed(parkcoreRole, parkcoreActions, parkcoreDenied),
    [parkcoreRole, parkcoreActions, parkcoreDenied],
  );
  const pemoCounts = useMemo(() => featureDomainGrantCounts(granted), [granted]);
  const parkcoreCounts = useMemo(() => parkcoreDomainGrantCounts(parkcoreGranted), [parkcoreGranted]);

  const features = activeModule === 'pemo' ? featuresForDomain(pemoDomain) : [];
  const parkcoreRows: readonly ParkCoreActionId[] =
    activeModule === 'parkcore' ? actionsForParkCoreDomain(parkcoreDomain) : [];
  const columns = [
    { key: 'feature', label: t(activeModule === 'parkcore' ? M.colParkcoreAction : M.colFeature, locale), width: '70%' },
    { key: 'granted', label: t(M.colGranted, locale), width: '30%' },
  ];

  const roleChip = isParkCoreRoleId(parkcoreRole)
    ? parkcoreRoleLabel(parkcoreRole, locale)
    : parkcoreRole
      ? t(M.parkcoreInvalidRole, locale)
      : t(M.parkcoreNoRole, locale);

  return (
    <section className="pemo-panel" data-testid="admin-group-rights">
      <h3 className="pemo-panel__title">{t(M.rightsHeading, locale)}</h3>
      <HintRow text={t(M.rightsEffectiveNote, locale)} testId="admin-group-rights-note" />
      {parkcoreLicensed ? (
        <>
          <HintRow text={t(M.parkcoreRightsNote, locale)} testId="admin-group-parkcore-rights-note" />
          <div className="pemo-chip-row" data-testid="admin-group-parkcore-role">
            <span className="pemo-meta">{t(M.parkcoreRoleHeading, locale)}</span>
            <PlainChip>{roleChip}</PlainChip>
          </div>
          <div className="pemo-rights-modules" data-testid="admin-rights-module-switcher">
            <span className="pemo-meta">{t(M.rightsModuleLabel, locale)}</span>
            <div
              className="pemo-function-tabs pemo-function-tabs--modules"
              role="tablist"
              aria-label={t(M.rightsModuleLabel, locale)}
            >
              <button
                type="button"
                role="tab"
                className="pemo-function-tab"
                data-testid="admin-rights-module"
                data-module="pemo"
                data-read-affordance="filter"
                aria-selected={activeModule === 'pemo'}
                tabIndex={activeModule === 'pemo' ? 0 : -1}
                onClick={() => setModule('pemo')}
              >
                {t(M.rightsModulePemo, locale)}
              </button>
              <button
                type="button"
                role="tab"
                className="pemo-function-tab"
                data-testid="admin-rights-module"
                data-module="parkcore"
                data-read-affordance="filter"
                aria-selected={activeModule === 'parkcore'}
                tabIndex={activeModule === 'parkcore' ? 0 : -1}
                onClick={() => setModule('parkcore')}
              >
                {t(M.rightsModuleParkcore, locale)}
              </button>
            </div>
          </div>
        </>
      ) : null}
      {activeModule === 'pemo' ? (
        <FeatureDomainTabs
          active={pemoDomain}
          locale={locale}
          onChange={setPemoDomain}
          idPrefix="admin-group-rights"
          counts={pemoCounts}
        />
      ) : (
        <DomainTabBar
          items={PARKCORE_DOMAIN_IDS.map((domain) => ({
            id: domain,
            label: parkcoreDomainLabel(domain, locale),
            count: parkcoreCounts[domain]!,
          }))}
          active={parkcoreDomain}
          locale={locale}
          onChange={setParkcoreDomain}
          idPrefix="admin-group-rights-parkcore"
          panelId="admin-group-rights-panel"
          ariaLabel={t(M.parkcoreTablistLabel, locale)}
          listTestId="admin-parkcore-tabs"
          tabTestId="admin-parkcore-tab"
          module="parkcore"
        />
      )}
      <div
        role="tabpanel"
        id="admin-group-rights-panel"
        data-testid={activeModule === 'parkcore' ? 'admin-parkcore-tabpanel' : 'admin-function-tabpanel'}
        data-domain={activeModule === 'parkcore' ? parkcoreDomain : pemoDomain}
        data-module={activeModule}
        aria-labelledby={
          activeModule === 'parkcore'
            ? `admin-group-rights-parkcore-tab-${parkcoreDomain}`
            : `admin-group-rights-tab-${pemoDomain}`
        }
      >
        {activeModule === 'pemo' ? (
          <Table caption={t(M.rightsHeading, locale)} columns={columns} testId="admin-group-rights-table">
            {features.map((feature) => {
              const on = granted.has(feature);
              const label = featureLabel(feature, locale);
              return (
                <tr key={feature} data-testid="admin-group-right-row" data-feature={feature}>
                  <th scope="row">{label}</th>
                  <td
                    className="pemo-matrix-cell"
                    data-testid="admin-group-right"
                    data-feature={feature}
                    data-granted={on ? 'true' : 'false'}
                  >
                    <FeatureGrantToggle
                      granted={on}
                      locale={locale}
                      label={label}
                      testId="admin-group-grant-toggle"
                      onChange={(next) => setAdminGroupPemoFeature(groupId, feature, next)}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Table caption={t(M.parkcoreTablistLabel, locale)} columns={columns} testId="admin-group-parkcore-rights-table">
            {parkcoreRows.map((action) => {
              const on = parkcoreGranted.has(action);
              const label = parkcoreActionLabel(action, locale);
              return (
                <tr key={action} data-testid="admin-group-parkcore-right-row" data-action={action}>
                  <th scope="row">
                    {label}
                  </th>
                  <td
                    className="pemo-matrix-cell"
                    data-testid="admin-group-parkcore-right"
                    data-action={action}
                    data-granted={on ? 'true' : 'false'}
                  >
                    <FeatureGrantToggle
                      granted={on}
                      locale={locale}
                      label={label}
                      testId="admin-group-parkcore-grant-toggle"
                      onChange={(next) => setAdminGroupParkcoreAction(groupId, action, next)}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
      {parkcoreLicensed ? <DeferredActions locale={locale} actions={PARKCORE_DEFERRED} /> : null}
    </section>
  );
}
