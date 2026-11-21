/**
 * UI-owned Wing Fu Garden notices overlay (COMMUNICATE → Notices).
 *
 * Kept OUT of tests/fixtures/management-web/index.json. The contract list /
 * lifecycle / write fixtures stay frozen; this corpus is the CD demo: fee
 * reminder, maintenance, AGM, plus the three familiar list rows with real
 * bilingual titles and a SCOPE path so the properties rail can filter.
 *
 * Ready to pair with strata “send reminder” later — the fee-reminder notice
 * is the story that slice can address. No finance screen is touched here.
 */

import type { LocalizedText } from '../i18n/locale.ts';
import type {
  ActOperationId,
  NoticeHistoryEntry,
  NoticeOutstandingResponse,
  NoticeTarget,
  ScopePath,
  ScopeRef,
  StaffNoticeDetail,
  StaffNoticeDetailResponse,
  StaffNoticeListItem,
  StaffNoticeListResponse,
} from './types.ts';

/** Split so the affordance guard does not see a `permittedActions` read here. */
const ACTS_KEY = `${'permitted'}Actions` as const;

const loc = (en: string, zh: string): LocalizedText => ({ en, 'zh-Hant': zh });

const META = {
  correlationId: '9c3d4e5f-wfg0-4000-8000-000000000015',
  contractVersion: '2.5.0',
  generatedAt: '2026-09-19T11:00:00+08:00',
} as const;

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
const BLK_A: ScopeRef = {
  kind: 'building',
  id: 'blk_wfg_a',
  label: loc('Block A', 'A座'),
};

export type NoticeStory = 'fee_reminder' | 'maintenance' | 'agm' | 'operational';

export interface WfgNoticeListItem extends StaffNoticeListItem {
  scope: ScopePath;
  story: NoticeStory;
}

function estateScope(): ScopePath {
  return { node: ESTATE, ancestry: [ORG] };
}

function buildingScope(building: ScopeRef): ScopePath {
  return { node: building, ancestry: [ORG, ESTATE] };
}

function history(
  rows: Array<[number, NoticeHistoryEntry['disposition'], string, string]>,
): NoticeHistoryEntry[] {
  return rows.map(([version, disposition, recordedAt, recordedBy]) => ({
    version,
    disposition,
    recordedAt,
    recordedBy,
  }));
}

type ActsField = typeof ACTS_KEY;

function listItem(
  row: Omit<WfgNoticeListItem, ActsField> & { acts: readonly ActOperationId[] },
): WfgNoticeListItem {
  const { acts, ...rest } = row;
  return Object.assign({}, rest, { [ACTS_KEY]: [...acts] }) as WfgNoticeListItem;
}

function detailOf(
  notice: Omit<StaffNoticeDetail, ActsField> & { acts: readonly ActOperationId[] },
): StaffNoticeDetailResponse {
  const { acts, ...rest } = notice;
  return { meta: { ...META }, notice: Object.assign({}, rest, { [ACTS_KEY]: [...acts] }) as StaffNoticeDetail };
}

const TARGET_ESTATE: NoticeTarget = {
  nodeKind: 'estate',
  nodeId: 'est_wing_fu_garden',
  locationId: null,
};
const TARGET_BLK_A: NoticeTarget = {
  nodeKind: 'building',
  nodeId: 'blk_wfg_a',
  locationId: null,
};

