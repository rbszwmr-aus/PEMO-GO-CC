/**
 * Navigation items the API refuses this staff member, so the nav does not offer a door that only says “no”.
 *
 * Two nav items are backed by a read of their own: the Audit log and Integration status. When that read answers
 * 403 the item is left out of the nav (hidden, not greyed). Everything else is left alone: a 401 is a session
 * problem the screen says itself, a 404 or a network error is “the API is not there”, and the fixture source
 * has nothing to refuse. The screen, if someone opens it by its address, still shows the refusal in words.
 */

import { API_BASE, DEMO_BEARER, autoLiveEnabled, type SourceMode } from '../data/sourced.ts';
import type { NavItemId } from '../data/nav-ia.ts';

/** The read that decides each nav item. Same paths the screens’ own clients call. */
export const NAV_BACKING_ROUTES: Readonly<Partial<Record<NavItemId, string>>> = {
  'adm-audit': '/admin/audit-log?limit=1',
  integrations: '/integration-status',
};

export interface NavAccessOptions {
  mode: SourceMode;
  base?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Test seam; defaults to the VITE_PEMO_AUTO_LIVE switch. */
  enabled?: boolean;
}

async function refused(path: string, o: NavAccessOptions): Promise<boolean> {
  const doFetch = o.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const origin = (o.base ?? '').replace(/\/$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 2500);
  try {
    const r = await doFetch(`${origin}${API_BASE}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${o.token ?? DEMO_BEARER}` },
      signal: ctl.signal,
    });
    return r.status === 403;
  } catch { return false; } finally { clearTimeout(timer); }
}

/** The nav items to leave out. Empty on the fixture source, and whenever the API cannot be asked. */
export async function deniedNavItems(o: NavAccessOptions): Promise<ReadonlySet<NavItemId>> {
  if (o.mode === 'fixture' || (o.mode === 'auto' && !(o.enabled ?? autoLiveEnabled()))) return new Set();
  const ids = Object.keys(NAV_BACKING_ROUTES) as NavItemId[];
  const answers = await Promise.all(ids.map((id) => refused(NAV_BACKING_ROUTES[id]!, o)));
  return new Set(ids.filter((_, i) => answers[i]));
}
