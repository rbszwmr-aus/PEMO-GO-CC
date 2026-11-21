/**
 * Tone for a passive tag (4S guide section 6): success, attention, critical,
 * unknown, or neutral when the state carries no judgement.
 *
 * Tags are borderless tints; the label always carries the meaning, so tone is
 * a second cue and never the only one. The tone is read from the state's
 * label in either language so every screen gets it from one place.
 */

export type ChipTone = 'success' | 'attention' | 'critical' | 'unknown' | 'urgent' | 'neutral';

const UNKNOWN = /unknown|unmapped|not linked|unverified|未知|未對應|未连结|未連結|未核實/i;
const URGENT = /^(overdue|逾期|已逾時|已逾时)$/i;
const CRITICAL = /fail|reject|bounce|suspend|offline|error|void|expired|blocked|declin|失敗|失败|拒絕|拒绝|退回|暫停|暂停|離線|离线|錯誤|错误|作廢|作废|過期|过期|逾期|逾時|逾时/i;
const ATTENTION = /pending|held|hold|await|draft|schedul|in progress|waiting|triag|action required|degrad|partial|unpaid|outstanding|due |approval|review|planned|queued|待|處理中|处理中|草稿|排程|排期|等候|等待|降級|降级|部分|未付|未繳|審批|审批|隊列|队列/i;
const SUCCESS = /publish|working|active|paid|confirm|resolved|deliver|verified|acknowledg|complet|checked in|approved|normal|linked|mapped|healthy|已發佈|已发布|運作|运作|啟用|启用|已付|已繳|已确认|已確認|已解決|已解决|已送達|已送达|已核實|已核实|完成|已簽到|已签到|已批准|已連結|已连结|已對應|已对应/i;

export function toneForLabel(label: string): ChipTone {
  if (UNKNOWN.test(label)) return 'unknown';
  if (URGENT.test(label.trim())) return 'urgent';
  if (CRITICAL.test(label)) return 'critical';
  if (ATTENTION.test(label)) return 'attention';
  if (SUCCESS.test(label)) return 'success';
  return 'neutral';
}
