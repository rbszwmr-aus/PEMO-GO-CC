/**
 * UI-owned Residents fixtures (WEB-05 vertical slice).
 *
 * Kept OUT of tests/fixtures/management-web/index.json because the management
 * OpenAPI has no listResidents / getResident reads yet (only occupancy writes).
 * Contract package is read-only to this surface; live stays on v0 freeze
 * (scope + tree). See docs/contracts/proposed-residents-read-ops.md.
 *
 * JSON sources remain under ./residents-fixtures/ for review; this module is the
 * runtime corpus (same approach as visitor-fixtures / households-corpus).
 *
 * Detail rows are keyed by residentId so list → detail (and household member
 * → tenant) opens the matching person, not the default A1 fixture.
 */

import type { LocalizedText } from '../i18n/locale.ts';
import type {
  ResidentDetailResponse,
  ResidentDirectoryState,
  ResidentListItem,
  ResidentListResponse,
  ResidentOccupancyRole,
  ResidentOccupancyRow,
  ScopePath,
  ScopeRef,
} from './types.ts';

const loc = (en: string, zh: string): LocalizedText => ({ en, 'zh-Hant': zh });

const ORG: ScopeRef = {
  kind: 'organization',
  id: 'org_wingfu_holdings',
  label: loc('Wing Fu Property Management', '榮富物業管理'),
};
const ESTATE: ScopeRef = {
  kind: 'estate',
  id: 'est_wing_fu_garden',
  label: loc('Wing Fu Garden', '榮富花園'),
};

function unitScope(
  unit: { id: string; en: string; zh: string },
  building: { id: string; en: string; zh: string },
  floor: { id: string; en: string; zh: string },
): ScopePath {
  return {
    node: { kind: 'unit', id: unit.id, label: loc(unit.en, unit.zh) },
    ancestry: [
      ORG,
      ESTATE,
      { kind: 'building', id: building.id, label: loc(building.en, building.zh) },
      { kind: 'floor', id: floor.id, label: loc(floor.en, floor.zh) },
    ],
  };
}

const SCOPE_A1 = unitScope(
  { id: 'unit_wfg_a_12_a1', en: 'Flat A1', zh: 'A1室' },
  { id: 'blk_wfg_a', en: 'Block A', zh: 'A座' },
  { id: 'fl_wfg_a_12', en: '12/F', zh: '12樓' },
);
const SCOPE_A4 = unitScope(
  { id: 'unit_wfg_a_05_a4', en: 'Flat A4', zh: 'A4室' },
  { id: 'blk_wfg_a', en: 'Block A', zh: 'A座' },
  { id: 'fl_wfg_a_05', en: '5/F', zh: '5樓' },
);
const SCOPE_B2 = unitScope(
  { id: 'unit_wfg_b_03_b2', en: 'Flat B2', zh: 'B2室' },
  { id: 'blk_wfg_b', en: 'Block B', zh: 'B座' },
  { id: 'fl_wfg_b_03', en: '3/F', zh: '3樓' },
);
const SCOPE_C3 = unitScope(
  { id: 'unit_wfg_c_08_c3', en: 'Flat C3', zh: 'C3室' },
  { id: 'blk_wfg_c', en: 'Block C', zh: 'C座' },
  { id: 'fl_wfg_c_08', en: '8/F', zh: '8樓' },
);
const SCOPE_P101 = unitScope(
  { id: 'unit_wfg_cp_p101', en: 'Parking P101', zh: '車位 P101' },
  { id: 'blk_wfg_cp', en: 'Car park', zh: '停車場' },
  { id: 'fl_wfg_cp_b1', en: 'B1', zh: 'B1' },
);

