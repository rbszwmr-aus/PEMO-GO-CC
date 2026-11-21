# UI-051 — Step ruling: notices write flow — MERGE; findings routed

Date: 2026-09-03
Report: docs/governance/reports/UI-051-step1.md. Branch UI-051 at 70621d1 (allocation 4161025 on main; D0 17a5159; build 07d1308). Node 129 (126/3 live skips); browser 365 (360/5); matrix 220; mutations 25/25; corpus.g.ts + digest byte-identical to main.

## Accepted as built → MERGE
- D1: `permits(target, op)` as a membership test; `NoticeActions.tsx` the only `data-act` drawer; source guard derives the act vocabulary from the contract enum on all three carriers; the 220-cell matrix checks the other direction per row. The lifecycle fixture as the place where "derive from state" and "read the list" disagree is exactly the intended bite.
- m12: undeclared reds on list cells turned out to be a finding and were declared, not suppressed — correct. The finding itself (a DRAFT row in list.json lists publishNotice) is routed to Main CC as a possible server defect, below.
- m17: the missing-language test now clears a body as well as a title — accepted; the harness corrected the author.
- F1 oracle widening (parameter names, for `Idempotency-Key`) — accepted: derived from the contract, never hand-kept; reported because it widens what a guard accepts, which is the right reflex.
- Live act client wired, paths asserted from source, not exercised — stated, not claimed. Accepted; GEN-050 D1 unblocks it.

## G-findings — rulings
G1 `notice-incomplete-translation` declared in the contract, no Problem fixture in the corpus. UI's on-screen declared gap, typed and total over the enum, is accepted for merge. The corpus defect is Main CC's: parity today covers operations, not Problem types. Ruled: parity extends to Problem types — every declared Problem type has at least one fixture, or the parity check reds.
G2 `refusal-wrong-state.json` carries `notice-stale-version`; `notice-wrong-state` has no fixture. Main CC: relabel or re-record so the file's name and its Problem type agree; add the missing fixture. (The Problem-type parity rule catches the second half.)
G3 `reasonCode` has no vocabulary in the contract while the server registry holds 15 codes across four acts. Ruled: the enum goes into the contract, generated from the server registry (one source), MINOR 2.1.0 → 2.2.0. UI's free-text-with-note is accepted meanwhile; the select binds in the next UI PID.
G6 Compose entry hangs off getScope, whose fixtures carry no floor or unit; getPropertyTree carries them and its floors and units also permit composeNotice. Ruled: the property tree is the canonical node picker — compose entry belongs on every node that lists composeNotice in whichever tree renders it, and getScope stays what R4(b) said it is (shell-load-bearing, the caller's own access). Not a defect in UI-051; accepted as built; the property-tree entry is D1 of the next UI PID.
G4, G5 as listed — accepted as deferred-with-reason. G7 — held by the PO; named deferral stands.

## Routed to Main CC — GEN-052 (contract/fixtures, 2.1.0 → 2.2.0 MINOR)
1. Problem-type parity check (G1 rule); fixture for `notice-incomplete-translation`.
2. G2 relabel/re-record + `notice-wrong-state` fixture.
3. `reasonCode` enum in the contract, generated from the server registry; Problem enum via gen.
4. INVESTIGATE list.json: a draft notice lists `publishNotice`. Either canPerform's state precondition for publish admits draft (then the act does too — GEN-047's matrix compared list to real invocation, so both would agree and both would be wrong), or the fixture was recorded against a stale registry. Report which; if the former, the fix is in the notices state precondition and the bite is "publish from draft → refused".
5. Regenerate consumers; UI suite must stay green through the gate.

## Next UI PID (after GEN-052 lands) — part 2b
D1 compose entry on property-tree nodes (G6). D2 bind G1/G2/G3 fixtures (incomplete-translation state; wrong-state refusal; reasonCode select). D3 G7 identity column once ruled. D4 live-mode act exercise once GEN-050's dev-token exists (report, not gate).

## Merge
Standard: refspec push from worktree, main never checked out, tree-hash re-read via ls-remote, through the hook, no --no-verify, [UI-051] tag. Rule 7 close. Report merged tree-hash + closed row. HARD STOP for the close ruling.
