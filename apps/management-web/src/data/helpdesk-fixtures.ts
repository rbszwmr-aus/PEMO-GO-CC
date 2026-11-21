/**
 * Page fixture corpus for Help desk (OPERATE → Help desk).
 *
 * NOT a management-web contract operation — v0 freeze has no help-desk queue
 * reads. Rows mirror the 6 Sept design demo (hdStats / hdQueue / hdNotes /
 * hdActions). Labeled fixture corpus for this page only; do not treat as live
 * API fields. See docs/contracts/proposed-helpdesk-read-ops.md.
 */

export type HelpdeskTone = 'critical' | 'warning' | 'info' | 'normal' | 'unknown';

export type HelpdeskChannel = 'app' | 'phone' | 'counter';

export type HelpdeskContactState = 'waiting' | 'in_progress' | 'overdue' | 'closed';

export interface HelpdeskStat {
  id: string;
  label: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  value: string;
  note: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  tone: HelpdeskTone;
}

export interface HelpdeskQueueRow {
  id: string;
  channel: HelpdeskChannel;
  who: string;
  unit: string;
  subject: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  wait: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  state: HelpdeskContactState;
  tone: HelpdeskTone;
}

export interface HelpdeskNote {
  k: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  v: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
}

export interface HelpdeskAction {
  id: string;
  label: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  primary?: boolean;
}

export interface HelpdeskTimelineTurn {
  at: string;
  who: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  channel: HelpdeskChannel | 'system';
  body: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
}

export interface HelpdeskContactDetail {
  id: string;
  channel: HelpdeskChannel;
  who: string;
  unit: string;
  subject: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  wait: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  state: HelpdeskContactState;
  tone: HelpdeskTone;
  openedAt: string;
  linkedCaseRef: string | null;
  disposition: { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined };
  timeline: HelpdeskTimelineTurn[];
}

export const HELPDESK_STATS: readonly HelpdeskStat[] = [
  {
    id: 'waiting',
    label: { en: 'WAITING', 'zh-Hant': '等候中', 'zh-Hans': '等候中' },
    value: '5',
    note: { en: 'longest 26 minutes', 'zh-Hant': '最長 26 分鐘', 'zh-Hans': '最长 26 分钟' },
    tone: 'warning',
  },
  {
    id: 'answered',
    label: { en: 'ANSWERED TODAY', 'zh-Hant': '今日已回覆', 'zh-Hans': '今日已回复' },
    value: '38',
    note: { en: 'median first reply 6 minutes', 'zh-Hant': '首次回覆中位數 6 分鐘', 'zh-Hans': '首次回复中位数 6 分钟' },
    tone: 'normal',
  },
  {
    id: 'raised',
    label: { en: 'RAISED AS CASES', 'zh-Hant': '已轉為個案', 'zh-Hans': '已转为案件' },
    value: '7',
    note: { en: 'of 38 · the rest closed at the desk', 'zh-Hant': '共 38 宗 · 其餘於服務台完結', 'zh-Hans': '共 38 宗 · 其余于服务台完结' },
    tone: 'info',
  },
  {
    id: 'hours',
    label: { en: 'OFFICE HOURS', 'zh-Hant': '辦公時間', 'zh-Hans': '办公时间' },
    value: '08:00',
    note: { en: 'to 20:00 · out of hours goes to phone', 'zh-Hant': '至 20:00 · 非辦公時間轉電話', 'zh-Hans': '至 20:00 · 非办公时间转电话' },
    tone: 'unknown',
  },
];

export const HELPDESK_ACTIONS: readonly HelpdeskAction[] = [
  { id: 'answer-next', label: { en: 'Answer next in queue', 'zh-Hant': '接下一位', 'zh-Hans': '接下一位' }, primary: true },
  { id: 'log-call', label: { en: 'Log a call', 'zh-Hant': '登記來電', 'zh-Hans': '登记来电' } },
  { id: 'log-counter', label: { en: 'Log a counter visit', 'zh-Hant': '登記櫃台來訪', 'zh-Hans': '登记柜台来访' } },
  { id: 'more', label: { en: 'More', 'zh-Hant': '更多', 'zh-Hans': '更多' } },
];

