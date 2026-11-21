/**
 * The residentsDetail URL parameter.
 *
 * Canonical: `residentId` — the only name this client ever WRITES.
 *
 * Legacy alias (read-only): links minted before 69b4fcc carried the same id
 * under the canonical name minus its `Id` suffix. Those links still open the
 * detail: the alias is read only when `residentId` is absent, and writeRoute
 * never emits it.
 *
 * THE LITERAL IS ALLOWLISTED, NOT HIDDEN. test/guard/no-client-role-reasoning
 * refuses any string literal equal to a contract role, and the legacy URL key
 * spells one. It is a URL key, not a role: nothing here compares against or
 * branches on a role. The guard's URL_KEY_ALLOWLIST names exactly the line
 * below (file-scoped, exact text); any other occurrence of the literal — here
 * or anywhere in src — still fails, and so does the entry if this line goes.
 */

export const RESIDENT_ID_PARAM = 'residentId';

/** The pre-69b4fcc parameter name, read as a fallback only. Never written. */
export const RESIDENT_ID_LEGACY_ALIAS = 'resident';

/** residentId, else the legacy alias, else undefined. */
export function readResidentId(q: URLSearchParams): string | undefined {
  return q.get(RESIDENT_ID_PARAM) ?? q.get(RESIDENT_ID_LEGACY_ALIAS) ?? undefined;
}

/** Writes the canonical name only; drops a stale legacy alias if present. */
export function writeResidentId(q: URLSearchParams, residentId: string | undefined): void {
  q.delete(RESIDENT_ID_LEGACY_ALIAS);
  if (residentId) q.set(RESIDENT_ID_PARAM, residentId);
}
