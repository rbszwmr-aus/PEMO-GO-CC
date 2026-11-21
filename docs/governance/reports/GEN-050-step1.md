# GEN-050 step 1 — local try-out ergonomics, and citations read by context

**Date:** 2026-09-03  **Pin:** `1116fed`.  **Battery:** 35 passed, 0 failed.  **Manifest:** 37 proven, 0 failed (5 new).

## D1 — `pnpm -C apps/api dev-token <principal>`
`apps/api/src/cli/dev-token.ts`. No route. Two refusals, both inherited: the environment one is
`loadConfig()`'s own (`PEMO_ENV must be exactly "development"`) and the command adds no way round it;
the principal is looked up in `access.staff_principal`, and an unknown one is refused with a message that
names nothing else — a "did you mean" would be an enumeration oracle. Tested as a child process, so the
refusal tested is the one a person sees. **Bites:** skip the lookup → reds; force the env before the
guard → reds. **The guide the spec names (`GUIDE-try-the-ui-locally-2026-09-03`) is not on the drive
under any name I can find**, so its one-line usage note is NOT written; the README carries the line.

## D2 — Node floor
`engines.node` `>=20` → **`>=22.6.0`** (`--experimental-strip-types`), `.nvmrc` = `24`, and
`engine-strict=true` in `.npmrc` so the floor refuses rather than warns. **This host cannot run an older
Node**, so the bite asserts the floor from the files (lower it → reds) — stated, not claimed as an install run.

## D3 — README
Was a bare title. Now: bash + psql for `bootstrap.sh`, Windows = Git Bash or WSL, the Node floor, the
four commands, the dev-token line.

## D4 — context-scoped citation recognition
The rule was syntactic — any backticked bracket anywhere was a citation. It is now **contextual**:
STRICT in PID files, the principles file and code (every bracketed slug must resolve; the
definition-context rule is unchanged); PROSE elsewhere (a registered slug counts, an unregistered one is
a mention); FENCED CODE never. The counted-citation total drops (76 → 72) because prose mentions no
longer count — the dangling arm loses nothing it ever guarded. **Bites**, via a new `guard` kind in the
runner (a shell guard must refuse with the named message — usable for the owed shell-guard class too): a
dangling citation in a PID file still reds; one inside a fence does not; `[data-tree-chrome]` planted in
a report stays green, proven directly. **Ninth instance, closed as a class:** the first draft of this very
rewrite refused itself — its explanatory comment named the attribute in backticked brackets, and `.sh`
is strict.

## Not in the filed spec
The step ruling mentions a D5 "hook guard"; the spec on the drive (2026-09-03 13:00) has no D5. Not
built; flagged.

## Merge
On the spec as the dispatch. No `-RULINGS-` filed for GEN-050 yet, so Rule 7 waits. HARD STOP.