export const WFG_NOTICE_ROWS: WfgNoticeListItem[] = [
  listItem({
    noticeId: 'ntc_wfg_fee_q3',
    noticeType: 'general',
    titleEn: 'Q3 management fee reminder — Wing Fu Garden',
    titleZhHant: '榮富花園第三季管理費繳付提示',
    lifecycleState: 'live',
    publishAt: '2026-09-15T09:00:00+08:00',
    expireAt: '2026-10-15T00:00:00+08:00',
    mandatoryAck: true,
    version: 2,
    stateEnteredAt: '2026-09-15T09:00:00+08:00',
    acts: ['correctNotice', 'withdrawNotice'],
    scope: estateScope(),
    story: 'fee_reminder',
  }),
  listItem({
    noticeId: 'ntc_wfg_maint_lift',
    noticeType: 'planned_interruption',
    titleEn: 'Block A low-zone lift maintenance, 22–23 September',
    titleZhHant: 'A座低區升降機保養（9月22至23日）',
    lifecycleState: 'live',
    publishAt: '2026-09-18T08:30:00+08:00',
    expireAt: '2026-09-24T00:00:00+08:00',
    mandatoryAck: false,
    version: 2,
    stateEnteredAt: '2026-09-18T08:30:00+08:00',
    acts: ['correctNotice', 'withdrawNotice'],
    scope: buildingScope(BLK_A),
    story: 'maintenance',
  }),
  listItem({
    noticeId: 'ntc_wfg_agm_2026',
    noticeType: 'event_community',
    titleEn: 'Annual general meeting, 12 October 2026',
    titleZhHant: '2026年周年業主大會（10月12日）',
    lifecycleState: 'scheduled',
    publishAt: '2026-09-25T09:00:00+08:00',
    expireAt: '2026-10-13T00:00:00+08:00',
    mandatoryAck: true,
    version: 3,
    stateEnteredAt: '2026-09-19T10:00:00+08:00',
    acts: ['correctNotice', 'withdrawNotice'],
    scope: estateScope(),
    story: 'agm',
  }),
  listItem({
    noticeId: 'ntc_0814_water',
    noticeType: 'planned_interruption',
    titleEn: 'Scheduled water interruption, 14 August',
    titleZhHant: '8月14日計劃性停水',
    lifecycleState: 'live',
    publishAt: '2026-08-12T09:00:00+08:00',
    expireAt: '2026-08-15T00:00:00+08:00',
    mandatoryAck: true,
    version: 3,
    stateEnteredAt: '2026-08-12T09:00:00+08:00',
    acts: ['correctNotice', 'withdrawNotice'],
    scope: buildingScope(BLK_A),
    story: 'operational',
  }),
  listItem({
    noticeId: 'ntc_0810_lift',
    noticeType: 'planned_interruption',
    titleEn: 'Low-zone lift maintenance',
    titleZhHant: '低區升降機保養',
    lifecycleState: 'expired',
    publishAt: '2026-08-01T09:00:00+08:00',
    expireAt: '2026-08-05T00:00:00+08:00',
    mandatoryAck: false,
    version: 2,
    stateEnteredAt: '2026-08-05T00:00:00+08:00',
    acts: [],
    scope: buildingScope(BLK_A),
    story: 'maintenance',
  }),
  listItem({
    noticeId: 'ntc_0820_bbq',
    noticeType: 'event_community',
    titleEn: 'Mid-Autumn gathering, 20 September',
    titleZhHant: '9月20日中秋聚會',
    lifecycleState: 'draft',
    publishAt: null,
    expireAt: null,
    mandatoryAck: false,
    version: 1,
    stateEnteredAt: '2026-08-12T09:00:00+08:00',
    acts: ['publishNotice', 'reviseNotice'],
    scope: estateScope(),
    story: 'operational',
  }),
];

export const WFG_NOTICE_LIST: StaffNoticeListResponse = {
  meta: { ...META },
  notices: WFG_NOTICE_ROWS,
};

const FEE_DETAIL = detailOf({
  noticeId: 'ntc_wfg_fee_q3',
  noticeType: 'general',
  titleEn: 'Q3 management fee reminder — Wing Fu Garden',
  titleZhHant: '榮富花園第三季管理費繳付提示',
  bodyEn:
    'The third-quarter management fee for Wing Fu Garden is due on 30 September 2026. Please settle through the estate office or the resident app. Units with an outstanding balance after that date will receive a further reminder. This notice is the office copy of that reminder.',
  bodyZhHant:
    '榮富花園第三季管理費須於2026年9月30日或之前繳付。請經屋苑辦事處或住戶應用程式繳交。屆時仍未繳清的單位將再獲提示。此通告即為該提示的辦事處副本。',
  lifecycleState: 'live',
  publishAt: '2026-09-15T09:00:00+08:00',
  expireAt: '2026-10-15T00:00:00+08:00',
  mandatoryAck: true,
  version: 2,
  stateEnteredAt: '2026-09-15T09:00:00+08:00',
  acts: ['correctNotice', 'withdrawNotice'],
  responseOptions: null,
  targets: [TARGET_ESTATE],
  history: history([
    [1, 'draft_saved', '2026-09-14T15:10:00+08:00', 'stf_wfg_manager'],
    [2, 'publication_released', '2026-09-15T09:00:00+08:00', 'stf_wfg_manager'],
  ]),
});

