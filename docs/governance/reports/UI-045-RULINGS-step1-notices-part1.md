# UI-045 Step 1 — Product Owner ruling (filed)

**Author:** Product Owner · **Date:** 2026-09-02 · **Rules on:** `reports/UI-045-step1.md`
**Verdict:** notices part 1 **APPROVED to merge once `GEN-046`'s gate exists, subject to R1.**
Nothing merges yet.

## Allocation rule — first live test worked

`045` at `6020a54` → `b2d5a3b`; Main CC re-fetched → `GEN-046`. Its first act invalidated a name in
the brief that adopted it; the brief is corrected by this ruling.

## F3 with a body

`main`'s UI suite was 101/79/**19 FAIL** and nothing ran it; a suite no gate runs stops being true
quietly. Classify-before-act on `corpus.g.ts` (3 reshaped / 16 stamp-only / 7 identical) correct;
regeneration accepted as a UI-owned prerequisite.

## R1 — required before the 10 proven count

`GEN-044` found Main CC's `with-mutation` treated ANY non-zero exit (including a build failure) as a
red — five bites were false. `a-bite-is-a-named-red` is harness-agnostic.

**CONFIRM your UI mutation harness certifies a mutation only when the NAMED case fails for its own
reason WITH ITS LOG PRESENT.** If it keys on exit status, apply the `GEN-044` fix to the UI harness
and re-run the 10 `prove:notices` mutations under it before merge. Report which.

## Accepted

- **m7 found a hole:** the copy scan, the claim register and the forbidden-terms boundary all walk
  `MESSAGES`; a JSX literal is invisible to all three — `correlated-lists-certify-nothing` on the UI
  side. `no-jsx-literal-copy.test.ts` closes it; acceptance 4 met by the new guard.
- **The no-controls guard was WIDENED by derivation** (explicit read-affordance marker; no control
  bears a deferred act's name; `select` added). Correct shape.
- **Bilingual:** both languages always render, the toggle changes which leads — a guard must measure
  something real, and zero-width would have passed silently. Accepted; the brief's locale-first design
  is superseded.

## G1 — the PO's error, two levels

The brief's *"R3's fixture from `GEN-042`"* was false. `GEN-042` added **no** fixtures for its new
operations, `GEN-043` repeated it, and the PO's `GEN-042` close ruling failed to catch a
fixture-parity breach (`GEN-006`) it had itself required. Eleven write routes plus R1 and R3 have no
fixtures.

**RULING:** `GEN-047` (backend) adds fixture parity for every `GEN-042` operation. The stated gap and
the decision to write **no renderer** for `getNoticeOutstanding` are correct.

## G2–G7

Routed to `GEN-047`, including **G5** (oldest-first approval queue needs a state-entered timestamp on
the list; `2.1.0`). Main CC will read `UI-045-step1.md` from branch `codex/ui-045-v1.0` — no need to
re-transcribe.

## UI-004

**RULED: close as superseded.** Notices requests answered by `ADR-019`; Overview design intent,
Cases, and Home-Safety freshness carried as named owed items. Execute `UI-004`'s Rule 7 close
(`status: superseded`; this ruling is its `-RULINGS-`) with `UI-045`'s merge.

## Merge

After `GEN-046` lands. Standard: refspec push from the worktree; `main` never checked out; tree-hash
re-read via `git ls-remote`; through the hook (which will then run the UI suite), **no `--no-verify`**;
`[UI-045]` tag. Rule 7 close for **`UI-045` and `UI-004`**, `closed: <TODAY from date>`. Report the
merged tree-hash and both closed rows.

Until then: **HARD STOP at "built, green, awaiting gate"** — answer R1 in the meantime.
