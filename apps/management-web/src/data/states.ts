/**
 * THE STATE REGISTRY — the specification for state coverage, in one place.
 *
 * Sources, both of which are needed because neither contains the other:
 *   - DOC-014-ST section 2.2, the states the design export does NOT show. The
 *     PID names this as the specification; the states the export does show are
 *     the easy half.
 *   - Design system v2.0 section 18, what every implemented screen must define.
 *
 * Four kinds, and the last two are the point:
 *   fixture     a committed fixture renders it
 *   problem     a committed Problem fixture renders it
 *   client-only no server response exists — declared as such in the corpus
 *               manifest with a reason, not invented here
 *   no-fixture  THE CONTRACT DESCRIBES IT AND THE CORPUS HAS NO EXAMPLE.
 *               Rendered as an explicit absence. Nothing is invented to fill it,
 *               because a screen that needs data no fixture provides is a
 *               contract finding and is worth more reported than worked around.
 *
 * Write-dependent states from section 18 — confirmation, action failure, success —
 * arrived with UI-051 against contract 2.1.0, as the `s5compose` and `s5act`
 * screens below. A fifth kind, `client-form`, names the one state a write surface
 * has that no server response describes: the author's own form before any request.
 */

import { copy, type LocalizedText } from '../i18n/locale.ts';

const m = copy;

export type StateKind = 'fixture' | 'problem' | 'client-only' | 'no-fixture' | 'client-form';

export interface ScreenState {
  id: string;
  kind: StateKind;
  /** Corpus path for `fixture` and `problem`. */
  file?: string;
  /** For `no-fixture`: what the contract describes and the corpus lacks. */
  missing?: LocalizedText;
  /** For `client-form`: why no server response can describe it. */
  reason?: LocalizedText;
}

export type ScreenId = 's1' | 's2' | 's3' | 's4' | 's5' | 's5detail' | 's5ack' | 's5compose' | 's5act' | 'visitorLog' | 'visitorRegister' | 'visitorCounter' | 'residents' | 'residentsDetail' | 'households' | 'householdsDetail' | 'helpdesk' | 'helpdeskDetail' | 'adminUsers' | 'adminUsersDetail' | 'adminGroups' | 'adminGroupsDetail' | 'adminRoles' | 'adminEmail' | 'adminLists' | 'adminAudit' | 'bookings' | 'bookingsDetail' | 'bookingCalendar' | 'bookingCheckin' | 'bookingFacilities' | 'bookingFacilitiesDetail' | 'bookingRates' | 'reports' | 'charges' | 'chargesDetail' | 'payments' | 'paymentsDetail' | 'refunds' | 'refundsDetail' | 'documents' | 'documentsDetail' | 'carPark' | 'integrationStatus' | 'integrationStatusDetail';

/** The seven transitions and their recorded request/response fixture pairs. */
const TRANSITION_VERBS = ['revise', 'submit', 'approve', 'decline', 'publish', 'correct', 'withdraw'] as const;

/** Applies to every screen: the four the export shows on none of them. */
const COMMON: ScreenState[] = [
  { id: 'loading', kind: 'client-only' },
  { id: 'offline', kind: 'client-only' },
  { id: 'error', kind: 'problem', file: 'problems/internal-error.json' },
  { id: 'session-expired', kind: 'problem', file: 'problems/session-expired.json' },
  { id: 'invalid-credential', kind: 'problem', file: 'problems/invalid-credential.json' },
  { id: 'denied', kind: 'problem', file: 'problems/insufficient-scope.json' },
];

