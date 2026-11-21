/**
 * THE VALIDATOR-CODE DECLARATION AND ITS CALL SITES AGREE — BOTH DIRECTIONS.
 *
 * `R5b`/`H5`, closing `GEN-034` gap 2.
 *
 * `adrs-present.sh` must be able to tell a VALIDATOR CODE from a dangling
 * PRINCIPLE id, because they share the bracketed spelling. It used to learn the
 * validator namespace by grepping `fail('<code>'` out of `validate.mjs` — which
 * resolves only the calls written that way. MEASURED at the pin: 120 `fail(`
 * calls, 73 codes resolved. A code the grep missed was silently reclassified as a
 * dangling principle, and the consumer's vacuity refusal could not see it,
 * because the derivation had not resolved NOTHING — it had resolved MOST.
 *
 * The fix is a DECLARATION the consumer reads. This test is what keeps the
 * declaration honest, and it is deliberately NOT run inside `adrs-present.sh`:
 * a file cannot non-circularly check a list it derives its own answer from. The
 * first version of that check looped over the declaration comparing it to a set
 * built from the declaration, and a mutation renaming a code passed it. That is
 * why the comparison lives here, against an INDEPENDENT source — the call sites.
 *
 * BOTH DIRECTIONS, because the two drifts fail differently:
 *   - a code used but not declared -> the namespace is incomplete, and
 *     `adrs-present` mistakes it for a dangling principle. The original defect.
 *   - a code declared but not used -> the declaration is stale, and a stale
 *     allowlist is worse than none because it reads as a source of truth.
 *
 * NO DATABASE. It lives in the integration suite because that is where this
 * repository runs Node tests over repository files; it touches no schema.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { VALIDATOR_CODES, VALIDATOR_CODE_PATTERN } from '../fixtures/validator-codes.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Every code any `fail(` call site names.
 *
 * This regex is the thing H5 says must NOT be the source of truth — and using it
 * HERE is the point: it is one independent witness being compared against
 * another, not a derivation anything downstream depends on. If it ever misses a
 * call shape, this test goes red in the "declared but never used" direction and
 * says so, which is the loud failure the old arrangement lacked.
 */
const calledCodes = (): ReadonlySet<string> => {
  const src = readFileSync(resolve(REPO, 'tests/fixtures/validate.mjs'), 'utf8');
  // THE CHARACTER CLASS INCLUDES A DOT, and that is not a detail. `openapi-3.1`
  // is a real code, and the original `[a-z0-9-]*` silently skipped it — in BOTH
  // this regex and the one that built the declaration, so the two agreed while
  // both were wrong. That is `correlated-lists-certify-nothing` inside the very
  // check written to prevent it: an "independent witness" is only independent if
  // it does not share the other side's blind spot.
  // The grammar is DECLARED, never restated here (GEN-046 G5): three copies of
  // it agreed on `[a-z0-9-]*` and all three lost `openapi-3.1` to the dot.
  const re = new RegExp(`fail\\(\\s*'(${VALIDATOR_CODE_PATTERN})'`, 'g');
  return new Set([...src.matchAll(re)].map((m) => m[1]!));
};

test('every code a call site uses is declared', () => {
  const declared = new Set(VALIDATOR_CODES);
  const undeclared = [...calledCodes()].filter((c) => !declared.has(c)).sort();
  assert.deepEqual(undeclared, [],
    'validate.mjs names codes that validator-codes.mjs does not declare; adrs-present.sh ' +
    'would read each of these as a dangling principle id');
});

test('every declared code is used by a call site', () => {
  const called = calledCodes();
  const unused = VALIDATOR_CODES.filter((c) => !called.has(c)).sort();
  assert.deepEqual(unused, [],
    'validator-codes.mjs declares codes no call site uses — a stale allowlist reads as a ' +
    'source of truth while describing something that no longer exists');
});

test('the declaration is sorted and free of duplicates', () => {
  // Not cosmetic: a duplicate makes the count checks in adrs-present.sh disagree
  // with each other, and an unsorted list makes an addition hard to review.
  assert.deepEqual([...VALIDATOR_CODES], [...VALIDATOR_CODES].sort(), 'declaration is not sorted');
  assert.equal(new Set(VALIDATOR_CODES).size, VALIDATOR_CODES.length, 'declaration has duplicates');
});
