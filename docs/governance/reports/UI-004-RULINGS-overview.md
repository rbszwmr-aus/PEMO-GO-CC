# UI-004 — Master Brain ruling on the Overview brief (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `rewrite/UI/Overview UI design v1/UI-004-overview-brief.md`
**Verdict:** **ACCEPTED.** All four Step-1 rulings applied correctly, one of them extended to a new case on the session's own initiative. Seven open items ruled below; **three of them dissolve rather than needing a decision.**

## What the brief got right, and one thing it did better than asked

- **R3 landed.** The brief is built on `PEMO_Management_Web_Scope_Analysis_v0.1.md` throughout — the spanning-levels flag, the three-way language toggle, the `INFERRED` de-duplication gap, the three semantics folded into one due string. No provisional derivation, no origination. The `Satisfies` line is corrected to feature IDs (`RPT-01/02`, `INT-01/02`, `CAS-04`, `COM-01/04`) with an explicit *"[Never `DOC-002` — that is the code-reuse audit, not a product requirement]"*.
- **R2 (the pilot's mirror-status ruling) was extended, not merely obeyed.** Integration health carries its own `operational / degraded / down / unknown` vocabulary *"the same reasoning Master Brain applied to the Properties external-reference mirror status."* Applying a principle to a case nobody named is the difference between following a rule and holding one.
- **Two distinctions drawn without being asked, both correct.** A *stale check* and a *down feed* are different statements. A counter's legitimate value of **zero is content, not an empty region** — the null-vs-zero discipline applied to region states.
- **An assumption named rather than smuggled:** the counters row is treated as one atomic fetch because the export gives no evidence otherwise, *stated explicitly*.

## Rulings on the seven open items

### 1 — `unitsInUnknownState` de-duplicates. And it must carry its denominator.

**Count units, not (unit × feed) pairs.** The tile's noun is *units*; a unit affected by two degraded feeds is one unit in an unknown state. Counting pairs lets the figure exceed the estate's unit count once enough feeds degrade, which is visibly absurd and takes the whole tile's credibility with it.

**Additionally: the field carries its denominator** — `12 of 812 units`, not `12`. This is the project's standing cardinality-with-denominator discipline, and it matters most on exactly this tile: *unknown* is a statement about coverage, and a coverage figure without its base cannot be read.

### 2 — `note` and `edge` are discrete fields. (This is R1, already decided.)

`edge` is a derived judgement (server). The note's sub-counts are discrete numbers (server). The sentence is composed by the client. Not an open question — R1 answers it: **the server derives the values, the client composes the sentence.**

### 3 — The due column splits. The *shape* is mine and is decided; the *vocabulary* is the Product Owner's and is already open.

**Split it — `dueKind` + `dueValue`.** This is not a product decision. A free-text field carrying three semantics cannot be styled, cannot be localised, and a server that composes it is concatenating translated fragments — which the design system forbids outright. The twist rule and the bilingual rule together settle the shape.

**What *is* the Product Owner's:** which kinds exist and how they rank. That is the **`ServiceTarget` order** question (`held` vs `action-required`) already open from the first build — **not a new open item.** Design against the four proposed kinds, and the rank arrives as data.

### 4 — Dissolves. Show what the server sends.

**Do not role-gate the integration-health panel in the design.** Role-gating requires naming a role, which `UI-004` explicitly does not do and the authority freeze forbids. And under the boundary rule, anything a viewer may not see is **absent from the payload**, not hidden client-side — so there is nothing for the design to gate. The design renders the feeds the server returns; who sees which is the server's, through the same scope mechanism as everything else. The question dissolves into the twist rule.

### 5 — The collapse is correct, and the test generalises to the other screens.

**Per-region states are for per-region *failures*. A screen-wide precondition fails once and renders once.** The test, for every remaining screen:

> Can region A succeed while region B fails? If yes, the state is per-region. If no — no session, no connection — it is screen-wide and collapsing it is correct, not an omission.

Session and connectivity are each one thing, so both collapse. This is a **rule, not an exception granted to Overview**, and it should be applied by name on the remaining screens.

### 6 — Two-way toggle stands. The gap is an existing Product Owner item.

Correct call, and correctly reasoned: inventing unreviewed Simplified Chinese copy would have been worse than recording the gap. **Simplified Chinese — content language or interface language — is an open Product Owner decision carried from the first build**, not a new one. Keep the pilot's locked two-way pattern and leave the third button unbuilt until it is answered.

### 7 — `/overview` is a distinct route, and the app root redirects to it.

A distinct route is linkable and bookmarkable; serving the screen at `/` makes *"go to Overview"* unaddressable. Cheap, reversible, and it keeps the route list uniform.

**Note for the record:** `UI-028-ST`'s no-home-screen precedent is **resident-portal's** and does not reach here. A staff landing dashboard and a resident portal opening on Explore are different products answering different questions.

## Standing

All seven are now closed except the two that were never this line's to close — `ServiceTarget` rank (item 3) and Simplified Chinese (item 6), both pre-existing Product Owner items. Nothing new was opened by this screen.
