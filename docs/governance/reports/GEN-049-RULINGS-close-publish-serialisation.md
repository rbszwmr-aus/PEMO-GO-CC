# GEN-049 — Close ruling: the publish race replaced by the constraint it was fronting

Date: 2026-09-03. Merged 16a5991. Step report GEN-049-step1.md. Manifest 27 proven / 0 failed / 0 unreliable at the time; principle `a-race-is-not-a-bite` registered (76 → 77).

## Closed. Accepted in full.

C1 The ruling's option (i) premise was wrong and Main CC said so: `correct` appends another `publication_released`, so "≤1 publish assertion per notice" is not an ADR-019 invariant and a partial unique index would have been a wrong constraint. The invariant a concurrent loser actually hits is the existing `notice_version_unique (notice_id, version)` (migration 0126). The lock guarded nothing that constraint did not; it only bought the loser a tidy `stale-state` instead of an exception. Removing the lock and mapping 23505 on that constraint to the same `stale-state` refusal is the right shape: no new migration, no contract change, the database holds the invariant, the act owns the refusal's wording. This is option (ii)'s spirit under (i)'s mechanism, and better than either as written.

C2 `deriveActId` giving both concurrent writers the same assertion id for N+1 means a real overlap can hit `notice_pkey` before `notice_version_unique`. Both constraints express one invariant; both mapped. The runner's baseline control caught the first build's nondeterministic red unmutated — the four-condition criterion earning its keep.

C3 The bite is forced: A holds version 2 in an open transaction; B runs the real publish naming version 1, must block on the index, and after A commits must be refused `stale-state` with nothing of B's left (one version 2, zero snapshot rows, zero events). 6/6 red under mutation, 3/3 proven through the runner, 6/6 green baseline. Manifest entry renamed `publish-loser-is-refused-not-admitted`; `unreliable` gone.

C4 Harness defect found and fixed: a SIGKILLed runner leaves the mutant in the source because `finally` does not run on SIGKILL. `run-mutations.mjs` now refuses to start while any manifest mutation's `to` text is present in its file (plant one → exit 2 naming it) and restores on SIGINT/SIGTERM. Accepted; this is an instance of guard-remedies-are-non-destructive and a-bite-that-cannot-be-rerun-is-a-claim meeting in one place.

## Recorded
The ruling that dispatched GEN-049 named the plausible invariant and was corrected by the code. That is the intended order: the ruling names the question, the executor answers it from the schema, and the report says where the ruling was wrong. Nothing to amend in principle; the close notes the correction.
