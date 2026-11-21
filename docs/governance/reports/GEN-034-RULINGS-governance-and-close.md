# GEN-034 CLOSE — R5 governance conventions

**Verdict: CLOSE. Merge authorized.**
Date: 2026-09-01

## What is proven

Green on a from-nothing rebuild, pin 0991a539: contract 105/105, integration
352/352, battery 27/27, boundaries PASS, validator PASS, stamp PASS. Contract
1.1.0 → 1.2.0 (MINOR, additive — I6). All six items land, each proven by mutating
to the plausible wrong rule.

## Items confirmed

- **I1** — non-conforming `pids/` stem now faults naming the file. The decision to
  keep `archive/`'s silent skip is correct and well-reasoned: archive holds
  generated companions that are not PIDs, `pids/` holds nothing but PIDs — the
  fault belongs where the invariant is total.
- **I2** — the message names the literal `-RULINGS-` pattern and the failure; Rule 7
  now records the convention that was previously written down only in the refusal.
- **I3** — `pnpm gen:enums`, idempotent by construction, with a battery case; proven
  by adding a registry entry (check reds, validator reds, gen fixes, both pass).
  The generation step is no longer performed from memory.
- **I4** — [mutate-to-the-plausible-wrong-rule] added; [delegation-floor] confirmed
  present.
- **I5** — accepted, and the pivot is correct. The sigil was infeasible: 176 of 275
  citations live in `reports/` and `archive/`, which are immutable Rule-7 records —
  a migration that cannot touch two-thirds of its subject leaves both forms in
  circulation and resolves nothing. Deriving the other namespaces (31 Problem.type
  slugs, 73 validator codes) from their own sources at scan time, with a vacuity
  refusal, respects that immutability instead of fighting it. The mutation proves
  the allowlist was the wrong cure (hand-listing the one id that bit GEN-033 passes
  that case, reds on a different code). Both directions in the battery.
  The self-catch is noted with approval: documenting the citation form tripped the
  checker on `adrs-present.sh` itself (the fourth instance of the class its own
  header records), fixed at source per the header — the shape is described, not
  written.
- **I6** — the pair is carried, and the replay path re-derives it by reading the act
  rather than echoing the request (the easy wrong answer avoided; consistent with
  idempotency storing identity, not a response).

## Gap 2 — ruled, does not block this close, must be retired

The foreign-namespace derivation greps `fail('…')` out of `validate.mjs` for the
73 validator codes. If that call shape changes, the derivation silently narrows,
and the vacuity refusal catches only a total failure, not a partial one. This is
the exact "derived axis with a fragile derivation" shape R5 exists to retire, one
level down — a sharp and correct find.

**Why it does not block close:** its failure mode is *safe and loud*. A narrowed
code set means a bracketed validator code in prose is misread as a dangling
principle → `adrs-present` fails → a close is refused. That is a false positive
that fails loudly and blocks nothing bad from passing; it never masks a real
defect. So GEN-034 closes on its proven merits.

**Ruling — retire it in R5b:** give validator codes a **declared source of truth**
(an enum/union that `validate.mjs` itself consumes), and have the citation
derivation read that declaration rather than grepping call sites. This makes the
validator-code axis symmetric with the Problem.type axis, which already derives
from a type (robust). Elevated to a first-class item in the R5b code-hygiene PID.

## The other three gaps

The report lists four gaps; gap 2 is detailed and ruled above. The other three I
take as forward-carried on the all-green merits — per precedent, if any is an
authority-floor or guard concern rather than tooling/cosmetic, hold it out and
flag before the next PID pins.

## R5b (code-hygiene sibling) — now carries

- LIKE-escape sweep; fixtures ON CONFLICT; derive-refusing-commands-from-types;
  with-mutation.sh; **and the validator-code declared-enum (gap 2 above).**
- Sequenced after ADR-018 (PO ruling: R5 → ADR-018 → notices/cases), or slotted
  by the PO.

## Merge (standard)

Refspec push from worktree; main never checked out; tree-hash equality re-read via
`git ls-remote`; through the pre-push hook, NO `--no-verify`; `[GEN-034]` commit
tag. Rule 7 close: file → archive/ with index row, status: merged, closed:
<TODAY from `date`>.

— PO ruling, filed as durable record.
