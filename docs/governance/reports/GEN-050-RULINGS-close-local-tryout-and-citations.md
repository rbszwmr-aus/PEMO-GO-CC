# GEN-050 — Close ruling: local try-out ergonomics + context-scoped citation recognition

Date: 2026-09-03. Merged a85c66b, tree-hash equal. Battery 35/35; manifest 37 proven / 0 failed (5 new). Step report GEN-050-step1.md.

## Closed. Accepted, with the three flags answered.

C1 D1 `pnpm -C apps/api dev-token <principal>`: no route; both refusals inherited (loadConfig's `PEMO_ENV must be exactly "development"`; unknown principal refused naming nothing — a "did you mean" would be an enumeration oracle). Tested as a child process so the refusal tested is the one a person sees. Accepted.
C2 D2 engines `>=22.6.0`, `.nvmrc` 24, `engine-strict=true` so the floor refuses rather than warns; bite asserted from the files because the host cannot run an older Node — stated, not claimed. Accepted.
C3 D3 README from a bare title to the four commands, floors, and the dev-token line. Accepted.
C4 D4 citation recognition is now contextual: STRICT in PID files, the principles file and code; PROSE elsewhere (registered slug = citation, unregistered = mention); FENCED never. Counted citations 76 → 72 because prose mentions no longer count; the dangling arm loses nothing it guarded. New `guard` kind in the runner (a shell guard must refuse with the named message) — usable for the owed shell-guard class. Ninth instance closed as a class, inside the fix itself. Accepted.

## The three flags
F1 "The guide the spec names is not on the drive." Correct — it never was on the drive; UI CC wrote it untracked and UI-051 D0 carried it to main at docs/governance/reports/GUIDE-try-the-ui-locally-2026-09-03.md. My spec pointed at the wrong place. The one-line dev-token note in the guide's live-mode section is UI CC's (it owns the guide) and goes into UI-053. The README line stands meanwhile.
F2 "D5 hook guard absent from the filed spec." Correct — I added D5 by dispatch box after filing and did not amend the file; the executor built the filed spec, as it should. Not built; owed to GEN-054 (below). Rule for me, recorded: a scope addition is filed to the spec before it is dispatched, or it is not scope.
F3 Ninth collision closed as a class — accepted; nothing further.

## Owed after GEN-050 → GEN-054 (governance/harness batch, Main CC, next)
- D5 hook guard: pre-push refuses while the pushing worktree has a rebase/merge/cherry-pick/revert in progress; principle a-push-is-a-finished-tree.
- GEN-047 matrix gains the approval-policy dimension (gated × ungated type) if GEN-052 did not add it (GEN-052's step report shows the fixture-value pin, not the matrix change — confirm).
- CHECK-precheck class: for every CHECK constraint in notices and cases schemas, a test that the act refuses with a Problem before the row reaches the CHECK.
- Prose-bite classes, first two of four: DDL/grants and HTTP adapters, using the new `guard` kind where a shell guard is the subject.
- Exact projection type; multi-node ticket case (carried, still owed).
