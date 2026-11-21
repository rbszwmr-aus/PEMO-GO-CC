/**
 * Administration directory session: membership add/remove and the union
 * that drives Effective permissions (groups’ default roles × matrix).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addAdminGroupMember,
  effectiveFeaturesForStaff,
  getAdminGroupDetail,
  getAdminGroupList,
  getAdminUserDetail,
  getAdminUserList,
  groupsEligibleForStaff,
  removeAdminGroupMember,
  resetAdminDirectory,
  setAdminGroupParkcoreAction,
  setAdminGroupPemoFeature,
  staffEligibleForGroup,
} from '../../src/data/admin-directory-session.ts';
import { effectiveParkcoreActions, sessionParkcoreAllowed } from '../../src/data/parkcore-domains.ts';

test('Ng Ka-ho dual groups union security and help-desk features', () => {
  resetAdminDirectory();
  const user = getAdminUserDetail('stf_wfg_dual_role');
  assert.ok(user);
  assert.deepEqual(user.user.groups.map((g) => g.groupId).sort(), [
    'grp_wfg_help_desk',
    'grp_wfg_security',
  ]);
  const granted = effectiveFeaturesForStaff('stf_wfg_dual_role');
  assert.equal(granted.has('manage_visitors'), true);
  assert.equal(granted.has('manage_access'), true);
  assert.equal(granted.has('manage_helpdesk'), true);
  assert.equal(granted.has('manage_residents'), true);
  assert.equal(granted.has('view_safety'), true);
  assert.equal(granted.has('admin_users'), false);
  assert.equal(granted.has('manage_bookings'), false);
});

test('add member appears on the group and updates the user’s roles and effective set', () => {
  resetAdminDirectory();
  assert.equal(
    getAdminGroupDetail('grp_wfg_security')?.group.members.some((m) => m.staffId === 'stf_wfg_alex'),
    false,
  );
  assert.equal(staffEligibleForGroup('grp_wfg_security').some((u) => u.staffId === 'stf_wfg_alex'), true);

  assert.equal(addAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), true);
  const group = getAdminGroupDetail('grp_wfg_security');
  assert.ok(group?.group.members.some((m) => m.staffId === 'stf_wfg_alex'));
  const alex = getAdminUserDetail('stf_wfg_alex');
  assert.ok(alex?.user.groups.some((g) => g.groupId === 'grp_wfg_security'));
  assert.ok(alex?.user.roles.includes('administrator'));
  assert.ok(alex?.user.roles.includes('security'));
  assert.equal(getAdminUserList().users.find((u) => u.staffId === 'stf_wfg_alex')?.groupCount, 2);
  assert.equal(getAdminGroupList().groups.find((g) => g.groupId === 'grp_wfg_security')?.memberCount, 3);
  assert.equal(staffEligibleForGroup('grp_wfg_security').some((u) => u.staffId === 'stf_wfg_alex'), false);
  assert.equal(addAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), false);
});

test('remove member drops the row and shrinks Effective permissions', () => {
  resetAdminDirectory();
  const before = effectiveFeaturesForStaff('stf_wfg_dual_role');
  assert.equal(before.has('manage_helpdesk'), true);
  assert.equal(before.has('manage_access'), true);

  assert.equal(removeAdminGroupMember('grp_wfg_help_desk', 'stf_wfg_dual_role'), true);
  const user = getAdminUserDetail('stf_wfg_dual_role');
  assert.ok(user);
  assert.equal(user.user.groups.some((g) => g.groupId === 'grp_wfg_help_desk'), false);
  assert.deepEqual(user.user.roles, ['security']);
  const after = effectiveFeaturesForStaff('stf_wfg_dual_role');
  assert.equal(after.has('manage_helpdesk'), false);
  assert.equal(after.has('manage_access'), true);
  assert.equal(after.has('manage_visitors'), true);
  assert.equal(
    getAdminGroupDetail('grp_wfg_help_desk')?.group.members.some((m) => m.staffId === 'stf_wfg_dual_role'),
    false,
  );
  assert.equal(groupsEligibleForStaff('stf_wfg_dual_role').some((g) => g.groupId === 'grp_wfg_help_desk'), true);
  assert.equal(removeAdminGroupMember('grp_wfg_help_desk', 'stf_wfg_dual_role'), false);

  assert.equal(addAdminGroupMember('grp_wfg_help_desk', 'stf_wfg_dual_role'), true);
  assert.equal(effectiveFeaturesForStaff('stf_wfg_dual_role').has('manage_helpdesk'), true);
});

test('resetAdminDirectory restores the seed memberships', () => {
  resetAdminDirectory();
  addAdminGroupMember('grp_wfg_administrators', 'stf_wfg_counter');
  assert.ok(getAdminUserDetail('stf_wfg_counter')?.user.groups.some((g) => g.groupId === 'grp_wfg_administrators'));
  resetAdminDirectory();
  assert.equal(
    getAdminUserDetail('stf_wfg_counter')?.user.groups.some((g) => g.groupId === 'grp_wfg_administrators'),
    false,
  );
  assert.deepEqual(getAdminUserDetail('stf_wfg_dual_role')?.user.groups.map((g) => g.groupId).sort(), [
    'grp_wfg_help_desk',
    'grp_wfg_security',
  ]);
});

test('session grant toggles update pemo extras/denials and parkcore_actions', () => {
  resetAdminDirectory();
  const groupId = 'grp_wfg_estate_managers';

  assert.equal(setAdminGroupPemoFeature(groupId, 'view_overview', false), true);
  let group = getAdminGroupDetail(groupId);
  assert.ok(group);
  assert.equal(group.group.pemo_denied?.includes('view_overview'), true);
  assert.equal(effectiveFeaturesForStaff('stf_wfg_manager').has('view_overview'), false);

  assert.equal(setAdminGroupPemoFeature(groupId, 'view_overview', true), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.pemo_denied?.includes('view_overview'), false);
  assert.equal(effectiveFeaturesForStaff('stf_wfg_manager').has('view_overview'), true);

  assert.equal(setAdminGroupPemoFeature(groupId, 'admin_users', true), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.pemo_features?.includes('admin_users'), true);
  assert.equal(effectiveFeaturesForStaff('stf_wfg_manager').has('admin_users'), true);
  assert.equal(setAdminGroupPemoFeature(groupId, 'admin_users', false), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.pemo_features?.includes('admin_users'), false);

  assert.equal(setAdminGroupParkcoreAction(groupId, 'receipt.export', false), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.parkcore_actions?.includes('receipt.export'), false);
  assert.equal(effectiveParkcoreActions(group.group.parkcore_role, group.group.parkcore_actions).has('receipt.export'), false);

  assert.equal(setAdminGroupParkcoreAction(groupId, 'receipt.export', true), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.parkcore_actions?.includes('receipt.export'), true);
  assert.equal(effectiveParkcoreActions(group.group.parkcore_role, group.group.parkcore_actions).has('receipt.export'), true);

  assert.equal(setAdminGroupParkcoreAction(groupId, 'lane.operate', false), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(effectiveParkcoreActions(group.group.parkcore_role, group.group.parkcore_actions).has('lane.operate'), true);
  assert.equal(sessionParkcoreAllowed(group.group.parkcore_role, group.group.parkcore_actions, group.group.parkcore_denied).has('lane.operate'), false);
  assert.equal(group.group.parkcore_denied?.includes('lane.operate'), true);

  assert.equal(setAdminGroupParkcoreAction(groupId, 'lane.operate', true), true);
  group = getAdminGroupDetail(groupId)!;
  assert.equal(group.group.parkcore_denied?.includes('lane.operate'), false);
  assert.equal(sessionParkcoreAllowed(group.group.parkcore_role, group.group.parkcore_actions, group.group.parkcore_denied).has('lane.operate'), true);

  resetAdminDirectory();
  group = getAdminGroupDetail(groupId)!;
  assert.deepEqual([...(group.group.parkcore_actions ?? [])], ['receipt.export']);
  assert.equal(group.group.pemo_features, undefined);
  assert.equal(effectiveFeaturesForStaff('stf_wfg_manager').has('view_overview'), true);
});
