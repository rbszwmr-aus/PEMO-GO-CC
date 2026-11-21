# GEN-036 CLOSE — R5b code-hygiene sweep (derive membership, don't hand-list)

**Verdict: CLOSE.**
Date: 2026-09-01
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-036`.

Merge confirmed: `c91cd9e8` -> `dd693c8a`, tree-hash `a8a2b06c`, equal via `ls-remote`,
hook 29/0, no `--no-verify`. Gate from a from-nothing rebuild: contract 105/105,
integration 361/361, battery 29/29, register OK (next 037), enums/fixtures/boundaries
clean. Contract delta NONE, no migration.

---

H1 deviation ACCEPTED, right call: the literal rule (forbid raw-interpolated LIKE)
matches 0 sites -> a rule that can't fire proves nothing. Building the live-hazard
rule too (unescaped `_` across 18 files, GEN-014/029 class) was correct; one-sided
asymmetry, no need to ask.

H2 deviation: my spec ("every insert carries ON CONFLICT") was too literal. 224/259
have none and demanding it would be wrong on nearly all (222 deliberate
DELETE-then-INSERT, 2 ON COMMIT DROP temps). Deriving the PROPERTY (idempotent
re-seed) and naming the mechanism — executing intent over wording, measured first —
is right.

FOUR self-caught guard defects = the payoff for H4: commented-out SQL read as live;
H3 refusal kind guessed wrong; a bite firing on a syntax error not the guard; and
H5's CIRCULAR completeness check (ground truth built from the file it checks —
removed, not patched; real cross-check compares declaration vs call sites both
ways). The last is the R5 theme one level deeper.

H4 proven not asserted: GEN-029 reproduced on a real tracked file; uncommitted
marker survived, mutation gone; killed mid-flight, file byte-identical.

H5: validator codes now a declared enum/union validate.mjs consumes; citation
derivation reads it, not call-site greps. GEN-034 gap 2 retired.

`destructive-target-confirmed` sharpening: not supplied, rides as a one-line
follow-up, NOT in PID-PRINCIPLES — correct; stays adopted as practice.

---

## Executor's answer to the close question (H1 residual), re-derived at the pin

The ruling asked for one line confirming the 3 residual sites were genuine wildcard
intent rather than misses. **Re-measured against `c91cd9e8` itself, and the premise
does not hold as stated — reported rather than confirmed.**

At the pin there were **44** unescaped literal `_` patterns, not 45: **42 real query
lines, all fixed**, and **2 prose lines inside comments** (`apps/api/src/testing/harness.ts:46`
and `tests/integration/estate-contact-scope-write.test.ts:37`), both describing the
`GEN-014` bug they exist to warn about.

The `45` in the step-2 report was a MID-BUILD count that included
`modules/platform/src/db/like-pattern.ts` — a file this PID created — so it measured
the tree after the helper landed, not at the pin. The step-2 figure is corrected here.

**There are zero misses and zero residual wildcard-intent query sites.** The only
deliberate-wildcard site in the repository is the one marked in
`tests/integration/like-pattern.test.ts`, where the wildcard is the test's subject.