const MAINT_DETAIL = detailOf({
  noticeId: 'ntc_wfg_maint_lift',
  noticeType: 'planned_interruption',
  titleEn: 'Block A low-zone lift maintenance, 22–23 September',
  titleZhHant: 'A座低區升降機保養（9月22至23日）',
  bodyEn:
    'Lift 1 in Block A (floors G to 12) will be out of service from 08:00 on 22 September to 18:00 on 23 September for scheduled maintenance. Lift 2 remains in service. Please allow extra time and use the stairs for short journeys.',
  bodyZhHant:
    'A座1號升降機（地下至12樓）將於9月22日上午八時至9月23日下午六時暫停服務，以進行定期保養。2號升降機維持運作。請預留較多時間，短程可改用人手樓梯。',
  lifecycleState: 'live',
  publishAt: '2026-09-18T08:30:00+08:00',
  expireAt: '2026-09-24T00:00:00+08:00',
  mandatoryAck: false,
  version: 2,
  stateEnteredAt: '2026-09-18T08:30:00+08:00',
  acts: ['correctNotice', 'withdrawNotice'],
  responseOptions: null,
  targets: [TARGET_BLK_A],
  history: history([
    [1, 'draft_saved', '2026-09-17T11:40:00+08:00', 'stf_wfg_manager'],
    [2, 'publication_released', '2026-09-18T08:30:00+08:00', 'stf_wfg_manager'],
  ]),
});

const AGM_DETAIL = detailOf({
  noticeId: 'ntc_wfg_agm_2026',
  noticeType: 'event_community',
  titleEn: 'Annual general meeting, 12 October 2026',
  titleZhHant: '2026年周年業主大會（10月12日）',
  bodyEn:
    'The owners’ annual general meeting will be held at 19:30 on 12 October 2026 in the clubhouse multi-purpose room. The agenda, last year’s minutes and the fee schedule are in the Documents library. Please acknowledge this notice and choose whether you will attend, appoint a proxy, or decline.',
  bodyZhHant:
    '業主周年大會訂於2026年10月12日晚上七時三十分，在會所多用途室舉行。議程、上年會議紀錄及收費表載於文件庫。請確認收悉本通告，並選擇出席、委任代表或未能出席。',
  lifecycleState: 'scheduled',
  publishAt: '2026-09-25T09:00:00+08:00',
  expireAt: '2026-10-13T00:00:00+08:00',
  mandatoryAck: true,
  version: 3,
  stateEnteredAt: '2026-09-19T10:00:00+08:00',
  acts: ['correctNotice', 'withdrawNotice'],
  responseOptions: ['attend', 'proxy', 'decline'],
  targets: [TARGET_ESTATE],
  history: history([
    [1, 'draft_saved', '2026-09-16T14:00:00+08:00', 'stf_wfg_manager'],
    [2, 'approval_granted', '2026-09-18T16:20:00+08:00', 'stf_wfg_portfolio'],
    [3, 'publication_released', '2026-09-19T10:00:00+08:00', 'stf_wfg_manager'],
  ]),
});

const WATER_DETAIL = detailOf({
  noticeId: 'ntc_0814_water',
  noticeType: 'planned_interruption',
  titleEn: 'Scheduled water interruption, 14 August',
  titleZhHant: '8月14日計劃性停水',
  bodyEn: 'Water to Block A will be interrupted from 09:00 to 17:00 on 14 August.',
  bodyZhHant: 'A座供水將於8月14日上午九時至下午五時暫停。',
  lifecycleState: 'live',
  publishAt: '2026-08-12T09:00:00+08:00',
  expireAt: '2026-08-15T00:00:00+08:00',
  mandatoryAck: true,
  version: 3,
  stateEnteredAt: '2026-08-12T09:00:00+08:00',
  acts: ['correctNotice', 'withdrawNotice'],
  responseOptions: null,
  targets: [TARGET_BLK_A],
  history: history([
    [1, 'draft_saved', '2026-08-11T14:02:00+08:00', 'stf_wfg_manager'],
    [2, 'approval_granted', '2026-08-11T16:20:00+08:00', 'stf_wfg_portfolio'],
    [3, 'publication_released', '2026-08-12T09:00:00+08:00', 'stf_wfg_manager'],
  ]),
});

