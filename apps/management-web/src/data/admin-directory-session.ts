/**
 * In-memory Administration directory session.
 *
 * Membership add/remove and Groups Rights grant toggles update fixture
 * state for this page load only. No localStorage / sessionStorage / cookies
 * — the credential-storage guard forbids those APIs. No live grant API.
 *
 * Effective permission = union of features from all of a person’s groups’
 * default roles (via the matrix) plus each group’s session pemo_features,
 * minus pemo_denied.
 */

import {
  ADMIN_GROUPS_LIST,
  ADMIN_GROUP_DETAILS,
  ADMIN_ROLES_MATRIX,
  ADMIN_USERS_LIST,
  ADMIN_USER_DETAILS,
} from './admin-directory-corpus.ts';
import { appendAuditEvent } from './audit-session.ts';
import {
  effectiveGroupPemoFeatures,
  filterStaffFeatures,
  grantedFeaturesForRoles,
} from './feature-domains.ts';
import {
  PARKCORE_ACTION_IDS,
  filterParkCoreActions,
  isParkCoreActionId,
  roleAllowsParkCore,
  type ParkCoreActionId,
} from './parkcore-domains.ts';
import {
  STAFF_FEATURE_IDS,
  STAFF_ROLE_IDS,
  type AdminGroupDetailResponse,
  type AdminGroupListItem,
  type AdminGroupListResponse,
  type AdminGroupMemberRow,
  type AdminUserDetailResponse,
  type AdminUserGroupRef,
  type AdminUserListItem,
  type AdminUserListResponse,
  type StaffFeatureId,
  type StaffRoleId,
} from './types.ts';

interface DirectoryState {
  users: Record<string, AdminUserDetailResponse>;
  groups: Record<string, AdminGroupDetailResponse>;
}

function seed(): DirectoryState {
  return {
    users: structuredClone(ADMIN_USER_DETAILS) as Record<string, AdminUserDetailResponse>,
    groups: structuredClone(ADMIN_GROUP_DETAILS) as Record<string, AdminGroupDetailResponse>,
  };
}

let current: DirectoryState = seed();
let revision = 0;
const listeners = new Set<() => void>();

function emit(): void {
  revision += 1;
  for (const l of listeners) l();
}

function rolesFromMemberships(staffId: string): StaffRoleId[] {
  const detail = current.users[staffId];
  if (!detail) return [];
  const found = new Set<StaffRoleId>();
  for (const ref of detail.user.groups) {
    const group = current.groups[ref.groupId];
    if (!group) continue;
    for (const role of group.group.defaultRoles) found.add(role);
  }
  return STAFF_ROLE_IDS.filter((role) => found.has(role));
}

