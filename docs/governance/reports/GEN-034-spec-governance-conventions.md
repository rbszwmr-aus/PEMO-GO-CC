# GEN-034 — R5 governance conventions (hand/memory rules → enforced)

PID id: take the register's next allocation (expected GEN-034). File as
`pids/GEN-034.md`. Human label "R5 governance". Pins to origin/main 0991a539.
Theme: **a rule whose membership is grepped by hand — or whose scan silently
ignores what falls outside its pattern — is a suggestion, not a rule.** Each item
below has bitten a cycle this week; this PID converts each into something a
checker or a scripted step enforces.

## Scope — six items

**I1 — pids/ stem must fault, not skip silently (GEN-032).**
The allocation checker's `ID_RE = ^(TYPE)-\d{3}$` places a non-conforming stem
OUTSIDE its authority — invisible to `max(NNN)+1` and the duplicate check. Change
it to **fault** on any `pids/` file whose stem does not match `ID_RE`, naming the
offending file. Silent invisibility is worse than a rejection.
Bite: add `pids/not-an-id.md` → checker faults naming it; revert the fault → it
is silently ignored (the current bug). The fault must red the bad-stem case.

**I2 — the `-RULINGS-` close convention must be discoverable, not learned by
refusal (GEN-032).** The close check already faults loudly ("no -RULINGS- file
for it exists"). The gap is that nothing states the rule until a close is
refused. Document it in the governance README's close/Rule-7 section, and ensure
the checker's message names the required `reports/*-RULINGS-*` pattern verbatim so
the cure is self-evident. (Low-code; the enforcement already exists.)
Bite: the close check's failure text contains the literal pattern `-RULINGS-`.

**I3 — registry → surface-enum regeneration must be a scripted step, not from
memory (GEN-033).** The enum is generated from the registry (the source of
truth), but nothing regenerates it automatically — done by hand at GEN-027,
nearly missed at GEN-033, caught only by the `problem-type-enum-agreement`
validator. Add a scripted generation target (e.g. `make gen-enums` / a script)
that regenerates the enum from the registry, and make the validator's remedy
"run the gen step," not "hand-edit." "A generation step performed by memory is a
step that will be skipped."
Bite: add a registry entry, run the gen step → the enum updates to match; the
existing agreement validator reds when the committed enum is stale, and passes
after the gen step. A test asserts gen is idempotent (running it twice is a no-op).

**I4 — add principle [mutate-to-the-plausible-wrong-rule] to PID-PRINCIPLES.md
(GEN-033).** Definition: *a guard is proven to bite only by mutating it to a
competing rule a reasonable author might have written, not by a syntactic
deletion — which may not compile, or may red for an unrelated reason.* (The
corpus already carries `delegation-floor` from GEN-033; confirm it is present.)

**I5 — citation-vs-mention: disambiguate, do NOT allowlist (GEN-033).**
`adrs-present` reads ANY bracketed kebab-case token as a principle citation, so a
validator code or a problem-type slug mentioned in prose is misread as a dangling
citation. Three namespaces (principle ids, validator codes, problem-type slugs)
now share one bracketed form and only one is checked. The allowlist is the wrong
cure — a foreign id is neither a metavariable nor a late principle. Fix by
**distinguishing a citation from a mention**: either principle citations take a
distinct form the checker keys on (a sigil, or resolution only within a declared
"Cites:"/principle-reference context), and a bare bracketed token in free prose
is a mention; Main CC picks the mechanism that fits the corpus and migrates
existing genuine citations to it.
Bite: a report containing a bracketed NON-principle token in prose (e.g. a
validator code) passes `adrs-present`; a genuinely-undefined principle written in
the citation form still fails. Both cases in the battery.

**I6 — removeMembership response echo (GEN-033, cosmetic).** Widen the
`removeMembership` response so `groupId`/`principalId` carry the pair acted on,
not empty (the command returns instance+version and was not widened for
presentation). This is the one contract-touching item → MINOR contract bump
(additive), restamp as usual.
Bite: a test asserts the response carries the acted-on (group, principal).

## Acceptance

All green on a from-nothing rebuild: contract, integration, battery (add cases
for I1, I3, I5, I6), boundaries, validator, stamp. Each new/changed check shown
to BITE per [mutate-to-the-plausible-wrong-rule] — mutate the guard to the
plausible wrong rule, not a syntactic deletion. Report the contract version delta
(from I6) and confirm `adrs-present` resolves this PID's own citations (mind that
until I5 lands, a bracketed non-principle id in this very PID would dangle —
write foreign ids and not-yet-defined principles in prose/backticks, not
brackets).

## Out of scope — the code-hygiene sibling (R5b), still owed

The original grep-cluster's code sweeps are a SEPARATE PID (proposed R5b),
sequenced after ADR-018 or as the PO slots it — kept out of this PID to keep it
coherent:
- LIKE-escape sweep (`_`/`%` are wildcards; user input in LIKE must be escaped).
- fixtures ON CONFLICT.
- derive-refusing-commands-from-types (don't hand-list which commands refuse).
- with-mutation.sh (the mutation-control script owed after the scratchpad-wipe
  near-miss).

## Close protocol

Standard merge: refspec push from worktree; main never checked out; tree-hash
equality re-read via git ls-remote; through the pre-push hook, NO --no-verify;
`[GEN-034]` commit tag (the register's allocated id). Rule 7 close: file →
archive/ with index row, status: merged, closed: <TODAY from `date`>. The PO
ruling will be filed with `-RULINGS-` in its name. Report merged tree-hash and
the closed row. HARD STOP for the close ruling.
