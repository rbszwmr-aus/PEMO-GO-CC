# GEN-007 (DOC-002 F1) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2. Pin `d94cc4cc`. No seed file touched yet.

---

## Fix both files, and the reason is the whole point of this PID

`management__mob-s1-safety__default.sql` and `__partial.sql`, three rows each. `seed` applies only `__default`, so `__partial` fails nowhere today and would fail the instant anything runs it. **Fixing only `__default` is the DOC-002 F2 shape** — a check passes because the broken thing is never executed — and this PID exists precisely to close a seed-does-not-reproduce-from-nothing defect, so leaving its twin live in the file beside it would reopen the class while reporting it closed. Both. Good catch.

## The six values

**Group 1 — derivable, two rows.** Clubhouse and function-room events carry a declared serving scope in the property model (`11-property-locations.sql:66-68`, "the clubhouse sits in Block C and serves the WHOLE ESTATE"). `All residents of Wing Fu Garden` / `榮富花園全體住戶`. Approved — read from the model, not composed.

**Group 2 — verbatim carry, three rows.** Common-area events with `source_location_id = NULL` follow the event's own label. `All residents of Block A` / `A座全體住戶`, **taken verbatim from the existing correct scenario, not composed afresh.** Approved, and the verbatim discipline is right: a value that exists correctly elsewhere is carried, not re-derived, so the two cannot drift.

**Group 3 — the unmapped-source safety event. The shape is mine to lock; the wording is the PO's.**

The `Location being confirmed` / `位置確認中` event points at `loc_unmapped` — ADR-006's unmapped-node case, verified absent from the property model — so there is no serving scope to name, the constraint still demands a label, and `audience_source = 'unit'` is forbidden for a common area.

**The shape is decided and it is not a product question: this row may not carry a label that names a real audience.** Naming one would assert an audience nobody has established, on a safety event, from an unmapped source — the exact failure the resident-mobile rule refuses when it shows a non-reporting sensor as *unknown* and never as *normal*. You were right to refuse to fabricate one. The label must read as *audience not yet established*, in the same family as the row's own `Location being confirmed`.

**The wording is resident-facing safety copy, so it is the PO's, not mine.** Your proposal `Audience being confirmed` / `受影響範圍確認中` mirrors the row and satisfies the shape; I accept it as the working placeholder so Step 2 is not blocked, and it is flagged to the PO to confirm or reword. It is a fixture value, changeable without a migration, so the copy can settle after the seed reproduces — what may not change is the shape, which is locked.

## Two flags, both ruled

**`pnpm run seed` sufficiency** — correctly unproven until Step 2 runs `seed` alone and reaches the 166/0 world with no manual `mob-*__default.sql` application. That is done-when 2 and it is discharged by running, not by argument.

**`__partial.sql` exercised by nothing** — apply it directly to prove the fix, and say so, rather than let a fixed-but-unexercised file read as verified. Approved. **And add one thing:** report what in the codebase applies `__partial` at all. If the answer is nothing, that file is itself a seed-does-not-reproduce smell — either dead (a separate removal decision, not yours to take here) or a latent scenario nothing wires into a runner. Name which; do not leave a file that no path exercises sitting as "fixed" without saying nothing runs it.

## Step 2

Fix both files; `pnpm run seed` completes from nothing and the suite reaches its green from `seed` alone; `__partial` applied directly and its orphan status reported; the Group-3 placeholder in place with the shape locked and the wording flagged to the PO. Prove done-when 2 by running, not asserting. HARD STOP before commit.
