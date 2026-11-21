# UI-058 — Hotfix report: main's boundary guard on live-exercise.ts

| | |
|---|---|
| PID | `UI-058` (hotfix). Allocation `28c3dfa`; fix `4274c42` |
| Pin | `origin/main` at `79275b1` (UI-054's close). Contract 2.2.0 |
| Trigger | `main` red at `9063278` and `79275b1`: apps/api `verify:boundaries` reported one boundary violation |
| Written | 2026-09-03 |

## 1. The violation, and why it is a workaround not a fix

The CI `register` job's step **"module boundaries hold, including the composition
layer"** (`pnpm --filter @pemo/api verify:boundaries`) reported:

```
FAIL  no-cross-schema-sql(apps/management-web/tool/live-exercise.ts) — notices.length
FAIL — 1 boundary violation(s).
```

The `no-cross-schema-sql` scanner (`apps/api/src/cli/cross-schema-scan.ts`) extracts
**string literals** from a source file and matches `\b"?<schema>"?\s*\.\s*"?<ident>`
against them, for every module schema the file does not own. `notices` is a module
schema — and also this contract's list field `StaffNoticeListResponse.notices`. The D4
report tool had one template literal:

```ts
say(`${who}: ${l.data.notices.length} notices visible, ${mine.length} from this run`);
```

The scanner reads the interpolation text `notices.length` as `notices.<table>` — a
cross-schema SQL reference. **There is no SQL in the file, and no SQL verb anywhere near
the match.** It is a false positive: the guard is right to be strict, and wrong here.

**The change is a workaround, said so on the line.** It binds `l.data.notices` to a
local `visible` so the text `notices.length` no longer sits inside a string literal — the
only thing the scanner reads. The code was already correct; renaming around a guard as a
habit is how a codebase loses the guard, so the line, this report, and the close-ruling
request all say plainly that this is temporary. It stays only until Main CC's
scanner-precision PID lands (gate the match on an actual SQL verb; do not scan
interpolated expression text). After that the binding may remain because it reads fine —
but the comment goes.

**Proven, not asserted.** Against the built scanner, `findCrossSchemaSql` returns
`["notices.length"]` on the committed file and `[]` after the binding. End to end, the
real CI command `pnpm --filter @pemo/api verify:boundaries` prints **`PASS — module
boundaries hold at all four layers`** (exit 0) on the fixed tree.

## 2. The G-finding for Main CC — the scanner's imprecision

The scanner matches a schema name inside **any** string literal, including
template-literal interpolation text, with no SQL-verb context. So `x.notices.length`,
`.resident.map`, `.property.filter` — any `<schema>.<ident>` printed in a template string
in any scanned file trips it. `notices` is an ordinary English word and a contract field
name; the collision is structural, not incidental. The precision fix is Main CC's (the
scanner is theirs): gate the match on a nearby SQL verb, or exclude the interpolated
expressions of a template literal (they are code, not string content). Dispatched in
parallel per the ruling.

## 3. The UI pre-push gate versus the CI register job — the list, not a summary

**This class was invisible to the UI track locally. The third time a local gate has seen
less than CI.** The lists, from `.githooks/pre-push`, `docs/governance/bin/prove.sh`, and
`.github/workflows/governance.yml`:

### The UI pre-push gate (`.githooks/pre-push`) runs, in order:
1. **in-progress-op refusal** — refuses the push while a rebase/merge/cherry-pick/revert
   is in progress in the worktree (GEN-050 D5).
2. **`node docs/governance/bin/pid-index.mjs --check --require-git`** — the register
   matches the directory.
3. **`docs/governance/bin/prove.sh`** — which itself runs:
   - the register-guard mutation battery (`clean register`, duplicate-NNN,
     missing-key, template-comment, unknown-key, index-drift, ignored-PID, orphan-report,
     closed-PID-no-ruling, the git-worktree skip cases);
   - `adrs-present.sh` (every ADR / amendment / principle citation resolves);
   - **module-boundary via dependency-cruiser** (`apps/api/node_modules/.bin/depcruise`:
     `no-module-to-module`, `no-simulator-in-runtime`) — **an import-graph check, NOT the
     SQL-text scanner**;
   - the database checks (grants-complete, live-grant / live-membership cardinality,
     provision-once, surface-enums) — **only when `database/dev/.env` is present; a LOUD
     SKIP otherwise**, which is the UI worktree's normal state;
   - the SQL/vocab family (`every LIKE accounts for its wildcards`, `fixture INSERTs
     idempotent`, `notice types agree`, `act vocabulary agrees`, `notice reason codes
     agree`, `case vocabularies agree`);
   - `contract-stamps-current` (generated files match their contract);
   - **`app-suites.sh`** — each app's `build` + **`test:node` only**; it collects
     `test:browser` into a NOT-RUN note and does **not** run it.

### The CI `register` job (`governance.yml`) runs, in order:
1. `pid-index.mjs --check --require-git` — same as the gate.
2. database env + **`database/bootstrap.sh --with-seed`** — a real seeded Postgres, always.
3. **`pnpm --filter @pemo/api verify:boundaries`** — the step that failed. The
   **`no-cross-schema-sql` scanner**, plus `no-cross-module-foreign-key` and
   `only-in-scope-schemas`. **Not in the pre-push gate** (the gate's boundary check is
   dependency-cruiser, a different tool answering a different question).
4. `prove.sh` — same battery as the gate, but with the DB present so the database and
   SQL/vocab checks actually run rather than LOUD-SKIP.
5. `premise-arm-guard.sh` — flips a cluster-global role; **CI-only, never in prove.sh**.
6. **`pnpm --filter @pemo/api test`** — the integration and contract suites (need the DB).
   **Not in the pre-push gate.**
7. **the app browser suites** — `pnpm -C apps/$a run test:browser` for management-web and
   resident-portal. **Not in the pre-push gate** (app-suites.sh names them NOT-RUN).
8. (separate job) `flutter-tests` — the resident-mobile Flutter suite.

### What CI runs that the UI pre-push gate does not
- **`verify:boundaries`** (`no-cross-schema-sql`, `no-cross-module-foreign-key`,
  `only-in-scope-schemas`) — **the class that caught this PID.**
- The integration and contract suites (`@pemo/api test`).
- The **browser suites** (`test:browser`) — including management-web's own 385, which the
  UI author runs by hand but the pre-push gate never does.
- `premise-arm-guard.sh`.
- The database and SQL/vocab checks whenever the UI worktree has no `database/dev/.env`
  (they LOUD-SKIP locally, run in CI).

**Not fixed here.** Per the ruling, the list is the deliverable; closing the gap is the
next governance PID's to act on. The honest one-liner: the UI track can be green through
its own pre-push gate and still red on CI's boundary scanner, its integration suite, and
its own browser suite — because the gate runs none of those.

## 4. Close

Allocation `28c3dfa`, fix `4274c42`. Merged tree-hash and the main run's conclusion are
reported with the close. Rule 7 close; the workaround is recorded so it is not mistaken
for a settled naming choice.