export const HELPDESK_NOTES: readonly HelpdeskNote[] = [
  {
    k: { en: 'Not a second case queue', 'zh-Hant': '不是第二個個案佇列', 'zh-Hans': '不是第二个案件队列' },
    v: {
      en: 'A help-desk contact is a conversation, not a record of work. Most close at the desk in one exchange. Only contacts that need tracked work become cases, and the link is kept both ways.',
      'zh-Hant': '服務台聯絡是對話，不是工作紀錄。多數一次溝通即可在服務台完結。只有需要跟進的聯絡才轉為個案，並雙向保留連結。', 'zh-Hans': '服务台联络是对话，不是工作记录。多数一次沟通即可在服务台完结。只有需要跟进的联络才转为案件，并双向保留连结。',
    },
  },
  {
    k: { en: 'Channel is recorded, never hidden', 'zh-Hant': '渠道一律記錄，從不隱藏', 'zh-Hans': '渠道一律记录，从不隐藏' },
    v: {
      en: 'App, phone and counter contacts share one queue so waiting time is real. A resident who walked in is not invisible to a colleague answering the app.',
      'zh-Hant': '應用程式、電話與櫃台共用同一佇列，等候時間才真實。親身來訪的住戶不會在同事回覆應用程式時被忽略。', 'zh-Hans': '应用程序、电话与柜台共用同一队列，等候时间才真实。亲身来访的住户不会在同事回复应用程序时被忽略。',
    },
  },
  {
    k: { en: 'Out of hours is stated, not implied', 'zh-Hant': '非辦公時間須明確說明', 'zh-Hans': '非办公时间须明确说明' },
    v: {
      en: 'Outside 08:00–20:00 the app tells the resident when the desk reopens and offers the phone line. Silence is never presented as an open desk.',
      'zh-Hant': '08:00–20:00 以外，應用程式會告知住戶服務台何時重開，並提供電話熱線。絕不以沉默暗示服務台仍開放。', 'zh-Hans': '08:00–20:00 以外，应用程序会告知住户服务台何时重开，并提供电话热线。绝不以沉默暗示服务台仍开放。',
    },
  },
  {
    k: { en: 'Safety never routes here', 'zh-Hant': '安全事件不會路由至此', 'zh-Hans': '安全事件不会路由至此' },
    v: {
      en: 'A critical safety event goes through Home Safety with its own recipients and timers. The help desk can see it but cannot own it.',
      'zh-Hant': '危急安全事件經家居安全處理，有獨立接收者與計時。服務台可見但不可接管。', 'zh-Hans': '危急安全事件经家居安全处理，有独立接收者与计时。服务台可见但不可接管。',
    },
  },
];