const SUMMARY_A1 = loc('Block A · 12/F · Flat A1', 'A座 · 12樓 · A1室');
const SUMMARY_A4 = loc('Block A · 5/F · Flat A4 (ended)', 'A座 · 5樓 · A4室（已結束）');
const SUMMARY_B2 = loc('Block B · 3/F · Flat B2', 'B座 · 3樓 · B2室');
const SUMMARY_C3 = loc('Block C · 8/F · Flat C3', 'C座 · 8樓 · C3室');

function listRow(row: {
  residentId: string;
  displayName: string;
  preferredLanguage: 'en' | 'zh-Hant';
  directoryState: ResidentDirectoryState;
  primaryRole: ResidentOccupancyRole | null;
  unitSummary: LocalizedText | null;
  scope: ScopePath | null;
  invitation: ResidentListItem['invitation'];
  verification: ResidentListItem['verification'];
  scopeEndedAt?: string;
}): ResidentListItem {
  return row;
}

function occ(row: ResidentOccupancyRow): ResidentOccupancyRow {
  return row;
}

type ResidentRecord = {
  residentId: string;
  displayName: string;
  preferredLanguage: 'en' | 'zh-Hant';
  directoryState: ResidentDirectoryState;
  passReference: string | null;
  verification: { state: 'verified' | 'pending'; verifiedAt?: string };
  occupancies: ResidentOccupancyRow[];
};

function detailOf(correlationId: string, record: ResidentRecord): ResidentDetailResponse {
  return {
    meta: {
      correlationId,
      contractVersion: '2.3.0',
      generatedAt: '2026-08-12T09:56:00+08:00',
    },
    resident: record,
  };
}

export const RESIDENTS_LIST = {
  meta: {
    correlationId: '7a1b2c3d-res0-4000-8000-000000000001',
    contractVersion: '2.3.0',
    generatedAt: '2026-08-12T09:56:00+08:00',
  },
  counts: {
    all: 8,
    verified: 4,
    invited: 1,
    pendingVerification: 1,
    expiredScope: 2,
  },
  residents: [
    listRow({
      residentId: 'res_wfg_000412',
      displayName: 'Ho Mei-yi 何美儀',
      preferredLanguage: 'en',
      directoryState: 'verified',
      primaryRole: 'owner_occupier',
      unitSummary: SUMMARY_A1,
      scope: SCOPE_A1,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2024-03-02T10:00:00+08:00' },
    }),
    listRow({
      residentId: 'res_wfg_000908',
      displayName: 'Chan Ka-ming 陳家明',
      preferredLanguage: 'en',
      directoryState: 'verified',
      primaryRole: 'household_member',
      unitSummary: SUMMARY_A1,
      scope: SCOPE_A1,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2021-03-05T11:20:00+08:00' },
    }),
    listRow({
      residentId: 'res_wfg_000733',
      displayName: 'Lam Siu-fung 林小鳳',
      preferredLanguage: 'en',
      directoryState: 'expired_scope',
      primaryRole: 'caregiver',
      unitSummary: SUMMARY_A1,
      scope: SCOPE_A1,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2026-01-02T09:00:00+08:00' },
      scopeEndedAt: '2026-08-12T00:00:00+08:00',
    }),
    listRow({
      residentId: 'res_wfg_inv_014',
      displayName: 'Ng Chi-wai 吳志偉',
      preferredLanguage: 'zh-Hant',
      directoryState: 'invited',
      primaryRole: 'tenant',
      unitSummary: SUMMARY_C3,
      scope: SCOPE_C3,
      invitation: { state: 'sent', sentAt: '2026-08-10T14:30:00+08:00', channel: 'app' },
      verification: { state: 'pending' },
    }),
    listRow({
      residentId: 'res_wfg_000001',
      displayName: 'Test No-Access Resident',
      preferredLanguage: 'en',
      directoryState: 'pending_verification',
      primaryRole: null,
      unitSummary: null,
      scope: null,
      invitation: { state: 'sent', sentAt: '2026-08-01T09:00:00+08:00', channel: 'counter' },
      verification: { state: 'pending' },
    }),
    listRow({
      residentId: 'res_wfg_000501',
      displayName: 'Tam Siu-fong 譚小芳',
      preferredLanguage: 'zh-Hant',
      directoryState: 'verified',
      primaryRole: 'owner_occupier',
      unitSummary: SUMMARY_B2,
      scope: SCOPE_B2,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2022-11-16T09:30:00+08:00' },
    }),
    listRow({
      residentId: 'res_wfg_000512',
      displayName: 'Tam Yee-man 譚綺雯',
      preferredLanguage: 'zh-Hant',
      directoryState: 'verified',
      primaryRole: 'tenant',
      unitSummary: SUMMARY_B2,
      scope: SCOPE_B2,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2024-09-02T11:00:00+08:00' },
    }),
    listRow({
      residentId: 'res_wfg_000220',
      displayName: 'Cheung Tak-wah 張德華',
      preferredLanguage: 'zh-Hant',
      directoryState: 'expired_scope',
      primaryRole: 'tenant',
      unitSummary: SUMMARY_A4,
      scope: SCOPE_A4,
      invitation: null,
      verification: { state: 'verified', verifiedAt: '2021-01-04T10:15:00+08:00' },
      scopeEndedAt: '2025-12-31T00:00:00+08:00',
    }),
  ],
} as ResidentListResponse;