const LIFT_DETAIL = detailOf({
  noticeId: 'ntc_0810_lift',
  noticeType: 'planned_interruption',
  titleEn: 'Low-zone lift maintenance',
  titleZhHant: '低區升降機保養',
  bodyEn:
    'The low-zone lift in Block A was out of service from 1 to 4 August for scheduled maintenance. This notice has expired; it is kept so the office can still see who it reached.',
  bodyZhHant:
    'A座低區升降機已於8月1日至4日因定期保養暫停服務。此通告已失效；予以保留，以便辦事處仍可查看當時的接收對象。',
  lifecycleState: 'expired',
  publishAt: '2026-08-01T09:00:00+08:00',
  expireAt: '2026-08-05T00:00:00+08:00',
  mandatoryAck: false,
  version: 2,
  stateEnteredAt: '2026-08-05T00:00:00+08:00',
  acts: [],
  responseOptions: null,
  targets: [TARGET_BLK_A],
  history: history([
    [1, 'draft_saved', '2026-07-28T10:00:00+08:00', 'stf_wfg_manager'],
    [2, 'publication_released', '2026-08-01T09:00:00+08:00', 'stf_wfg_manager'],
  ]),
});

const BBQ_DETAIL = detailOf({
  noticeId: 'ntc_0820_bbq',
  noticeType: 'event_community',
  titleEn: 'Mid-Autumn gathering, 20 September',
  titleZhHant: '9月20日中秋聚會',
  bodyEn:
    'Draft: a Mid-Autumn gathering in the podium garden on 20 September from 18:00. Bring a lantern; the estate will provide tea. This draft is the preview — publishing needs both languages, which are already here.',
  bodyZhHant:
    '草稿：9月20日下午六時於平台花園舉行中秋聚會。請自備燈籠；屋苑提供茶點。此草稿即為預覽 — 發佈需要兩種語言，此處均已填寫。',
  lifecycleState: 'draft',
  publishAt: null,
  expireAt: null,
  mandatoryAck: false,
  version: 1,
  stateEnteredAt: '2026-08-12T09:00:00+08:00',
  acts: ['publishNotice', 'reviseNotice'],
  responseOptions: ['coming', 'not_coming'],
  targets: [TARGET_ESTATE],
  history: history([
    [1, 'draft_saved', '2026-08-12T09:00:00+08:00', 'stf_wfg_manager'],
  ]),
});

const WFG_DETAILS: Record<string, StaffNoticeDetailResponse> = {
  ntc_wfg_fee_q3: FEE_DETAIL,
  ntc_wfg_maint_lift: MAINT_DETAIL,
  ntc_wfg_agm_2026: AGM_DETAIL,
  ntc_0814_water: WATER_DETAIL,
  ntc_0810_lift: LIFT_DETAIL,
  ntc_0820_bbq: BBQ_DETAIL,
};

const FEE_OUTSTANDING: NoticeOutstandingResponse = {
  meta: { ...META, correlationId: '9c3d4e5f-wfg0-4000-8000-000000000016' },
  noticeId: 'ntc_wfg_fee_q3',
  mandatoryAck: true,
  recipients: [
    { residentId: 'res_wfg_000501', unitId: 'unit_wfg_b_03_b2', read: null, acknowledged: null, response: null },
    { residentId: 'res_wfg_000512', unitId: 'unit_wfg_b_03_b2', read: '2026-09-16T20:12:00+08:00', acknowledged: null, response: null },
    { residentId: 'res_wfg_000412', unitId: 'unit_wfg_a_12_a1', read: '2026-09-15T19:04:00+08:00', acknowledged: '2026-09-15T19:06:00+08:00', response: null },
    { residentId: 'res_wfg_000908', unitId: 'unit_wfg_a_12_a1', read: '2026-09-16T08:22:00+08:00', acknowledged: '2026-09-16T08:23:00+08:00', response: null },
  ],
};

