# GEN-027 (W2 — the grant write surface) — rulings + close

Date: 2026-08-31
Report: rewrite/reports/GEN-027-step2.md — HARD STOP, nothing committed. Pin 6ee9eb9d.
Contract 105/105 · integration 298/298 (+24) · battery 24/24 · boundaries PASS · validator PASS · contract stamp PASS, on a database rebuilt from nothing.

## Verdict: MERGES, subject to one verification (R2). My scope on the last-administrator guard was wrong and yours is right.

---

## R1 — The refused act that was audited and burned its key: the diagnosis and the fix are right. **The opt-in is not.**

A module command reporting refusals as **values** meant the primitive committed them — an
`audit_event` recording an act that never happened, and a consumed key turning the caller's corrected
retry into a D5 conflict. Your framing is the correct one and it is GEN-009's argument from the other
end: **the audit is a record of acts, and a false record is worse than a missing one.**

`AuditedWriteOptions.committed` is the right mechanism. **But opt-in is the shape that has bitten this
corpus five times** — a command that refuses-by-value and forgets the flag still writes a false audit,
and nothing notices. The precedent is W1b's `source`: making it **required rather than defaulted** meant
**the compiler enumerated every call site**, which you called the mechanism working. Same move, same
argument, and this is the audit spine.

**Ruling:**
- **Before close — verify no current command can reach the false-audit path**: every command that can
  refuse-by-value sets `committed: false`. Report the evidence. If any is unsafe, fix it now.
- **Making it REQUIRED is W3's first item.** Not at close — a change to the primitive at close time is
  design-at-close, which we avoid. If required turns out materially larger than the ~20 opt-in lines,
  report the delta and I rule rather than you absorbing it.

This is the **third** shared-primitive touch; calling it out rather than folding it in is the standard.

## R2 — The fingerprint trap: the rule is right, and it is bigger than this PID.

`deriveRequestFingerprint` **warns in its own text** about a field varying innocently between retries —
and you then fingerprinted the **resolved** `effectiveFrom`, which defaults to the request instant, so
an honest retry would have been refused as a conflict. The rule you drew is crisp and general:
**fingerprint what the client SENT, never what the server filled in.**

Note the shape without piling on: **a warning in the code is a control only if it is read at the moment
of writing.** It was there and it did not stop the hand.

**Do not add a principle on assumption.** Check whether one already owns it — `[seed-from-declared-basis]`
and `[frozen-axis]` are the candidates I can see from the list; **read them**, do not infer from names
(that is exactly what misled me at R5). Route to W3's principles pass.

## R3 — The mutation that lied: this is the sharpest thing in the report.

Weakening zero-ever to zero-live left all 298 green — and the **mutation** was wrong, not the tests:
filtering raw assertions by liveness still matches the open version-1 row. The realistic wrong
implementation resolves latest-then-liveness, and with **that** the test reds. **"Only asking why the
green appeared separated the two."**

The lesson generalises and belongs in the corpus: **a mutation must express the realistic wrong
implementation, not merely a syntactic weakening — a green under an unrepresentative mutation proves
nothing in either direction.** Same instruction: **check for an existing owner first**
(`[probe-must-bite]` is the likely home, as a worked note). Route to W3's principles pass.

## R4 — The last-administrator guard: **my scope was wrong, yours is right.** Accepted.

I framed it at the organization node on the premise that an estate is administrable from above — and
you are right that **the premise holds only if an administrator exists above it, which is not
automatic.** The definitively unrecoverable state is **no live administrator at all**, and that is what
you guarded. Strictly safer and simpler than what I ruled.

The **subtree case** — an estate whose only administrator is revoked while the organization's remaining
administrator cannot reach it under `G-2` — is real, and **naming it rather than guarding it was
right**: it needs reachability analysis over the scope tree, which is its own piece of work. **Owed.**

## R5 — The worked-note check paid off, and it exposed something about the file itself.

`[no-coincidental-collision]` is about **numeric** coincidence despite its name — so the note correctly
went to `[shadowed-layer-empty-oracle]`, and the instruction to read before appending earned its
keep. **I was misled by the name**, which is precisely the hiding place GEN-026 R2 identified: not only
comments, docs and status lines, but **names** — and now, a name inside the principles file itself.

Do **not** rename (ids are permanent once cited). **Add one clarifying line to
`[no-coincidental-collision]`'s body** so the next reader is not misled as I was. Route to W3's
principles pass.

## R6 — Gap 1: the bootstrap is not self-contained, and that is the honest state of the phase.

Provisioning still cannot bootstrap a genuinely empty organization — the group must already exist, and
group creation is W3. **W2 alone does not remove the DBA; W2 + W3 does.** Correct not to expand into
W3 to close it. Say so plainly in the close note so nobody reads W2 as the finished capability.

## R7 — Weight and ratio.
1428 / 165 across 35 files (20 of them the regenerated contract stamp) plus 5 new files, with a
**551-line proof suite as the largest single piece**. On the first surface that creates authority, that
is the right ratio, and saying so is not self-congratulation — it is the record of a deliberate choice.

## Close instruction
Verify R1's pre-close check, then merge through the hook (no `--no-verify`), tag `[GEN-027]`. Rule 7
close → archive/ with row, `status: merged`, `closed: <today, from `date`>`, artifacts carried (spec,
step1 report + ruling, step2 report + this ruling). Note in the close that the bootstrap completes at
W3.

## W3 will carry
1. **`committed` made required, not optional** (R1) — first item.
2. `createGroup` / `addMembership` — the operations that actually remove the DBA.
3. **One principles pass, three items, each check-before-adding**: the fingerprint rule (R2), the
   mutation-realism lesson (R3), and the clarifying line on `[no-coincidental-collision]` (R5).

## Owed ledger — additions
- Subtree administrability (reachability over the scope tree) — named, not guarded (R4).
- The boundary-scan blind spot (carried).
