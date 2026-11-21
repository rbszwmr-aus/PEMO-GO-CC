/**
 * UI-owned Administration fixtures (Users, Groups, Roles & features, Audit log).
 *
 * Kept OUT of tests/fixtures/management-web/index.json because the management
 * OpenAPI has no listUsers / listGroups / getRoleCatalog reads yet. Live stays
 * on the v0 freeze. Effective permission is the union of each group’s roles’
 * features; this corpus is the fixture UI only.
 *
 * Staff names align with the signed-in Account chrome (Alex Chen) and the
 * access-staff seed (Chan Mei-ling, Lau Chi-wai, Ng Siu-fong, Ng Ka-ho,
 * Tsang Ho-yin). Role ids are fixture labels, not ConferGrantRequest values.
 * Membership and Groups Rights grant toggles mutate for the session in
 * admin-directory-session.ts. Group stubs may carry optional parkcore_role +
 * parkcore_actions[] when the fixture license includes ParkCore
 * (EffectiveAllowed = Role ∪ filtered actions on Groups Rights).
 */

import {
  STAFF_FEATURE_IDS,
  type AdminGroupDetailResponse,
  type AdminGroupListResponse,
  type AdminRolesMatrixResponse,
  type AdminUserDetailResponse,
  type AdminUserListResponse,
  type StaffRoleId,
} from './types.ts';

const META = {
  contractVersion: '2.5.0',
  generatedAt: '2026-09-19T12:00:00+08:00',
} as const;

export const ADMIN_USERS_LIST = {
  meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-000000000001' },
  counts: { all: 6, active: 5, inactive: 1 },
  users: [
    {
      staffId: 'stf_wfg_alex',
      displayName: 'Alex Chen',
      email: 'alex.chen@wingfu.example',
      roles: ['administrator'],
      status: 'active',
      groupCount: 1,
    },
    {
      staffId: 'stf_wfg_manager',
      displayName: 'Chan Mei-ling 陳美玲',
      email: 'mei-ling.chan@wingfu.example',
      roles: ['estate_manager'],
      status: 'active',
      groupCount: 1,
    },
    {
      staffId: 'stf_wfg_block_a',
      displayName: 'Lau Chi-wai 劉志偉',
      email: 'chi-wai.lau@wingfu.example',
      roles: ['security'],
      status: 'active',
      groupCount: 1,
    },
    {
      staffId: 'stf_wfg_counter',
      displayName: 'Ng Siu-fong 吳小芳',
      email: 'siu-fong.ng@wingfu.example',
      roles: ['help_desk'],
      status: 'active',
      groupCount: 1,
    },
    {
      staffId: 'stf_wfg_dual_role',
      displayName: 'Ng Ka-ho 吳家豪',
      email: 'ka-ho.ng@wingfu.example',
      roles: ['security', 'help_desk'],
      status: 'active',
      groupCount: 2,
    },
    {
      staffId: 'stf_wfg_former',
      displayName: 'Tsang Ho-yin 曾浩然',
      email: 'ho-yin.tsang@wingfu.example',
      roles: ['estate_manager'],
      status: 'inactive',
      groupCount: 1,
    },
  ],
} as AdminUserListResponse;

export const ADMIN_USERS_EMPTY = {
  meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000e0' },
  counts: { all: 0, active: 0, inactive: 0 },
  users: [],
} as AdminUserListResponse;

