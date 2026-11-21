# GEN-053 step 1 — harness debt batch

**Date:** 2026-09-03  **Pin:** `5ac8963` (allocation), built on `7bd188c`.  **Note on the id:** the spec expected GEN-054; the register's scan gave **053** (UI-053 had not landed its allocation), and the sequence is global — this PID is GEN-053. Its worktree directory is named GEN-054; nothing else is.
**Battery:** 35 → 35 (no new battery check; D1 lives in the hook).  **Manifest:** 37 → **54 entries, 54 proven, 0 failed, 0 unreliable** **API suites:** contract 115/115, integration 470/470 — after a first full run reddened three of my own new tests because I was running bites that mutate the same source under the live suite; rerun undisturbed, green.

## D1 — a push is a finished tree
`.githooks/pre-push` refuses before any other check while `rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD` or `REVERT_HEAD` exists, naming which. **Bite (guard kind):** a throwaway clone with a conflicting rebase; the hook must refuse naming the state and, after `--abort`, must pass that gate — the probe reports both halves and the mutation (the state list emptied) fails the first. Principles registered: `a-push-is-a-finished-tree`, and `the-track-that-owns-the-file-writes-the-line` (GEN-052 had not).

## D2 — done by GEN-052; evidence, and skipped
`tests/integration/notice-permitted-actions.test.ts` lines 250–285: `CELLS` = 7 (state × gated/ungated) × 4 callers × 7 acts against real invocation; the `submitNotice`-on-an-ungated-draft hand rule reds the matrix (bite `permitted-actions-single-sourced` still proves) and the fixture-value pin stays. Nothing added.

## D3 — the CHECK-precheck class
Every CHECK in the notices and cases migrations, and where its precheck lives:

| constraint | reachable from input? | precheck |
|---|---|---|
| `notice_schedule_ordered` (0126) | yes | compose/revise/correct → `schedule-inverted` (GEN-052) |
| `notice_target` node-kind enum, kind↔id pairing, node-or-location (0127) | **yes — was a 500** | **compose/revise → `invalid-target` → `bad-request`** (this PID) |
| `ticket.channel` enum (0131) | **yes — was an exception** | **submitByStaff → `invalid-channel`** (this PID) |
| notice/ticket/case `version >= 1`, disposition and state enums, ack kind, approval-policy type (0126/0131/0132/0133/0134/0136) | no — set by the act | none needed |
| ticket reporter/node completeness (0131) | no — the act sets both halves | none needed |
| `closure_reason` only when closed, `reopen_reason` only when reopened (0131/0132) | no — the act chooses both | none needed |
| `case.complaint_class` requires `is_complaint`; `case_satisfaction.rating` 1–5 (0132) | **no act writes them yet** | none possible; noted for C3 |
| attachment `scan_status`, `size_bytes >= 0` (0128) | no — platform-internal | none needed |

**Finding for a ruling:** the contract's `ScopeRef` admits `portfolio`, `phase` and `location` as node kinds; `notice_target` admits neither portfolio nor phase. A notice addressed to a portfolio was a 500; it is now a refusal. Whether it should be *allowed* is a schema question, not decided here. Bites: drop either precheck → the test reds with the 500 / the thrown constraint. Class recorded as an instance under `a-check-fails-for-its-own-rules-reason`.

## D4 — two prose-bite classes, converted
| class | recorded at GEN-046 | converted | proven | left as CLAIM |
|---|---|---|---|---|
| DDL / grants | 7 (GEN-037 ×3, GEN-038 ×4) | **8** (+ the visibility filter, a source subject in the same table) | **8** | 0 |
| HTTP adapters | 6 (GEN-043) | **6** | **6** | 0 |

**Mechanism:** `with-ddl-mutation.sh` (drop or grant as the owner, run, restore in a trap) and `ddl-bite.sh` (one script, four plain arguments) under the runner's `guard` kind.

**What converting them found — three harness defects, each caught by a control rather than by luck:**
1. **A DDL bite's test leaves the duplicate the dropped constraint admitted; the restore then fails on it.** The runner counted three such bites *proven* while `notice_version_unique`, `ticket_version_unique` and `notice_ack_once_only_idx` stayed missing from the dev database, and every later red — e2e 500s, cases-origination — was downstream. Restore failures now print the database's own reason on stdout and the runner treats the line as FAIL.
2. **Why the teardown never ran:** the guard command piped `node --test` into `grep -q`, which exits at its first match and closes the pipe; node died of SIGPIPE before its `after()` hooks. The run is now captured before it is searched. (My own `pkill -f "node --test"` killed the shell that issued it — the same class, the same afternoon.)
3. **Two inlining failures before `ddl-bite.sh`:** JSON-escaped quotes became literal, then a double-quoted outer shell expanded `$(node …)` and *executed the TAP output as commands*. Four plain arguments to one script is what a manifest entry should be.

Also caught: the runner refused to start twice on a **mutant left in the tree** by a timeout-killed run (`covering-conjunction`, then `container-list`) — GEN-049's pre-flight doing its job; and two GEN-050 bites were anchored on `pids/GEN-050.md`, which Rule 7 moved at close — re-anchored to `archive/`, which D4 keeps strict.

## D5 — status only
Exact projection type: owed, untouched. Multi-node ticket case: owed, untouched.

## Merge
Merged on the spec as the dispatch; no `-RULINGS-` for GEN-053 yet, so Rule 7 waits. HARD STOP.