export const RESIDENTS_EMPTY = {
  meta: {
    correlationId: '7a1b2c3d-res0-4000-8000-000000000003',
    contractVersion: '2.3.0',
    generatedAt: '2026-08-12T09:56:00+08:00',
  },
  counts: {
    all: 0,
    verified: 0,
    invited: 0,
    pendingVerification: 0,
    expiredScope: 0,
  },
  residents: [],
} as ResidentListResponse;

export const RESIDENT_DETAILS: Readonly<Record<string, ResidentDetailResponse>> = {
  res_wfg_000412: detailOf('7a1b2c3d-res0-4000-8000-000000000002', {
    residentId: 'res_wfg_000412',
    displayName: 'Ho Mei-yi 何美儀',
    preferredLanguage: 'en',
    directoryState: 'verified',
    passReference: 'RP-000412',
    verification: { state: 'verified', verifiedAt: '2024-03-02T10:00:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_412_a12a1',
        role: 'owner_occupier',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2020-01-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_a_12_a1',
        scope: SCOPE_A1,
      }),
      occ({
        occupancyId: 'occ_412_c08c3',
        role: 'household_member',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2023-06-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_c_08_c3',
        scope: SCOPE_C3,
      }),
      occ({
        occupancyId: 'occ_412_p101',
        role: 'owner_occupier',
        unitClass: 'parking',
        status: 'active',
        effectiveFrom: '2020-01-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_a_12_a1',
        scope: SCOPE_P101,
      }),
    ],
  }),
  res_wfg_000908: detailOf('7a1b2c3d-res0-4000-8000-000000000908', {
    residentId: 'res_wfg_000908',
    displayName: 'Chan Ka-ming 陳家明',
    preferredLanguage: 'en',
    directoryState: 'verified',
    passReference: 'RP-000908',
    verification: { state: 'verified', verifiedAt: '2021-03-05T11:20:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_908_a12a1',
        role: 'household_member',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2024-03-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_a_12_a1',
        scope: SCOPE_A1,
      }),
      occ({
        occupancyId: 'occ_908_c08c3',
        role: 'household_member',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2023-06-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_c_08_c3',
        scope: SCOPE_C3,
      }),
    ],
  }),
  res_wfg_000733: detailOf('7a1b2c3d-res0-4000-8000-000000000733', {
    residentId: 'res_wfg_000733',
    displayName: 'Lam Siu-fung 林小鳳',
    preferredLanguage: 'en',
    directoryState: 'expired_scope',
    passReference: 'RP-000733',
    verification: { state: 'verified', verifiedAt: '2026-01-02T09:00:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_733_a12a1',
        role: 'caregiver',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2025-06-01T00:00:00+08:00',
        effectiveTo: '2026-09-30T00:00:00+08:00',
        householdId: 'hh_wfg_a_12_a1',
        scope: SCOPE_A1,
      }),
    ],
  }),
  res_wfg_000501: detailOf('7a1b2c3d-res0-4000-8000-000000000501', {
    residentId: 'res_wfg_000501',
    displayName: 'Tam Siu-fong 譚小芳',
    preferredLanguage: 'zh-Hant',
    directoryState: 'verified',
    passReference: 'RP-000501',
    verification: { state: 'verified', verifiedAt: '2022-11-16T09:30:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_501_b03b2',
        role: 'owner_occupier',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2022-11-15T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_b_03_b2',
        scope: SCOPE_B2,
      }),
    ],
  }),
  res_wfg_000512: detailOf('7a1b2c3d-res0-4000-8000-000000000512', {
    residentId: 'res_wfg_000512',
    displayName: 'Tam Yee-man 譚綺雯',
    preferredLanguage: 'zh-Hant',
    directoryState: 'verified',
    passReference: 'RP-000512',
    verification: { state: 'verified', verifiedAt: '2024-09-02T11:00:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_512_b03b2',
        role: 'tenant',
        unitClass: 'residential',
        status: 'active',
        effectiveFrom: '2024-09-01T00:00:00+08:00',
        effectiveTo: null,
        householdId: 'hh_wfg_b_03_b2',
        scope: SCOPE_B2,
      }),
    ],
  }),
  res_wfg_000220: detailOf('7a1b2c3d-res0-4000-8000-000000000220', {
    residentId: 'res_wfg_000220',
    displayName: 'Cheung Tak-wah 張德華',
    preferredLanguage: 'zh-Hant',
    directoryState: 'expired_scope',
    passReference: null,
    verification: { state: 'verified', verifiedAt: '2021-01-04T10:15:00+08:00' },
    occupancies: [
      occ({
        occupancyId: 'occ_220_a05a4',
        role: 'tenant',
        unitClass: 'residential',
        status: 'ended',
        effectiveFrom: '2021-01-01T00:00:00+08:00',
        effectiveTo: '2025-12-31T00:00:00+08:00',
        householdId: 'hh_wfg_a_05_a4_ended',
        scope: SCOPE_A4,
      }),
    ],
  }),
  res_wfg_inv_014: detailOf('7a1b2c3d-res0-4000-8000-000000000014', {
    residentId: 'res_wfg_inv_014',
    displayName: 'Ng Chi-wai 吳志偉',
    preferredLanguage: 'zh-Hant',
    directoryState: 'invited',
    passReference: null,
    verification: { state: 'pending' },
    occupancies: [],
  }),
  res_wfg_000001: detailOf('7a1b2c3d-res0-4000-8000-0000000000a1', {
    residentId: 'res_wfg_000001',
    displayName: 'Test No-Access Resident',
    preferredLanguage: 'en',
    directoryState: 'pending_verification',
    passReference: null,
    verification: { state: 'pending' },
    occupancies: [],
  }),
};

/** Default detail fixture (Ho Mei-yi) — used by the state-matrix `detail` state. */
export const RESIDENTS_DETAIL_DEFAULT: ResidentDetailResponse =
  RESIDENT_DETAILS['res_wfg_000412']!;

export const RESIDENTS_CORPUS: Readonly<Record<string, unknown>> = {
  'residents/list.json': RESIDENTS_LIST,
  'residents/detail.json': RESIDENTS_DETAIL_DEFAULT,
  'residents/empty.json': RESIDENTS_EMPTY,
} as const;

export function residentsFixture(path: string): unknown | undefined {
  return RESIDENTS_CORPUS[path];
}

export function findResidentDetail(residentId: string): ResidentDetailResponse | undefined {
  return RESIDENT_DETAILS[residentId];
}