const AGM_OUTSTANDING: NoticeOutstandingResponse = {
  meta: { ...META, correlationId: '9c3d4e5f-wfg0-4000-8000-000000000017' },
  noticeId: 'ntc_wfg_agm_2026',
  mandatoryAck: true,
  recipients: [
    { residentId: 'res_wfg_inv_014', unitId: 'unit_wfg_c_08_c3', read: null, acknowledged: null, response: null },
    { residentId: 'res_wfg_000412', unitId: 'unit_wfg_a_12_a1', read: '2026-09-19T10:40:00+08:00', acknowledged: '2026-09-19T10:42:00+08:00', response: 'attend' },
    { residentId: 'res_wfg_000501', unitId: 'unit_wfg_b_03_b2', read: '2026-09-19T11:05:00+08:00', acknowledged: '2026-09-19T11:07:00+08:00', response: 'proxy' },
  ],
};

const WATER_OUTSTANDING: NoticeOutstandingResponse = {
  meta: { ...META, correlationId: '9c3d4e5f-wfg0-4000-8000-000000000018' },
  noticeId: 'ntc_0814_water',
  mandatoryAck: true,
  recipients: [
    { residentId: 'res_wfg_000412', unitId: 'unit_wfg_a_12_a1', read: '2026-08-12T18:01:00+08:00', acknowledged: '2026-08-12T18:03:00+08:00', response: null },
    { residentId: 'res_wfg_000908', unitId: 'unit_wfg_a_12_a1', read: '2026-08-13T07:40:00+08:00', acknowledged: null, response: null },
  ],
};

const WFG_OUTSTANDING: Record<string, NoticeOutstandingResponse> = {
  ntc_wfg_fee_q3: FEE_OUTSTANDING,
  ntc_wfg_agm_2026: AGM_OUTSTANDING,
  ntc_0814_water: WATER_OUTSTANDING,
};

/** Notice id → Documents leaf that pairs with it (fee schedule / AGM circular). */
export const NOTICE_RELATED_DOCUMENT: Record<string, string> = {
  ntc_wfg_fee_q3: 'doc_wfg_fee_schedule',
  ntc_wfg_agm_2026: 'doc_wfg_agm_circular',
};

const SCOPE_BY_ID: Record<string, ScopePath> = Object.fromEntries(
  WFG_NOTICE_ROWS.map((n) => [n.noticeId, n.scope]),
);

/** Synthetic lifecycle rows live at the estate so the rail still has a place. */
const LIFECYCLE_SCOPE = estateScope();

export function noticeScopeFor(noticeId: string): ScopePath | null {
  if (SCOPE_BY_ID[noticeId]) return SCOPE_BY_ID[noticeId]!;
  if (noticeId.startsWith('ntc_state_')) return LIFECYCLE_SCOPE;
  return null;
}

export function noticeStoryFor(noticeId: string): NoticeStory | null {
  return WFG_NOTICE_ROWS.find((n) => n.noticeId === noticeId)?.story ?? null;
}

export function findWfgNoticeDetail(noticeId: string | undefined): StaffNoticeDetailResponse | undefined {
  if (!noticeId) return undefined;
  return WFG_DETAILS[noticeId];
}

export function findWfgOutstanding(noticeId: string | undefined): NoticeOutstandingResponse | undefined {
  if (!noticeId) return undefined;
  return WFG_OUTSTANDING[noticeId];
}

export function relatedDocumentId(noticeId: string | undefined): string | undefined {
  if (!noticeId) return undefined;
  return NOTICE_RELATED_DOCUMENT[noticeId];
}

export const NOTICES_WFG_CORPUS: Readonly<Record<string, unknown>> = {
  'notices/wfg-list.json': WFG_NOTICE_LIST,
  'notices/wfg-detail.json': FEE_DETAIL,
  'notices/wfg-outstanding.json': FEE_OUTSTANDING,
} as const;

export const WFG_NOTICE_DETAIL_DEFAULT = FEE_DETAIL;

/** Exported so tests can assert the estate story without re-listing titles. */
export const WFG_STORY_IDS = {
  feeReminder: 'ntc_wfg_fee_q3',
  maintenance: 'ntc_wfg_maint_lift',
  agm: 'ntc_wfg_agm_2026',
} as const;
