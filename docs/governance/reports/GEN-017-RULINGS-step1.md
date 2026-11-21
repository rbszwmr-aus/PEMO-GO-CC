# GEN-017 (C1 — ADR consolidation) — Step 1 rulings

Date: 2026-08-30
Report: rewrite/reports/GEN-017-step1.md — HARD STOP, nothing moved. main 1db84026, allocation a945ab1f, next 018.

## Verdict: plan APPROVED, following the repo's own conventions. The CHECK is the deliverable — sharpened by the README finding. Proceed to Step 2. ADR-013 text supplied (delta doc).

---

## R1 — The reference rewrite is ~zero: good, and it resizes the PID correctly.

All 64 references are by NAME (`ADR-011` in prose/comments/SQL), never by path; only 3 path-shaped
refs, none broken. Adding the files makes every reference resolve with no edit. So this PID is: add
the files + reconcile status/wording + the check — not a reference rewrite. Confirmed: committed code
and schema (0114–0117, seeds, five modules, five tests) rest on three decisions a repo reader cannot
open — which is the hazard.

## R2 — The check is the deliverable, and the README finding dictates its FORM.

`docs/adr/README.md` already diagnosed this failure and already tried the fix — two mandatory header
fields including `Target location`. It failed because **a field records where a doc belongs and
cannot notice it never arrived**; three ADRs accumulated then, three again now. This is
*principle-is-not-a-control*, demonstrated inside the directory being repaired.

Therefore the check must be **ACTIVE, not another field**: it enumerates ADR references across the
repo and **fails when any referenced ADR id has no file in `docs/adr/`**. Prove by making it fail —
reference a non-existent ADR → red; restore → green. This is the durable win; the file moves are the
one-time part.

Note the status-staleness class (six instances now — incl. ADR-012 `Proposed` vs accepted 2026-08-28,
ADR-013 `Awaiting` vs 2026-08-29) is closed by **single-sourcing**: once `docs/adr/` is the canonical
home, the ADR's own status line IS the record, so there is no separate acceptance record to
contradict. Set each status correctly in the canonical file; the check guards presence, single-source
guards status.

## R3 — Plan APPROVED: copy-with-banner, fold-or-link amendments, per the repo's existing conventions.

Use the conventions the repo already set, do not invent: copy into `docs/adr/` with the existing
"SUPERSEDED COPY — the repository is authoritative" banner (as ADR-002/003/006/007 already do); fold
an amendment into its base when it touches one ADR (as ADR-008 A4 already is); give the ADR-010
amendment its own file because it touches three.

## R4 — The `Prompt/specs/` banner question: YES, banner the specs copies. APPROVED as a scope expansion.

Writing the "SUPERSEDED COPY" banner into the `Prompt/specs/` copies is (a) the repo's own
established convention and (b) necessary — an un-bannered specs copy of ADR-011 recreates the exact
"two sources, reader opens the wrong one" hazard we are fixing. This expands the write-scope beyond
`docs/adr/` to include the `Prompt/specs/` ADR copies (banner text only, no content change). Approved
explicitly so it is not a silent scope-touch. `Prompt/specs/` is in-repo, so this is an in-repo edit.

## R5 — D1 wording: change ONLY `ADR-010:33`. The three others stay untouched.

Correct. Fix the `(principal, scope node)` phrasing only at `ADR-010:33` (the live base text, in the
canonical `docs/adr/` copy). Do NOT touch: `0112`'s comment (accurate when written; migrations
immutable), `0116` (already explains the staleness), the governance reports (Rule 7 records). The
ADR-010 canonical copy also needs its status reconciled (Proposed → Accepted/Amended) and its "three
questions remain open by design" line reconciled to point at the amendment that closed them — all
reconciliation, not revision. The stop condition correctly did not fire: no DECISION changes.

## R6 — ADR-013 canonical text: SUPPLIED.

Base body = the Drive doc `adr-013-append-only-state-the-assertion-model.md`, verbatim. Apply the
delta in `adr-013-repo-delta.md`: Status → `Accepted v1.1`, and append the **Corollaries** section
(C1 lapse-vs-end; C2 orthogonal guards; C3 D5 mechanism refinement + READ COMMITTED assertion;
C4 constraint-violation-never-a-500; C5 reason-is-act-metadata). The PO hands both docs to Main CC;
Main CC assembles by copy-plus-delta (no re-typing the body, so no drift).

## Step 2 authorised
Add all missing ADRs to `docs/adr/` (011, 012, ADR-010 amendment as its own file, 013 via the delta),
banner the `Prompt/specs/` copies, reconcile ADR-010 (status + open-questions line + D1:33 wording),
set all status lines correctly, build the active presence-check and prove it bites, and fold the
GEN-016 `closed:` date correction (to today's date) into this commit. No behaviour, schema, or
write-path change. HARD STOP before commit.

## Owed ledger
Unchanged except this item (ADR-consolidation) now in progress. C4/C5 above also seed:
constraint-violation-never-a-500 → PID-PRINCIPLES; audit-spine act-reason → owed decision.