export const ADMIN_USER_DETAILS: Readonly<Record<string, AdminUserDetailResponse>> = {
  stf_wfg_alex: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d1' },
    user: {
      staffId: 'stf_wfg_alex',
      displayName: 'Alex Chen',
      email: 'alex.chen@wingfu.example',
      jobTitle: { en: 'System administrator', 'zh-Hant': '系統管理員', 'zh-Hans': '系统管理员' },
      status: 'active',
      roles: ['administrator'],
      groups: [{ groupId: 'grp_wfg_administrators', name: { en: 'Administrators', 'zh-Hant': '系統管理員', 'zh-Hans': '系统管理员' } }],
      scopeSummary: {
        en: 'Wing Fu Garden — estate (all blocks). Organization: Wing Fu Property Management.',
        'zh-Hant': '榮富花園 — 屋苑（所有座數）。機構：榮富物業管理。', 'zh-Hans': '荣富花园 — 小区（所有栋数）。机构：荣富物业管理。',
      },
    },
  },
  stf_wfg_manager: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d2' },
    user: {
      staffId: 'stf_wfg_manager',
      displayName: 'Chan Mei-ling 陳美玲',
      email: 'mei-ling.chan@wingfu.example',
      jobTitle: { en: 'Estate manager', 'zh-Hant': '屋苑經理', 'zh-Hans': '小区经理' },
      status: 'active',
      roles: ['estate_manager'],
      groups: [{ groupId: 'grp_wfg_estate_managers', name: { en: 'Estate managers', 'zh-Hant': '屋苑經理', 'zh-Hans': '小区经理' } }],
      scopeSummary: {
        en: 'Wing Fu Garden — estate (Blocks A, B and C).',
        'zh-Hant': '榮富花園 — 屋苑（A、B、C 座）。', 'zh-Hans': '荣富花园 — 小区（A、B、C 栋）。',
      },
    },
  },
  stf_wfg_block_a: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d3' },
    user: {
      staffId: 'stf_wfg_block_a',
      displayName: 'Lau Chi-wai 劉志偉',
      email: 'chi-wai.lau@wingfu.example',
      jobTitle: { en: 'Block supervisor', 'zh-Hant': '座數主管', 'zh-Hans': '栋数主管' },
      status: 'active',
      roles: ['security'],
      groups: [{ groupId: 'grp_wfg_security', name: { en: 'Security', 'zh-Hant': '保安', 'zh-Hans': '保安' } }],
      scopeSummary: {
        en: 'Wing Fu Garden · Block A (building). Other blocks are outside this grant stub.',
        'zh-Hant': '榮富花園 · A 座（大廈）。其他座數不在此授權摘要內。', 'zh-Hans': '荣富花园 · A 栋（大楼）。其他栋数不在此授权摘要内。',
      },
    },
  },
  stf_wfg_counter: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d4' },
    user: {
      staffId: 'stf_wfg_counter',
      displayName: 'Ng Siu-fong 吳小芳',
      email: 'siu-fong.ng@wingfu.example',
      jobTitle: { en: 'Help desk officer', 'zh-Hant': '服務台職員', 'zh-Hans': '服务台职员' },
      status: 'active',
      roles: ['help_desk'],
      groups: [{ groupId: 'grp_wfg_help_desk', name: { en: 'Help desk', 'zh-Hant': '服務台', 'zh-Hans': '服务台' } }],
      scopeSummary: {
        en: 'Wing Fu Garden — estate desk (counter / phone / app queue).',
        'zh-Hant': '榮富花園 — 屋苑服務台（櫃台／電話／應用程式佇列）。', 'zh-Hans': '荣富花园 — 小区服务台（柜台／电话／应用程序队列）。',
      },
    },
  },
  stf_wfg_dual_role: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d5' },
    user: {
      staffId: 'stf_wfg_dual_role',
      displayName: 'Ng Ka-ho 吳家豪',
      email: 'ka-ho.ng@wingfu.example',
      jobTitle: { en: 'Duty officer', 'zh-Hant': '當值主任', 'zh-Hans': '当值主任' },
      status: 'active',
      roles: ['security', 'help_desk'],
      groups: [
        { groupId: 'grp_wfg_security', name: { en: 'Security', 'zh-Hant': '保安', 'zh-Hans': '保安' } },
        { groupId: 'grp_wfg_help_desk', name: { en: 'Help desk', 'zh-Hant': '服務台', 'zh-Hans': '服务台' } },
      ],
      scopeSummary: {
        en: 'Wing Fu Garden · Block A (building) via two group memberships.',
        'zh-Hant': '榮富花園 · A 座（大廈），經兩個群組成員資格。', 'zh-Hans': '荣富花园 · A 栋（大楼），经两个群组成员资格。',
      },
    },
  },
  stf_wfg_former: {
    meta: { ...META, correlationId: 'a1b2c3d4-adm0-4000-8000-0000000000d6' },
    user: {
      staffId: 'stf_wfg_former',
      displayName: 'Tsang Ho-yin 曾浩然',
      email: 'ho-yin.tsang@wingfu.example',
      jobTitle: { en: 'Former estate manager', 'zh-Hant': '前任屋苑經理', 'zh-Hans': '前任小区经理' },
      status: 'inactive',
      roles: ['estate_manager'],
      groups: [{ groupId: 'grp_wfg_estate_managers', name: { en: 'Estate managers', 'zh-Hant': '屋苑經理', 'zh-Hans': '小区经理' } }],
      scopeSummary: {
        en: 'Grant ended — Wing Fu Garden estate is no longer in force for this account.',
        'zh-Hant': '授權已結束 — 此帳戶不再持有榮富花園屋苑範圍。', 'zh-Hans': '授权已结束 — 此账户不再持有荣富花园小区范围。',
      },
    },
  },
};

export const ADMIN_USERS_DETAIL_DEFAULT: AdminUserDetailResponse = ADMIN_USER_DETAILS['stf_wfg_alex']!;

