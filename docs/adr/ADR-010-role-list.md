# ADR-010 — The role list: capability, scope, and what the model deliberately does not gate

**Status:** **`Accepted`** — `v1.1`, accepted by the Product Owner 2026-08-19. `D1`–`D6` taken 2026-08-15 on Product Owner rulings, against `DOC-021-ST`'s evidence. **All three open questions are now CLOSED** by `ADR-010-AMENDMENT-open-questions-closed.md` (`A1` provisioning act · `A2` all-clear as its own capability · `A3` attestation), taken 2026-08-19; `A4` closed `ADR-011`'s Open question 1 in the same pass. The *Open questions* section below is retained **verbatim** as the record of what was open and why — **read it with the amendment, not instead of it.**
**Date:** 2026-08-15
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-010-role-list.md`
**Committing session:** `PEMO Contract` — this ADR has no other authorised route into the repository.
**Gates:** every write operation; the second management contract slice; any administration surface.
**Evidence:** `DOC-021-ST` — `PEMO_Role_List_Evidence_v0.1.md`, 439 lines, **read in full rather than from its summary**. 53 actions inventoried against 24 enumerated sources; 24 second-party appearances quoted with screen and field.
**Related:** `ADR-002` (hierarchy), `ADR-003` (locations), `ADR-006` (`C3`, `C4`, `D3`), `ADR-007` (`D3`, `D4`, `D9`, `A2`–`A4`), `ADR-008` (versioning).

## Why this could not have been written earlier, and why it can be written now

Four tracks have been held behind this decision. `API-017-ST` contracted eleven reads and **zero** writes; `GEN-018-ST` states that for reads scope is the only gate and will not extend to writes on those terms; `UI-019-ST` renders every deferred write as absent; and `S5` carries a fixture stuck at `supervisor-approval · pending` that no designed role can advance.

The reason it waited is that **the only way to answer it quickly was to import an org chart** — and an architecture answered by whoever writes it first is the failure `ADR-006` exists to prevent, arriving as a personnel question instead of a technical one. `DOC-021-ST` was therefore forbidden to import any role vocabulary and required to cite every candidate to a project artifact or a named Hong Kong instrument.

## The finding that frames every decision below

**53 actions. 24 have a designed control. The write surface is 2.2× the drawn one** — so any plan derived from screen count under-counts by roughly half, and three of the five heaviest authorization clusters (`Q` quarantine disposition, `P` severity policy approval, `G` scope grant) **have no screen at all.**

**27 of 53 actions are scope-only.** That figure is not an accident of a thin design. The export consistently reaches for **audit and reversibility where a role model would reach for a gate** — *"Both are reversible and audited"*, *"must give a reason, which is written to the audit log"*, *"can revoke on written request with an audit entry"* — three screens, one position, applied deliberately.

**That position is a product decision, and it moves the number.** It is taken in `D1`.

## Decisions

### D1 — Audit is the default. Gates are the exception, and every exception is named.

**The Product Owner accepts the design's position: record who did it rather than restrict who may.**

The **27 scope-only actions** are released on **scope alone** — no capability gate, exactly as `GEN-018-ST` built it for reads. No new schema, no assignment burden, no bootstrap. The resident acknowledgement — the one write this project has shipped — is the worked precedent: *you may acknowledge an event for a unit you hold.*

> **Reconciled by `GEN-017` against `ADR-012`.** This sentence originally read *released on `(principal, scope node)` alone*, written before `ADR-012` moved the grant off the principal. **The grant key is now `(group_id, role, node_kind, node_id, tstzrange)`** — held by a **group**, carrying a **role**, at a **node**, effective-dated — implemented by migration `0115`. Only the wording trailed; the decision did not change, and the substance is that **the actor and the authority are two different facts**: the act is attributable to a **principal**, the authority under which it was performed is a **group-held grant**. `ADR-013`'s audit record keeps both and never reconciles them into one.

**A default settles the default. It does not settle the items the evidence classifies as capability.** Those are `D2`'s four and the three questions left open. A default that silently absorbs its own exceptions is not a default; it is a decision taken by omission, which is the shape this ADR exists to prevent.

**The load-bearing half of this decision is what *"audited"* must mean.** If an audit record substitutes for a gate, then it carries the weight the gate would have carried, and a weak audit record makes `D1` empty. So every scope-only write requires an audit record that is:

- **written in the same transaction as the act** — an audit written afterwards is an audit that can fail separately;
- **attributable to a principal**, not to a session, a service or a job;
- **effective-dated**, so *what was this person permitted to do then* is answerable — `ADR-007` `D4` already requires this of grants, and an audit that cannot be read against the grant in force at the time cannot reconstruct authority;
- **not deletable or amendable by the actor.**

Without all four, *"record rather than restrict"* records nothing. **This is a requirement on the write path, not a logging preference.**

### D2 — Four roles. Three carried by evidence, one by `D3`.

| Role | What it gates | Evidence |
|---|---|---|
| **Estate staff** | the residual — holds scope, performs the 27 | The only designed role; `Estate manager` in the shell chip |
| **Approver** | approving what another composed: notice approval, critical-event updates, credential revocation | `supervisor` **five times on four screens** — `S5` `approvalSteps`, `S1` composer, `S1` `e5` timeline, `S2` `ovNotices`, `S7` `acRequests`. The stuck fixture sits on exactly this |
| **Integration support** | raw payload and correlation trace; quarantine disposition (`Q`); unmapped-node mapping; vocabulary table (`V`) | *"until an **integration administrator** maps the source node to a unit"*; *"**Integration administrators** notified"*; *"integration-support roles only"*. `ADR-007` `D3` **has already decided this tier exists** |
| **Grant administrator** | creating scope grants (`G`), bounded per `D3` | `admin` stub `WEB-15`: *"roles and scoped permissions"* |

**The Approver is decorative unless it is held by someone other than the composer at the same node.** That is not an implementation note — it is the whole content of the role, and it is the same warning `ADR-006` `C4` gives about a quarantine owner who is nominally named and never available.

**No fifth role is invented.** Where the evidence names a party the model cannot yet hold — the fire consultant — `D6` records the capability and leaves the holder open rather than manufacturing a principal.

### D3 — `G-2`: PEMO is the system of record for staff assignment, and granting is delegated by scope.

**A principal may create a scope grant only within a node they already hold.**

This contains the circularity `G` carries — the write that confers the ability to perform the others — without pretending to remove it. Two consequences follow immediately:

- **`WEB-15`'s *"roles and scoped permissions"* is a write surface**, not a read. The administration screen is PEMO's to build.
- **The first grant still has no gate.** Delegation cannot bootstrap itself. That is *Open question 1* and it is small, but it cannot be left to whoever writes the provisioning script.

The alternative shape — grants provisioned entirely outside PEMO — was available and was **not** taken. Recording that it was considered matters: under it, a whole class of role would have disappeared from PEMO and `WEB-15` would have become a read. The decision to hold assignment inside PEMO is what makes the Grant administrator role exist at all.

### D4 — `role` enters the exclusion-constraint key. One principal may hold two roles at one node.

`GEN-018-ST` built `access.scope_grant` with a `btree_gist` exclusion over `(principal, node_kind, node_id)` and a half-open `tstzrange`. **`role` joins that key.**

**The evidence is not balanced.** `Ng Ka-ho` appears as supervisor, as duty officer **and** as a case assignee — and that is not merely a plausible shape, it is **the only staffing example the project has.** Role outside the key would make the project's sole worked assignment unrepresentable, which is *prefer unrepresentable over forbidden* firing in the wrong direction: forbidding a legitimate state rather than an illegitimate one.

**Two consequences, both to be acted on rather than noted.**

- **The invariant's meaning changes**, and existing rows do not become illegal. Today the constraint enforces *one grant per principal per node at a time*; with `role` in the key it enforces *one grant per principal per role per node*. That is a semantic migration over an effective-dated table with a live constraint — more than a column add, less than a rebuild. The backfill value is asserted to have been true **historically**, so it is a claim about the past, not a default.
- **Do it while the table holds test data.** It is cheap now and it is cheap for as long as no estate is live. **The trigger is the first production deployment, not the first convenient moment.**

**And `D4` makes fine-grained naming cheap**, which changes how the open questions should be answered. Because one principal may hold two roles at one node, **naming a capability separately costs nothing operationally** — the same person can hold both. Merging two capabilities into one is hard to undo; separating them later is the expensive direction. Where the evidence is ambiguous, name separately and assign together.

### D5 — Roles are not tiers. `ADR-007` `D3`'s three tiers and this ADR's four roles are orthogonal mechanisms and must not be merged.

`ADR-007` `D3` decides **what data a surface may show**. This ADR decides **what acts a principal may perform**. They are different questions with different failure modes, and one name appears in both: **integration support.**

**That collision is a trap and it is named here so nobody walks into it.** The temptation will be to implement the tier by checking the role — *if principal has role integration-support, include `rawPayload`*. That would convert the resident boundary's strongest property, its **unconditionality**, into a per-response policy evaluation, which is exactly what `ADR-007` `D2` refused when it chose separate contract packages over role-scoped responses.

**So: the boundary stays structural and remains proven by a scan over the corpus without evaluating anything. Roles gate writes. Neither mechanism reads the other.** A principal holding the Integration support role on a surface that does not carry raw payloads still does not see raw payloads, because the surface does not contain them.

### D6 — The severity-policy approval capability is real; its holder is open.

`ADR-006` `C3` requires *an approval behind every upward step* in the severity policy table. **`D1`'s audit default does not satisfy `C3`** — `C3` asks for an approval, not a record of who acted — so `P` remains a capability regardless of the default.

**But its holder falls outside all three of `ADR-007` `D3`'s tiers.** `ADR-006` `D3` assigns Layer-2 policy to *"estate management with the fire consultant"*, and a fire consultant is neither estate staff nor integration support nor a resident. `DOC-021-ST` established this as the first evidence that the role question is not contained by the tiers.

**This ADR decides the capability exists and must be expressible. It does not decide who holds it** — see *Open question 3*.

**One constraint on whatever is decided:** `V` and `P` must remain separately holdable. `ADR-006` `D3` separated them because their change rates differ by an order of magnitude, and *"chained to each other's slowest approver"* is the failure it named. A role model that hands one party both re-creates the coupling the ADR paid to remove.

## What this ADR deliberately does not gate

The 27 scope-only actions, released under `D1`. They include every case operation except escalation, every notice action up to submission, audience selection — *"the audience **is** the authorization surface"*, which makes it the purest scope action in the inventory — the whole help-desk surface, visitor and credential **requests** (the access system decides, PEMO raises), household and resident administration, and the counter, which is an `ADR-003` Location and therefore the cleanest scope case in the product.

**Listing them is part of the decision.** A reader who cannot see what was left ungated cannot tell whether the gates that exist were chosen or defaulted into.

## Open questions

Each is named rather than absorbed. **None blocks the writes `D1` releases**, which is why this ADR can be taken now.

### 1 — The first grant. What creates it?

**Blocks:** provisioning an estate. Not the writes.

`D3` delegates granting to principals who already hold a node; the first principal holds nothing.

**Options.** (a) Organization provisioning is an **operator act** performed when the Organization is created, recorded with `D1`'s four audit properties, effective-dated like any grant. (b) A standing break-glass principal.

**[my view] (a).** A standing break-glass principal is a permanent maximum-privilege credential that exists between uses; a provisioning act exists only at Organization creation and leaves an effective-dated record behind it. **The bootstrap is an event, not a role.**

### 2 — All-clear authority. Who may declare a resident-facing safety state over?

**Blocks:** nothing contracted today. It is the item `ADR-006` calls *"the largest remaining hole in the safety model"*.

**This is the one place I push back on `D1`.** The default was accepted for **ordinary operations**, and an all-clear is not one. `ADR-006` uses the word **authority**. Left to the default, the outcome is the failure named when this work began: *the all-clear declared by whoever was nearest.*

**Options.** (a) A capability of its own, commonly held by the same person as Approver. (b) Folded into Approver. (c) Scope-only under `D1`.

**[my view] (a), and `D4` is why it is free.** Since one principal may hold two roles at one node, naming it separately costs nothing today and preserves the ability to separate it later. Folding it into Approver borrows evidence about **notices** to settle a question about **safety**, and those are not the same warrant.

### 3 — Is the fire consultant a PEMO principal, or is their approval an attestation recorded in PEMO?

**Blocks:** the severity policy table's contents — which is why `GEN-012-ST` correctly shipped it **empty**.

**Options.** (a) An external principal, credentialled in PEMO. (b) An **attestation**: PEMO records that the approval happened, with who and when, and a policy row is not effective until the attestation exists.

**[my view] (b).** It satisfies `C3` — an approval sits behind every upward step — without issuing a credential to somebody who is not a user of the product, and without making a three-tier boundary hold a fourth party. It is also consistent with how this project has already resolved an adjacent question: under `ADR-007` `D6`, PEMO **references** a source it does not own rather than absorbing it.

## Consequences

**Released.** The 27 scope-only writes become contractable. `S5` unblocks — the composer's submit is scope, the approval is Approver. `Q` gets the named owner `ADR-006` `C4` requires. `ADR-007` `D3`'s decided tier acquires a subject.

**Required.** `D1`'s four audit properties, on every scope-only write, before any of them ships. `D4`'s migration, before the first production deployment. `D5`'s separation, asserted rather than assumed — the boundary scan must remain unconditional and must be shown to be so after roles exist.

**Still not buildable.** The administration surface `D3` implies, until *Open question 1*. Severity policy contents, until *Open question 3*. All-clear, until *Open question 2*.

**Not decided here.** The six inferred-field product decisions, the five untraced product areas, Intercom, CMMS, Simplified Chinese. Each remains its own decision.

## Decision record

```text
Default posture:      audit, not gate — 27 of 53 actions scope-only     — decided 2026-08-15
Roles:                Estate staff · Approver · Integration support ·
                      Grant administrator                              — decided 2026-08-15
Grant administration: in PEMO, delegated within a held node (G-2)       — decided 2026-08-15
Exclusion key:        (principal, role, node_kind, node_id) — two roles
                      at one node permitted                            — decided 2026-08-15
Tiers vs roles:       orthogonal; neither mechanism reads the other     — decided 2026-08-15
Policy approval:      capability real, holder open                      — decided 2026-08-15
Bootstrap grant:      open — provisioning act vs break-glass principal
All-clear authority:  open — own capability vs folded vs scope-only
Fire consultant:      open — external principal vs attestation
```
