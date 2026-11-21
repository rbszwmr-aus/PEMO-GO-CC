# GEN-044 — C2 cases intake/triage (ADR-020 cut C) — build + merge report

**Merged.** `dfdcf8c7` → **`6020a5405b1d18a3f381e01a146ef6b0c28b9218`**
**Tree-hash `6fc8bbafd178f1b0142dd423d4f9d4adc8b4d151`** — local and remote EQUAL via `ls-remote`.
Refspec push, `main` never checked out, through the hook (31/0), no `--no-verify`. **Date** 2026-09-02.

**Carry-in:** pin matched; all seven cited ADRs resolve. **ACTS ONLY** — no routes, no handling, no
read surface. **CONTRACT DELTA: NONE.**

## THE CLOSE IS NOT DONE — no filed ruling. The PID stays `draft`.

---

## TWO SELF-INFLICTED FAILURES WORTH READING BEFORE THE FEATURES

### 1. FIVE OF MY BITES WERE FALSE, and the harness reported every one as caught

My mutations used `false && <original condition>`. That breaks TypeScript's narrowing —
`target.unitId` stops being `string` — so **the build failed, the test suite never ran, and
`with-mutation` counted the non-zero exit as the red.** Five guards reported as proven had proven
nothing.

**Found by noticing a bite's log file did not exist.** The bite helper now requires the log to be
present (the suite actually ran) AND the NAMED case to be the one that failed; every mutation was
rewritten to compile. Re-run strictly, all five red for their own case.

Two smaller harness faults surfaced alongside: `${2:+--test-name-pattern="$2"}` splits on the space
inside a test name, so the filter never reached node and each bite silently ran the whole file,
reporting whichever case failed first. Fixed by passing the pattern as a separate quoted argument.

**This is `[adapter-bite-severs-the-plumbing]` and `[probe-must-bite]` compounding:
a harness that can report "caught" without running the subject is worse than no harness.**

### 2. THE BATTERY'S PRE-FLIGHT BLOCKED THIS PID — correctly refusing, wrongly diagnosing

`prove.sh` compared its derived boundary victims against `origin/main` and aborted on **any**
difference, telling me to *"restore it from origin/main"* — that is, to discard this PID's work.

The premise was that a difference could only be a killed battery's injected import. **The victims are
DERIVED from the tree** (first sorted source file in a non-platform module), so the first PID to
legitimately edit whichever file it lands on is locked out of the battery entirely. `notices`,
`helpdesk` and `service_case` all shifted that selection as they were added; this PID's export in
`modules/helpdesk/src/index.ts` finally landed on it.

**Fixed by anchoring on the injection itself** — the exact import specifier this script writes, on the
first line, which ordinary code has no reason to contain. `[anchor-the-discriminator]`: classify the
thing you mean, not a proxy that correlates with it.

**Proven both directions:** a real injected leftover still ABORTS; a legitimate edit does not.

---

## D2 — THE REPORTABLE SET, a new authority shape

Staff authority is a grant expanded through the hierarchy. **A resident holds no grant at all**, and
their authority to report is derived from where they live:

| target | rule |
|---|---|
| their own unit | must be a unit they currently occupy |
| a Location | its **serving scope** must intersect their units |
| anything else | refused |

**Serving scope, not containment** — the lift that serves their floor, whether or not it stands near
them. And the refusals are the point: another household's unit is a statement about somebody's home;
another block's lift *looks* harmless because a lift is shared infrastructure, which is exactly why
"any Location" is the tempting wrong rule. A report naming **no** subject is refused too — a subject
nobody can check is not general feedback.

## D4 — ATOMIC OPEN-CASE, and why the happy path cannot test it

A Case whose Ticket does not point back is an **orphan**: ADR-020 D9 makes the Ticket the only route
from a Case to its reports, so nothing can ever reach it.

Case 5 asserts both links exist — **and that is equally true of two separate transactions.** The
difference appears only when something fails between them, which is the ordinary case of a crash. So
case 5b forces it: it seizes the primary key the act will derive, so the ticket write dies *after* the
Case insert has run. One transaction rolls back; two leave the orphan. **The mutation
`caseTx` → `caseDb` reds it.**

A modular monolith permits a cross-module transaction and forbids cross-module TABLE access. This
crosses none — each statement runs on its own module's handle — and that distinction is why the act
lives in the composition layer rather than in either module.

---

## ACCEPTANCE

| # | criterion | bite → result |
|---|---|---|
| 1 | resident submit: ticket, display ref, **no audit row** | — asserted directly |
| 1b | staff submit: ticket **and** an audit row with the witness | — |
| 2 | Location serving their unit allowed | drop the intersection → **2b reds** |
| 2b/2c | another block's lift / another unit refused | drop the unit check → **2c reds** |
| 2d | no subject refused | — |
| 3 | anonymous fail-closed | `no row ⇒ true` → **3 reds** |
| 4 | triage floor + re-triage appends | any-node floor → **4 reds** |
| 5 | both links, one transaction | — |
| **5b** | **failure leaves NO Case** | `caseTx` → `caseDb` → **5b reds** |
| 6 | one primary Case ever | drop the check → **6 reds** |
| 7 | client-key submit, derived-key triage, stale refusal | — |
| 8 | attachments by reference; **no upload path exists** | asserted by absence |
| 9 | related linking, out-of-reach refused | — |
| 10 | stances + explicit no-reason entries | — |

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| bootstrap | 55 migrations, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **451 / 451** (436 + 15) |
| battery | **31 / 31** |
| boundaries / ADR-018 types | **PASS** / **PASS** |
| validator / stamp / contract-hash | rc 0 |
| register | OK, next **045** |
| contract delta | **NONE** |

## Judgement calls, disclosed

- **`originating_ticket_ref` is NULLABLE** though `createCase` requires it. Rows predating the
  migration cannot be backfilled: the value lives in `helpdesk`, and a migration may touch only its
  own schema — the runner enforces that. Inventing provenance is worse than admitting its absence.
- **GEN-038's boundary test forbade any `%ticket%` column** in `service_case`. It now excludes the
  satisfaction grain and the provenance column BY NAME, with the reasoning recorded: the rule is
  about the ASSOCIATION having one home, and a test that fails for the word "ticket" fails for
  another rule's reason.
- **A composition-layer query was schema-qualified** (`platform.attachment_ref`) and the boundary
  scan refused it. Unqualified now: which module a query belongs to is expressed by WHICH HANDLE runs
  it, not by a prefix.
- **`case_current` needed recreating** when the column was added — the `SELECT *` view trap that 0135
  already documented and this migration still had to relearn.

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-044-*-RULINGS-*`.
2. **The ticket disposition and lifecycle vocabularies fully OVERLAP** — `ticket_current` maps
   disposition to state one-to-one, so `opened|triaged|escalated|closed|reopened` are both. That is
   the exact defect GEN-042 fixed for notices, still latent here. Not touched: the dispatch did not
   ask, and it needs a migration plus a generated vocabulary. **Named for the C3 dispatch.**
3. **`linkRelatedTicket` carries the previous disposition forward**, because linking is not a
   lifecycle act and there is no disposition for it. Defensible, and a consequence of (2).
4. **No upload path for attachments** (D5), blocked on the object-store decision. On the usability
   critical path and named.
5. **`related_ticket_ref` holds one ticket**, so linking a third replaces the second. The schema is
   single-valued; a many-to-many needs its own decision.

Out of scope as dispatched: C3 handling; CAS-04 transport; routes and read surface; attachment upload;
SLA; escalation; team entity; CAS-05; CAS-06.

**HARD STOP for the close ruling.**
