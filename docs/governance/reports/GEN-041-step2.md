# GEN-041 — N3 notices acknowledgement (ADR-019 cut B) — build + merge report

**Merged.** `7110815d` → **`16148286bb0c57f2e31b87a4caab3a060fcd83ee`**
**Tree-hash `873aae6bb9608fa57957a5445956bde49db88beb`** — local and remote EQUAL, remote re-read via
`git ls-remote`. Refspec push, `main` never checked out, through the hook (31/0), no `--no-verify`.
**PID `GEN-041`** from the directory scan (next: 042). **Date** 2026-09-02.

**Carry-in:** pin matched; ADR-007/013/014/015/019 all resolve. **ACTS ONLY** — no routes, no read
surface. **CONTRACT DELTA: NONE** (no `openapi.yaml`, no file under `packages/api-contracts/`).

## THE CLOSE IS NOT DONE — no filed ruling. The PID stays `draft`.

---

## D6 — THE AUDIT-SOURCE MEASUREMENT (reported item), AND THE STOP CONDITION

**The dispatch's premise is incorrect, and the correction is the answer.** It asks how
`home_safety`'s acknowledgement "records its audit row". **It records none.**

| measurement | result |
|---|---|
| does `home_safety.acknowledgement` write `access.audit_event`? | **no** — it carries provenance in the domain row: `resident_id`, `action`, `occurred_at`, `received_at`, `correlation_id`, plus `acknowledgement_key` for idempotency |
| could a resident-authored `audit_event` row exist? | **no** — `audit_event.principal_id` has a **FOREIGN KEY to `access.staff_principal`** |
| are any residents staff principals? | **0** (GEN-006, Person ≠ Principal) |
| existing `audit_event` rows describing a resident act | **none, of any source** |

So the refusal happens at the **foreign key**, before GEN-025's authority biconditional is ever
evaluated. The biconditional is not the obstacle; the identity boundary is.

**STOP CONDITION: NOT REACHED, and I want to be precise about why.** It fires if the constraint
cannot represent a resident act *without inventing a group or weakening the biconditional*. Reusing
the measured shape requires **neither** — it requires writing no audit row at all, which is what the
established resident-act pattern already does. I invented nothing and weakened nothing. **No new
audit source value was created**, so no PO ruling is pre-empted.

`notice_acknowledgement` now carries `received_at` and `correlation_id`, so the two resident-act
tables in this codebase record a resident act **identically** rather than each inventing a shape.

---

## A MEASURED NEGATIVE: THE ADVISORY LOCK IS NOT LOAD-BEARING

Acceptance 7 expected `drop the lock → reds`. **It does not red**, and rather than report the case as
passing I discriminated which mechanism actually provides the guarantee:

| configuration | concurrent acknowledge | duplicate acknowledge |
|---|---|---|
| lock dropped, index intact | **one row — passes** | passes |
| index dropped, lock intact | **two rows — fails** | **fails** |
| both intact | passes | passes |

**The partial unique index is the mechanism.** `INSERT … ON CONFLICT DO NOTHING` is atomic, so the
race is closed by the constraint — the same answer `constraint-violation-never-500` gives elsewhere.

**And the lock does not close the other window either.** The read-then-write gap it would protect is
a resident acknowledging while the notice is being withdrawn — but `withdraw` takes a **per-notice**
lock and this takes a **per-recipient** one, so the two never contend.

I kept it and **documented it as UNPROVEN in the source**, with the measurement, rather than leave it
reading as proven. Carrying a guard nothing can fire is the shape this corpus keeps refusing. The
honest options are a cross-act lock ordering or deletion; **both are your call**, and neither is
inside this PID's acceptance.

---

## ACCEPTANCE — eleven cases

| # | criterion | mutation → result |
|---|---|---|
| 1 | all three acts, status reflects all | — provenance in 3 domain rows; **0** audit_event rows |
| 2 | not in the snapshot ⇒ refused | membership from CURRENT occupancy → **case 2 reds** |
| 3 | acting as oneself | drop the principal→resident binding → **case 3 reds** |
| 4 | once-only kinds | remove the conflict target → **case 4 reds** |
| 5 | latest-wins, declared options only | accept any key (free text) → **case 5 reds** |
| 5b | no declared question ⇒ refused | — |
| 5c | retried respond is one row | — |
| 6 | state gate | allow `withdrawn` → **case 6 reds** |
| 7 | concurrency | **drop the lock → does NOT red** (above) |
| 8 | stances + explicit no-reason | — derived from the act surface |
| 8b | refusals are values | — |

**Case 2 is GEN-040 case-7's first real home**, as the dispatch predicted: the snapshot — not a
re-resolution — gates the act, and the mutation that re-resolves is exactly the wrong rule.

---

## DEFECTS FOUND, and two of them are the same class back to back

1. **A backtick inside a SQL comment in a template literal** terminated the string, and the
   identifiers after it became JS (`ReferenceError: occurred_at is not defined`).
2. **The replacement comment then had `\n` become a real newline**, splitting the SQL comment and
   leaving a bare `and` in the query (`syntax error at or near "and"`).
   **Both were in prose ABOUT escaping in template literals** — the fifth and sixth incidents of the
   class the GEN-039 ruling recorded (`_`, `\n`, `\d`, backtick). The explanation now lives in a **JS
   comment outside the literal**, where neither can happen. That is the general fix: SQL strings hold
   SQL.
3. **The DOWN migration dropped a column the view still depended on.** The up recreated the view; the
   down did not. Only a full `migrate down` exercises that asymmetry, and the round-trip test found
   it — 417/418 — after everything else was green.
4. **`CREATE OR REPLACE VIEW` cannot change a view's column list**, and a view defined as `SELECT *`
   fixes its columns at creation. Adding `response_options` to the table left it invisible to every
   reader of `notice_current`. Recorded in the migration, because the failure surfaces as a bare
   "column does not exist" from a query that names the view.
5. **Two responses at one timestamp made "latest" a tie** an aggregate broke arbitrarily — my test
   reused one actor, so both answers shared `occurred_at`. Fixed on both sides: a fresh actor per
   act, and the resolution now tie-breaks on server-set `received_at`, which a client's clock cannot
   contradict.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| tables before | **0** |
| bootstrap | **52 migrations**, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **418 / 418** (407 + 11) |
| battery | **31 / 31** |
| boundaries / validator | **PASS** / rc 0 |
| register | OK, next **042** |
| contract delta | **NONE** |

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-041-*-RULINGS-*`.
2. **The advisory lock is unproven** (above). Ruling wanted: order the locks across acts, or delete it.
3. **Staff-recorded acknowledgement on a resident's behalf is NOT here**, as dispatched — own act,
   own floor, own audit source, forgery risk.
4. **Free-text responses wait on ADR-019 OQ4** (retention / legal hold), which is the right gate:
   prose is what a retention rule is actually about.
5. **`acknowledgementStatus` is module-internal and unread** — the outstanding-list and export are the
   staff read surface, and reminders are Notification's.
6. **The disjoint-vocabulary ruling from GEN-040 is NOT yet applied** to disposition/lifecycle. The
   ack `kind` vocabulary is already disjoint from both, as D1 required, but the notice lifecycle
   overlap that caused GEN-040's silent mismatch is still there. Owed to routes hardening.

Out of scope as dispatched and untouched: routes and the HTTP contract; the resident read projection
and staff outstanding-list/export; reminders; household aggregation; N2 templates.

**HARD STOP for the close ruling.**
