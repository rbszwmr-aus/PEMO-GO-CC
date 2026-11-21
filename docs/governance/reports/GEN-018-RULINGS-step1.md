# GEN-018 (C2 — governance hardening) — Step 1 rulings

Date: 2026-08-30
Report: rewrite/reports/GEN-018-step1.md — HARD STOP, nothing built. main b34eccb0, allocation c3ce4c07, next 019.

## Verdict: batching APPROVED, sequence as proposed. Each batch is its own PID (GEN-018 = batch [C+F]). Rulings on A/B/D/R5 below.

---

## R1 — Batching + sequence APPROVED: [C+F] → [A] → [B] → [D+E].

The reasoning is right, especially: (i) A out of batch 1 so a doc-only diff and a script diff aren't
reviewed as one; (ii) B alone (highest blast radius — `startHarness` is every integration test's
entry); (iii) **D+E last because D changes the very mechanism that gates its own merge** — so every
prior batch lands under the known-good manual gate. Sharp.

**Each batch is its own PID** (one-PID-one-closure, as GEN-015's slices were): **GEN-018 proceeds to
Step 2 as batch [C+F] and closes as GEN-018**; A, B, D+E are new allocations dispatched in turn as
each closes.

## R2 — A: the check resolves a reference by SELF-DECLARATION in EITHER shape. Widen A to all governance references.

The discrimination is A's real risk, correctly flagged. Rule: the check resolves an amendment as
present if **either** a separate `docs/adr/…AMENDMENT…` file declares it (H1 match) **or** it is
folded into the base ADR's "Amendments" section (the amendment id appears as a heading there). Reds
only when **neither** shape carries it. Prove all three: non-existent amendment → red; ADR-007's
folded A2–A6 → green; a separate-file amendment → green.

**Widen A into "all governance references resolve":** since A is already the reference-resolution
work, it also adds a **principle-citation-resolves check** (every `principle …` citation resolves to
a live slug or the legacy map from C+F) and a **red for the Rule-7-directory exclusion** (a citation
inside a Rule-7 record must NOT trip the check). So C+F *declares* the principles and ids; A *proves*
every citation to them resolves. AM4 severity is genuinely low (one PID-PRINCIPLES sentence, not
migrations/modules) — A's value is the check, not the one dangling ref.

## R3 — B: fix the LIVE reseed gap; keep the prophylactic teardown-prefix part LIGHT.

The honesty is exactly right — the reseed gap is the live 3× bite (`40-access-staff-and-grants.sql:25`
DELETEs `user_group WHERE group_id LIKE 'grp_%'`, `audit_event.group_id` FKs to it, `harness.ts`
touches `audit_event` zero times), and the prefix-teardown class has **no live instance** (all 12
checked). So:
- **Fix reseed** (the real bug): clear `audit_event` in FK-safe order within `reseed()`. Proven by the
  3× scenario going green **for the right reason**.
- **Prophylactic prefix guard: keep it LIGHT.** A documented convention + a single assertion/guard
  that a teardown prefix cannot match seed ids — **do NOT refactor the 12 currently-safe teardowns.**
  Don't gold-plate a non-bug. B alone, as proposed.

## R4 — D: accept the honest ceiling — versioned hook + opt-in + battery-asserts-opt-in + CI backstop.

The analysis is correct: a repo cannot force a `pre-push` hook (`.git/hooks` unversioned) and CI is
too late by construction. So D is, honestly:
- a **versioned hook** (e.g. `.githooks/pre-push`) running `pid-index --check` + the battery;
- a **one-line opt-in** (`core.hooksPath=.githooks`), documented in setup;
- a **battery case asserting `core.hooksPath`** points at the versioned dir (makes non-compliance
  visible — the difference between this and pure convention);
- **CI as a post-push backstop** (defence in depth: too late to prevent the push, but it fails the
  build and flags the bad state if the hook was bypassed).
That is the achievable ceiling; accept it. D+E last.

## R5 — Legacy "principle 43"-style citations: a MAPPING TABLE. Nothing is declared unresolvable.

Declaring them unresolvable orphans the audit trail. Rule:
- **Live citations** → update to the new slug.
- **Immutable-record citations** (Rule-7 archives) → kept resolvable by a **legacy-id map** (old
  number → new slug) in `PID-PRINCIPLES.md`, authoritative.
A's principle-citation-resolves check then treats a legacy number as resolved iff the map carries it.
Consistent with the whole ethos: records stay resolvable; references are never orphaned.

## R6 — The three related debts (reported, not folded): dispositions.
- `adrs-present.sh`'s Rule-7 exclusion has no red proving it works → **fold that red into A** (A is
  already touching the check; R2 covers it).
- The other two → **owed ledger** (do not fold; name them in the C2 close so they are not lost).

## Dispatch now: GEN-018 Step 2 = batch [C+F] (pure doc).
PID-PRINCIPLES.md populated with the 7 principles, each a **stable id** (F scheme) + evidence PIDs,
plus the **legacy-id map** (R5). Pure doc; its resolution is proven by A next. Then A → B → D+E.

## Owed ledger
C2 in progress (4 batches). Owed decisions (idempotency token; audit act-reason) still brain-owed.
Then the schema-vs-WEB-15 fork.
