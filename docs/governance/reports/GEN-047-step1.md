# GEN-047 step 1 — notices 2.1.0: permitted actions, state-entered, fixture parity

**Date:** 2026-09-03  **Pin:** `75d92fe`; allocated at `5fde336`; built on `355d217`.
**Battery:** 33 passed, 0 failed.  **API suites:** contract 109/109, integration 457/457.
**Manifest:** 24 proven, **1 failed** — a pre-existing GEN-040 bite, diagnosed below.
**NOT MERGED. HARD STOP** on that one item, and on one contract question (§7).

---

## 1 — the contract: 2.0.0 → 2.1.0, additive

Every removal in the diff is a version string. Nothing else was deleted or narrowed.

| change | item | level |
|---|---|---|
| `StaffNoticeListItem.titleZhHant` | UI-045 **G2** | additive |
| `StaffNoticeListItem/Detail.stateEnteredAt` | **D2** / G5 | additive |
| `StaffNoticeListItem/Detail.permittedActions` | **D1** | additive |
| `listNotices` query params `lifecycleState`, `noticeType` | **G4** | additive |
| `getNoticeOutstanding` gains 401/403/500 | **G6** | additive |
| `NoticeTransitionRequest` gains the content fields + `targets` | **found by D3** | additive |
| `NoticeActResponse` and `NoticeOutstandingResponse` gain `meta` | **found by D3** | additive |

**resident-mobile's SURFACE is unchanged** — `git diff` on its `openapi.yaml` is empty. Only its
corpus hash moved, because five fixtures were added, and a corpus change never moves a version.
Locks regenerated for both.

---

## 2 — D1: permitted actions, single-sourced

`apps/api/src/management/notice-permissions.ts`. The point is not the field; it is that **the acts
call it**. `stateRefusal(act, state, gated)` is the state precondition, and all seven acts now use it
— `grep` for a hand-written state comparison in `notice-acts.ts` returns one line, and that line only
chooses the wording of a refusal. There is no second table to keep in step because there is no second
table. `permittedActions` then dry-runs it plus the covering floor (`ADR-017`) for the role each act
demands (`ADR-018`), reusing the acts' own target expansion and fail-closed policy read.

**Content refusals are not predicted**, and case 1b asserts it: a caller with authority over a
half-translated notice is told `publish` is permitted, and the refusal is shown by attempting it.
Hiding the control would teach the author that publishing is forbidden rather than that a
translation is missing.

**Acceptance 1 is the matrix**: 5 states × 4 callers × 7 acts, where the expected value is not a
table I wrote but **the act actually invoked** on a notice created for that probe. A refusal of
`out-of-scope`/`wrong-state`/`approval-required` is the floor or state saying no; anything else means
permitted. **Bite:** diverge the role table so `approve` stops demanding the approver floor → a
staff-only caller is claimed able to approve and the act refuses them → case 1 reds.

## 3 — D2: state-entered

`notice_current.recorded_at` — the latest assertion, exposed. **No migration was needed**, which is
worth stating plainly rather than inventing one. Case 2 walks draft → pending → approved and asserts
the value tracks, then asserts the FIRST assertion's timestamp differs from the latest, so the
positive assertion cannot hold for the wrong reason. **Bite:** report `min(recorded_at)` — the
instance's creation, the rule that would silently order an approval queue by creation date → reds.

## 4 — D3: fixture parity, and what the fixtures found

**24 fixtures recorded** (19 management-web, 5 resident-mobile) by
`tests/fixtures/record-notice-fixtures.mjs`, from **real HTTP responses**, bound to a new scenario
`management__notices__lifecycle.sql`. Client keys are fixed so the notice ids are stable and
re-recording is a no-op; the recorder resets its own world first and **restores it afterwards**.

**All 13 operations GEN-042 shipped without fixtures now have them.** `fixture-debt.json` names the
**10 remaining** (grants, memberships, occupancy, provisioning, estate contacts, safety updates),
each with an owing PID and a reason — a debt with a creditor, not a permission.
`tests/contract/operation-fixture-parity.test.ts` derives its subject from the contract, so a NEW
operation without a fixture is a red. **Bite:** remove `getNoticeOutstanding`'s coverage → reds.

### Three contract defects the fixtures found immediately

Nothing else could have seen them, because the check is only as wide as the operations a fixture reaches.

1. **`NoticeTransitionRequest` forbade exactly what the server accepts.** It declared `fromVersion`
   and `reasonCode` under `additionalProperties: false`, while `reviseNotice` and `correctNotice`
   read and apply eight content fields and `targets` from the same body. **A client conforming to the
   contract literally could never change a notice's content** — the only two operations for changing
   content took a body permitting none of it.
2. **Eleven write responses and `getNoticeOutstanding` echoed no correlation identifier**, though this
   contract's own text says `meta` "echoes the correlation identifier … a response that cannot be
   correlated cannot be traced", and every read carries it. An act was the one thing that could not be
   correlated with the request that performed it.
3. **The parity harness's rename assertion assumed the path parameter is the last segment**
   (`${before.url}_moved`). Every fixture it had until now was a read like
   `/safety/events/{eventId}`; `/notices/{noticeId}/revise` is the first where it is not, and the
   assertion failed for the route's SHAPE rather than for anything being transcribed. Generalised to
   "strip the marker and the original must come back". Its Problem exemption is likewise now decided
   by the body's shape rather than a `problems/` path prefix.

