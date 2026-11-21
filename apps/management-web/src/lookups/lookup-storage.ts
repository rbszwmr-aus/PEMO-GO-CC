/**
 * The one place this app touches browser storage.
 *
 * It holds the lookup-list fixture edits, so a trial user can add or rename a type and see it
 * again after a reload, and the facility the booking calendar was last set to (a display
 * preference, one facility id). It never holds a credential, a token or anything about who is signed in
 * (the credential-storage guard in test/guard still bans that everywhere else and checks this file
 * for those words). When the Backend serves /lookups this file goes away with the fixture client.
 */

export interface LookupStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const KEY = 'pemo.lookups.v1';

export function browserStorage(): LookupStorage {
  const store = (): Storage | null => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  };
  return {
    get: (k) => { try { return store()?.getItem(k) ?? null; } catch { return null; } },
    set: (k, v) => { try { store()?.setItem(k, v); } catch { /* storage full or blocked: edits stay in memory for this page */ } },
    remove: (k) => { try { store()?.removeItem(k); } catch { /* ignore */ } },
  };
}

export function memoryStorage(): LookupStorage {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export const LOOKUP_STORAGE_KEY = KEY;

/** The facility the booking calendar showed last. Versioned so a later change of shape starts clean. */
export const CALENDAR_FACILITY_KEY = 'pemo.calendar.facility.v1';
