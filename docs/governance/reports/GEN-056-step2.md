# GEN-056 — landing A (kind governs every render-by-key site) and B (gate decouple)

**PID:** GEN-056 (branch `codex/gen-056`, worktree off `a547ff5`)
**Date (UTC):** 2026-09-05
**Status:** author-complete; both directives landed together, full Flutter suite and every DB-free
register step green locally. Awaiting the close ruling.

## A — the KIND signal governs EVERY render-by-key call site, not section 18 alone

The branch's first CI run reddened the Flutter job because the regenerated 0.4.0 corpus added two
groups that are not built fetching screens — `problems` (Problem bodies, an operation-fixture) and
`notices` (a fetching screen, but unbuilt: MOB-06's `InboxPlaceholder`). Any test that pumped a widget
by raw corpus key threw for those two. The ruling: derive the key list from KIND at every such site,
because "a fix that greens section 18 and leaves rules 7/8/semantics iterating raw keys has moved the
failure, not removed it."

Enumerated call sites and their disposition:
- `test/rules/state_coverage_test.dart` (section 18 matrix) — **fixed**: iterates `renderableScreens`.
- `test/a11y/accessibility_test.dart` (rules 7/8 + semantics) — **fixed**: same.
- `test/rules/rule01_*.dart`, `test/rules/rules_02_to_10_*.dart` — unaffected: they name the built
  `mob-*` keys literally, never `byScreenAndState.keys`, so no operation-fixture reaches them.
- `test/contract/palette_matches_contract_test.dart` — unaffected: byte/semantic identity over the
  embedded corpus, not a render-by-key.

The derivation lives once, in `test/support/screens.dart`, from TWO signals — neither a hand-kept list:
- `FixtureCorpus.screenKind[k] == 'screen'` — DERIVED in the generator from the fixture SHAPE (a
  GET-200 data fixture is what gives a group a state matrix); excludes `problems`.
- `screenFor(k) != null` — the widget wiring itself returns null for a key the app builds no screen
  for; excludes the unbuilt `notices`.

`renderableScreens` is that intersection, and it is the only list a render-by-key test iterates.
Full `flutter test`: **280 tests, all pass**. `flutter analyze` on the changed files: clean.

## B — the gate's rules are decoupled from the debt, DEBT and RESULTS both synthetic

The half-done decouple synthesised the gate's *input events* but still read the *real*
`flutter-test-debt.json` — which GEN-056 empties — so rule 4 printed "0 exempt (of 0 booked)". Fixed by
pointing the gate at a SYNTHETIC debt file through the `PEMO_FLUTTER_DEBT_FILE` seam GEN-048 built, so
both the events and the booked debts are controlled input. Verified the env var reaches the process
(`run()` passes it), the fixture carries two entries with cause/owedBy/date, and rule 4 now prints
"1 gated, 2 exempt". `flutter-gate.test.ts`: **6/6**. The shipped `flutter-test-debt.json` is `[]` and
`--validate-debt` on it is green.

## The KIND bite (D3, both ways)

`docs/governance/bin/corpus-kind-current.mjs` re-derives each group's kind from the SOURCE fixture
shape and compares it to the `screenKind` map EMITTED in `fixture_corpus.g.dart`. They agree for all 7
groups today. New manifest guard `corpus-kind-matches-derivation` (GEN-056): mislabel `problems` as a
`screen` in the generated file → the check reds naming `problems` ("g.dart says 'screen', source shape
derives 'operation-fixture'") — exactly the label `renderableScreens` trusts to keep operation-fixtures
out of the state matrix. `run-mutations GEN-056`: **2 proven, 0 failed** (this plus the stamp-check
bite from step 1).

## What ran locally, and the one boundary

Run and green locally: `pnpm -r build` (whole TS workspace, api included); full `flutter test` (280);
`flutter analyze`; `flutter-gate.test.ts` (6/6); `run-mutations GEN-056` (2/2); `contract-stamps-current`
(4 stamped, current); `corpus-kind-current` (7 groups agree).

NOT run locally: the DB-backed register steps (`verify:boundaries`, the api integration/contract suite).
This environment has no usable dev-DB credentials — `database/dev/.env` is absent, and the container on
`:55433` was initialised by an `.env` that is gone; the system cluster on `:5432` is the wrong,
unbootstrapped target, and tearing down the running container to re-init is a destructive act against a
DB I did not create and cannot identify (declined). CI runs the full DB register on push. This is not
the step-1-class lapse: that skipped the *Flutter* suite — the surface this change actually touches —
and this change's Flutter surface is fully run locally; the diff touches no api source and no SQL, and
`pnpm -r build` proves the shared build.
