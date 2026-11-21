# UI-004 Step 1 — Master Brain ruling (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `reports/UI-004-step1.md`
**Verdict:** Step 1 **ACCEPTED**. Step 2 **RELEASED** subject to the four rulings below. `UI-004.md` amended to `v1.1` as a direct result of R1 and R3.

## R1 — The wider state set governs. **My PID was wrong and is corrected.**

`UI-004 v1.0`'s header and Done-when named four states (loading / empty / partial / error). The session brief named the design system §18 baseline of eight, plus Home Safety's ten. **The wider set is what was intended; the PID file was the defective artifact.**

The session built the stricter matrix **and flagged the discrepancy rather than proceeding on the more convenient reading** — the correct move, and the one that made this catchable. Its observation is the load-bearing part: *a future reader of `UI-004.md` alone would have signed off a thinner deck than the brief requires, and the file that is supposed to be the authority disagreed with the brief that derives from it.* That is the `D01` failure class — **the filed artifact goes stale and it is the one the next session reads**.

**`UI-004.md` is amended to `v1.1`**, carrying the eight-state baseline, Home Safety's ten, and the requirement that a state which does not apply is recorded **N/A with its reason**, never silently dropped. The session's §3 matrix already meets this; its per-screen N/A notes (Notices/offline, Facility-detail/empty, duplicate-submission across all seven) are exactly the right treatment.

## R2 — Both open Home Safety states: **drop from the state matrix. One returns as content.**

The session was right to ask rather than draw. The distinction it was reaching for is now a rule:

> **A screen state is about the viewer's own access or fetch. A fact about an entity the screen displays is content.** Confusing the two produces either a phantom screen state or a fact with nowhere to render.

- **"Resident not authorized" — drop.** On a staff surface, what staff may see is governed by their **scope grant**, not by a resident's consent. A resident outside scope is **absent from the payload** (query filter), which is the existing no-permission case. There is no distinct staff-facing state here.
- **"Caregiver permission expired" — drop as a state, render as content.** Staff genuinely need to see that a caregiver's access has lapsed — the Properties pilot already established both the fact and its copy: *"Safety viewing permission is granted by the resident in the app, not by management. Staff can see who holds it and when it expires, and can revoke on written request with an audit entry."* So it is a **data state of a displayed entity**, rendered per the Properties household-panel pattern, and it inherits `CFR-4`'s rule — `canRevoke` arrives as a **pre-authorized boolean**, never a raw expiry the client compares to "now".

## R3 — Overview and Cases **do have sources.** The search looked in the wrong place.

The session searched the first-build **UI PIDs** and correctly found nothing. The precedent lives in `DOC-014-ST`'s **output**, not in the PID:

1. **`Prompt\UI\PEMO_Management_Web_Scope_Analysis_v0.1.md`** (~50 KB) — the screen inventory, **state coverage per screen including states the export omits**, **every displayed field, filter, sort and action with inferred meanings marked**, the authorization surface against `ADR-002`'s levels, and traceability to the Function Scope. This is precisely the field-level precedent Overview and Cases were said to lack.
2. **`Prompt\UI\PEMO Management Web (standalone).html`** (6.9 MB) — **the design authority** for this surface, by Product Owner ruling 2026-08-13. Extract **programmatically** per `DOC-014-ST`'s recipe (bundled Claude Design file: JSON of UUID → `{mime, compressed, data}`, base64 + gzip; strip style and helmet blocks). **Do not eyeball a rendering.**

**Therefore: no provisional derivation, and no origination.** Read both, then design. If after reading them a genuine gap remains, it returns as a `CONTRACT FIELD REQUEST` or an open question — not as an invented field set.

The session's instinct was right and is worth recording: it declined to originate under a PID framed as translation, and said so. **A PID that silently turns into origination is a scope change nobody approved.**

## R4 — Authorized to design against Proposed sections, with status disclosed.

Confirmed. §7 (navigation), §9 (management-web visual rules) and §18 (state coverage) are **Proposed baseline**, and designing against them is correct — **a design is how a proposal gets tested before acceptance.** What is forbidden is designing against them *silently*: that is how "Proposed" becomes "Accepted" with nobody deciding, which is the self-justifying-error loop in a new costume.

**Conditions:** disclose the status **per section** wherever the deck depends on one, and list what the Product Owner still owes as a consequence. The session's §2 already does this, including the observation that *"pinned to the design system" does not mean "pinned to an approved document"* for most of what it will draw. Severity is correctly identified as the one place this is not a live risk — §3/§3.1 are Accepted **and** the same seven-level enumeration is frozen in `severity.json` at contract `0.2.0`.

## Accepted without change

- **Routes are proposals, labelled as such.** Correct. `UI-028-ST`'s removal of a resident-portal home/landing screen is correctly treated as **binding precedent, not reopened**.
- **Audience deliberately unnamed by role.** Correct — naming a role would invent the authority spine this PID explicitly does not decide.
- **§4's twist-boundary precedents**, all five, carried forward rather than relitigated. Two are worth naming: the `s3.systemName` value-map must have a fallback that **fails the completeness check**, never a `label` default (so a fourth external system renders honestly rather than silently); and the Home Safety absence-claim copy must be **one shared source**, because the first build shipped that exact bug twice on that exact screen with one instance gated and one not.
- **§5's CFR list**, including the `FacetCount.basis` vs `scope` live gap — render from `scope`, never `basis`, per the existing ruling.

## Released

Step 2 proceeds: seven screens, the amended state set, R2's screen-state/content-state split, R3's sources read first, R4's per-section status disclosure. The `CONTRACT FIELD REQUEST` list accumulates across all seven and is delivered **once, whole**.
