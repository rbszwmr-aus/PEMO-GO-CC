# UI-066-RULINGS — close: the corpus digest hashes what is authored, not what is stamped

**Date:** 2026-09-06
**PID:** UI-066 (UI track) — corpus digest excludes the stamped `contractVersion`.
**Authorises:** the Rule 7 close (archive/ + index row + this filed artifact).
**Landed:** `main` @ `735b6d6`, tree `095ee24` (re-read via `git ls-remote`, equal to local), through the hook, no `--no-verify`. CI `register: success · flutter-tests: success`.
**Implements:** `RULING-corpus-digest-hashes-authored-not-stamped-2026-09-06.md` (option b).

---

## 1. Accepted

The fix is the right one and is proven the right way. `stripStampedVersion` blanks the stamped `contractVersion` before hashing in the shared `sha256` path, so record and check stay identical; corpus content is unchanged; screens render as before. `write-digest.ts` stops recording a top-level `contractVersion` (`versionIndependent: true`) — correct, since a stored version note was itself the stamped-as-authored coupling being removed.

The guard is proven to still bite, non-vacuously — the test that matters most in a change that makes a guard ignore something:

- version bump alone → every digest unchanged, asserted non-vacuous (raw buffers differ first);
- an authored `titleEn` change → digest still moves (the strip did not blind it);
- `stamp-version` stamps no fixture field beyond `contractVersion` → the "any other stamped field" clause caught structurally, so a future second stamped field reds this test and names the fix.

This is (b), not the refused (a): what the digest hashes changed, the corpus did not; §4's `counts`/`getOverview` corpus stayed out of scope, deferred to UI-065. Merge-gate discipline honoured in full.

## 2. The allocation call was correct, and it is evidence

`--next` said 063; 063/064 are held by GEN-063/GEN-064 on codex branches whose allocations are not yet on main's register. Taking 063 would have reissued a number another track holds. UI CC took **UI-066** — the lowest free across all *known* allocations — and documented the 063–065 gap in the allocation commit and the PID.

That is the right judgement, and it is also **direct evidence for the gate-coverage PID's known concern**: `pid-index --next` resolves against main's register alone and cannot see allocations in flight on unmerged codex branches, so it will propose a colliding number whenever two tracks run in parallel. UI CC's manual avoidance worked *this* time because it knew the held numbers; a tool that only a human's memory saves from collision is not yet a gate.

Recorded as a first-class input to the gate-coverage PID: **`--next` must resolve against all known allocations — fetched `origin/main` plus in-flight branch allocations — or refuse when it cannot see them.** This sits alongside the empty-case debt survivors and the `--next`-against-fetched-`origin/main` item already queued there.

## 3. Carried items, verified

- Both readouts (mockup-vs-built, demo-readiness) now tracked as D0. Good.
- UI-058's closed date corrected `2026-09-03` → `2026-09-04` (its close-push UTC date) in archive and index — a stale-row fix, not a reopen. Accepted.

## 4. One finding recorded — not a close blocker, a fast-follow

`stripStampedVersion` mirrors `stamp-version`'s byte substitution (`/("contractVersion": ")[^"]*(")/`) as its **own copy** of that pattern. Two copies of one pattern are `a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy`: if `stamp-version` ever changes the stamped line's shape (whitespace, quoting, nesting), the strip's regex silently stops matching and the guard reds again — for the copy's reason, not the corpus's.

The clean guard against that drift is not a shared regex refactor for its own sake; it is that **test 1 drives the *real* `stamp-version` and then asserts digests unchanged** — so any format change to the stamp is caught by the strip's own test automatically.

- If UI-066's test 1 already runs the actual `stamp-version` tool over a fixture (not a hand-edited version string), the drift is caught and this finding is **closed by verification** — state so in the archive note.
- If it uses a hand-edited version, add the round-trip (stamp for real → assert strip neutralises exactly what stamp wrote), or bind both to one shared pattern. Either remedy **rides UI CC's next PID's first commit**, the way the UI-058 date fix rode this one — not a reopen of UI-066.

This does not block the close: the two patterns are identical today and the guard is green. It is recorded so the copy does not outlive the memory that keeps it in sync.

## 5. Close

UI-066 is **cleared to close under Rule 7**: archive the PID, add the index row, this artifact is the filed `-RULINGS-`. Record in the archive note which branch of §4 applies (verified vs fast-follow).

UI-065 stays after GEN-064 closes. This unblocks GEN-064's rebase: its 2.3.0 stamp no longer reds the corpus guard.

## 6. Principle

No new principle. Two existing ones did the work and are cited: `a-digest-must-hash-what-is-authored-not-what-is-stamped` (the fix), `a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy` (the §4 finding).
