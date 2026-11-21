# GEN-056 — the resident-mobile regeneration (step 1)

**PID:** GEN-056 (branch `codex/gen-056`, worktree off `a547ff5`)
**Date (UTC):** 2026-09-04
**Status:** author-complete; awaiting the step ruling. The two exempt Flutter tests go green in CI's
Flutter job (the only place Flutter runs); everything else is proven locally.

## D1 — the two Dart generators ported to node (faithful; no refusal needed)

Both `generate_tokens.dart` and `generate_fixtures.dart` are pure JSON→Dart-string transforms, so a
faithful node port was possible for both:
- `apps/resident-mobile/tool/generate-tokens.mjs` — reads `severity.json`, emits
  `lib/theme/severity_tokens.g.dart` (enum + token map), byte-shape unchanged.
- `apps/resident-mobile/tool/generate-fixtures.mjs` — reads
  `tests/fixtures/resident-mobile/index.json` + the fixture files, emits `lib/data/fixture_corpus.g.dart`.

The one thing that could have blocked a faithful port — the "byte-identical fixture corpus" test — does
NOT compare bytes: `palette_matches_contract_test.dart:71` compares `jsonDecode(embedded)` with
`jsonDecode(source)` (semantic equality), so node's `JSON.stringify` and Dart's `jsonEncode` are
interchangeable. `.mjs` (not `.ts` + a package.json) keeps the Flutter app out of the pnpm workspace
(`pnpm-workspace.yaml` globs `apps/*`, and resident-mobile is deliberately outside it).

## D2 — regenerated to 0.4.0; the debt entries removed in the same commit

- `severity_tokens.g.dart`: `contractVersion` 0.2.2 → **0.4.0**; the seven severity colours re-emitted
  from the v2.0 design export values in `severity.json` (the 0.2.2→0.4.0 delta is the colour re-banding
  of UI-010-ST, structure unchanged — still 7 levels, same enum).
- `fixture_corpus.g.dart`: `contractVersion` 0.2.2 → **0.4.0**; 76 fixtures across 7 screens re-embedded
  from the current source corpus. Generators are idempotent (a re-run changes nothing).
- `tests/fixtures/flutter-test-debt.json`: both resident-mobile debts **removed**, in this same commit —
  the gate's rule 3 reds the moment an exempt test passes while its entry survives, so the file must
  empty together with the fix. `debts: []`.

## D3 — the root cause: the stamp check now covers EVERY consumer, derived

`contract-stamps-current.mjs` walked only `apps/<app>/src` for `*.g.ts`, so the Flutter consumers under
`lib/` in `.g.dart` were outside its reach — which is why GEN-046's regenerate-every-consumer rule was
skipped silently for a month. Extended:
- the walk now covers `apps/<app>/src` AND `apps/<app>/lib`, matching `*.g.ts` OR `*.g.dart`;
- each file still names its own source and stamp, DISCOVERED not listed — `.g.dart` via
  `// Source: <path>.json` + `static const contractVersion = 'v';`, `.g.ts` via its existing header —
  so a new consumer is covered by the existing walk and a new language is one branch, never a new list.

It now checks **4** stamped files (was 2): the two `.g.ts` token consumers (management-web,
resident-portal) and the two `.g.dart` consumers (resident-mobile tokens + fixtures), plus 2
not-contract-derived files named in the output.

**Bite (`run-mutations GEN-056`, kind guard, 1 proven):** revert the regenerated Dart tokens to the
stale 0.2.2 stamp → the check reds naming `apps/resident-mobile/lib/theme/severity_tokens.g.dart`
("0.2.2 but severity.json is now 0.4.0") — which the `.g.ts`-only walk could not do.

**Principle:** `[a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy]` — registered.

## D4 — the consumer list the stamp check now derives

Not a list in the check — derived by walking. As of this commit the walk covers:
`apps/management-web/src/**.g.ts`, `apps/resident-portal/src/**.g.ts`,
`apps/resident-mobile/lib/theme/severity_tokens.g.dart`,
`apps/resident-mobile/lib/data/fixture_corpus.g.dart`. Adding a consumer, in any of those languages,
is covered automatically; a new language adds one branch to `readConsumer`, not an entry to a list.

## Verification

- `contract-stamps-current.mjs`: **4 stamped, all current** (green); the bite reds naming the consumer.
- `run-mutations GEN-056`: 1 proven, 0 failed. `adrs-present`: the new principle resolves.
- The two exempted tests (`palette_matches_contract_test.dart`) pass only where Flutter runs — CI's
  Flutter job — which with the debt file emptied is the acceptance for D2. Confirmed on the branch run.