export const HELPDESK_QUEUE: readonly HelpdeskQueueRow[] = [
  {
    id: 'hd_2026_0812_001',
    channel: 'app',
    who: 'Ho Mei-yi 何美儀',
    unit: 'A · 12/F A1',
    subject: {
      en: 'Renovation permit form — which version applies?',
      'zh-Hant': '裝修許可表格 — 適用哪個版本？', 'zh-Hans': '装修许可表格 — 适用哪个版本？',
    },
    wait: { en: '2m', 'zh-Hant': '2 分鐘', 'zh-Hans': '2 分钟' },
    state: 'waiting',
    tone: 'warning',
  },
  {
    id: 'hd_2026_0812_002',
    channel: 'phone',
    who: 'Cheung Wai-hung 張偉雄',
    unit: 'A · 7/F A2',
    subject: {
      en: 'Chasing water leak from this morning',
      'zh-Hant': '跟進今早漏水', 'zh-Hans': '跟进今早漏水',
    },
    wait: { en: 'On call 4m', 'zh-Hant': '通話中 4 分鐘', 'zh-Hans': '通话中 4 分钟' },
    state: 'in_progress',
    tone: 'info',
  },
  {
    id: 'hd_2026_0812_003',
    channel: 'counter',
    who: 'Lau Ka-yan 劉嘉欣',
    unit: 'B · 18/F B4',
    subject: {
      en: 'Collecting registered mail',
      'zh-Hant': '領取掛號郵件', 'zh-Hans': '领取挂号邮件',
    },
    wait: { en: 'At desk', 'zh-Hant': '在櫃台', 'zh-Hans': '在柜台' },
    state: 'in_progress',
    tone: 'info',
  },
  {
    id: 'hd_2026_0812_004',
    channel: 'app',
    who: 'Tam Siu-fong 譚小芳',
    unit: 'B · 3/F B1',
    subject: {
      en: 'Clubhouse booking deposit query',
      'zh-Hant': '會所預約按金查詢', 'zh-Hans': '会所预约押金查询',
    },
    wait: { en: '11m', 'zh-Hant': '11 分鐘', 'zh-Hans': '11 分钟' },
    state: 'waiting',
    tone: 'warning',
  },
  {
    id: 'hd_2026_0812_005',
    channel: 'app',
    who: 'Ng Chi-wai 吳志偉',
    unit: 'C · 9/F C3',
    subject: {
      en: 'Gas detector still offline',
      'zh-Hant': '氣體探測器仍離線', 'zh-Hans': '气体探测器仍离线',
    },
    wait: { en: '26m', 'zh-Hant': '26 分鐘', 'zh-Hans': '26 分钟' },
    state: 'overdue',
    tone: 'critical',
  },
];

