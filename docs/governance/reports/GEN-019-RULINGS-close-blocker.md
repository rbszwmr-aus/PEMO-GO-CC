# GEN-019 (C2 batch A) — close-blocker ruling

Date: 2026-08-30
Report: rewrite/reports/GEN-019-step2-BLOCKER-close.md — close blocked at the gate; main 5f8475d2, staged, uncommitted.

## First: the block was the right call, twice over.

Refusing to merge past a red battery, and refusing to relabel a real citation as a placeholder —
both are the discipline holding under pressure to just-close. Stepping around the gate to land the
gate's own PID would be the exact failure this corpus records. Correct, and exactly what the last two
PIDs were for.

And the dangling `[probe-must-bite]` is **my error, correctly caught** — R3 cited it and scheduled its
definition a PID later. "Cite before define" is precisely what this check forbids; it caught the
brain. Owned.

## The three do not resolve for three different reasons — so three different fixes.

### 1. `[probe-must-bite]` — DEFINE it in THIS PID (moved out of batch B). 
It is a **real** citation with a definition I wrongly deferred. Add it to `PID-PRINCIPLES.md` in
GEN-019 with a stable id, so the citation resolves where it was opened. Remove it from batch B's
scope. Distinguishing note (it neighbours `[patch-verify-on-disk]`): **`[patch-verify-on-disk]`**
verifies an *edit landed on disk* (trust the artifact, not the tool's success report);
**`[probe-must-bite]`** verifies a *probe/mutation actually changed the checked input* (a probe that
no-ops is indistinguishable from a check that does not fire). Different objects — an edit vs a test's
own probe.

**Process lesson (mine):** a principle's citation and its definition land in the **same** PID; never
schedule a definition after a citation. Add this as the discipline behind the citation check.

### 2. `[slug]` and `[no-such-principle]` — allowlist as metavariables, with provenance. 
Neither is a citation of a principle so named: `[slug]` is a **syntax metavariable** ("an id looks
like `[slug]`"); `[no-such-principle]` is a deliberate **example of non-existence** (a Step-1 red).
R2 forbids relabelling a *real* dangling citation as a placeholder — these are not real citations, so
allowlisting them is permitted. This ruling is the R2 gate; record provenance per entry.

### 3. `[expected-red-stops-being-read]` — CONFIRM its status before acting. 
You invoked it as an existing principle. If it resolves to one of the pre-existing principle ids
(check the 48 originals), no action — it is a real, resolved citation. If it does NOT exist, report
which it is: a genuine principle worth codifying (then define it here, like probe-must-bite) or a
prose mention (then allowlist with provenance). **Do not guess** — resolve it by its actual status.

## Do NOT reorder the batches.
Landing batch B first to dodge a one-line edit reorders two approved batches for the wrong reason.
Defining `[probe-must-bite]` here is correct on its own terms (cite-and-define together), so fix in
place. Sequence stays [C+F done] → [A now] → [B] → [D+E].

## The standing tax + the cheaper shape: acknowledged, owed, with a trigger — not bolted on here.
Your diagnosis is right: an allowlist that must grow per principle-system-meta report is the wrong
steady state. The cure — **make a citation syntactically distinct from a mention**, so the check
scans only deliberate citations and prose mentions are ignored, retiring the allowlist — is a real
design decision. It is genuinely deferrable, because **real citations to existing principles resolve
untaxed**; the tax only hits reports that discuss the citation *system* (rare after GEN-018/019). So:
- **Owed:** a small PID to design the citation-vs-mention syntax (Step-1: propose the marker against
  the codebase — how many real citations exist, what marker is greppable and collision-free; I rule).
- **Trigger:** if the allowlist would need *another* ruling-gated entry before that PID runs, do the
  syntax cure **instead** of growing the allowlist further. Until then, the closed allowlist stands.

## Close path (after the three fixes + green battery)
Define `[probe-must-bite]` (and `[expected-red-stops-being-read]` if genuinely a principle); allowlist
the two metavariables (and `[expected-red-stops-being-read]` if a mention) with provenance; re-run the
battery to green; then the standard gate, `[GEN-019]` tag, Rule 7 close, `closed: 2026-08-30`.

## Owed ledger — additions
- `[probe-must-bite]` defined in GEN-019 (removed from batch B).
- Citation-vs-mention syntax redesign — owed PID, with the trigger above.
- Process discipline: cite-and-define a principle in the same PID.
- (unchanged) ADR-003 AM1–AM5 unaccepted; then B, D+E; then idempotency + audit-reason; then schema-vs-WEB-15.
