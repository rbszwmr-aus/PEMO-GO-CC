/**
 * Interactive RBAC: add/remove group members in session fixture state.
 * User Effective permissions = union of all memberships’ default roles
 * through the role → feature matrix. No live grant API.
 */

import { appOrigin, expect, test } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { FEATURE_DOMAIN_IDS } from '../../src/data/feature-domains.ts';

test('Group detail add member appears then remove drops the row', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_security`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="admin-groups-detail"]')).toBeVisible();
  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="members"]').click();
  await expect(page.locator('[data-testid="admin-group-member-row"][data-staff-id="stf_wfg_alex"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-group-add-member"]')).toBeVisible();

  await page.locator('[data-testid="admin-group-add-member"]').selectOption('stf_wfg_alex');
  await page.locator('[data-testid="admin-group-add-member-submit"]').click();
  await expect(page.locator('[data-testid="admin-group-member-row"][data-staff-id="stf_wfg_alex"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-member-row"][data-staff-id="stf_wfg_alex"]')).toContainText('Alex Chen');
  await expect(page.locator('[data-testid="admin-group-add-member"] option[value="stf_wfg_alex"]')).toHaveCount(0);

  await page.locator('[data-testid="admin-group-remove-member"][data-staff-id="stf_wfg_alex"]').click();
  await expect(page.locator('[data-testid="admin-group-member-row"][data-staff-id="stf_wfg_alex"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-group-add-member"] option[value="stf_wfg_alex"]')).toHaveCount(1);
});

test('User Effective permissions is the union and changes when membership changes', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=adminUsersDetail&state=detail&lang=en&user=stf_wfg_dual_role`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="admin-users-detail"]')).toBeVisible();
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="groups"]').click();
  await expect(page.locator('[data-testid="admin-user-group-row"][data-group-id="grp_wfg_security"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-user-group-row"][data-group-id="grp_wfg_help_desk"]')).toBeVisible();
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="effective"]').click();
  await expect(page.locator('[data-testid="admin-user-effective"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-user-effective-note"]')).toHaveAttribute('aria-label', /union/);
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(FEATURE_DOMAIN_IDS.length);

  await page.locator('[data-testid="admin-function-tab"][data-domain="visitors"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'visitors');
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_visitors"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_access"]')).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-function-tab"][data-domain="helpdesk_cases"]').click();
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_helpdesk"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_cases"]')).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-function-tab"][data-domain="administration"]').click();
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="admin_users"]')).toHaveAttribute('data-granted', 'false');

  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="groups"]').click();
  await page.locator('[data-testid="admin-user-remove-group"][data-group-id="grp_wfg_help_desk"]').click();
  await expect(page.locator('[data-testid="admin-user-group-row"][data-group-id="grp_wfg_help_desk"]')).toHaveCount(0);
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="effective"]').click();
  await page.locator('[data-testid="admin-function-tab"][data-domain="helpdesk_cases"]').click();
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_helpdesk"]')).toHaveAttribute('data-granted', 'false');
  await page.locator('[data-testid="admin-function-tab"][data-domain="visitors"]').click();
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_access"]')).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="groups"]').click();
  await page.locator('[data-testid="admin-user-add-group"]').selectOption('grp_wfg_help_desk');
  await page.locator('[data-testid="admin-user-add-group-submit"]').click();
  await expect(page.locator('[data-testid="admin-user-group-row"][data-group-id="grp_wfg_help_desk"]')).toBeVisible();
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="effective"]').click();
  await page.locator('[data-testid="admin-function-tab"][data-domain="helpdesk_cases"]').click();
  await expect(page.locator('[data-testid="admin-user-effective-right"][data-feature="manage_helpdesk"]')).toHaveAttribute('data-granted', 'true');
});

test('Interactive RBAC controls and Effective heading localise in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=adminUsersDetail&state=detail&lang=zh-Hant&user=stf_wfg_dual_role`, { waitUntil: 'load' });

  await expect(page.locator('[data-testid="admin-user-pane-tab"][data-tab="effective"]')).toContainText(MESSAGES.admin.effectiveHeading['zh-Hant']);
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="groups"]').click();
  await expect(page.locator('[data-testid="admin-user-add-group-submit"]')).toHaveText(MESSAGES.admin.addToGroup['zh-Hant']);
  await expect(page.locator('[data-testid="admin-user-remove-group"]').first()).toHaveText(MESSAGES.admin.removeFromGroup['zh-Hant']);
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="effective"]').click();
  await expect(page.locator('[data-testid="admin-function-tab"][data-domain="visitors"] [data-testid="admin-function-tab-label"]')).toHaveText(MESSAGES.admin.featureDomain.visitors['zh-Hant']);

  await page.goto(`${base}/?screen=adminGroupsDetail&state=detail&lang=zh-Hant&group=grp_wfg_security`, { waitUntil: 'load' });
  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="members"]').click();
  await expect(page.locator('[data-testid="admin-group-add-member-submit"]')).toHaveText(MESSAGES.admin.addMember['zh-Hant']);
  await expect(page.locator('[data-testid="admin-group-remove-member"]').first()).toHaveText(MESSAGES.admin.removeMember['zh-Hant']);
});
