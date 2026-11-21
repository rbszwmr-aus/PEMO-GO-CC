# GEN-026 (W1d — `staff` → `principal`) — rulings + close

Date: 2026-08-31
Report: rewrite/reports/GEN-026-step2.md — HARD STOP, nothing committed. Pin 0310b978.
Contract 105/105 · integration 274/274 · battery 24/24 zero skips · boundaries PASS · validator PASS · index OK.

## Verdict: APPROVED, close. Two judgements worth keeping, one method finding routed to W2.

---

## R1 — The `UPDATE` kept despite zero rows: right, and the reason is the rule.

Measured: 0 rows, 0 `staff`, no seed writes the table. You kept the `UPDATE` anyway because *"a rename
that only works on an empty table is not a rename"* — a migration must be correct for **any** database
that applies it, not merely for the one in front of you. That is the standard; the measurement
justified the *timing*, not the *shape*.

Ordering was right too: data first while the old CHECK still permits it, then the vocabulary. And
`0121` is a new migration with `0119` untouched — the rule you drew last PID, applied.

## R2 — The constraint rename: the stale-artifact shape, found in an identifier.

`..._only_when_staff` over a vocabulary containing no `staff` would be **a name contradicting its own
contents** — the stale-comment shape this corpus keeps catching, but **hidden in an identifier, where
it is harder to notice** and where no reader is looking for it. Renaming it to
`audit_event_authority_only_when_principal` was correct and unprompted. Note the location as a new
place the class hides: not only comments, docs and status lines, but **names**.

## R3 — No default introduced: the W1b property preserved.

The compiler enumerated the four call sites again and **no default was added** — an act with no actor
still cannot inherit an attribution by omission. That was the point of making `source` required rather
than defaulted, and it survived the rename.

## R4 — The method finding: routed to W2 as a worked note. This is a good one.

`grep "'staff'" | grep -v estate_staff` reported none, and **it was wrong**:
`harness-isolation.test.ts:33` carried both `'staff'` and `'estate_staff'` **on one line**, so the
exclusion filter discarded the line along with the genuine hit. The suite caught it — but the search
had already told you the work was done, which is the dangerous part: **a search that answers "none"
ends the looking.**

The lesson is precise and non-obvious: **a line-based exclusion filter discards the whole line, so it
can hide a genuine match that shares a line with an excluded one.** Correct not to add a principle
mid-PID with the basket out of scope, and correct to re-run unfiltered and read the remaining matches
rather than trusting the filtered count.

**Ruling — append a worked note to `[anchor-the-discriminator]`**, riding W2. So **W2 carries exactly
TWO worked notes** — this one and the `[shadowed-layer-empty-oracle]` note from GEN-025. Two, and no
more; the basket stays closed.

## R5 — The down migration refuses when a non-staff principal has acted.

Same shape as W1a's refusal: a reversal that would **mislabel a resident's act as staff** must refuse
rather than proceed quietly. Consistent, and now twice-applied — a reversal that would silently
misrepresent or resurrect something refuses. Worth remembering as the house pattern for down
migrations.

## R6 — Test counts unchanged.
For a rename, that is the right outcome, and saying so is the right instinct: a rename that changes
test counts has changed behaviour.

## Close instruction
Merge through the hook, no `--no-verify`; tag `[GEN-026]`. Rule 7 close → archive/ with row,
`status: merged`, `closed: <today, from `date`>`, artifacts carried (spec, step2 report + this ruling).

## Next: W2 — the grant write surface.
Step 1 proposes four things: `act_id` stability (structural, not a caller convention), the
provisioning act's self-limiting predicate, the three operation contracts (stance + reason
vocabulary), and where `G-2` lives. Plus the two worked notes above. **This is the first surface that
creates authority — anything that needs an assumption is a stop-and-ask, not a proceed.**
