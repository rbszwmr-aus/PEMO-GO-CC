# ADR-010 AMENDMENT — the three open questions closed, and `ADR-011`'s with them

**Status:** **`Accepted`** — `v1.0`, accepted by the Product Owner 2026-08-19. `A1`–`A4` taken the same day on Product Owner rulings.
**Date:** 2026-08-19
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-010-AMENDMENT-open-questions-closed.md`
**Committing session:** `PEMO Contract`
**Amends:** `ADR-010` *Open questions* 1, 2 and 3; and `ADR-011` *Open question* 1.
**Gates released:** every write operation in PEMO.
**Related:** `ADR-006` (`C3`, `C4`, `D3`), `ADR-007` (`D3`, `D6`), `ADR-010` (`D1`, `D2`, `D4`, `D5`, `D6`), `ADR-011` (`D6`, `D10`), `DOC-021-ST`, `DOC-030-ST`.

---

## Why this amendment matters more than its length suggests

`DOC-021-ST` opened on 2026-08-14 with *four tracks dammed behind one undecided product question*. `DOC-030-ST`'s coverage audit made it **five** on 2026-08-19 and was the first to **measure** the dam: **10 unbuilt bullets closed by that one question**, 7 of them from two contract decisions — `API-017-ST` and `API-027-ST` — both closing writes for the same stated reason.

**PEMO can currently write one thing: a resident acknowledgement.** `API-017-ST` contracted eleven reads and zero writes. `GEN-018-ST` was buildable only because *for reads, scope is the only gate*. `UI-019-ST` renders every deferred write as absent. `ADR-011` `D10` closed interest writes. `S5` carries a fixture stuck at `supervisor-approval · pending` that no designed role could advance.

**All five are released by the four decisions below.** None of them required an engineering round.

---

## Decisions

### A1 — `ADR-010` *Open question 1* closed. **The bootstrap is a provisioning act, not a standing principal.**

**Option (a).** When an Organization is created, its **first scope grant is created as part of that act** — recorded with `D1`'s four audit properties and effective-dated like any other grant. After it, `D3`'s `G-2` rule takes over unchanged: a principal may create a grant only within a node they already hold.

**Option (b) — a standing break-glass principal — is rejected, and the reason is what to enforce.** A break-glass account is a **permanent maximum-privilege credential that exists between uses**, when nobody is watching it. A provisioning act exists only at Organization creation and leaves a dated record behind it.

> **The bootstrap is an event, not a role.**

**Stop condition, because this is the decision most likely to be undone by convenience:** any mechanism that creates a scope grant **outside a held node and outside Organization creation** is the break-glass shape arriving through the back door, whatever it is called. Provisioning scripts, admin CLIs and support tooling are the three places it will try to appear.

#### And this is the second instance of one shape — they must not be solved twice, differently

`GEN-029-ST` met the same problem four days later from the other side: `ADR-011` `D6` requires audit *attributable to a principal, not to a session, a service or a job* — **and a seeded row has no acting principal.** Its answer was honest absence, gated all-or-nothing against `source`, with **no placeholder principal representable**.

**A provisioning grant has no prior principal either.** It is the same category: **an act that legitimately has no actor holding authority at the time it occurs.**

**Required: one representation, not two.** Whoever builds the provisioning path adopts `GEN-029-ST`'s shape — honest absence with the source recorded, never a fabricated principal id, never `'system'`. **A fiction is worse than a null because a null is legible**, and two different fictions in two modules is how the same question gets two answers.

### A2 — `ADR-010` *Open question 2* closed. **All-clear authority is a capability of its own.**

**Option (a).** Named separately from Approver. Commonly held by the same person at the same node — and **`D4` is why that costs nothing**: one principal may hold two roles at one node, so naming it separately today is free operationally while preserving the ability to separate the duty later.

**Rejected, with reasons, because both alternatives are defensible and neither is right:**

- **(b) folded into Approver** borrows evidence about **notices** to settle a question about **safety**. `ADR-010` `D2` created the Approver on `supervisor` appearing five times across four screens — every one of them a notice, a credential revocation or a critical-event update. **That is not a warrant for who may tell a resident it is safe to go home.**
- **(c) scope-only under `D1`** is the failure `DOC-021-ST` named when this work began: ***the all-clear declared by whoever was nearest.*** `D1`'s default was accepted for **ordinary operations**, and `ADR-006` does not call this one ordinary — it uses the word **authority**.

**What it releases:** `ADR-006`'s *"largest remaining hole in the safety model"* now has a holder shape, so the resident-facing all-clear becomes contractable.

**And it inherits an obligation already written down.** `GEN-018-ST` recorded in `event-queries.ts`: *"an event with an audience and no text is accepted by the database and rejected when a resident asks … **whoever builds the write path should move this check into it**, so the event is rejected by the party that can still fix it."* **The write path is no longer hypothetical. That check is a named requirement on the first Home Safety write PID**, not a comment to be rediscovered.

### A3 — `ADR-010` *Open question 3* closed. **The fire consultant's approval is an attestation. PEMO issues no credential.**

**Option (b).** PEMO **records that the approval happened** — who approved, when, what was approved, and a reference to the instrument where one exists. **A severity policy row is not effective until its attestation exists.**

This satisfies `ADR-006` `C3` — *an approval sits behind every upward step* — **without issuing a credential to somebody who is not a user of the product**, and without making a three-tier boundary hold a fourth party.

**It is also how this project has already resolved the adjacent question.** `ADR-007` `D6`: PEMO **references** a source it does not own rather than absorbing it. Same as the car park under `ADR-003`; same as lift statutory compliance under Cap. 618. **This is a boundary shape the project already knows, applied to a person instead of a system.**

**Three consequences, each to be acted on:**

1. **`attestation` is a new concept and needs a home, and the home is a boundary decision.** `ADR-006` put device mapping in Integration Hub on the reasoning that Home Safety must not also own device correspondence. **The same reasoning applies and the same failure is available: an attestation table that lands in whichever module needed it first is architecture by default.** Derive it and state the reasoning; do not take it from me.
2. **An attestation is a claim about the outside world, entered by an insider.** It therefore carries **at least** the provenance and audit that `ADR-011` `D6` requires of an interest — the four properties in full, plus the external reference. **Recording somebody else's approval without recording who recorded it is not an audit trail, it is a rumour with a timestamp.**
3. **`ADR-010` `D6`'s constraint stands unchanged:** `V` (the vocabulary) and `P` (the severity policy) must remain **separately holdable**. `ADR-006` `D3` separated them because their change rates differ by an order of magnitude, and *chained to each other's slowest approver* is the failure it paid to remove. **An attestation mechanism that hands one party both re-creates it.**

**What it releases:** `GEN-012-ST` shipped the severity policy table **empty by design**. It can now be populated, because a policy row finally has something that makes it effective.

### A4 — `ADR-011` *Open question 1* closed. **Writing an interest requires an Approver.**

**Estate staff composes; an Approver confirms.** Creating an ownership interest, ending a tenancy, or correcting one entered wrongly are not ordinary operations.

**`ADR-010` `D1`'s audit default was accepted for ordinary operations**, and rewriting who owns a flat is not one: it changes who receives a management-fee statement, who sees `ADR-011` `D8`'s safety-event projection, and who may be issued a login. **The consequence is financial as well as operational**, which is a stronger warrant than the one behind the all-clear argument in `A2`.

**And `D4` makes it affordable.** One principal may hold two roles at one node, so a small estate can have the same person compose and approve today, while the ability to separate the duty is preserved for the estate that needs it. **Merging two capabilities is hard to undo; separating them later is the expensive direction.**

**`ADR-011` `D10` is hereby lifted on its stated condition** — it closed the interest write surface *"until Open question 1 is answered"*, and it is answered. `D10`'s other requirements survive: the closure was to be recorded as a **deferred surface with its reason** in `API-027-ST`'s `x-deferred` form, and that entry is now to be **replaced by a contracted operation**, not silently deleted.

---

## What this releases, and what it does not

**Released.** The 27 scope-only writes `ADR-010` `D1` always permitted, now with their audit obligation defined. `S5`'s stuck fixture — the composer's submit is scope, the approval is Approver. `ADR-006` `C4`'s quarantine disposition. The severity policy table's contents. The Home Safety all-clear. The interest write surface. **`WEB-15`'s *"roles and scoped permissions"*, which `D3` already established is a write surface and PEMO's to build.**

**Not released, and the distinction matters because a decision is not an implementation.**

- **`D1`'s four audit properties on every scope-only write, before any of them ships.** Written in the same transaction as the act; attributable to a principal, not a session, service or job; effective-dated; not deletable or amendable by the actor. **Without all four, *record rather than restrict* records nothing** — and `A1` now defines what "attributable" means when there is legitimately no actor.
- **`D4`'s migration** — `role` into the `access.scope_grant` exclusion key — **before the first production deployment, not the first convenient moment.** It is cheap for as long as no estate is live.
- **`D5`'s separation, asserted rather than assumed.** The `ADR-007` `D2` boundary scan must remain unconditional and must be **shown** to be so now that roles exist and writes are contractable. **This is the first moment `D5` can actually be violated**, and *the first opportunity to break a rule is when nobody is checking it yet.*

**Still open and untouched by this amendment:** `ADR-011` *Open questions* 2 (owner login provisioning) and 3 (`INT-03`'s outbound publisher); the `authorized representative` relationship, which is its own decision; `occupancy.role`'s named debt; the `getScope` location rule; `getPropertyTree`'s expansion policy.

## Recommended order, offered rather than decided

**The write surface is now large and it should not be opened everywhere at once.** In rising order of consequence, which is also rising order of how much each one teaches:

1. **The 27 scope-only writes**, because they need no new role and their audit obligation is the thing every later write depends on. **Building the audit path first means every subsequent write inherits a proven one.**
2. **`WEB-15` / grant administration**, because `A1` and `D3` together now fully specify it, and until it exists every grant is a manual act.
3. **The interest write surface** (`A4`), because `ADR-011`'s model is built and seeded and only the write is missing.
4. **All-clear and severity policy** (`A2`, `A3`), last — not because they matter least, but because both touch resident safety, and they should inherit an audit path that has already been proven by three earlier surfaces rather than establish one.

## Decision record

```text
Bootstrap grant:      provisioning act at Organization creation; no
                      standing break-glass principal                   — decided 2026-08-19
                      representation shared with GEN-029-ST's
                      no-placeholder gate — one shape, not two
All-clear authority:  its own capability, commonly co-held with
                      Approver; D4 makes separate naming free          — decided 2026-08-19
Fire consultant:      attestation, not a PEMO principal; a policy row
                      is not effective until the attestation exists    — decided 2026-08-19
Interest writes:      Estate staff composes, Approver confirms;
                      ADR-011 D10 lifted on its stated condition       — decided 2026-08-19
```