export const ADMIN_GROUPS_LIST = {
  meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-000000000001' },
  counts: { all: 4 },
  groups: [
    {
      groupId: 'grp_wfg_administrators',
      name: { en: 'Administrators', 'zh-Hant': '系統管理員', 'zh-Hans': '系统管理员' },
      description: {
        en: 'Office principals who administer staff directory and grants.',
        'zh-Hant': '負責管理職員名冊與授權的辦事處人員。', 'zh-Hans': '负责管理职员名册与授权的办事处人员。',
      },
      memberCount: 1,
      defaultRoles: ['administrator'],
      defaultScope: { en: 'Wing Fu Garden — estate', 'zh-Hant': '榮富花園 — 屋苑', 'zh-Hans': '荣富花园 — 小区' },
    },
    {
      groupId: 'grp_wfg_estate_managers',
      name: { en: 'Estate managers', 'zh-Hant': '屋苑經理', 'zh-Hans': '小区经理' },
      description: {
        en: 'Day-to-day estate operations across every block.',
        'zh-Hant': '負責各座日常屋苑營運。', 'zh-Hans': '负责各座日常小区营运。',
      },
      memberCount: 2,
      defaultRoles: ['estate_manager'],
      defaultScope: { en: 'Wing Fu Garden — estate', 'zh-Hant': '榮富花園 — 屋苑', 'zh-Hans': '荣富花园 — 小区' },
    },
    {
      groupId: 'grp_wfg_help_desk',
      name: { en: 'Help desk', 'zh-Hant': '服務台', 'zh-Hans': '服务台' },
      description: {
        en: 'Counter, phone and app queue — one team at the desk.',
        'zh-Hant': '櫃台、電話與應用程式佇列 — 同一服務台隊伍。', 'zh-Hans': '柜台、电话与应用程序队列 — 同一服务台队伍。',
      },
      memberCount: 2,
      defaultRoles: ['help_desk'],
      defaultScope: { en: 'Wing Fu Garden — estate desk', 'zh-Hant': '榮富花園 — 屋苑服務台', 'zh-Hans': '荣富花园 — 小区服务台' },
    },
    {
      groupId: 'grp_wfg_security',
      name: { en: 'Security', 'zh-Hant': '保安', 'zh-Hans': '保安' },
      description: {
        en: 'Patrol and access watch for assigned blocks.',
        'zh-Hant': '負責指定座數的巡邏與門禁監察。', 'zh-Hans': '负责指定栋数的巡逻与门禁监察。',
      },
      memberCount: 2,
      defaultRoles: ['security'],
      defaultScope: { en: 'Wing Fu Garden · Block A', 'zh-Hant': '榮富花園 · A 座', 'zh-Hans': '荣富花园 · A 栋' },
    },
  ],
} as AdminGroupListResponse;

export const ADMIN_GROUPS_EMPTY = {
  meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-0000000000e0' },
  counts: { all: 0 },
  groups: [],
} as AdminGroupListResponse;

