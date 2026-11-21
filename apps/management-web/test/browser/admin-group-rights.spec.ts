/**
 * Administration Groups detail: Rights / permissions by PEMO | ParkCore
 * module, then function-domain tabs. Grant checkboxes update the session
 * stub. Roles & features uses the same PEMO domain catalog. Fixture-first.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { FEATURE_DOMAIN_IDS } from '../../src/data/feature-domains.ts';
import { PARKCORE_DOMAIN_IDS } from '../../src/data/parkcore-domains.ts';

test('Group detail Rights tabs scope features by function domain', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 's2', 'default', 'en'), { waitUntil: 'load' });

  await page.locator('[data-testid="nav-item"][data-nav="admin"] .pemo-nav__chevron').click();
  await page.locator('[data-testid="nav-item"][data-nav="adm-groups"]').click();
  await expect(page.locator('[data-testid="admin-groups-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="page-title"]')).toHaveText(MESSAGES.admin.groupsListTitle.en);

  await page.locator('[data-testid="admin-groups-row"][data-group-id="grp_wfg_estate_managers"] [data-testid="admin-group-open"]').click();
  await expect(page.locator('[data-testid="admin-groups-detail"]')).toBeVisible();
  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  await expect(page.locator('[data-testid="admin-group-rights"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-rights-note"]')).toHaveAttribute('aria-label', /union/);
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(FEATURE_DOMAIN_IDS.length);

  const panel = page.locator('[data-testid="admin-function-tabpanel"]');
  await expect(panel).toHaveAttribute('data-domain', 'overview_properties');
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="view_overview"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="manage_properties"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="manage_visitors"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="view_overview"]')).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-function-tab"][data-domain="visitors"]').click();
  await expect(panel).toHaveAttribute('data-domain', 'visitors');
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="manage_visitors"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="manage_access"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="view_overview"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="manage_visitors"]')).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-function-tab"][data-domain="administration"]').click();
  await expect(panel).toHaveAttribute('data-domain', 'administration');
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="admin_users"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="admin_users"]')).toHaveAttribute('data-granted', 'false');
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="view_audit"]')).toHaveAttribute('data-granted', 'false');

  await page.locator('[data-testid="admin-function-tab"][data-domain="residents_households"]').click();
  await expect(panel).toHaveAttribute('data-domain', 'residents_households');
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="manage_residents"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="manage_households"]')).toHaveAttribute('data-granted', 'true');
});

test('Roles matrix tabs show only the active function domain', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(urlFor(base, 'adminRoles', 'matrix', 'en'), { waitUntil: 'load' });

  await expect(page.locator('[data-testid="admin-roles-matrix"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(FEATURE_DOMAIN_IDS.length);
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'overview_properties');
  await expect(page.locator('[data-testid="admin-roles-row"][data-feature="view_overview"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-roles-row"][data-feature="admin_users"]')).toHaveCount(0);

  await page.locator('[data-testid="admin-function-tab"][data-domain="helpdesk_cases"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'helpdesk_cases');
  await expect(page.locator('[data-testid="admin-roles-row"][data-feature="manage_helpdesk"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-roles-row"][data-feature="manage_cases"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-roles-row"][data-feature="view_overview"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-role-feature"][data-role="help_desk"][data-feature="manage_helpdesk"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="admin-role-feature"][data-role="security"][data-feature="manage_helpdesk"]')).toHaveAttribute('data-granted', 'false');
});

test('Group rights tab labels localise in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(`${base}/?screen=adminGroupsDetail&state=detail&lang=zh-Hant&group=grp_wfg_security`, { waitUntil: 'load' });

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  await expect(page.locator('[data-testid="admin-group-rights"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-function-tab"][data-domain="overview_properties"] [data-testid="admin-function-tab-label"]')).toHaveText(MESSAGES.admin.featureDomain.overview_properties['zh-Hant']);
  await expect(page.locator('[data-testid="admin-function-tab"][data-domain="visitors"] [data-testid="admin-function-tab-label"]')).toHaveText(MESSAGES.admin.featureDomain.visitors['zh-Hant']);
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="view_overview"]')).toHaveAttribute('data-granted', 'true');
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="view_reports"]')).toHaveAttribute('data-granted', 'false');

  await page.locator('[data-testid="admin-function-tab"][data-domain="visitors"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'visitors');
  await expect(page.locator('[data-testid="admin-group-right-row"][data-feature="manage_visitors"]')).toContainText(MESSAGES.admin.feature.manage_visitors['zh-Hant']);
  await expect(page.locator('[data-testid="admin-group-right"][data-feature="manage_visitors"]')).toHaveAttribute('data-granted', 'true');
});

test('ParkCore domain tabs show on a group when the fixture license includes parkcore', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_estate_managers`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  await expect(page.locator('[data-testid="admin-group-rights"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(FEATURE_DOMAIN_IDS.length);
  await expect(page.locator('[data-testid="admin-rights-module"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="admin-rights-module"][data-module="pemo"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]')).toHaveText(
    MESSAGES.admin.rightsModuleParkcore.en,
  );
  await expect(page.locator('[data-testid="admin-parkcore-tab"]')).toHaveCount(0);

  await page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tab"]')).toHaveCount(PARKCORE_DOMAIN_IDS.length);
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="lanes"] [data-testid="admin-parkcore-tab-label"]')).toHaveText(
    MESSAGES.admin.parkcoreDomain.lanes.en,
  );
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="payments"] [data-testid="admin-parkcore-tab-label"]')).toHaveText(
    MESSAGES.admin.parkcoreDomain.payments.en,
  );
  await expect(page.locator('[data-testid="admin-parkcore-tabpanel"]')).toHaveAttribute('data-domain', 'lanes');
  await expect(page.locator('[data-testid="admin-group-parkcore-role"]')).toContainText(
    MESSAGES.admin.parkcoreRole.MANAGER.en,
  );

  await page.locator('[data-testid="admin-parkcore-tab"][data-domain="receipts"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tabpanel"]')).toHaveAttribute('data-domain', 'receipts');
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="receipt.view"]')).toHaveAttribute(
    'data-granted',
    'true',
  );
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="receipt.export"]')).toHaveAttribute(
    'data-granted',
    'true',
  );

  await page.locator('[data-testid="admin-parkcore-tab"][data-domain="admin"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tabpanel"]')).toHaveAttribute('data-domain', 'admin');
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="user.admin"]')).toHaveAttribute(
    'data-granted',
    'false',
  );
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="audit.view"]')).toHaveAttribute(
    'data-granted',
    'true',
  );
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('ParkCore domain tabs are hidden when the fixture license excludes parkcore', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_estate_managers&modules=pemo`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  await expect(page.locator('[data-testid="admin-group-rights"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(FEATURE_DOMAIN_IDS.length);
  await expect(page.locator('[data-testid="admin-rights-module"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-parkcore-tab"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-group-parkcore-rights-note"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute('data-domain', 'overview_properties');
});

test('ParkCore domain tab labels localise in zh-Hant', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=zh-Hant&group=grp_wfg_security`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  await expect(page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]')).toHaveText(
    MESSAGES.admin.rightsModuleParkcore['zh-Hant'],
  );
  await expect(page.locator('[data-testid="admin-rights-module-switcher"]')).toContainText(
    MESSAGES.admin.rightsModuleLabel['zh-Hant'],
  );

  await page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="lanes"] [data-testid="admin-parkcore-tab-label"]')).toHaveText(
    MESSAGES.admin.parkcoreDomain.lanes['zh-Hant'],
  );
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="holds"] [data-testid="admin-parkcore-tab-label"]')).toHaveText(
    MESSAGES.admin.parkcoreDomain.holds['zh-Hant'],
  );
  await expect(page.locator('[data-testid="admin-group-parkcore-role"]')).toContainText(
    MESSAGES.admin.parkcoreRole.READ_ONLY['zh-Hant'],
  );

  await page.locator('[data-testid="admin-parkcore-tab"][data-domain="alarms"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tabpanel"]')).toHaveAttribute('data-domain', 'alarms');
  await expect(page.locator('[data-testid="admin-group-parkcore-right-row"][data-action="alarm.ack"]')).toContainText(
    MESSAGES.admin.parkcoreAction['alarm.ack']['zh-Hant'],
  );
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="alarm.ack"]')).toHaveAttribute(
    'data-granted',
    'true',
  );
  await expect(page.locator('[data-testid="admin-group-parkcore-right"][data-action="alarm.view"]')).toHaveAttribute(
    'data-granted',
    'true',
  );
});

test('ParkCore module switcher selects ParkCore domains and grant checkboxes toggle', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_estate_managers`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  const overview = page.locator('[data-testid="admin-group-right"][data-feature="view_overview"]');
  await expect(overview).toHaveAttribute('data-granted', 'true');
  await overview.locator('[data-testid="admin-group-grant-toggle"]').uncheck();
  await expect(overview).toHaveAttribute('data-granted', 'false');
  await overview.locator('[data-testid="admin-group-grant-toggle"]').check();
  await expect(overview).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-function-tab"][data-domain="administration"]').click();
  const adminUsers = page.locator('[data-testid="admin-group-right"][data-feature="admin_users"]');
  await expect(adminUsers).toHaveAttribute('data-granted', 'false');
  await adminUsers.locator('[data-testid="admin-group-grant-toggle"]').check();
  await expect(adminUsers).toHaveAttribute('data-granted', 'true');
  await adminUsers.locator('[data-testid="admin-group-grant-toggle"]').uncheck();
  await expect(adminUsers).toHaveAttribute('data-granted', 'false');

  await page.locator('[data-testid="admin-function-tab"][data-domain="overview_properties"]').click();
  await page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]').click();
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="lanes"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="payments"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="alarms"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-parkcore-tabpanel"]')).toHaveAttribute('data-domain', 'lanes');
  await expect(page.locator('[data-testid="admin-function-tab"]')).toHaveCount(0);

  const operate = page.locator('[data-testid="admin-group-parkcore-right"][data-action="lane.operate"]');
  await expect(operate).toHaveAttribute('data-granted', 'true');
  await operate.locator('[data-testid="admin-group-parkcore-grant-toggle"]').uncheck();
  await expect(operate).toHaveAttribute('data-granted', 'false');
  await operate.locator('[data-testid="admin-group-parkcore-grant-toggle"]').check();
  await expect(operate).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-parkcore-tab"][data-domain="receipts"]').click();
  const exported = page.locator('[data-testid="admin-group-parkcore-right"][data-action="receipt.export"]');
  await expect(exported).toHaveAttribute('data-granted', 'true');
  await exported.locator('[data-testid="admin-group-parkcore-grant-toggle"]').uncheck();
  await expect(exported).toHaveAttribute('data-granted', 'false');
  await exported.locator('[data-testid="admin-group-parkcore-grant-toggle"]').check();
  await expect(exported).toHaveAttribute('data-granted', 'true');

  await page.locator('[data-testid="admin-rights-module"][data-module="pemo"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute(
    'data-domain',
    'overview_properties',
  );
  await expect(overview).toHaveAttribute('data-granted', 'true');
});

test('Group rights domain tabs show granted/total badges from session grants', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_estate_managers`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  const overviewCount = page.locator(
    '[data-testid="admin-function-tab"][data-domain="overview_properties"] [data-testid="admin-function-tab-count"]',
  );
  const adminCount = page.locator(
    '[data-testid="admin-function-tab"][data-domain="administration"] [data-testid="admin-function-tab-count"]',
  );
  await expect(overviewCount).toBeVisible();
  await expect(overviewCount).toHaveText('4/4');
  await expect(adminCount).toHaveText('0/3');
  await expect(
    page.locator('[data-testid="admin-function-tab"][data-domain="residents_households"] [data-testid="admin-function-tab-count"]'),
  ).toHaveText('2/2');
  await expect(
    page.locator('[data-testid="admin-function-tab"][data-domain="visitors"] [data-testid="admin-function-tab-count"]'),
  ).toHaveText('2/2');

  await page.locator('[data-testid="admin-group-right"][data-feature="view_overview"] [data-testid="admin-group-grant-toggle"]').uncheck();
  await expect(overviewCount).toHaveText('3/4');
  await page.locator('[data-testid="admin-group-right"][data-feature="view_overview"] [data-testid="admin-group-grant-toggle"]').check();
  await expect(overviewCount).toHaveText('4/4');

  await page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]').click();
  await expect(
    page.locator('[data-testid="admin-parkcore-tab"][data-domain="lanes"] [data-testid="admin-parkcore-tab-count"]'),
  ).toHaveText('2/2');
  await expect(
    page.locator('[data-testid="admin-parkcore-tab"][data-domain="alarms"] [data-testid="admin-parkcore-tab-count"]'),
  ).toHaveText('1/2');
  await expect(
    page.locator('[data-testid="admin-parkcore-tab"][data-domain="receipts"] [data-testid="admin-parkcore-tab-count"]'),
  ).toHaveText('2/2');
  await expect(
    page.locator('[data-testid="admin-parkcore-tab"][data-domain="admin"] [data-testid="admin-parkcore-tab-count"]'),
  ).toHaveText('1/2');
});

test('Group rights domain tabs overflow with scroll arrows', async ({ strictPage: page }) => {
  const base = await appOrigin();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(
    `${base}/?screen=adminGroupsDetail&state=detail&lang=en&group=grp_wfg_estate_managers`,
    { waitUntil: 'load' },
  );

  await page.locator('[data-testid="admin-group-pane-tab"][data-tab="rights"]').click();
  const bar = page.locator('[data-testid="admin-function-tabs-bar"]');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-overflow', 'true');
  const prev = page.locator('[data-testid="admin-domain-tabs-prev"]');
  const next = page.locator('[data-testid="admin-domain-tabs-next"]');
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  await expect(prev).toBeDisabled();

  const scroller = page.locator('[data-testid="admin-function-tabs"]');
  const before = await scroller.evaluate((el) => el.scrollLeft);
  await next.click();
  await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
  await expect(prev).toBeEnabled();

  await page.locator('[data-testid="admin-rights-module"][data-module="parkcore"]').click();
  const parkBar = page.locator('[data-testid="admin-parkcore-tabs-bar"]');
  await expect(parkBar).toHaveAttribute('data-overflow', 'true');
  await expect(page.locator('[data-testid="admin-domain-tabs-next"]')).toBeVisible();
  await expect(page.locator('[data-testid="admin-parkcore-tab"][data-domain="lanes"]')).toBeVisible();
  await page.locator('[data-testid="admin-rights-module"][data-module="pemo"]').click();
  await expect(page.locator('[data-testid="admin-function-tabpanel"]')).toHaveAttribute(
    'data-domain',
    'overview_properties',
  );
});

