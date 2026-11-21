/**
 * UI-owned Documents library (COMMUNICATE → Documents).
 *
 * Light fixture corpus: circulars, house rules, and a fee-schedule PDF stub
 * for Wing Fu Garden. No listDocuments / getDocument operation in the
 * management contract under v0 freeze — page fixtures only. SCOPE rail
 * filters rows that already carry a place.
 *
 * The fee schedule pairs with the notices fee-reminder story; the AGM
 * circular pairs with the AGM notice. Strata “send reminder” can point at
 * the same fee-schedule stub later. No finance screen is touched here.
 */

import type { LocalizedText } from '../i18n/locale.ts';
import type { ScopePath, ScopeRef } from './types.ts';

const loc = (en: string, zh: string): LocalizedText => ({ en, 'zh-Hant': zh });

export type DocumentKind = 'circular' | 'house_rules' | 'fee_schedule';
export type DocumentStatus = 'current' | 'superseded';

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

function estateScope(): ScopePath {
  return { node: ESTATE, ancestry: [ORG] };
}

function buildingScope(building: ScopeRef): ScopePath {
  return { node: building, ancestry: [ORG, ESTATE] };
}

export interface DocumentStub {
  fileName: string;
  mime: 'application/pdf';
  pages: number;
  sizeLabel: LocalizedText;
}

export interface DocumentRow {
  documentId: string;
  kind: DocumentKind;
  status: DocumentStatus;
  title: LocalizedText;
  publishedOn: string;
  scope: ScopePath;
  placeSummary: LocalizedText;
  stub: DocumentStub;
  summary: LocalizedText;
  relatedNoticeId?: string;
}

const FEE_SCHEDULE: DocumentRow = {
  documentId: 'doc_wfg_fee_schedule',
  kind: 'fee_schedule',
  status: 'current',
  title: loc('Management fee schedule 2026/27', '2026/27 年度管理費收費表'),
  publishedOn: '2026-04-01',
  scope: estateScope(),
  placeSummary: loc('Wing Fu Garden', '榮富花園'),
  stub: {
    fileName: 'WFG-fee-schedule-2026-27.pdf',
    mime: 'application/pdf',
    pages: 4,
    sizeLabel: loc('180 KB · PDF stub', '180 KB · PDF 代用檔'),
  },
  summary: loc(
    'Quarterly management fee by unit class. The Q3 fee-reminder notice points here. A later strata slice can send the same reminder without inventing a second schedule.',
    '按單位類別列出每季管理費。第三季繳費提示通告指向此表。稍後的業主立案法團付款切片可重用同一提示，無需另編收費表。',
  ),
  relatedNoticeId: 'ntc_wfg_fee_q3',
};

const HOUSE_RULES: DocumentRow = {
  documentId: 'doc_wfg_house_rules',
  kind: 'house_rules',
  status: 'current',
  title: loc('House rules — Wing Fu Garden', '榮富花園屋苑守則'),
  publishedOn: '2025-01-15',
  scope: estateScope(),
  placeSummary: loc('Wing Fu Garden', '榮富花園'),
  stub: {
    fileName: 'WFG-house-rules-2025.pdf',
    mime: 'application/pdf',
    pages: 12,
    sizeLabel: loc('420 KB · PDF stub', '420 KB · PDF 代用檔'),
  },
  summary: loc(
    'Quiet hours, common-area use, renovation notice, and pet rules. Issued by the management office; the 2019 edition is superseded.',
    '訂明寧靜時段、公用地方使用、裝修預告及寵物守則。由管理處發出；2019年版已予取代。',
  ),
};

const HOUSE_RULES_2019: DocumentRow = {
  documentId: 'doc_wfg_house_rules_2019',
  kind: 'house_rules',
  status: 'superseded',
  title: loc('House rules 2019 (superseded)', '2019年屋苑守則（已取代）'),
  publishedOn: '2019-03-01',
  scope: estateScope(),
  placeSummary: loc('Wing Fu Garden', '榮富花園'),
  stub: {
    fileName: 'WFG-house-rules-2019.pdf',
    mime: 'application/pdf',
    pages: 10,
    sizeLabel: loc('310 KB · PDF stub', '310 KB · PDF 代用檔'),
  },
  summary: loc(
    'Previous house rules. Kept for the office record. The current edition is House rules — Wing Fu Garden.',
    '先前的屋苑守則，留作辦事處紀錄。現行版本為「榮富花園屋苑守則」。',
  ),
};

const AGM_CIRCULAR: DocumentRow = {
  documentId: 'doc_wfg_agm_circular',
  kind: 'circular',
  status: 'current',
  title: loc('AGM 2026 circular and agenda', '2026年周年大會通函及議程'),
  publishedOn: '2026-09-19',
  scope: estateScope(),
  placeSummary: loc('Wing Fu Garden', '榮富花園'),
  stub: {
    fileName: 'WFG-AGM-2026-circular.pdf',
    mime: 'application/pdf',
    pages: 6,
    sizeLabel: loc('240 KB · PDF stub', '240 KB · PDF 代用檔'),
  },
  summary: loc(
    'Notice of meeting, agenda, last year’s minutes extract, and proxy form. Pairs with the scheduled AGM notice.',
    '會議通知、議程、上年會議紀錄摘錄及委任表格。與已排期的周年大會通告配對。',
  ),
  relatedNoticeId: 'ntc_wfg_agm_2026',
};

const WATER_CIRCULAR: DocumentRow = {
  documentId: 'doc_wfg_water_circular',
  kind: 'circular',
  status: 'current',
  title: loc('Block A water interruption circular', 'A座停水通函'),
  publishedOn: '2026-08-12',
  scope: buildingScope(BLK_A),
  placeSummary: loc('Block A', 'A座'),
  stub: {
    fileName: 'WFG-Block-A-water-14-Aug.pdf',
    mime: 'application/pdf',
    pages: 2,
    sizeLabel: loc('90 KB · PDF stub', '90 KB · PDF 代用檔'),
  },
  summary: loc(
    'Printed circular posted in Block A lift lobbies for the 14 August water interruption.',
    '就8月14日停水張貼於A座升降機大堂的印刷通函。',
  ),
  relatedNoticeId: 'ntc_0814_water',
};

export const DOCUMENT_ROWS: DocumentRow[] = [
  FEE_SCHEDULE,
  AGM_CIRCULAR,
  HOUSE_RULES,
  WATER_CIRCULAR,
  HOUSE_RULES_2019,
];

export const DOCUMENT_KINDS: readonly DocumentKind[] = ['circular', 'house_rules', 'fee_schedule'];
export const DOCUMENT_STATUSES: readonly DocumentStatus[] = ['current', 'superseded'];

export const DOCUMENT_DETAIL_DEFAULT = FEE_SCHEDULE;

export function findDocument(documentId: string | undefined): DocumentRow | undefined {
  if (!documentId) return undefined;
  return DOCUMENT_ROWS.find((d) => d.documentId === documentId);
}

export function documentsRelatedNotice(documentId: string | undefined): string | undefined {
  return findDocument(documentId)?.relatedNoticeId;
}