export const SCREENS: Record<ScreenId, { operationIds: string[]; states: ScreenState[] }> = {
  s1: {
    operationIds: ['listSafetyEvents', 'getSafetyEvent', 'getSafetyEventDelivery', 'getSafetyEventSource'],
    states: [
      { id: 'default', kind: 'fixture', file: 'mob-s1-safety/default.json' },
      { id: 'empty', kind: 'fixture', file: 'mob-s1-safety/empty.json' },
      { id: 'partial', kind: 'fixture', file: 'mob-s1-safety/partial.json' },
      { id: 'detail', kind: 'fixture', file: 'mob-s1-safety/detail.json' },
      { id: 'delivery', kind: 'fixture', file: 'mob-s1-safety/delivery.json' },
      { id: 'source', kind: 'fixture', file: 'mob-s1-safety/source.json' },
      { id: 'source-unmapped', kind: 'fixture', file: 'mob-s1-safety/source-unmapped.json' },
      { id: 'restricted', kind: 'problem', file: 'problems/restricted-projection.json' },
      { id: 'scope-not-found', kind: 'problem', file: 'problems/scope-not-found.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
      // `severity-coverage` was a no-fixture panel here until API-020-ST. All
      // seven levels now appear in the corpus — `normal` in default.json and
      // resolved.json, `information` and `offline` in partial.json — so the
      // panel was removed rather than left saying something untrue.
      { id: 'resolved', kind: 'fixture', file: 'mob-s1-safety/resolved.json' },
      {
        id: 'communication-coverage',
        kind: 'no-fixture',
        missing: m(
          'A safety event whose communication state is update-overdue. The contract carries seven communication states and the corpus now exercises six; only update-overdue has no row, so it cannot be shown without inventing an event.',
          '通訊狀態為「更新逾期」的安全事件。合約共有七種通訊狀態，資料集現已涵蓋其中六種，僅「更新逾期」並無相關記錄，故無法在不虛構事件的情況下呈現。',
          '通讯状态为“更新逾期”的安全事件。合约共有七种通讯状态，数据集现已涵盖其中六种，仅“更新逾期”并无相关记录，故无法在不虚构事件的情况下呈现。',
        ),
      },
      {
        id: 'zero-recipients',
        kind: 'no-fixture',
        missing: m(
          'An event with no authorized recipients. DOC-014-ST section 2.2 records it as a state the export never draws, and the corpus has no delivery fixture with an empty recipient list.',
          '沒有任何獲授權接收者的事件。DOC-014-ST 第 2.2 節記錄此狀態從未在設計稿中呈現，而資料集亦無接收者名單為空的傳送記錄。',
          '没有任何获授权接收者的事件。DOC-014-ST 第 2.2 节记录此状态从未在设计稿中呈现，而数据集亦无接收者名单为空的发送记录。',
        ),
      },
    ],
  },

  s2: {
    operationIds: ['getOverview'],
    states: [
      { id: 'default', kind: 'fixture', file: 'mob-s2-overview/default.json' },
      {
        id: 'empty-attention',
        kind: 'no-fixture',
        missing: m(
          'An empty attention queue — nothing needing attention, and all feeds working. DOC-014-ST section 2.2 records both as absent from the export, and the corpus carries only the populated case.',
          '待跟進清單為空的狀態，即沒有任何項目需要跟進且所有連接系統運作正常。DOC-014-ST 第 2.2 節記錄兩者均未在設計稿中呈現，資料集亦只包含有內容的情況。',
          '待跟进列表为空的状态，即没有任何项目需要跟进且所有连接系统运作正常。DOC-014-ST 第 2.2 节记录两者均未在设计稿中呈现，数据集亦只包含有内容的情况。',
        ),
      },
      // `feed-unavailable` was a no-fixture panel until API-020-ST supplied one.
      // The two states are different claims: `unavailable` means the exchange
      // failed; `unknown` carries lastExchangeAt null because nothing has been
      // heard at all, so there is no exchange to report.
      { id: 'integration-down', kind: 'fixture', file: 'mob-s2-overview/integration-down.json' },
    ],
  },

  s3: {
    operationIds: ['getPropertyTree', 'getUnitDetail'],
    states: [
      { id: 'tree', kind: 'fixture', file: 'mob-s3-properties/tree.json' },
      { id: 'unit', kind: 'fixture', file: 'mob-s3-properties/unit.json' },
      { id: 'scope-not-found', kind: 'problem', file: 'problems/scope-not-found.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
      {
        id: 'unmapped-unit',
        kind: 'no-fixture',
        missing: m(
          'A unit that matches no source node, and a unit with no household. DOC-014-ST section 2.2 lists both; the corpus carries one unit and it is mapped and occupied.',
          '未能配對任何來源節點的單位，以及沒有住戶的單位。DOC-014-ST 第 2.2 節列出兩者，惟資料集只有一個單位，且該單位已配對並有人居住。',
          '未能配对任何来源节点的单元，以及没有住户的单元。DOC-014-ST 第 2.2 节列出两者，惟数据集只有一个单元，且该单元已配对并有人居住。',
        ),
      },
    ],
  },

  s4: {
    operationIds: ['listCases'],
    states: [
      { id: 'default', kind: 'fixture', file: 'mob-s4-cases/default.json' },
      { id: 'empty', kind: 'fixture', file: 'mob-s4-cases/empty.json' },
      { id: 'scope-not-found', kind: 'problem', file: 'problems/scope-not-found.json' },
      {
        id: 'case-detail',
        kind: 'no-fixture',
        missing: m(
          'A case detail view. The export renders the row as a link and never designs the destination — DOC-014-ST records it as WEB-07 — and the contract has no case-detail operation. There is nothing to render and nothing has been designed here in its place.',
          '個案詳情畫面。設計稿將該行呈現為連結，但從未設計其目的地畫面（DOC-014-ST 記錄為 WEB-07），合約亦無個案詳情的讀取操作。此處無內容可供呈現，本畫面亦未自行設計替代方案。',
          '案件详情页面。设计稿将该行呈现为连结，但从未设计其目的地页面（DOC-014-ST 记录为 WEB-07），合约亦无案件详情的读取操作。此处无内容可供呈现，本页面亦未自行设计替代方案。',
        ),
      },
    ],
  },

  /**
   * NOTICES, three views (UI-045). They are three SCREENS in the state matrix and
   * one NAV ENTRY: `NAV` in Shell.tsx lists what a person clicks, `SCREENS` lists
   * what the URL can construct, and the two were never required to be the same
   * list. Detail and outstanding are reached from the list, so adding nav rows for
   * them would put three entries where the design has one.
   */
  s5: {
    operationIds: ['listNotices'],
    states: [
      { id: 'wfg', kind: 'fixture', file: 'notices/wfg-list.json' },
      { id: 'list', kind: 'fixture', file: 'mob-s5-notices/list.json' },
      { id: 'lifecycle', kind: 'fixture', file: 'mob-s5-notices/lifecycle.json' },
      {
        id: 'empty',
        kind: 'no-fixture',
        missing: m(
          'A notices list with no notices in it. The corpus carries two populated list fixtures and no empty one, and an empty list cannot be derived from a populated one without inventing the server response that produced it.',
          '沒有任何通告的清單。資料集載有兩個有內容的清單記錄，但並無空白清單記錄；若無伺服器回應作依據，不能從有內容的清單推導出空白清單。',
          '没有任何公告的列表。数据集载有两个有内容的列表记录，但并无空白列表记录；若无服务器回应作依据，不能从有内容的列表推导出空白列表。',
        ),
      },
    ],
  },

  s5detail: {
    operationIds: ['getNotice'],
    states: [
      { id: 'detail', kind: 'fixture', file: 'mob-s5-notices/detail.json' },
      {
        id: 'draft-preview',
        kind: 'no-fixture',
        missing: m(
          'One notice, in draft, whose detail IS the COM-05 preview. The only detail fixture is a live notice; the draft rows in the corpus are LIST rows, which carry neither body language and so cannot be shown as a detail.',
          '一份處於草稿狀態的通告詳情，該詳情即為 COM-05 預覽。資料集中唯一的詳情記錄為生效中的通告；資料集內的草稿項目屬清單項目，並不載有任何語言的內文，故無法以詳情形式呈現。',
          '一份处于草稿状态的公告详情，该详情即为 COM-05 预览。数据集中唯一的详情记录为生效中的公告；数据集内的草稿项目属列表项目，并不载有任何语言的内文，故无法以详情形式呈现。',
        ),
      },
      {
        id: 'empty',
        kind: 'no-fixture',
        missing: m(
          'Not applicable: one notice is either returned or it is not. A detail read has no empty result — a notice the caller cannot see is a 404 by contract, which is the not-found state, not an empty one.',
          '不適用：通告詳情只有傳回或不傳回兩種情況，並無「空白」結果。按合約，查閱者無法查閱的通告會傳回 404，即「找不到」狀態，而非空白狀態。',
          '不适用：公告详情只有返回或不返回两种情况，并无“空白”结果。按合约，查阅者无法查阅的公告会返回 404，即“找不到”状态，而非空白状态。',
        ),
      },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
      // 2.2.0: getNotice's own 404 — out of scope and does-not-exist are one answer.
      { id: 'notice-not-found', kind: 'problem', file: 'notices/refusal-not-found.json' },
    ],
  },

  s5ack: {
    operationIds: ['getNoticeOutstanding'],
    states: [
      // UI-045 G1 CLOSED by GEN-047: the operation has its fixture, and the screen
      // that was a stated gap is now a renderer. The `empty` gap below stays, because
      // it is still true.
      { id: 'outstanding', kind: 'fixture', file: 'notices/outstanding.json' },
      {
        id: 'empty',
        kind: 'no-fixture',
        missing: m(
          'A notice whose audience resolved to nobody. It needs the same absent fixture as the populated case, and one cannot be derived from the other.',
          '接收對象結果為零的通告。此情況與有內容的情況同樣欠缺記錄，且兩者不能互相推導。',
          '接收对象结果为零的公告。此情况与有内容的情况同样欠缺记录，且两者不能互相推导。',
        ),
      },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  /**
   * COMPOSE (UI-051 D2). Entered from a scope node whose permittedActions lists
   * composeNotice. `blank` is the author's empty form — the one state a write
   * surface has that no response describes, and also the pre-act bilingual-missing
   * state, since both languages are missing until typed. `prefilled` renders the
   * recorded request, field for field; `created` the recorded response; `refused`
   * the recorded out-of-scope refusal.
   */
  s5compose: {
    operationIds: ['composeNotice'],
    states: [
      {
        id: 'blank',
        kind: 'client-form',
        reason: m(
          'The author’s empty form. No server response describes a form nobody has submitted; both languages are missing until they are typed, which is the pre-act bilingual-missing state.',
          '撰寫者的空白表格。尚未提交的表格並無任何伺服器回應可供描述；兩種語言在輸入前均屬缺漏，此即為執行前的雙語缺漏狀態。',
          '撰写者的空白表格。尚未提交的表格并无任何服务器回应可供描述；两种语言在输入前均属缺漏，此即为执行前的双语缺漏状态。',
        ),
      },
      { id: 'prefilled', kind: 'fixture', file: 'notices/compose-request.json' },
      { id: 'created', kind: 'fixture', file: 'notices/compose.json' },
      { id: 'refused', kind: 'problem', file: 'notices/refusal-out-of-scope.json' },
      { id: 'schedule-inverted', kind: 'problem', file: 'notices/refusal-schedule-inverted.json' },
    ],
  },

  /**
   * TRANSITIONS (UI-051 D3). One confirm state per act, prefilled from the recorded
   * request; one recorded state per act, rendering the recorded response; the two
   * recorded refusals; and the refusal the contract describes that the corpus
   * does not carry, stated as a gap rather than invented.
   */
  s5act: {
    operationIds: [...TRANSITION_VERBS.map((v) => `${v}Notice`)],
    states: [
      ...TRANSITION_VERBS.map((v) => ({ id: v, kind: 'fixture' as const, file: `notices/${v}-request.json` })),
      ...TRANSITION_VERBS.map((v) => ({ id: `${v}-recorded`, kind: 'fixture' as const, file: `notices/${v}.json` })),
      // 2.2.0 (GEN-052, closing UI-051 G2): stale-version has its own relabelled fixture
      // and wrong-state is a real wrong-state refusal. Distinguished by TYPE.
      { id: 'stale-version', kind: 'problem', file: 'notices/refusal-stale-version.json' },
      { id: 'wrong-state', kind: 'problem', file: 'notices/refusal-wrong-state.json' },
      { id: 'out-of-scope', kind: 'problem', file: 'notices/refusal-out-of-scope.json' },
      { id: 'approval-required', kind: 'problem', file: 'notices/refusal-approval-required.json' },
      { id: 'retargeting-forbidden', kind: 'problem', file: 'notices/refusal-retargeting-forbidden.json' },
      { id: 'empty-audience', kind: 'problem', file: 'notices/refusal-empty-audience.json' },
      // UI-051 G1 CLOSED by GEN-052: the corpus now carries the publish refusal for a
      // half-translated notice, so the post-act bilingual-missing state renders from
      // its recorded fixture rather than as a declared gap.
      { id: 'incomplete-translation', kind: 'problem', file: 'notices/refusal-incomplete-translation.json' },
    ],
  },

  /**
   * VISITORS P0 — page fixtures only. No list/write operation in the management
   * contract under v0 freeze; bodies render from src/data/visitor-fixtures.ts.
   */
  visitorLog: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Visitor log page fixture (design demo rows). No listVisitors operation in v0 freeze.',
          '訪客紀錄頁面固定資料（設計示範列）。v0 凍結範圍內並無 listVisitors 操作。',
          '访客记录页面固定数据（设计演示列）。v0 冻结范围内并无 listVisitors 操作。',
        ),
      },
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Visitor detail from the same page fixture corpus. Check-out is fixture-local only.',
          '同一頁面固定資料集的訪客詳情。簽出僅在固定資料模式下本機生效。',
          '同一页面固定数据集的访客详情。签出仅在固定数据模式下本机生效。',
        ),
      },
    ],
  },

  visitorCounter: {
    operationIds: [],
    states: [
      {
        id: 'walk-in',
        kind: 'client-form',
        reason: m(
          'Front counter, walk-in path. Check in creates a visit in the fixture client; no visitor write API is live yet.',
          '服務櫃檯即場登記。登記入場會在固定資料客戶端建立到訪紀錄；訪客寫入 API 尚未上線。',
          '前台现场登记。登记入场会在固定数据客户端建立到访记录；访客写入 API 尚未上线。',
        ),
      },
      {
        id: 'pass',
        kind: 'client-form',
        reason: m(
          'Front counter, pre-registered path. Verify is a dry run; Check in redeems one use per request key. Fixture client only.',
          '服務櫃檯已預先登記途徑。驗證為試行檢查；登記入場會以請求金鑰扣減一次使用。僅限固定資料客戶端。',
          '前台已预先登记途径。验证为试行检查；登记入场会以请求金钥扣减一次使用。仅限固定数据客户端。',
        ),
      },
    ],
  },

  visitorRegister: {
    operationIds: [],
    states: [
      {
        id: 'blank',
        kind: 'client-form',
        reason: m(
          'Register / pre-register form. Submit is a stub — no visitor write API in v0 freeze.',
          '登記 / 預先登記表格。提交為 Stub — v0 凍結範圍內並無訪客寫入 API。',
          '登记 / 预先登记表格。提交为 Stub — v0 冻结范围内并无访客写入 API。',
        ),
      },
    ],
  },

  /**
   * RESIDENTS (WEB-05). Fixture-first directory under Properties. UI-owned corpus
   * until listResidents / getResident are contracted — see
   * docs/contracts/proposed-residents-read-ops.md. operationIds empty on purpose.
   */
  residents: {
    operationIds: [],
    states: [
      { id: 'list', kind: 'fixture', file: 'residents/list.json' },
      { id: 'empty', kind: 'fixture', file: 'residents/empty.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  residentsDetail: {
    operationIds: [],
    states: [
      { id: 'detail', kind: 'fixture', file: 'residents/detail.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },
  /**
   * HOUSEHOLDS (WEB-04). Fixture-first composition under Properties. UI-owned
   * corpus until listHouseholds / getHousehold are contracted — see
   * docs/contracts/proposed-households-read-ops.md. operationIds empty on purpose.
   */
  households: {
    operationIds: [],
    states: [
      { id: 'list', kind: 'fixture', file: 'households/list.json' },
      { id: 'empty', kind: 'fixture', file: 'households/empty.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  householdsDetail: {
    operationIds: [],
    states: [
      { id: 'detail', kind: 'fixture', file: 'households/detail.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  /**
   * HELP DESK (OPERATE). Page fixtures only — no queue/contact operation in the
   * management contract under v0 freeze. See
   * docs/contracts/proposed-helpdesk-read-ops.md. operationIds empty on purpose.
   */
  helpdesk: {
    operationIds: [],
    states: [
      {
        id: 'queue',
        kind: 'client-form',
        reason: m(
          'Help desk live queue page fixture (design demo rows). No listHelpdeskQueue operation in v0 freeze.',
          '服務台即時佇列頁面固定資料（設計示範列）。v0 凍結範圍內並無 listHelpdeskQueue 操作。',
          '服务台即时队列页面固定数据（设计演示列）。v0 冻结范围内并无 listHelpdeskQueue 操作。',
        ),
      },
      {
        id: 'empty',
        kind: 'client-form',
        reason: m(
          'Help desk empty queue fixture state. Same page corpus; no contacts waiting.',
          '服務台空佇列固定狀態。同一頁面資料集；沒有等候中的聯絡。',
          '服务台空队列固定状态。同一页面数据集；没有等候中的联络。',
        ),
      },
      {
        id: 'partial',
        kind: 'client-form',
        reason: m(
          'Help desk partial queue fixture — Block C app feed delayed; subset of contacts shown.',
          '服務台不完整佇列固定狀態 — C 座應用程式饋送延遲；只顯示部分聯絡。',
          '服务台不完整队列固定状态 — C 栋应用程序馈送延迟；只显示部分联络。',
        ),
      },
    ],
  },

  helpdeskDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Help desk contact detail from the same page fixture corpus. No getHelpdeskContact in v0 freeze.',
          '同一頁面固定資料集的服務台聯絡詳情。v0 凍結範圍內並無 getHelpdeskContact。',
          '同一页面固定数据集的服务台联络详情。v0 冻结范围内并无 getHelpdeskContact。',
        ),
      },
    ],
  },

  /**
   * ADMINISTRATION (WEB-15). Fixture-first Users / Groups / Roles & features
   * / Audit log. UI-owned corpus until list/read ops are contracted.
   * operationIds empty. Session-memory audit appends merge with the seed.
   * The live append-only audit_event table comes later.
   */
  adminUsers: {
    operationIds: [],
    states: [
      { id: 'list', kind: 'fixture', file: 'admin-users/list.json' },
      { id: 'empty', kind: 'fixture', file: 'admin-users/empty.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  adminUsersDetail: {
    operationIds: [],
    states: [
      { id: 'detail', kind: 'fixture', file: 'admin-users/detail.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  adminGroups: {
    operationIds: [],
    states: [
      { id: 'list', kind: 'fixture', file: 'admin-groups/list.json' },
      { id: 'empty', kind: 'fixture', file: 'admin-groups/empty.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  adminGroupsDetail: {
    operationIds: [],
    states: [
      { id: 'detail', kind: 'fixture', file: 'admin-groups/detail.json' },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  adminRoles: {
    operationIds: [],
    states: [
      { id: 'matrix', kind: 'fixture', file: 'admin-roles/matrix.json' },
    ],
  },

  /**
   * ADMINISTRATION Lists. Managed lookup lists (visitor purpose first), fixture-backed until Backend serves
   * GET /lookups/{list_key} and the admin CRUD. Edits persist in this browser only. operationIds empty.
   */
  adminLists: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Administration Lists page. Fixture-backed until Backend serves lookup lists; edits stay in this browser.',
          '系統管理清單頁面。在後端提供查閱清單前使用固定資料，變更只保存在此瀏覽器。',
          '系统管理列表页面。在后端提供查阅列表前使用固定数据，更改只保存在此浏览器。',
        ),
      },
    ],
  },

  adminAudit: {
    operationIds: [],
    states: [
      {
        id: 'list',
        kind: 'client-form',
        reason: m(
          'Administration Audit log. Read through the audit source: Backend’s /admin/audit-log when it answers, the contract-shaped fixture when it does not.',
          '系統管理審計紀錄。經審計來源讀取：後端 /admin/audit-log 有回應時用即時資料，否則用符合合約格式的固定資料。',
          '系统管理审计记录。经审计来源读取：后端 /admin/audit-log 有响应时用实时数据，否则用符合合约格式的固定数据。',
        ),
      },
    ],
  },

  /**
   * INTEGRATION STATUS (S05). What the 2IoT Hub has told PEMO about the building systems. PEMO never
   * integrates with a building system itself; it reads Backend’s integration-status routes (the Hub’s
   * reports and PEMO’s own “the Hub went quiet” rule). The views are the contract’s own cases.
   */
  integrationStatus: {
    operationIds: [],
    states: [
      {
        id: 'list',
        kind: 'client-form',
        reason: m(
          'Integration status. Read through the integration source: Backend’s /integration-status when it answers, the contract-shaped fixture when it does not.',
          '整合狀態。經整合來源讀取：後端 /integration-status 有回應時用即時資料，否則用符合合約格式的固定資料。',
          '整合状态。经整合来源读取：后端 /integration-status 有响应时用实时数据，否则用符合合约格式的固定数据。',
        ),
      },
      {
        id: 'hub-late',
        kind: 'client-form',
        reason: m(
          'The Hub is late (120 to 179 seconds): a warning on the Hub; systems keep what they last reported. Sample view.',
          'Hub 延遲（120 至 179 秒）：只在 Hub 顯示警告，系統保留最後回報的狀態。範例畫面。',
          'Hub 延迟（120 至 179 秒）：只在 Hub 显示警告，系统保留最后报告的状态。示例画面。',
        ),
      },
      {
        id: 'hub-silent',
        kind: 'client-form',
        reason: m(
          'The Hub is silent (180 seconds or more): every system reads unknown, never offline. Sample view.',
          'Hub 沉默（180 秒或以上）：所有系統顯示為未知，而不是離線。範例畫面。',
          'Hub 沉默（180 秒或以上）：所有系统显示为未知，而不是离线。示例画面。',
        ),
      },
      {
        id: 'hub-never',
        kind: 'client-form',
        reason: m(
          'PEMO has never heard from the Hub: every system reads unknown. Sample view.',
          'PEMO 從未收到 Hub 的消息：所有系統顯示為未知。範例畫面。',
          'PEMO 从未收到 Hub 的消息：所有系统显示为未知。示例画面。',
        ),
      },
      {
        id: 'needs-mapping',
        kind: 'client-form',
        reason: m(
          'One system has neither a PEMO map entry nor a Hub hint: shown as not placed yet, to estate readers only. Sample view.',
          '有一個系統既沒有 PEMO 對應也沒有 Hub 提示：顯示為尚未指定地點，只有屋苑層級的讀者可見。範例畫面。',
          '有一个系统既没有 PEMO 对应也没有 Hub 提示：显示为尚未指定地点，只有小区层级的读者可见。示例画面。',
        ),
      },
      {
        id: 'places',
        kind: 'client-form',
        reason: m(
          'A block supervisor: scope “places”, no Hub card, only that block’s systems. Sample view.',
          '座主管的視角：範圍為「地點」，沒有 Hub 卡片，只有該座的系統。範例畫面。',
          '座主管的视角：范围为“地点”，没有 Hub 卡片，只有该座的系统。示例画面。',
        ),
      },
      {
        id: 'places-empty',
        kind: 'client-form',
        reason: m(
          'A block with no mapped systems: 200 with an empty list, not a refusal. Sample view.',
          '沒有對應系統的座：回應 200 及空清單，並非拒絕。範例畫面。',
          '没有对应系统的座：响应 200 及空列表，并非拒绝。示例画面。',
        ),
      },
    ],
  },

  integrationStatusDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'One system: what the Hub said, when, and its history. Read through the integration source.',
          '單一系統：Hub 的說明、時間及其紀錄。經整合來源讀取。',
          '单一系统：Hub 的说明、时间及其记录。经整合来源读取。',
        ),
      },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  /**
   * ADMINISTRATION Email (WEB-15). Fixture-first SMTP settings form.
   * Persist is in-memory session only. operationIds empty.
   */
  adminEmail: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Administration Email settings form. Fixture persist in this session only. SMTP values should move to server env in live.',
          '系統管理電郵設定表格。固定資料僅保存在此工作階段。正式環境的 SMTP 值應改存伺服器環境變數。',
          '系统管理电子邮件设置表格。固定数据仅保存在此会话。正式环境的 SMTP 值应改存服务器环境变数。',
        ),
      },
    ],
  },

  /**
   * FACILITY BOOKING (AMENITIES). Page fixtures only — no booking list/write
   * operation in the management contract under v0 freeze. operationIds empty.
   */
  bookings: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Bookings list page fixture (Wing Fu Garden demo rows). No listBookings operation in v0 freeze.',
          '預約名單頁面固定資料（榮富花園示範列）。v0 凍結範圍內並無 listBookings 操作。',
          '预约名单页面固定数据（荣富花园演示列）。v0 冻结范围内并无 listBookings 操作。',
        ),
      },
    ],
  },

  bookingsDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Booking detail from the same page fixture corpus. Amend / cancel stay deferred.',
          '同一頁面固定資料集的預約詳情。更改／取消仍列於稍後實作。',
          '同一页面固定数据集的预约详情。更改／取消仍列于稍后实现。',
        ),
      },
    ],
  },

  bookingCalendar: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Day/week calendar of the fixture week. Click opens booking detail.',
          '固定週的日／週日曆。按一下即開啟預約詳情。',
          '固定周的日／周日历。按一下即打开预约详情。',
        ),
      },
    ],
  },

  bookingCheckin: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          "Today's confirmed bookings on the fixture clock. Check-in / no-show is fixture-local only.",
          '固定時鐘上的今日已確認預約。到場／缺席僅在固定資料模式下本機生效。',
          '固定时钟上的今日已确认预约。到场／缺席仅在固定数据模式下本机生效。',
        ),
      },
    ],
  },

  bookingFacilities: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Facilities & zones catalogue page fixture. No listFacilities operation in v0 freeze.',
          '設施與分區目錄頁面固定資料。v0 凍結範圍內並無 listFacilities 操作。',
          '设施与分区目录页面固定数据。v0 冻结范围内并无 listFacilities 操作。',
        ),
      },
    ],
  },

  bookingFacilitiesDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Facility detail with zones and slots from the same page fixture corpus.',
          '同一頁面固定資料集的設施詳情，載有分區與時段。',
          '同一页面固定数据集的设施详情，载有分区与时段。',
        ),
      },
    ],
  },

  reports: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Reports page fixture: twelve cards of figures derived from sample rows. No report endpoint in v0 freeze.',
          '報告頁面固定資料：十二張卡片的數字由示範資料列推算。v0 凍結範圍內並無報告端點。',
          '报告页面固定数据：十二张卡片的数字由演示数据行推算。v0 冻结范围内并无报告端点。',
        ),
      },
      {
        id: 'drill',
        kind: 'client-form',
        reason: m(
          'The rows behind one figure as a filtered table in the same page, from the same sample rows. CSV and PDF export what is on screen.',
          '同一頁內以篩選表格顯示單一數字背後的資料列，來自同一批示範資料列。CSV 與 PDF 匯出畫面上的內容。',
          '同一页内以筛选表格显示单一数字背后的数据行，来自同一批演示数据行。CSV 与 PDF 导出屏幕上的内容。',
        ),
      },
    ],
  },

  bookingRates: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Read-only peak / off-peak rate cards. No rate-card write in this slice.',
          '唯讀繁忙／非繁忙收費表。本切片沒有收費表寫入。',
          '只读繁忙／非繁忙收费表。本切片没有收费表写入。',
        ),
      },
    ],
  },

  /**
   * STRATA / MANAGEMENT-FEE PAYMENTS (CONFIGURE). Page fixtures only — no
   * charges/payments/refunds operation in the management contract under v0
   * freeze, and no live PSP. operationIds empty on purpose.
   */
  charges: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Charges list page fixture (Wing Fu Garden monthly management fees). No listCharges operation in v0 freeze.',
          '管理費帳單名單頁面固定資料（榮富花園每月管理費）。v0 凍結範圍內並無 listCharges 操作。',
          '物业费账单名单页面固定数据（荣富花园每月物业费）。v0 冻结范围内并无 listCharges 操作。',
        ),
      },
    ],
  },

  chargesDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Charge detail from the same page fixture corpus. Remind / adjust / record payment stay deferred.',
          '同一頁面固定資料集的帳單詳情。催繳／調整／記錄付款仍列於稍後實作。',
          '同一页面固定数据集的账单详情。催缴／调整／记录付款仍列于稍后实现。',
        ),
      },
    ],
  },

  payments: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Payments list page fixture — receipts allocated to charges. Method stubs only; no live PSP.',
          '付款名單頁面固定資料 — 已分配至帳單的收據。付款方式僅為 Stub；並無即時付款服務。',
          '付款名单页面固定数据 — 已分配至账单的收据。付款方式仅为 Stub；并无即时付款服务。',
        ),
      },
    ],
  },

  paymentsDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Payment detail from the same page fixture corpus. Reverse / reallocate stay deferred.',
          '同一頁面固定資料集的付款詳情。撤銷／重分配仍列於稍後實作。',
          '同一页面固定数据集的付款详情。撤销／重分配仍列于稍后实现。',
        ),
      },
    ],
  },

  refunds: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Refunds list page fixture — credit and refund stubs. Execute stays deferred.',
          '退款名單頁面固定資料 — 貸記與退款 Stub。執行仍列於稍後實作。',
          '退款名单页面固定数据 — 贷记与退款 Stub。执行仍列于稍后实现。',
        ),
      },
    ],
  },

  refundsDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Refund detail from the same page fixture corpus. Execute stays deferred.',
          '同一頁面固定資料集的退款詳情。執行仍列於稍後實作。',
          '同一页面固定数据集的退款详情。执行仍列于稍后实现。',
        ),
      },
    ],
  },

  /**
   * DOCUMENTS (COMMUNICATE). Page fixtures only — no listDocuments / getDocument
   * in the management contract under v0 freeze. operationIds empty on purpose.
   */
  documents: {
    operationIds: [],
    states: [
      {
        id: 'list',
        kind: 'client-form',
        reason: m(
          'Documents library page fixture (Wing Fu Garden circulars, house rules, fee-schedule PDF stubs). No listDocuments operation in v0 freeze.',
          '文件庫頁面固定資料（榮富花園通函、屋苑守則、收費表 PDF 代用檔）。v0 凍結範圍內並無 listDocuments 操作。',
          '文件库页面固定数据（荣富花园通函、小区守则、收费表 PDF 占位文件）。v0 冻结范围内并无 listDocuments 操作。',
        ),
      },
      {
        id: 'empty',
        kind: 'client-form',
        reason: m(
          'Documents empty library fixture state. Same page corpus; no circulars or schedules.',
          '文件庫空白固定狀態。同一頁面資料集；沒有通函或收費表。',
          '文件库空白固定状态。同一页面数据集；没有通函或收费表。',
        ),
      },
    ],
  },

  documentsDetail: {
    operationIds: [],
    states: [
      {
        id: 'detail',
        kind: 'client-form',
        reason: m(
          'Document detail from the same page fixture corpus. PDF preview is a stub.',
          '同一頁面固定資料集的文件詳情。PDF 預覽為代用檔。',
          '同一页面固定数据集的文件详情。PDF 预览为占位文件。',
        ),
      },
      { id: 'not-found', kind: 'problem', file: 'problems/record-not-found.json' },
    ],
  },

  /**
   * CAR PARK (BUILDING SYSTEMS). Thin ParkCore connector — no parking
   * operation in the management contract. PEMO opens ParkCore in a new tab.
   */
  carPark: {
    operationIds: [],
    states: [
      {
        id: 'default',
        kind: 'client-form',
        reason: m(
          'Car Park is a thin ParkCore connector. PEMO does not embed ParkCore UI. The SSO CTA is a fixture one-time-code callback stub. No car-park operation in the management contract.',
          '停車場是精簡的 ParkCore 連接頁。PEMO 不嵌入 ParkCore 畫面。SSO 按鈕為一次性代碼回呼固定摘要。管理合約並無停車場操作。',
          '停车场是精简的 ParkCore 连接页。PEMO 不嵌入 ParkCore 页面。SSO 按钮为一次性代码回呼固定摘要。管理合约并无停车场操作。',
        ),
      },
    ],
  },

};

/** Every screen carries the common states plus its own. */
export function statesFor(screen: ScreenId): ScreenState[] {
  return [...SCREENS[screen].states, ...COMMON];
}

export const SCREEN_IDS = Object.keys(SCREENS) as ScreenId[];

/** Shell-level gap, recorded beside the screen gaps rather than in prose only. */
export const SCOPE_GAP = m(
  'The contract supports eight scope kinds. The corpus carries seven of them, and a Portfolio-level grant as well as a Portfolio node — the form that has teeth, since a grant is what a scope check descends from. Only Phase has no node, so that tier is handled structurally and has nothing to display.',
  '合約支援八種範圍層級。資料集已涵蓋其中七種，並同時包含投資組合層級的授權及投資組合節點——授權才是實際起作用的形式，因為範圍檢查是由授權向下推展。僅「期數」尚無節點，故該層級僅在結構上處理，並無內容可供顯示。',
  '合约支援八种范围层级。数据集已涵盖其中七种，并同时包含投资组合层级的授权及投资组合节点——授权才是实际起作用的形式，因为范围检查是由授权向下推展。仅“期数”尚无节点，故该层级仅在结构上处理，并无内容可供显示。',
);