## 5 — D4: the G2–G7 table

| # | finding | disposition |
|---|---|---|
| G1 | `getNoticeOutstanding` has no fixture | **resolved** — recorded, plus the parity check |
| G2 | list carries `titleEn` only | **resolved** — `titleZhHant` added |
| G3 | list `noticeType` is a bare string, no enum | **DEFERRED — see §7** |
| G4 | `listNotices` declares no query parameters | **resolved** — both filters contracted and implemented, narrowing the result and never the access |
| G5 | no time at which approval was requested | **resolved** — D2 |
| G6 | `getNoticeOutstanding` declares only 200/404 | **resolved** — 401/403/500 added |
| G7 | outstanding carries no recipient name | **DEFERRED — a product decision** |

**G7's deferral, with its reason:** UI-045 said it plainly — whether staff working an outstanding
list should see resident names is a product decision, not an omission to paper over. Adding a name
would widen what a staff surface discloses about residents, which is an `ADR-007` audience question.
I am not deciding it.

## 6 — D5, D6

**D5 — S2 overview `NoticeRow` was NOT touched.** No G-finding required it; the two open S2 gaps in
the validator are pre-declared and unrelated. Named, as instructed.

**D6 — vocabularies disjoint.** Case 5 is a type-level test: passing a disposition literal where a
lifecycle state is expected is a `@ts-expect-error`, so the comparison that silently never matched at
GEN-040 is no longer expressible.

---

## 7 — TWO THINGS THAT NEED A RULING

### (a) The manifest has one failure, and it is not GEN-047's

`GEN-040 publish-advisory-lock` — the concurrency bite for "two concurrent publishes produce exactly
ONE snapshot". **Measured, not asserted:**

| how it is run | result |
|---|---|
| the single case, in isolation, lock removed | **reds 6 of 6** |
| the whole file, lock removed (what the runner now does) | **ok / FAIL / FAIL** across three runs |

**Diagnosed cause, not the symptom: the lock is genuinely load-bearing, and the BITE is unreliable.**
Case 12 is a real race. Run alone it manifests every time. Run after the file's other fifteen tests,
the two publishes serialise naturally — warm pool, different timing — and the missing lock goes
undetected, so the test passes and the bite reports "the named case did not go red".

**GEN-046's own rule 4 caused this to surface**: bounding the blast radius meant the runner stopped
filtering to the target case, and this bite had been relying on that filter. It was "proven" at
GEN-040 and in every GEN-046 sweep by running alone.

**I have not fixed it.** GEN-046's stop condition says a bite that passes with its guard mutated is
reported and ruled on, not quietly repaired — and the repair here is a genuine design question:
either the manifest gains a declared per-entry isolation escape (which weakens rule 4 for exactly the
entries most likely to need it), or the test learns to force the overlap, or a race bite is accepted
as a different class of proof. **That is a ruling, and it is GEN-040's subject, not GEN-047's.**

### (b) The two new response fields are OPTIONAL, and required is better

`ADR-008`'s table puts a new required field at minor, so required was legal and is the better
contract — a consumer can rely on the field. Making them required invalidates the three
`mob-s5-notices` fixtures, and **PART A's ruling says not to touch `mob-s5-notices/detail.json`**.
Rather than edit a file I was told to leave — or regenerate its two siblings so that only the
forbidden one is stale — the fields are optional and the question is raised. One line to reverse.

---

## 8 — scope note, disclosed

**Two files under `apps/management-web/**` are modified**: `corpus-digest.json` and
`src/data/corpus.g.ts`. My PID file's write scope says "No apps/management-web/\*\*". The version bump
rewrote `meta.contractVersion` in every management fixture, which invalidated the UI's recorded
corpus digest and broke its build. GEN-046's standing ruling — *"the PID that bumps a contract
regenerates EVERY `*.g.ts` consumer of it, in every app … contract-derived generated files are
regenerated by the contract-bumping PID regardless of app"* — puts these two files on this PID.
**No hand-written UI source was touched**; both files are regenerated output.

---

## 9 — gaps, complete

1. **The GEN-040 concurrency bite is unreliable under the current criterion** — §7(a), needs a ruling.
2. **`permittedActions` / `stateEnteredAt` / `titleZhHant` are optional, not required** — §7(b).
3. **G3 and G7 deferred**, with reasons (§5).
4. **10 management-web operations still have no fixture**, named and owned in `fixture-debt.json`.
5. `apps/resident-mobile`'s 8 Flutter tests remain gated by nothing — GEN-048's D1.
6. The CI browser job remains unverified — GEN-048's D2.
7. Owed and untouched: harness classes for the ~36 prose bites; exact projection type; multi-node
   ticket case; context-scoped citation recognition; `destructive-target-confirmed` Section 0.

**A defect of mine, found by the harness and fixed:** my new test's teardown DELETED the
`planned_interruption` approval-policy row, which `database/seeds/60-notices-lift-interruption.sql`
owns and seeds as gated. That damaged the seeded world for every later test, and GEN-040's
fail-closed bite reddened case 1 as undeclared collateral. Rule 4 caught it. The teardown now
restores the seeded value instead of deleting it.
