/**
 * THE COPY-CLAIMS SWEEP — F-COPY-SWEEP, inherited from UI-028-ST and delivered here.
 *
 * UI-022-ST's class: a label the client invents is a CLAIM the client makes. Every
 * client-authored sentence is checked against the resident-portal boundary
 * denylist. The `bookingParty` group (heldby / bookedby / reservedby / bookername)
 * is what enforces "SlotState: unavailable reveals no holder" at the copy layer —
 * a tooltip or label naming a holder would re-open what the schema collapsed.
 *
 * THE LIST IS THE resident-portal ONE, and its boundary INVERTS the resident-mobile
 * one for booking: price/fee/capacity/membership are resident-facing (allowedExceptions)
 * and permitted; device/holder/internal/HKSTP identifiers are not.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { MESSAGES } from '../../src/i18n/messages.ts';
import { PORTAL_CONTRACT_DIR } from '../../tool/corpus-source.ts';

const DENY = JSON.parse(readFileSync(join(PORTAL_CONTRACT_DIR, 'forbidden-terms.json'), 'utf8'));

test('the scan loaded the resident-portal list, and it is recognisable', () => {
  assert.equal(DENY.surface, 'resident-portal', 'this is not the resident-portal denylist');
  const groups = Object.values(DENY.forbiddenPropertyNames) as Array<{ terms: string[] }>;
  const all = groups.flatMap((g) => g.terms);
  assert.ok(all.length > 20, 'the denylist is suspiciously small — an empty oracle agrees with everything');
  // The inversion: the holder-naming terms this surface forbids are present.
  assert.ok(all.includes('heldby') && all.includes('bookedby'), 'the bookingParty group is missing');
});

/** Every user-visible string in MESSAGES, recursively. */
function copyStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'object' && node !== null) {
    const o = node as Record<string, unknown>;
    if (typeof o.en === 'string' && typeof o['zh-Hant'] === 'string') {
      out.push(o.en as string, o['zh-Hant'] as string);
    } else {
      for (const v of Object.values(o)) copyStrings(v, out);
    }
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const allowed = new Set<string>((DENY.allowedExceptions ?? []).map((e: { term: string }) => e.term));
const forbidden = (Object.values(DENY.forbiddenPropertyNames) as Array<{ terms: string[] }>)
  .flatMap((g) => g.terms)
  .filter((t) => !allowed.has(t));

test('no client-authored copy contains a forbidden boundary term', () => {
  const strings = copyStrings(MESSAGES);
  assert.ok(strings.length > 50, 'copy collection is too small — the walk is broken');
  const hits: string[] = [];
  for (const s of strings) {
    const n = norm(s);
    for (const term of forbidden) if (n.includes(term)) hits.push(`"${s}" contains forbidden term "${term}"`);
  }
  assert.deepEqual(hits, [], `client copy crossed the boundary:\n  ${hits.join('\n  ')}`);
});

test('the scan is not vacuous — it would catch a holder-naming string', () => {
  const planted = norm('Held by another resident'); // heldby
  assert.ok(forbidden.some((t) => planted.includes(t)), 'the scan would not catch a holder-naming leak');
});