const DETAILS: Record<string, HelpdeskContactDetail> = {
  hd_2026_0812_001: {
    id: 'hd_2026_0812_001',
    channel: 'app',
    who: 'Ho Mei-yi 何美儀',
    unit: 'A · 12/F A1',
    subject: {
      en: 'Renovation permit form — which version applies?',
      'zh-Hant': '裝修許可表格 — 適用哪個版本？', 'zh-Hans': '装修许可表格 — 适用哪个版本？',
    },
    wait: { en: '2m', 'zh-Hant': '2 分鐘', 'zh-Hans': '2 分钟' },
    state: 'waiting',
    tone: 'warning',
    openedAt: '2026-08-12T09:54:00+08:00',
    linkedCaseRef: null,
    disposition: {
      en: 'Still at the desk — answer with the current permit pack link; no case yet.',
      'zh-Hant': '仍在服務台處理 — 回覆現行許可文件包連結；尚未轉個案。', 'zh-Hans': '仍在服务台处理 — 回复现行许可文件包连结；尚未转案件。',
    },
    timeline: [
      {
        at: '2026-08-12T09:54:00+08:00',
        who: { en: 'Ho Mei-yi 何美儀', 'zh-Hant': '何美儀', 'zh-Hans': '何美仪' },
        channel: 'app',
        body: {
          en: 'Which renovation permit form should I use for Flat A1? The estate notice board still shows last year’s pack.',
          'zh-Hant': 'A1 室應使用哪份裝修許可表格？大廈通告板仍是去年的文件包。', 'zh-Hans': 'A1 室应使用哪份装修许可表格？大楼公告板仍是去年的文件包。',
        },
      },
      {
        at: '2026-08-12T09:54:12+08:00',
        who: { en: 'System', 'zh-Hant': '系統', 'zh-Hans': '系统' },
        channel: 'system',
        body: {
          en: 'Queued for Help desk · waiting time started.',
          'zh-Hant': '已加入服務台佇列 · 開始計算等候時間。', 'zh-Hans': '已加入服务台队列 · 开始计算等候时间。',
        },
      },
    ],
  },
  hd_2026_0812_002: {
    id: 'hd_2026_0812_002',
    channel: 'phone',
    who: 'Cheung Wai-hung 張偉雄',
    unit: 'A · 7/F A2',
    subject: {
      en: 'Chasing water leak from this morning',
      'zh-Hant': '跟進今早漏水', 'zh-Hans': '跟进今早漏水',
    },
    wait: { en: 'On call 4m', 'zh-Hant': '通話中 4 分鐘', 'zh-Hans': '通话中 4 分钟' },
    state: 'in_progress',
    tone: 'info',
    openedAt: '2026-08-12T09:40:00+08:00',
    linkedCaseRef: 'CASE-2026-0812-014',
    disposition: {
      en: 'On call with building services; case already raised for the leak.',
      'zh-Hant': '正與樓宇服務通話；漏水個案已建立。', 'zh-Hans': '正与楼宇服务通话；漏水案件已建立。',
    },
    timeline: [
      {
        at: '2026-08-12T09:40:00+08:00',
        who: { en: 'Cheung Wai-hung 張偉雄', 'zh-Hant': '張偉雄', 'zh-Hans': '张伟雄' },
        channel: 'phone',
        body: {
          en: 'Inbound call — ceiling drip in bathroom since 07:30; wants ETA.',
          'zh-Hant': '來電 — 浴室天花自 07:30 滴水；想知預計到達時間。', 'zh-Hans': '来电 — 浴室天花自 07:30 滴水；想知预计到达时间。',
        },
      },
      {
        at: '2026-08-12T09:42:00+08:00',
        who: { en: 'Desk · Wong Suk-fan', 'zh-Hant': '服務台 · 黃淑芬', 'zh-Hans': '服务台 · 黄淑芬' },
        channel: 'phone',
        body: {
          en: 'Raised CASE-2026-0812-014 · transferring to building services on the same call.',
          'zh-Hant': '已建立 CASE-2026-0812-014 · 同通話轉接樓宇服務。', 'zh-Hans': '已建立 CASE-2026-0812-014 · 同通话转接楼宇服务。',
        },
      },
    ],
  },
  hd_2026_0812_003: {
    id: 'hd_2026_0812_003',
    channel: 'counter',
    who: 'Lau Ka-yan 劉嘉欣',
    unit: 'B · 18/F B4',
    subject: {
      en: 'Collecting registered mail',
      'zh-Hant': '領取掛號郵件', 'zh-Hans': '领取挂号邮件',
    },
    wait: { en: 'At desk', 'zh-Hant': '在櫃台', 'zh-Hans': '在柜台' },
    state: 'in_progress',
    tone: 'info',
    openedAt: '2026-08-12T09:51:00+08:00',
    linkedCaseRef: null,
    disposition: {
      en: 'Counter visit — verify ID stub and hand over registered mail; close at desk.',
      'zh-Hant': '櫃台來訪 — 核對身分摘要後交掛號郵件；於服務台完結。', 'zh-Hans': '柜台来访 — 核对身分摘要后交挂号邮件；于服务台完结。',
    },
    timeline: [
      {
        at: '2026-08-12T09:51:00+08:00',
        who: { en: 'Desk · Ng Ka-ho', 'zh-Hant': '服務台 · 吳家豪', 'zh-Hans': '服务台 · 吴家豪' },
        channel: 'counter',
        body: {
          en: 'Resident at counter for registered mail collection · ID stub checked.',
          'zh-Hant': '住戶在櫃台領取掛號郵件 · 已核對身分摘要。', 'zh-Hans': '住户在柜台领取挂号邮件 · 已核对身分摘要。',
        },
      },
    ],
  },
  hd_2026_0812_004: {
    id: 'hd_2026_0812_004',
    channel: 'app',
    who: 'Tam Siu-fong 譚小芳',
    unit: 'B · 3/F B1',
    subject: {
      en: 'Clubhouse booking deposit query',
      'zh-Hant': '會所預約按金查詢', 'zh-Hans': '会所预约押金查询',
    },
    wait: { en: '11m', 'zh-Hant': '11 分鐘', 'zh-Hans': '11 分钟' },
    state: 'waiting',
    tone: 'warning',
    openedAt: '2026-08-12T09:45:00+08:00',
    linkedCaseRef: null,
    disposition: {
      en: 'Waiting — point to rate card and refund window; close at desk unless dispute.',
      'zh-Hant': '等候中 — 指向收費表與退款時限；除非爭議否則於服務台完結。', 'zh-Hans': '等候中 — 指向收费表与退款时限；除非争议否则于服务台完结。',
    },
    timeline: [
      {
        at: '2026-08-12T09:45:00+08:00',
        who: { en: 'Tam Siu-fong 譚小芳', 'zh-Hant': '譚小芳', 'zh-Hans': '谭小芳' },
        channel: 'app',
        body: {
          en: 'When is the function-room deposit refunded after my booking on 20 Aug?',
          'zh-Hant': '8 月 20 日預約後，多用途禮堂按金何時退回？', 'zh-Hans': '8 月 20 日预约后，多用途礼堂押金何时退回？',
        },
      },
    ],
  },
  hd_2026_0812_005: {
    id: 'hd_2026_0812_005',
    channel: 'app',
    who: 'Ng Chi-wai 吳志偉',
    unit: 'C · 9/F C3',
    subject: {
      en: 'Gas detector still offline',
      'zh-Hant': '氣體探測器仍離線', 'zh-Hans': '气体探测器仍离线',
    },
    wait: { en: '26m', 'zh-Hant': '26 分鐘', 'zh-Hans': '26 分钟' },
    state: 'overdue',
    tone: 'critical',
    openedAt: '2026-08-12T09:30:00+08:00',
    linkedCaseRef: 'CASE-2026-0812-009',
    disposition: {
      en: 'Overdue reply — IoT offline already visible on Home Safety; help desk must not own the safety event. Escalate case only.',
      'zh-Hant': '回覆逾期 — 家居安全已可見物聯離線；服務台不可接管安全事件。只可升級個案。', 'zh-Hans': '回复逾期 — 家居安全已可见物联离线；服务台不可接管安全事件。只可升级案件。',
    },
    timeline: [
      {
        at: '2026-08-12T09:30:00+08:00',
        who: { en: 'Ng Chi-wai 吳志偉', 'zh-Hant': '吳志偉', 'zh-Hans': '吴志伟' },
        channel: 'app',
        body: {
          en: 'App shows gas detector offline since yesterday evening. Is someone coming?',
          'zh-Hant': '應用程式顯示氣體探測器自昨晚離線。有人會來嗎？', 'zh-Hans': '应用程序显示气体探测器自昨晚离线。有人会来吗？',
        },
      },
      {
        at: '2026-08-12T09:31:00+08:00',
        who: { en: 'System', 'zh-Hant': '系統', 'zh-Hans': '系统' },
        channel: 'system',
        body: {
          en: 'Linked open case CASE-2026-0812-009 · safety ownership stays on Home Safety.',
          'zh-Hant': '已連結開放個案 CASE-2026-0812-009 · 安全擁有權仍屬家居安全。', 'zh-Hans': '已连结开放案件 CASE-2026-0812-009 · 安全拥有权仍属家居安全。',
        },
      },
    ],
  },
  hd_2026_0812_006: {
    id: 'hd_2026_0812_006',
    channel: 'app',
    who: 'Lee Ka-man 李嘉雯',
    unit: 'A · 3/F A5',
    subject: {
      en: 'Visitor parking for tomorrow — confirmed',
      'zh-Hant': '明日訪客停車 — 已確認', 'zh-Hans': '明日访客停车 — 已确认',
    },
    wait: { en: 'Closed', 'zh-Hant': '已完結', 'zh-Hans': '已完结' },
    state: 'closed',
    tone: 'normal',
    openedAt: '2026-08-12T08:12:00+08:00',
    linkedCaseRef: null,
    disposition: {
      en: 'Closed at the desk — visitor parking slot confirmed; no case raised.',
      'zh-Hant': '於服務台完結 — 已確認訪客車位；未轉個案。', 'zh-Hans': '于服务台完结 — 已确认访客车位；未转案件。',
    },
    timeline: [
      {
        at: '2026-08-12T08:12:00+08:00',
        who: { en: 'Lee Ka-man 李嘉雯', 'zh-Hant': '李嘉雯', 'zh-Hans': '李嘉雯' },
        channel: 'app',
        body: {
          en: 'Can a visitor use visitor parking tomorrow 10:00–14:00 for Flat A5?',
          'zh-Hant': 'A5 室訪客明日 10:00–14:00 可否使用訪客車位？', 'zh-Hans': 'A5 室访客明日 10:00–14:00 可否使用访客车位？',
        },
      },
      {
        at: '2026-08-12T08:18:00+08:00',
        who: { en: 'Desk · Chan Mei-ling', 'zh-Hant': '服務台 · 陳美玲', 'zh-Hans': '服务台 · 陈美玲' },
        channel: 'app',
        body: {
          en: 'Yes — bay V-12 reserved. Pass code will show in the resident app.',
          'zh-Hant': '可以 — 已預留 V-12。通行證代碼會顯示於住戶應用程式。', 'zh-Hans': '可以 — 已预留 V-12。通行证代码会显示于住户应用程序。',
        },
      },
      {
        at: '2026-08-12T08:19:00+08:00',
        who: { en: 'System', 'zh-Hant': '系統', 'zh-Hans': '系统' },
        channel: 'system',
        body: {
          en: 'Contact closed at the desk · no case linked.',
          'zh-Hant': '聯絡已於服務台完結 · 無連結個案。', 'zh-Hans': '联络已于服务台完结 · 无连结案件。',
        },
      },
    ],
  },
};