export const ADMIN_GROUP_DETAILS: Readonly<Record<string, AdminGroupDetailResponse>> = {
  grp_wfg_administrators: {
    meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-0000000000d1' },
    group: {
      groupId: 'grp_wfg_administrators',
      name: { en: 'Administrators', 'zh-Hant': '系統管理員', 'zh-Hans': '系统管理员' },
      description: {
        en: 'Office principals who administer staff directory and grants.',
        'zh-Hant': '負責管理職員名冊與授權的辦事處人員。', 'zh-Hans': '负责管理职员名册与授权的办事处人员。',
      },
      members: [{ staffId: 'stf_wfg_alex', displayName: 'Alex Chen', status: 'active' }],
      defaultRoles: ['administrator'],
      defaultScope: { en: 'Wing Fu Garden — estate', 'zh-Hant': '榮富花園 — 屋苑', 'zh-Hans': '荣富花园 — 小区' },
      parkcore_role: 'ADMINISTRATOR',
      parkcore_actions: [],
    },
  },
  grp_wfg_estate_managers: {
    meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-0000000000d2' },
    group: {
      groupId: 'grp_wfg_estate_managers',
      name: { en: 'Estate managers', 'zh-Hant': '屋苑經理', 'zh-Hans': '小区经理' },
      description: {
        en: 'Day-to-day estate operations across every block.',
        'zh-Hant': '負責各座日常屋苑營運。', 'zh-Hans': '负责各座日常小区营运。',
      },
      members: [
        { staffId: 'stf_wfg_manager', displayName: 'Chan Mei-ling 陳美玲', status: 'active' },
        { staffId: 'stf_wfg_former', displayName: 'Tsang Ho-yin 曾浩然', status: 'inactive' },
      ],
      defaultRoles: ['estate_manager'],
      defaultScope: { en: 'Wing Fu Garden — estate', 'zh-Hant': '榮富花園 — 屋苑', 'zh-Hans': '荣富花园 — 小区' },
      parkcore_role: 'MANAGER',
      parkcore_actions: ['receipt.export'],
    },
  },
  grp_wfg_help_desk: {
    meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-0000000000d3' },
    group: {
      groupId: 'grp_wfg_help_desk',
      name: { en: 'Help desk', 'zh-Hant': '服務台', 'zh-Hans': '服务台' },
      description: {
        en: 'Counter, phone and app queue — one team at the desk.',
        'zh-Hant': '櫃台、電話與應用程式佇列 — 同一服務台隊伍。', 'zh-Hans': '柜台、电话与应用程序队列 — 同一服务台队伍。',
      },
      members: [
        { staffId: 'stf_wfg_counter', displayName: 'Ng Siu-fong 吳小芳', status: 'active' },
        { staffId: 'stf_wfg_dual_role', displayName: 'Ng Ka-ho 吳家豪', status: 'active' },
      ],
      defaultRoles: ['help_desk'],
      defaultScope: { en: 'Wing Fu Garden — estate desk', 'zh-Hant': '榮富花園 — 屋苑服務台', 'zh-Hans': '荣富花园 — 小区服务台' },
      parkcore_role: 'OPERATOR',
      parkcore_actions: [],
    },
  },
  grp_wfg_security: {
    meta: { ...META, correlationId: 'b2c3d4e5-adm0-4000-8000-0000000000d4' },
    group: {
      groupId: 'grp_wfg_security',
      name: { en: 'Security', 'zh-Hant': '保安', 'zh-Hans': '保安' },
      description: {
        en: 'Patrol and access watch for assigned blocks.',
        'zh-Hant': '負責指定座數的巡邏與門禁監察。', 'zh-Hans': '负责指定栋数的巡逻与门禁监察。',
      },
      members: [
        { staffId: 'stf_wfg_block_a', displayName: 'Lau Chi-wai 劉志偉', status: 'active' },
        { staffId: 'stf_wfg_dual_role', displayName: 'Ng Ka-ho 吳家豪', status: 'active' },
      ],
      defaultRoles: ['security'],
      defaultScope: { en: 'Wing Fu Garden · Block A', 'zh-Hant': '榮富花園 · A 座', 'zh-Hans': '荣富花园 · A 栋' },
      parkcore_role: 'READ_ONLY',
      parkcore_actions: ['alarm.ack'],
    },
  },
};

export const ADMIN_GROUPS_DETAIL_DEFAULT: AdminGroupDetailResponse =
  ADMIN_GROUP_DETAILS['grp_wfg_estate_managers']!;

const ALL_ROLES: readonly StaffRoleId[] = [
  'administrator',
  'estate_manager',
  'help_desk',
  'security',
];

export const ADMIN_ROLES_MATRIX = {
  meta: { ...META, correlationId: 'c3d4e5f6-adm0-4000-8000-000000000001' },
  roles: ALL_ROLES,
  features: STAFF_FEATURE_IDS,
  granted: {
    administrator: STAFF_FEATURE_IDS,
    estate_manager: [
      'view_overview',
      'view_safety',
      'manage_cases',
      'manage_notices',
      'manage_visitors',
      'manage_properties',
      'manage_helpdesk',
      'view_reports',
      'manage_access',
      'manage_residents',
      'manage_households',
      'manage_documents',
      'manage_bookings',
      'manage_payments',
    ],
    help_desk: [
      'view_overview',
      'manage_cases',
      'manage_visitors',
      'manage_properties',
      'manage_helpdesk',
      'manage_residents',
      'manage_households',
      'manage_documents',
    ],
    security: [
      'view_overview',
      'view_safety',
      'manage_visitors',
      'manage_access',
    ],
  },
} as AdminRolesMatrixResponse;

export const ADMIN_DIRECTORY_CORPUS: Readonly<Record<string, unknown>> = {
  'admin-users/list.json': ADMIN_USERS_LIST,
  'admin-users/empty.json': ADMIN_USERS_EMPTY,
  'admin-users/detail.json': ADMIN_USERS_DETAIL_DEFAULT,
  'admin-groups/list.json': ADMIN_GROUPS_LIST,
  'admin-groups/empty.json': ADMIN_GROUPS_EMPTY,
  'admin-groups/detail.json': ADMIN_GROUPS_DETAIL_DEFAULT,
  'admin-roles/matrix.json': ADMIN_ROLES_MATRIX,
};

export function findAdminUserDetail(staffId: string): AdminUserDetailResponse | undefined {
  return ADMIN_USER_DETAILS[staffId];
}

export function findAdminGroupDetail(groupId: string): AdminGroupDetailResponse | undefined {
  return ADMIN_GROUP_DETAILS[groupId];
}