/** A membership change is made at the estate the group works in. */
function recordMembershipAudit(
  action: 'add_membership' | 'remove_membership',
  groupId: string,
  staffId: string,
): void {
  appendAuditEvent({
    action,
    entity: { type: 'membership', id: `${groupId}:${staffId}` },
    place: { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
  });
}

function syncUserDerived(staffId: string): void {
  const detail = current.users[staffId];
  if (!detail) return;
  detail.user.roles = rolesFromMemberships(staffId);
}

export function adminDirectoryRevision(): number {
  return revision;
}

export function subscribeAdminDirectory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAdminDirectory(): void {
  current = seed();
  emit();
}

export function getAdminUserDetail(staffId: string): AdminUserDetailResponse | undefined {
  const row = current.users[staffId];
  return row ? structuredClone(row) : undefined;
}

export function getAdminGroupDetail(groupId: string): AdminGroupDetailResponse | undefined {
  const row = current.groups[groupId];
  return row ? structuredClone(row) : undefined;
}

export function getAdminUserList(): AdminUserListResponse {
  const users: AdminUserListItem[] = ADMIN_USERS_LIST.users.map((seedRow) => {
    const live = current.users[seedRow.staffId]?.user;
    return {
      staffId: seedRow.staffId,
      displayName: live?.displayName ?? seedRow.displayName,
      email: live?.email ?? seedRow.email,
      roles: live ? [...live.roles] : [...seedRow.roles],
      status: live?.status ?? seedRow.status,
      groupCount: live ? live.groups.length : seedRow.groupCount,
    };
  });
  return {
    meta: ADMIN_USERS_LIST.meta,
    counts: {
      all: users.length,
      active: users.filter((u) => u.status === 'active').length,
      inactive: users.filter((u) => u.status === 'inactive').length,
    },
    users,
  };
}

export function getAdminGroupList(): AdminGroupListResponse {
  const groups: AdminGroupListItem[] = ADMIN_GROUPS_LIST.groups.map((seedRow) => {
    const live = current.groups[seedRow.groupId]?.group;
    return {
      groupId: seedRow.groupId,
      name: live?.name ?? seedRow.name,
      description: live?.description ?? seedRow.description,
      memberCount: live ? live.members.length : seedRow.memberCount,
      defaultRoles: live ? [...live.defaultRoles] : [...seedRow.defaultRoles],
      defaultScope: live?.defaultScope ?? seedRow.defaultScope,
    };
  });
  return {
    meta: ADMIN_GROUPS_LIST.meta,
    counts: { all: groups.length },
    groups,
  };
}

export function staffEligibleForGroup(groupId: string): AdminUserListItem[] {
  const group = current.groups[groupId];
  if (!group) return [];
  const inGroup = new Set(group.group.members.map((m) => m.staffId));
  return getAdminUserList().users.filter((u) => !inGroup.has(u.staffId));
}

export function groupsEligibleForStaff(staffId: string): AdminGroupListItem[] {
  const user = current.users[staffId];
  if (!user) return [];
  const inGroups = new Set(user.user.groups.map((g) => g.groupId));
  return getAdminGroupList().groups.filter((g) => !inGroups.has(g.groupId));
}

export function effectiveFeaturesForStaff(staffId: string): ReadonlySet<StaffFeatureId> {
  const detail = current.users[staffId];
  if (!detail) return new Set();
  const out = new Set<StaffFeatureId>();
  for (const ref of detail.user.groups) {
    const group = current.groups[ref.groupId];
    if (!group) continue;
    for (const feature of effectiveGroupPemoFeatures(
      group.group.defaultRoles,
      group.group.pemo_features,
      group.group.pemo_denied,
      ADMIN_ROLES_MATRIX,
    )) {
      out.add(feature);
    }
  }
  return out;
}

export function setAdminGroupPemoFeature(
  groupId: string,
  feature: StaffFeatureId,
  granted: boolean,
): boolean {
  const row = current.groups[groupId];
  if (!row) return false;
  const g = row.group;
  const roleSet = grantedFeaturesForRoles(g.defaultRoles, ADMIN_ROLES_MATRIX);
  const extras = new Set(filterStaffFeatures(g.pemo_features));
  const denied = new Set(filterStaffFeatures(g.pemo_denied));
  if (granted) {
    denied.delete(feature);
    if (!roleSet.has(feature)) extras.add(feature);
  } else {
    extras.delete(feature);
    if (roleSet.has(feature)) denied.add(feature);
  }
  g.pemo_features = STAFF_FEATURE_IDS.filter((f) => extras.has(f));
  g.pemo_denied = STAFF_FEATURE_IDS.filter((f) => denied.has(f));
  emit();
  return true;
}

export function setAdminGroupParkcoreAction(
  groupId: string,
  action: ParkCoreActionId,
  granted: boolean,
): boolean {
  const row = current.groups[groupId];
  if (!row) return false;
  if (!isParkCoreActionId(action)) return false;
  const g = row.group;
  const roleSet = roleAllowsParkCore(g.parkcore_role);
  const extras = new Set(filterParkCoreActions(g.parkcore_actions));
  const denied = new Set(filterParkCoreActions(g.parkcore_denied));
  if (granted) {
    denied.delete(action);
    if (!roleSet.has(action)) extras.add(action);
  } else {
    extras.delete(action);
    if (roleSet.has(action)) denied.add(action);
  }
  g.parkcore_actions = PARKCORE_ACTION_IDS.filter((a) => extras.has(a));
  g.parkcore_denied = PARKCORE_ACTION_IDS.filter((a) => denied.has(a));
  emit();
  return true;
}

export function addAdminGroupMember(groupId: string, staffId: string): boolean {
  const group = current.groups[groupId];
  const user = current.users[staffId];
  if (!group || !user) return false;
  if (group.group.members.some((m) => m.staffId === staffId)) return false;
  if (user.user.groups.some((g) => g.groupId === groupId)) return false;

  const member: AdminGroupMemberRow = {
    staffId: user.user.staffId,
    displayName: user.user.displayName,
    status: user.user.status,
  };
  const ref: AdminUserGroupRef = {
    groupId: group.group.groupId,
    name: { ...group.group.name },
  };
  group.group.members = [...group.group.members, member];
  user.user.groups = [...user.user.groups, ref];
  syncUserDerived(staffId);
  recordMembershipAudit('add_membership', group.group.groupId, user.user.staffId);
  emit();
  return true;
}

export function removeAdminGroupMember(groupId: string, staffId: string): boolean {
  const group = current.groups[groupId];
  const user = current.users[staffId];
  if (!group || !user) return false;
  const beforeMembers = group.group.members.length;
  const beforeGroups = user.user.groups.length;
  group.group.members = group.group.members.filter((m) => m.staffId !== staffId);
  user.user.groups = user.user.groups.filter((g) => g.groupId !== groupId);
  if (group.group.members.length === beforeMembers && user.user.groups.length === beforeGroups) {
    return false;
  }
  syncUserDerived(staffId);
  recordMembershipAudit('remove_membership', group.group.groupId, user.user.staffId);
  emit();
  return true;
}