/** Default detail for state-matrix `detail` with no contact id in the URL. */
export const HELPDESK_DETAIL_DEFAULT: HelpdeskContactDetail = DETAILS['hd_2026_0812_001'] as HelpdeskContactDetail;

/**
 * Partial fixture: Block C app contacts may be missing. Queue is a subset of the
 * full demo so the banner is honest about incompleteness.
 */
export const HELPDESK_PARTIAL_REASONS: readonly { en: string; 'zh-Hant': string; 'zh-Hans'?: string | undefined }[] = [
  {
    en: 'Block C app-message feed delayed — some contacts may not yet appear in the queue.',
    'zh-Hant': 'C 座應用程式訊息饋送延遲 — 部分聯絡可能尚未出現在佇列。', 'zh-Hans': 'C 栋应用程序消息馈送延迟 — 部分联络可能尚未出现在队列。',
  },
];

export const HELPDESK_QUEUE_PARTIAL: readonly HelpdeskQueueRow[] = HELPDESK_QUEUE.filter(
  (q) => q.id !== 'hd_2026_0812_005',
);

export const HELPDESK_STATS_PARTIAL: readonly HelpdeskStat[] = HELPDESK_STATS.map((s) =>
  s.id === 'waiting'
    ? {
        ...s,
        value: '4',
        note: { en: 'longest 11 minutes · feed partial', 'zh-Hant': '最長 11 分鐘 · 饋送不完整', 'zh-Hans': '最长 11 分钟 · 馈送不完整' },
      }
    : s,
);

export function helpdeskContact(id: string): HelpdeskContactDetail | undefined {
  return DETAILS[id];
}

export type HelpdeskFixtureMode = 'queue' | 'empty' | 'partial';

export function helpdeskFixtureView(mode: HelpdeskFixtureMode): {
  stats: readonly HelpdeskStat[];
  rows: readonly HelpdeskQueueRow[];
  partial: boolean;
} {
  if (mode === 'empty') {
    return {
      stats: HELPDESK_STATS.map((s) => ({
        ...s,
        value: s.id === 'hours' ? s.value : '0',
        note:
          s.id === 'hours'
            ? s.note
            : ({ en: 'No contacts in this fixture state', 'zh-Hant': '此固定狀態沒有聯絡', 'zh-Hans': '此固定状态没有联络' } as const),
      })),
      rows: [],
      partial: false,
    };
  }
  if (mode === 'partial') {
    return { stats: HELPDESK_STATS_PARTIAL, rows: HELPDESK_QUEUE_PARTIAL, partial: true };
  }
  return { stats: HELPDESK_STATS, rows: HELPDESK_QUEUE, partial: false };
}
