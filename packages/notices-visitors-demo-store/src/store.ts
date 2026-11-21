import { seedNotices, seedVisitors } from './seed.js';
import type {
  CreateVisitorInput,
  DemoNotice,
  DemoVisitor,
  VisitorStatus,
} from './types.js';
import {
  FIXTURE_RESIDENT_ID,
  FIXTURE_UNIT_ID,
  isVisitorStatus,
} from './types.js';

function isoNow(): string {
  const d = new Date();
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export interface DemoNoticeStore {
  listAll(): DemoNotice[];
  get(noticeId: string): DemoNotice | null;
}

export interface DemoVisitorStore {
  listForResident(residentRef: string): DemoVisitor[];
  get(visitorId: string): DemoVisitor | null;
  create(input: CreateVisitorInput): DemoVisitor;
  checkOut(visitorId: string): DemoVisitor | null;
  setStatus(visitorId: string, status: VisitorStatus): DemoVisitor | null;
}

export function createNoticeStore(
  initial: readonly DemoNotice[] = seedNotices(),
): DemoNoticeStore {
  const notices = initial.map((n) => ({ ...n }));

  return {
    listAll(): DemoNotice[] {
      return notices
        .slice()
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    },
    get(noticeId: string): DemoNotice | null {
      return notices.find((n) => n.noticeId === noticeId) ?? null;
    },
  };
}

export function createVisitorStore(
  initial: readonly DemoVisitor[] = seedVisitors(),
): DemoVisitorStore {
  let visitors: DemoVisitor[] = initial.map((v) => ({ ...v }));

  const findIndex = (id: string): number =>
    visitors.findIndex((v) => v.visitorId === id);

  return {
    listForResident(residentRef: string): DemoVisitor[] {
      return visitors
        .filter((v) => v.residentRef === residentRef)
        .slice()
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    get(visitorId: string): DemoVisitor | null {
      return visitors.find((v) => v.visitorId === visitorId) ?? null;
    },

    create(input: CreateVisitorInput): DemoVisitor {
      const at = isoNow();
      const visitor: DemoVisitor = {
        visitorId: newId('vis'),
        name: input.name.trim(),
        purpose:
          typeof input.purpose === 'string' && input.purpose.trim().length > 0
            ? input.purpose.trim()
            : null,
        expectedFrom: input.expectedFrom.trim(),
        expectedTo: input.expectedTo.trim(),
        hostUnitId:
          typeof input.hostUnitId === 'string' && input.hostUnitId.trim().length > 0
            ? input.hostUnitId.trim()
            : FIXTURE_UNIT_ID,
        idStub:
          typeof input.idStub === 'string' && input.idStub.trim().length > 0
            ? input.idStub.trim()
            : null,
        residentRef: input.residentRef?.trim() || FIXTURE_RESIDENT_ID,
        status: 'expected',
        createdAt: at,
        updatedAt: at,
        checkedOutAt: null,
      };
      visitors = [visitor, ...visitors];
      return visitor;
    },

    checkOut(visitorId: string): DemoVisitor | null {
      return this.setStatus(visitorId, 'checked_out');
    },

    setStatus(visitorId: string, status: VisitorStatus): DemoVisitor | null {
      if (!isVisitorStatus(status)) return null;
      const idx = findIndex(visitorId);
      const cur = visitors[idx];
      if (!cur) return null;
      const at = isoNow();
      const next: DemoVisitor = {
        ...cur,
        status,
        updatedAt: at,
        checkedOutAt: status === 'checked_out' ? at : cur.checkedOutAt,
      };
      const copy = visitors.slice();
      copy[idx] = next;
      visitors = copy;
      return next;
    },
  };
}

let noticeSingleton: DemoNoticeStore | null = null;
let visitorSingleton: DemoVisitorStore | null = null;

export function getDemoNoticeStore(): DemoNoticeStore {
  if (!noticeSingleton) noticeSingleton = createNoticeStore();
  return noticeSingleton;
}

export function getDemoVisitorStore(): DemoVisitorStore {
  if (!visitorSingleton) visitorSingleton = createVisitorStore();
  return visitorSingleton;
}

export function resetDemoNoticeStoreForTests(): void {
  noticeSingleton = null;
}

export function resetDemoVisitorStoreForTests(): void {
  visitorSingleton = null;
}
