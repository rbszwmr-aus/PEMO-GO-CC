/**
 * THE VALIDATOR'S FAILURE CODES, DECLARED.
 *
 * ─── WHY THIS FILE EXISTS (GEN-034 gap 2) ────────────────────────────────────
 *
 * A validator code is an identifier in its own namespace, and two other checks
 * need to know the namespace exists: `adrs-present.sh` must tell a validator code
 * apart from a dangling PRINCIPLE id (they share the bracketed spelling), and the
 * fixture suite reports codes to humans who then cite them.
 *
 * Until now that namespace was DERIVED BY GREPPING THE CALL SITES —
 * `fail('<code>'` out of `validate.mjs`. That works only while every call has the
 * same shape. MEASURED at the pin: `validate.mjs` makes 120 `fail(` calls and the
 * grep resolved 73 codes; a call written `fail(code, ...)` with the code in a
 * variable, or wrapped across a line break, is simply invisible to it. The
 * consumer's VACUITY REFUSAL catches the derivation resolving NOTHING — it cannot
 * catch it resolving MOST, which is the failure that actually happens.
 *
 * So the codes are DECLARED here and the derivation reads the declaration. This
 * is the same move as the `Problem.type` axis, which derives from the registry
 * rather than from the throw sites — and the same move as `ADR-018`: the consumer
 * stops inferring what it is checking against.
 *
 * ─── THE DECLARATION IS LOAD-BEARING, NOT DECORATIVE ─────────────────────────
 *
 * `validate.mjs` imports this and REFUSES a code that is not declared. A list
 * nothing enforces drifts from its subject the first time someone is in a hurry,
 * and a stale allowlist is worse than none: it looks like a source of truth.
 * Adding a validator therefore means adding its code here, and forgetting is a
 * loud failure at the call, not a silent narrowing of another check.
 */

/** Every code `fail()` may be called with. Sorted; add new codes in place. */
/**
 * THE GRAMMAR OF A VALIDATOR CODE, DECLARED ONCE (GEN-046 G5).
 *
 * A code is a lowercase alphanumeric run, and may then contain `-` and `.`.
 * The DOT is the whole reason this constant exists. `GEN-043` shipped
 * `openapi-3.1`, and three separate checks — this file's consumer in
 * `adrs-present.sh` (twice) and `validator-codes.test.ts` — each wrote the
 * grammar out as `[a-z0-9-]*`. All three silently skipped the code, and all
 * three AGREED, which is what made it invisible: `[correlated-lists-certify-nothing]`
 * with the correlation in a regex rather than a list.
 *
 * Written as a source string, not a RegExp, because the shell consumer builds a
 * `sed` pattern from it and a compiled RegExp cannot be handed across that seam.
 * Every consumer derives from HERE; nobody writes the character class again.
 */
export const VALIDATOR_CODE_PATTERN = '[a-z0-9][a-z0-9.-]*';

export const VALIDATOR_CODES = Object.freeze([
  'acknowledgement-consistency',
  'bilingual',
  'classifier-unknown-field',
  'client-only-reason',
  'contract-lock-corpus-hash',
  'contract-lock-surface-hash',
  'contract-lock-version',
  'contract-version',
  'coverage-consistency',
  'coverage-severity-pairing',
  'declared-count',
  'dedup-undecidable',
  'derivation-basis',
  'derivation-disagreement',
  'derivation-missing',
  'derivation-unevaluable',
  'fixture-json',
  'fixture-missing',
  'fixture-undeclared',
  'forbidden-term',
  'forbidden-value',
  'freshness-age',
  'freshness-status',
  'mgmt-forbidden-term',
  'mgmt-forbidden-value',
  'mixed-language',
  'openapi-3.1',
  'operation-missing',
  'operation-unknown',
  'orphan-event-absent',
  'orphan-event-undeclared',
  'orphan-transition-complete',
  'orphan-transition-unreasoned',
  'portal-absence-vs-zero',
  'portal-counts-computed',
  'portal-eligibility-inversion',
  'portal-facet-scope',
  'portal-forbidden-term',
  'portal-public-area',
  'problem-type-enum-agreement',
  'problem-type-status',
  'problem-type-status-value',
  'problem-type-surface',
  'problem-type-undeclared',
  'problem-type-unused',
  'revision-consistency',
  'scenario-binding-absent',
  'scenario-binding-mismatch',
  'scenario-binding-missing',
  'scenario-binding-pending-count',
  'scenario-binding-unbacked',
  'scenario-binding-unreasoned',
  'scenario-binding-unverified',
  'schema-missing',
  'schema-validation',
  'serving-scope',
  'severity-bilingual-label',
  'severity-count',
  'severity-definition',
  'severity-enum-agreement',
  'severity-incoherent',
  'severity-value',
  'shared-identifier',
  'shared-world-mismatch',
  'shared-world-stale',
  'shared-world-unadjudicated-count',
  'shared-world-undeclared',
  'shared-world-unreasoned',
  'shared-world-unstatused',
  'state-coverage',
  'status-undeclared',
  'timestamp-order',
  'truncated-copy',
  'update-pending-consistency',
]);

/** Membership, for the enforcement inside `fail()`. */
export const VALIDATOR_CODE_SET = new Set(VALIDATOR_CODES);
