/**
 * Thin fetch wrappers for resident-portal notices (live :3200).
 * Freeze: docs/contracts/resident-portal-v0-notices-visitors-demo.md
 */
export const DEMO_RESIDENT_HEADER = 'X-PEMO-Demo-Resident';
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';

const noticesBase = '/api/resident-portal/v0/notices';

function headers(residentId = FIXTURE_RESIDENT_ID): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: 'Bearer demo',
    [DEMO_RESIDENT_HEADER]: residentId,
  };
}

export async function listDemoNotices(residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  const res = await fetch(noticesBase, { method: 'GET', headers: headers(residentId) });
  if (!res.ok) throw new Error(`notices list ${res.status}`);
  return res.json();
}

export async function getDemoNotice(noticeId: string, residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  const res = await fetch(`${noticesBase}/${encodeURIComponent(noticeId)}`, {
    method: 'GET',
    headers: headers(residentId),
  });
  if (!res.ok) throw new Error(`notice detail ${res.status}`);
  return res.json();
}
