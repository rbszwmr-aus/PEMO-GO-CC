/**
 * Portal notices — LIVE :3200 first; fixture store only if API unreachable.
 * Freeze: docs/contracts/resident-portal-v0-notices-visitors-demo.md
 */
import {
  FIXTURE_RESIDENT_ID as STORE_RESIDENT,
  getDemoNoticeStore,
  type DemoNotice,
  type NoticeSeverity,
} from '@pemo/notices-visitors-demo-store';
import { getDemoNotice, listDemoNotices } from './notices-demo-client.ts';

export type { DemoNotice, NoticeSeverity };
export {
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
} from '@pemo/notices-visitors-demo-store';

function asNotice(raw: unknown): DemoNotice | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nested = o.notice && typeof o.notice === 'object' ? (o.notice as Record<string, unknown>) : o;
  const id =
    (typeof nested.noticeId === 'string' && nested.noticeId) ||
    (typeof nested.id === 'string' && nested.id) ||
    '';
  if (!id) return null;
  const severityRaw = typeof nested.severity === 'string' ? nested.severity : 'info';
  const severity: NoticeSeverity =
    severityRaw === 'warning' || severityRaw === 'critical' || severityRaw === 'info'
      ? severityRaw
      : 'info';
  return {
    noticeId: id,
    title: typeof nested.title === 'string' ? nested.title : '',
    body: typeof nested.body === 'string' ? nested.body : '',
    publishedAt: typeof nested.publishedAt === 'string' ? nested.publishedAt : '',
    severity,
    category: typeof nested.category === 'string' ? nested.category : 'general',
  };
}

function asNotices(raw: unknown): DemoNotice[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.notices) ? o.notices : null;
  if (!list) return null;
  const out: DemoNotice[] = [];
  for (const item of list) {
    const n = asNotice(item);
    if (n) out.push(n);
  }
  return out;
}

export async function listNotices(): Promise<{ notices: DemoNotice[]; source: 'api' | 'local' }> {
  try {
    const raw = await listDemoNotices(STORE_RESIDENT);
    const notices = asNotices(raw);
    if (notices) return { notices, source: 'api' };
  } catch {
    /* fall through */
  }
  return { notices: getDemoNoticeStore().listAll(), source: 'local' };
}

export async function getNotice(id: string): Promise<{ notice: DemoNotice | null; source: 'api' | 'local' }> {
  try {
    const raw = await getDemoNotice(id, STORE_RESIDENT);
    const notice = asNotice(raw);
    if (notice) return { notice, source: 'api' };
  } catch {
    /* fall through */
  }
  return { notice: getDemoNoticeStore().get(id), source: 'local' };
}
