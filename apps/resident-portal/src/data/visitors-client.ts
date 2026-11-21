/**
 * Portal visitors — LIVE :3200 first; fixture store only if API unreachable.
 * Freeze: docs/contracts/resident-portal-v0-notices-visitors-demo.md
 */
import {
  FIXTURE_RESIDENT_ID as STORE_RESIDENT,
  FIXTURE_UNIT_ID,
  getDemoVisitorStore,
  type CreateVisitorInput,
  type DemoVisitor as StoreVisitor,
  type VisitorStatus,
} from '@pemo/notices-visitors-demo-store';
import { asVisitorPass, type VisitorPass } from './visitor-pass.ts';
import {
  checkOutDemoVisitor,
  createDemoVisitor,
  getDemoVisitor,
  listDemoVisitors,
} from './visitors-demo-client.ts';

export type { CreateVisitorInput, VisitorPass, VisitorStatus };
/** Store visitor plus the API's `visitor.pass` (snake_case, or null). The local fixture store has none. */
export type DemoVisitor = StoreVisitor & { pass?: VisitorPass | null };
export {
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_ID,
  FIXTURE_UNIT_LABEL,
} from '@pemo/notices-visitors-demo-store';

function asVisitor(raw: unknown): DemoVisitor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nested = o.visitor && typeof o.visitor === 'object' ? (o.visitor as Record<string, unknown>) : o;
  const id =
    (typeof nested.visitorId === 'string' && nested.visitorId) ||
    (typeof nested.id === 'string' && nested.id) ||
    '';
  if (!id) return null;
  const statusRaw = typeof nested.status === 'string' ? nested.status : 'expected';
  const status = (['expected', 'checked_in', 'checked_out', 'cancelled'] as const).includes(
    statusRaw as VisitorStatus,
  )
    ? (statusRaw as VisitorStatus)
    : 'expected';
  return {
    visitorId: id,
    name: typeof nested.name === 'string' ? nested.name : '',
    purpose: typeof nested.purpose === 'string' ? nested.purpose : null,
    expectedFrom: typeof nested.expectedFrom === 'string' ? nested.expectedFrom : '',
    expectedTo: typeof nested.expectedTo === 'string' ? nested.expectedTo : '',
    hostUnitId: typeof nested.hostUnitId === 'string' ? nested.hostUnitId : null,
    idStub: typeof nested.idStub === 'string' ? nested.idStub : null,
    residentRef: typeof nested.residentRef === 'string' ? nested.residentRef : STORE_RESIDENT,
    status,
    createdAt: typeof nested.createdAt === 'string' ? nested.createdAt : '',
    updatedAt: typeof nested.updatedAt === 'string' ? nested.updatedAt : '',
    checkedOutAt: typeof nested.checkedOutAt === 'string' ? nested.checkedOutAt : null,
    ...('pass' in nested ? { pass: asVisitorPass(nested.pass) } : {}),
  };
}

function asVisitors(raw: unknown): DemoVisitor[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.visitors) ? o.visitors : null;
  if (!list) return null;
  const out: DemoVisitor[] = [];
  for (const item of list) {
    const v = asVisitor(item);
    if (v) out.push(v);
  }
  return out;
}

export async function listMyVisitors(): Promise<{ visitors: DemoVisitor[]; source: 'api' | 'local' }> {
  try {
    const raw = await listDemoVisitors(STORE_RESIDENT);
    const visitors = asVisitors(raw);
    if (visitors) return { visitors, source: 'api' };
  } catch {
    /* fall through */
  }
  return { visitors: getDemoVisitorStore().listForResident(STORE_RESIDENT), source: 'local' };
}

export async function getMyVisitor(id: string): Promise<{ visitor: DemoVisitor | null; source: 'api' | 'local' }> {
  try {
    const raw = await getDemoVisitor(id, STORE_RESIDENT);
    const visitor = asVisitor(raw);
    if (visitor) return { visitor, source: 'api' };
  } catch {
    /* fall through */
  }
  return { visitor: getDemoVisitorStore().get(id), source: 'local' };
}

export async function createMyVisitor(input: {
  name: string;
  purpose?: string;
  expectedFrom: string;
  expectedTo: string;
  hostUnitId?: string;
  idStub?: string;
}): Promise<{ visitor: DemoVisitor | null; source: 'api' | 'local' }> {
  try {
    const raw = await createDemoVisitor(input, STORE_RESIDENT);
    const visitor = asVisitor(raw);
    if (visitor) return { visitor, source: 'api' };
  } catch {
    /* fall through */
  }
  const visitor = getDemoVisitorStore().create({
    name: input.name,
    ...(input.purpose ? { purpose: input.purpose } : {}),
    expectedFrom: input.expectedFrom,
    expectedTo: input.expectedTo,
    hostUnitId: input.hostUnitId ?? FIXTURE_UNIT_ID,
    ...(input.idStub ? { idStub: input.idStub } : {}),
    residentRef: STORE_RESIDENT,
  });
  return { visitor, source: 'local' };
}

export async function checkOutMyVisitor(id: string): Promise<{ visitor: DemoVisitor | null; source: 'api' | 'local' }> {
  try {
    const raw = await checkOutDemoVisitor(id, STORE_RESIDENT);
    const visitor = asVisitor(raw);
    if (visitor) return { visitor, source: 'api' };
  } catch {
    /* fall through */
  }
  return { visitor: getDemoVisitorStore().checkOut(id), source: 'local' };
}
