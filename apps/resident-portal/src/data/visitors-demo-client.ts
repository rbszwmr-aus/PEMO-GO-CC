/**
 * Thin fetch wrappers for resident-portal visitors (live :3200).
 * Freeze: docs/contracts/resident-portal-v0-notices-visitors-demo.md
 * Check-out: POST|PATCH .../check-out — no BMS unlock.
 */
export const DEMO_RESIDENT_HEADER = 'X-PEMO-Demo-Resident';
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';

const visitorsBase = '/api/resident-portal/v0/visitors';

function headers(residentId = FIXTURE_RESIDENT_ID): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: 'Bearer demo',
    [DEMO_RESIDENT_HEADER]: residentId,
  };
}

export async function listDemoVisitors(residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  const res = await fetch(visitorsBase, { method: 'GET', headers: headers(residentId) });
  if (!res.ok) throw new Error(`visitors list ${res.status}`);
  return res.json();
}

export async function getDemoVisitor(visitorId: string, residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  const res = await fetch(`${visitorsBase}/${encodeURIComponent(visitorId)}`, {
    method: 'GET',
    headers: headers(residentId),
  });
  if (!res.ok) throw new Error(`visitor detail ${res.status}`);
  return res.json();
}

export async function createDemoVisitor(
  input: {
    name: string;
    purpose?: string;
    expectedFrom: string;
    expectedTo: string;
    hostUnitId?: string;
    idStub?: string;
  },
  residentId = FIXTURE_RESIDENT_ID,
): Promise<unknown> {
  const res = await fetch(visitorsBase, {
    method: 'POST',
    headers: headers(residentId),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`visitor create ${res.status}`);
  return res.json();
}

export async function checkOutDemoVisitor(
  visitorId: string,
  residentId = FIXTURE_RESIDENT_ID,
): Promise<unknown> {
  const res = await fetch(`${visitorsBase}/${encodeURIComponent(visitorId)}/check-out`, {
    method: 'POST',
    headers: headers(residentId),
    body: '{}',
  });
  if (!res.ok) throw new Error(`visitor check-out ${res.status}`);
  return res.json();
}
