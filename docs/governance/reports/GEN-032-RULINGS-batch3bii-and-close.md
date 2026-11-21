# GEN-032 CLOSE — W3 batch 3b-ii (bootstrap / the atomic provisioning act)

**Verdict: CLOSE. Merge authorized.**
Date: 2026-09-01

## What is proven

Green on a from-nothing rebuild, pin 516dc637 re-read at build start: contract
105/105, integration 342/342 (+8, run twice), battery 26/26, boundaries PASS,
validator PASS, stamp PASS. Contract version 0.6.0 → 1.0.0 (MAJOR, breaking),
citing the ADR-008 amendment. Weight 555 ins / 96 del across 30 files, 20 of
which are the generated contract-version restamp. No new migration (0124 carried
the schema).

## Decisions confirmed

- **D3 guard runs first, before any INSERT, under the org lock.** Ordering became
  load-bearing only once the act grew to four writes. Weakening EVER → LIVE reds
  battery CASE 2 — the tense is proven, not asserted. This is the exact position
  I earlier got wrong, now nailed down by a biting case.
- **D4 idempotency exempt-with-reason** landed as ruled; the route-refusal path
  reached through the guard (see finding below).
- **D5 confirmed already enforced** (GEN-031 Gap A enforcement half): no
  `identitySource` in the input type, `'external'` hard-coded in both command and
  act. The seed category is structurally unreachable from runtime.
- **D6 breaking bump, and the amendment does not shadow its ADR.** Moving ADR-008
  out still reds, so the GEN-017 hole stays closed. ADR-008 points at the
  amendment via ADR-010's convention, table retained verbatim, general rule
  carried into the pointer — *not listed in the table is never a licence.*

## Accepted finding — the route's `committed` had no oracle

Mutating `committed: () => true` onto the provisioning route left all 341 tests
green: CASE 1 asserted only the status code, and GEN-028's standing zero-audit-
rows oracle tests provisioning **at the module**, never reaching the primitive.
Nothing watched that route's declaration — the exact gap the standing oracle
exists to close, reappearing at the one site the oracle had deliberately routed
around. The new case provisions at the module first, then calls the route so the
**guard** refuses inside the act, asserting zero audit rows AND that the key is
not burned; re-run with the mutation, it reds. Accepted. This is probe-must-bite
applied to a blind spot the oracle itself created — the right instinct.

## PO error owned — PID id vs register allocation

I dispatched batch ii with id `W3-3b-ii`. That is not a register id. Main CC
probed rather than assumed: created `pids/W3-3b-ii.md`, ran the checker, which
did NOT fault — it reported `OK … Next allocation: 032`. **The register does not
see the file at all**, because `ID_RE = ^(TYPE)-\d{3}$` places a non-conforming
name outside the allocation authority Rule 1 defines — invisible to `max(NNN)+1`
and to the duplicate check. A silent invisibility is worse than a rejection.

**Ruling — naming, effective now:** the PID id is always the GEN-NNN the register
allocates. The `W3` / `batch 3b-ii` language is a human label that lives in the
title and body, never the id and never the commit tag. Batch ii's tag is
`[GEN-032]` (correct as taken). Batch iii will take the register's next
allocation as its id — not `W3-3b-iii`.

**Ruling — the register hole is a real defect, folded into R5.** The grep-cluster
governance PID (scheduled after W3) must make the register/allocation checker
**fault** on any `pids/` file whose stem does not match `ID_RE`, rather than
silently skipping it. Same family as the rest of R5: a rule whose membership is
grepped by hand — or whose scan silently ignores what falls outside its pattern —
is a suggestion. Until R5 lands, the naming ruling above prevents recurrence.

## Gap acknowledged, no action

`1.0.0` is a major bump on a contract no client consumes yet — correct by the
amendment, and nothing broke in practice. A version is a promise to future
consumers; making it before the first consumer exists is cheap and honest. No
action.

## Merge (standard)

Refspec push from worktree; main never checked out; tree-hash equality re-read
via `git ls-remote`; through the pre-push hook, NO `--no-verify`; `[GEN-032]`
commit tag. Rule 7 close: file → archive/ with index row, status: merged,
closed: <TODAY from `date`> (read the date, do not carry a value).

— PO ruling, filed as durable record.
