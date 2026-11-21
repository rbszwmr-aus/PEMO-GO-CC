import { DEMO_ADMINS, seedTickets } from './seed.js';
import type {
  CreateTicketInput,
  DemoAdmin,
  DemoTicket,
  DemoTimelineEvent,
  TicketStatus,
} from './types.js';
import {
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
  isTicketStatus,
} from './types.js';

export interface DemoTicketStore {
  listAll(): DemoTicket[];
  listForReporter(reporterRef: string): DemoTicket[];
  /** Surfaces alias for listForReporter. */
  listForResident(reporterId: string): DemoTicket[];
  get(id: string): DemoTicket | null;
  getTicket(id: string): DemoTicket | null;
  create(input: CreateTicketInput): DemoTicket;
  createTicket(input: CreateTicketInput): DemoTicket;
  assign(id: string, admin: { adminId: string; adminLabel: string }): DemoTicket | null;
  assignTicket(
    id: string,
    admin: { adminId: string; adminLabel: string },
  ): DemoTicket | null;
  setStatus(id: string, status: TicketStatus, note?: string): DemoTicket | null;
  setTicketStatus(id: string, status: TicketStatus, note?: string): DemoTicket | null;
  listAdmins(): readonly DemoAdmin[];
  subscribe(listener: () => void): () => void;
  replaceAll(tickets: readonly DemoTicket[]): void;
}

/** Surfaces alias name. */
export type PortalTicketStore = DemoTicketStore;

function isoNow(): string {
  const d = new Date();
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createTicketStore(
  initial: readonly DemoTicket[] = seedTickets(),
): DemoTicketStore {
  let tickets: DemoTicket[] = initial.map((t) => ({
    ...t,
    timeline: [...t.timeline],
  }));
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const l of listeners) l();
  };

  const commit = (next: DemoTicket[]): void => {
    tickets = next;
    notify();
  };

  const findIndex = (id: string): number => tickets.findIndex((t) => t.id === id);

  const createImpl = (input: CreateTicketInput): DemoTicket => {
    const at = isoNow();
    const id = newId('tkt');
    const reporter =
      input.reporterRef?.trim() ||
      input.createdByResidentId?.trim() ||
      FIXTURE_RESIDENT_ID;
    const name = input.createdByName?.trim() || FIXTURE_RESIDENT_NAME;
    const created: DemoTimelineEvent = {
      id: newId('tln'),
      at,
      kind: 'created',
      actor: 'resident',
      messageEn: 'Ticket opened via resident portal.',
      messageZh: '住戶已於住戶入門網站開立服務單。',
      status: 'open',
      residentVisible: true,
    };
    const ticket: DemoTicket = {
      id,
      subject: input.subject.trim(),
      body: (input.body ?? '').trim(),
      category: (input.category ?? 'general').trim() || 'general',
      status: 'open',
      assignedAdminId: null,
      assignedAdminLabel: null,
      unitLabel: input.unitLabel?.trim() || FIXTURE_UNIT_LABEL,
      channel: 'app',
      reporterRef: reporter,
      createdByResidentId: reporter,
      createdByName: name,
      createdAt: at,
      updatedAt: at,
      dueAt: null,
      timeline: [created],
    };
    commit([ticket, ...tickets]);
    return ticket;
  };

  const assignImpl = (
    id: string,
    admin: { adminId: string; adminLabel: string },
  ): DemoTicket | null => {
    const idx = findIndex(id);
    const cur = tickets[idx];
    if (!cur) return null;
    const at = isoNow();
    const event: DemoTimelineEvent = {
      id: newId('tln'),
      at,
      kind: 'assign',
      actor: 'staff',
      messageEn: `Assigned to ${admin.adminLabel}.`,
      messageZh: `已指派予 ${admin.adminLabel}。`,
      residentVisible: true,
    };
    const next: DemoTicket = {
      ...cur,
      assignedAdminId: admin.adminId,
      assignedAdminLabel: admin.adminLabel,
      updatedAt: at,
      timeline: [...cur.timeline, event],
    };
    const copy = tickets.slice();
    copy[idx] = next;
    commit(copy);
    return next;
  };

  const setStatusImpl = (
    id: string,
    status: TicketStatus,
    note?: string,
  ): DemoTicket | null => {
    if (!isTicketStatus(status)) return null;
    const idx = findIndex(id);
    const cur = tickets[idx];
    if (!cur) return null;
    const at = isoNow();
    const events: DemoTimelineEvent[] = [
      {
        id: newId('tln'),
        at,
        kind: 'status',
        actor: 'staff',
        messageEn: `Status set to ${status}.`,
        messageZh: `狀態已設為 ${status}。`,
        status,
        residentVisible: true,
      },
    ];
    if (note && note.trim()) {
      events.push({
        id: newId('tln'),
        at,
        kind: 'note',
        actor: 'staff',
        messageEn: note.trim(),
        messageZh: note.trim(),
        residentVisible: false,
      });
    }
    const next: DemoTicket = {
      ...cur,
      status,
      updatedAt: at,
      timeline: [...cur.timeline, ...events],
    };
    const copy = tickets.slice();
    copy[idx] = next;
    commit(copy);
    return next;
  };

  const store: DemoTicketStore = {
    listAll(): DemoTicket[] {
      return tickets.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    listForReporter(reporterRef: string): DemoTicket[] {
      return tickets
        .filter(
          (t) =>
            t.reporterRef === reporterRef || t.createdByResidentId === reporterRef,
        )
        .slice()
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    },

    listForResident(reporterId: string): DemoTicket[] {
      return store.listForReporter(reporterId);
    },

    get(id: string): DemoTicket | null {
      return tickets.find((t) => t.id === id) ?? null;
    },

    getTicket(id: string): DemoTicket | null {
      return store.get(id);
    },

    create(input: CreateTicketInput): DemoTicket {
      return createImpl(input);
    },

    createTicket(input: CreateTicketInput): DemoTicket {
      return createImpl(input);
    },

    assign(id, admin): DemoTicket | null {
      return assignImpl(id, admin);
    },

    assignTicket(id, admin): DemoTicket | null {
      return assignImpl(id, admin);
    },

    setStatus(id, status, note): DemoTicket | null {
      return setStatusImpl(id, status, note);
    },

    setTicketStatus(id, status, note): DemoTicket | null {
      return setStatusImpl(id, status, note);
    },

    listAdmins(): readonly DemoAdmin[] {
      return DEMO_ADMINS;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    replaceAll(next) {
      commit(next.map((t) => ({ ...t, timeline: [...t.timeline] })));
    },
  };

  return store;
}

/** Surfaces alias. */
export const createPortalTicketStore = createTicketStore;

let singleton: DemoTicketStore | null = null;

/** Process singleton — API process holds the shared demo store for both apps. */
export function getDemoTicketStore(): DemoTicketStore {
  if (!singleton) singleton = createTicketStore();
  return singleton;
}

/** Surfaces alias. */
export const getPortalTicketStore = getDemoTicketStore;

/** Reset singleton (tests). */
export function resetDemoTicketStoreForTests(): void {
  singleton = null;
}

export const resetPortalTicketStoreForTests = resetDemoTicketStoreForTests;
