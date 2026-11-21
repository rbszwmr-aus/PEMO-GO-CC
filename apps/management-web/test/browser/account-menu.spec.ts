/**
 * Header Account control: fixture user, dropdown, log out, restore.
 * Administration Users / Groups / Roles & features / Email are fixture screens.
 * No Screen/State workbench.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

test('Account opens the dropdown with name and role; log out and restore work', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="dev-state-toolbar"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="locale-tab"]')).toBeVisible();
  const account = page.locator('[data-testid="account-button"]');
  await expect(account).toBeVisible();
  await expect(account).toContainText(MESSAGES.account.button.en);
  await expect(page.locator('[data-testid="account-avatar"]')).toHaveText(MESSAGES.account.initials.en);
  await expect(page.locator('[data-testid="account-menu-panel"]')).toHaveCount(0);

  await account.click();
  const panel = page.locator('[data-testid="account-menu-panel"]');
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-testid="account-display-name"]')).toHaveText(MESSAGES.account.displayName.en);
  await expect(page.locator('[data-testid="account-role"]')).toHaveText(MESSAGES.account.roleLine.en);
  await expect(page.locator('[data-testid="account-logout"]')).toHaveText(MESSAGES.account.logOut.en);

  await page.locator('[data-testid="account-logout"]').click();
  await expect(page.locator('[data-testid="signed-out"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.account.signedOutTitle.en);
  await expect(page.locator('[data-testid="sign-in-fixture"]')).toHaveText(MESSAGES.account.signInFixture.en);
  await expect(page.locator('[data-testid="account-button"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="nav-rail"]')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('session')).toBe('signed-out');
  await expect.poll(() => new URL(page.url()).searchParams.get('token')).toBe(null);

  await page.locator('[data-testid="sign-in-fixture"]').click();
  await expect(page.locator('[data-testid="signed-out"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="account-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="nav-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText('Overview');
  await expect.poll(() => new URL(page.url()).searchParams.get('session')).toBe(null);

  await page.locator('[data-testid="account-button"]').click();
  await expect(page.locator('[data-testid="account-display-name"]')).toHaveText(MESSAGES.account.displayName.en);
  await expect(page.locator('[data-testid="account-role"]')).toHaveText(MESSAGES.account.roleLine.en);
});

test('Account copy localises in zh-Hant; signed-out URL restores on reload', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'zh-Hant'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="account-button"]')).toContainText(MESSAGES.account.button['zh-Hant']);
  await page.locator('[data-testid="account-button"]').click();
  await expect(page.locator('[data-testid="account-display-name"]')).toHaveText(MESSAGES.account.displayName['zh-Hant']);
  await expect(page.locator('[data-testid="account-role"]')).toHaveText(MESSAGES.account.roleLine['zh-Hant']);
  await expect(page.locator('[data-testid="account-logout"]')).toHaveText(MESSAGES.account.logOut['zh-Hant']);

  await page.goto(`${base}/?screen=s2&state=default&lang=en&session=signed-out`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="signed-out"]')).toBeVisible();
  await expect(page.locator('[data-testid="sign-in-fixture"]')).toBeVisible();
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('[data-testid="signed-out"]')).toBeVisible();
});

test('Administration opens Users list, a user detail, Groups, Roles matrix, and Email', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="nav-item"][data-nav="admin"] .pemo-nav__chevron').click();
  await expect(page.locator('[data-testid="nav-item"][data-nav="adm-users"]')).toContainText('Users');
  await expect(page.locator('[data-testid="nav-item"][data-nav="adm-groups"]')).toContainText('Groups');
  await expect(page.locator('[data-testid="nav-item"][data-nav="adm-roles"]')).toContainText('Roles & features');
  await expect(page.locator('[data-testid="nav-item"][data-nav="adm-email"]')).toContainText('Email');

  await page.locator('[data-testid="nav-item"][data-nav="adm-users"]').click();
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.usersListTitle.en);
  await expect(page.locator('[data-testid="admin-users-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-users-row"][data-staff-id="stf_wfg_alex"]')).toContainText('Alex Chen');
  await expect(page.locator('[data-testid="admin-users-search"]')).toBeVisible();
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');
  await expect(page.locator('[data-testid="scope-rail"]')).toHaveCount(0);

  await page.locator('[data-testid="admin-users-row"][data-staff-id="stf_wfg_alex"] [data-testid="admin-user-open"]').click();
  await expect(page.locator('[data-testid="admin-users-detail"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-user-profile"]')).toContainText('alex.chen@wingfu.example');
  await expect(page.locator('[data-testid="admin-user-roles"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-user-scope"]')).toBeVisible();
  await page.locator('[data-testid="admin-user-pane-tab"][data-tab="groups"]').click();
  await expect(page.locator('[data-testid="admin-user-groups"]')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('user')).toBe('stf_wfg_alex');

  await page.locator('[data-testid="chain-dialog-close"]').click();
  await page.locator('[data-testid="nav-item"][data-nav="adm-groups"]').click();
  await expect(page.locator('[data-testid="admin-groups-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.groupsListTitle.en);
  await expect(page.locator('[data-testid="admin-groups-row"][data-group-id="grp_wfg_estate_managers"]')).toContainText('Estate managers');
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);

  await page.locator('[data-testid="nav-item"][data-nav="adm-roles"]').click();
  await expect(page.locator('[data-testid="admin-roles-matrix"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.rolesTitle.en);
  await page.locator('[data-testid="admin-function-tab"][data-domain="administration"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'administration');
  await expect(page.locator('[data-testid="admin-role-feature"][data-role="administrator"][data-feature="admin_users"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);

  await page.locator('[data-testid="nav-item"][data-nav="adm-email"]').click();
  await expect(page.locator('[data-testid="admin-email-form"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.emailTitle.en);
  await expect(page.locator('[data-testid="admin-email-host"]')).toHaveValue('smtp.wingfu.example');
  await expect(page.locator('[data-testid="coming-soon"]')).toHaveCount(0);
  await expect(page.locator('.pemo-shell')).toHaveAttribute('data-scope-hidden', 'true');

  await expect(page.locator('[data-testid="screen-select"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="state-select"]')).toHaveCount(0);
});
