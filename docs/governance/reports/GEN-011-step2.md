# GEN-011 — Step 2: the audited-write primitive and the extended boundary check

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** all three reds turn green — but the first mutation run showed my own tests **could not see the defect they exist to detect**. §4 is that, and it is the most important section here.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `db73c447e77980bd14987a7e86d628f604653177`, `origin/main` re-read from the remote and equal |
| **Working tree** | 4 modified, 3 new (below), plus **two untracked files that are GEN-009's** — `database/migrations/0116_access_audit_event.{up,down}.sql`. **They are not GEN-011's and must not enter this commit.** |
| **Verified green** | boundary check `PASS` (exit 0) · integration+contract **284/284** · governance battery **21/21** · `pid-index --check --require-git` OK, next allocation 012 |

Modified: `modules/platform/src/db/module-db.ts`, `modules/platform/src/index.ts`, `apps/api/src/cli/verify-boundaries.ts`, `.github/workflows/governance.yml`.
New: `modules/platform/src/audit/audited-write.ts`, `apps/api/src/cli/cross-schema-scan.ts`, `tests/integration/{audited-write,cross-schema-discriminator}.test.ts`.

## 2. The primitive

`auditedWrite(db, audit, act)` in `modules/platform/src/audit/audited-write.ts`. It opens the transaction, runs `act` on that transaction's handle, and inserts the audit by **qualified name on the same connection**. Both commit or neither, by construction rather than by guard.

Ruling 2 is in the type, not only the prose: the audit fields are a fixed `AuditRecord` matching 0116's columns. There is no table parameter and no payload, so the primitive **cannot express a second crossing** — a general facility would have been a hole the size of the isolation model.

Ruling 5: `ModuleDb` gained `readonly inTransaction: boolean` — `true` on transaction-scoped handles, `false` on pool-backed ones. Handed a transaction-scoped handle, the primitive throws `NestedAuditedWriteError`. It is on the interface rather than inferred because a refusal needs the caller's state to be *visible*.

**A failed audit fails the act.** D1 makes the record the condition of the write, so a write that cannot be recorded is one that must not happen.

## 3. The enforcement

The discriminator moved into `apps/api/src/cli/cross-schema-scan.ts` — its own file, because it is a **decision**, and decisions get tested. `verify-boundaries` now scans `apps/` as well as `modules/`: **135 app files across `apps/api`, `apps/management-web` and `apps/resident-portal`** that no check had ever read.

The rule: a qualified name counts only **inside a string carrying a SQL verb**, found by a hand-written tokeniser rather than regex replacement (which mis-handles `"it's"` and `'http://'`). All nine known-benign `apps/api` matches stay silent; a planted crossing is caught.

**DDL is in the verb list on purpose.** Restricting to DML would let `db.query("DROP TABLE access.foo")` pass unseen — and it would also mean the provocation corpus stayed silent by *luck* rather than by decision. With DDL included it trips, so it carries a **named exemption**. Two exemptions exist, both in one list in that file; adding a third is a visible diff, not a flag someone can set at the call site.

**CI now runs the check.** It did not before — `governance.yml` ran the index and the battery only, so the four-layer enforcement was a command a developer might remember. A sanctioned crossing whose "it is the only one" check never executes is worse than no crossing at all. **This step is beyond the literal deliverable; shed it if you disagree.**

## 4. THE FINDING: my tests passed a mutation that reproduced GEN-009's exact defect

I moved the audit insert back onto the pool handle — its own connection, its own transaction, precisely the defect GEN-009 found. **All six tests stayed green.**

The first run was worse still and taught its own lesson twice over: I discarded `tsc -b`'s exit status, so I could not tell whether the mutation had reached `dist` at all — the disarmed-test class again — and my restore trap used relative paths after a `cd`, so **the restore silently failed** and left the mutation in the tree. Both are already in this repository's corpus. I rebuilt the harness with absolute paths, a byte-identity pre-flight, and a checked build status; then the mutation genuinely was in `dist`, and the suite genuinely still passed.

**Why nothing saw it.** Every test injected its failure either *before* the audit was written or *as* the audit. None injected one **between the audit write and the act's commit** — which is the entire hazard window. With the audit on its own connection it commits immediately; only a failure after that point can tell the two designs apart.

**The fix.** A `DEFERRABLE INITIALLY DEFERRED` unique constraint on a test-local act table gives the one injection point the primitive's own API deliberately withholds: the row is accepted at statement time and the violation is raised **at COMMIT**. Re-run under the same mutation:

```
✖ a failure at COMMIT, after BOTH writes, rolls back the audit as well as the act
  AssertionError: THE FALSE AUDIT: an audit row survived a transaction whose act
  did not. This is the 0-act/1-audit state GEN-009 found.
    actual: 1, expected: 0
```

`actual: 1, expected: 0` — GEN-009's false audit, reproduced through the primitive and caught. Without §4 this PID would have shipped a green suite that proved nothing about its central claim.

## 5. Proof — each guard made to fire for its own reason

| mutation | expected | result |
|---|---|---|
| **A** audit moved to the pool handle (GEN-009's defect) | the commit-window test alone goes red | ✖ `actual: 1, expected: 0` — "THE FALSE AUDIT" |
| **B** nesting guard removed | the nesting test alone goes red | ✖ `Missing expected rejection (NestedAuditedWriteError)` |
| **C** exemption stops naming the primitive | 2 unit tests **and the command** go red | ✖ ×2, and `FAIL no-cross-schema-sql(modules/platform/src/audit/audited-write.ts → access) — access.audit_event` |
| **D** real crossing planted in `apps/api/src/composition/home-projection.ts` | the command names it | `FAIL no-cross-schema-sql(apps/api/src/composition/home-projection.ts) — home_safety.safety_event` |

**D is the sharpest.** The victim file *already contains* a benign `resident.residentId`. The check reports the planted crossing and **not** the benign match, in the same file, on the same run — the discriminator's decision proven where a false positive and a true positive sit side by side.

Restores verified by `cmp` against the snapshot, not assumed.

### The third cry-wolf, caught by firing rather than by foresight
Step 1 predicted this class and designed against it. It happened anyway: the **first run of the extended check failed on `cross-schema-scan.ts` itself**, because my exemption's *reason text* quoted the provocation string, which carries a SQL verb — the checker flagged its own documentation. Fixed **at the source** by not writing a qualified name in that prose. Exempting the file would have blinded the checker to its own module, which is how a guard stops guarding.

## 6. Gaps — this list is complete

1. **`access.audit_event` is not real yet.** 0116 is GEN-009's and is not on `main`, so the test creates a same-named table of the same shape and drops it. The DDL is duplicated in the test file and **could drift from 0116**. Carried per your ruling: GEN-009 re-confirms against the real table and deletes that DDL rather than maintaining it.
2. **`tests/**` is not scanned.** Test fixtures legitimately contain SQL-shaped strings — `provocations.ts` is the proof — so scanning them would need a third exemption class. Deliberate, and outside the ruled scope, but a crossing hidden in a test file is currently unseen.
3. **A pool handle reused inside the primitive's own callback still opens a second connection.** `inTransaction` catches a transaction-scoped handle, which is the silent-join hazard you ruled on; it does not catch a module that ignores `tx` and writes on its own pool handle instead. That work is simply outside the transaction, silently. I have no check for it.
4. **`.sql` files are not scanned** — the walk takes `.ts` only. Migrations legitimately cross schemas, so this is right, but it is an unstated assumption in the check rather than a decision recorded in it.
5. **CI still does not run the integration or contract suites** — 284 tests, including every proof in §5, run only locally. I added the boundary check to CI but did not widen further; that is a larger decision than this PID.
6. **The primitive has no caller.** Nothing writes an audit through it yet; GEN-009 is its first user, so its ergonomics are unproven against a real command.
7. **`randomUUID`-based `audit_id`** is generated in the primitive, so an idempotent retry writes a second audit row for the same act. Whether the audit should be idempotent is a question I did not raise at Step 1 and have not answered.
8. **My `.env` falsified a test once.** I set `PEMO_LOG_LEVEL=error` where the template says `info`; `B5 — the cause is available to an operator in the log` failed for that reason alone and passed once the level was corrected. No code was involved — recorded because a green suite obtained by changing the environment is the failure this note exists to prevent.

## 7. Rulings sought

1. **§3, the CI step** — beyond the literal deliverable. Keep or shed.
2. **§6.2, `tests/**` unscanned** — accept as disclosed, or a follow-on.
3. **§6.7, audit idempotency on retry** — GEN-009's problem or a defect in the primitive's shape.
4. **Commit** — nothing is committed; the two `0116` files stay out.

**HARD STOP before commit.**

---

# Addendum — the CI ruling, and the three defects it exposed

Everything above stands as written and as found. This section is what happened **after** the Step 2 ruling, and it changes two claims above: §6.1's "the test creates a same-named table because 0116 isn't on `main`" was **wrong about my own machine**, and the "284/284" figure is superseded by **285**.

## A. The CI wiring is small — but it was never the point

The postgres service was already there from GEN-008. Two lines: run the suite, and make `database bootstrap` pass `--with-seed`. **Not a fast-follow PID.**

Running it is what mattered. The suite had never met a freshly bootstrapped database, and the moment it did, **it failed 7/7** — not in an assertion but in setup. Three separate defects, none of which any local run could have shown.

## B. Defect 1 — the untracked `0116` was being applied all along

`prove.sh` reported **43 tables** on a fresh database where an earlier run had said 42. A discrepancy of one, investigated rather than reconciled: **the migration runner reads the migrations DIRECTORY, and whether git tracks a file is nothing to it.** GEN-009's untracked `0116` was being applied on every bootstrap.

So `access.audit_event` already existed, my test's `DROP TABLE IF EXISTS` + `CREATE` **replaced a migrated table with its own approximation**, and the teardown then dropped it — leaving the database one table short for everything that ran afterwards. That is where the 42 came from.

Fixed: **create only what is absent, drop only what was created here.** The tests now use the real table whenever one exists — which means **the drift you carried to GEN-009 is already closed: the primitive is proven against the real `access.audit_event`, not a probe.** They still pass on a clean checkout, where they build the stand-in.

## C. Defect 2 — the suite depended on a seeding step nobody declared

The 7/7 failure was `the seeded world no longer supplies the values under test`. `home_safety.safety_event` was empty: **`pnpm seed` applies the base seeds *and* the `__default` scenario overlays; `startHarness`'s `reseed()` applies the base seeds only.** My tests derived a real event, so they worked only on a database somebody had seeded out of band — every previous green included.

Fixed twice over: the tests now act on a table this file owns, in a module schema, needing nothing beyond the base seeds; and CI's bootstrap passes `--with-seed` explicitly rather than being seeded as a side effect of `prove.sh` running first — an ordering coupling nobody would know they depended on.

## D. Defect 3 — one leftover audit row breaks every later test run

With the real `0116` present, `audit_event.group_id` references `access.user_group`, and `reseed()` replaces those group rows. **A single audit row left behind makes every subsequent integration run fail in `reseed` with a foreign key violation.** Found as a whole file failing 8/8 in setup.

Fixed: the teardown deletes the rows this file wrote when the table is 0116's. **Recorded for GEN-009 as a property of the design, not a test bug**: an append-only audit that references mutable reference data pins that data against reseeding. Dev-only today; it will matter the first time a real audit row exists.

## E. Re-proven, because the tests changed substantially

| | |
|---|---|
| **Mutation A** — audit moved to the pool handle | ✖ one test: `actual: 1, expected: 0` — "THE FALSE AUDIT", now against the **real** 0116 table |
| **Mutation B** — nesting guard removed | ✖ one test: `Missing expected rejection (NestedAuditedWriteError)` |
| **Mutation C** — exemption stops naming the primitive | ✖ 2 tests, and the command: `FAIL … audited-write.ts → access` |
| **Mutation D** — crossing planted in `home-projection.ts` | command **exit 1**, names the crossing, ignores the benign `resident.residentId` in the same file |

Restores verified by `cmp`. Consecutive runs verified: the file runs twice in a row leaving **0 audit rows** and the table count unchanged.

## F. Full CI sequence rehearsed end to end

Fresh `postgres:17-alpine`, clean build, `0116` moved aside so the tree matches what CI checks out, every step in workflow order, the `.env` **extracted from the workflow file itself** rather than retyped:

```
toolchain               exit=0     index --check --require-git   exit=0
database bootstrap      exit=0     module boundaries             exit=0  PASS
every guard fires       exit=0     21 passed, 0 failed
integration+contract    exit=0     105 contract + 180 integration = 285, 0 failures
```

**What this does not prove:** GitHub's runner is node 22 where I ran 24, and I cannot execute Actions locally. The command sequence and the database contract are proven; the runner is not.

## G. Gaps — revised and complete

Superseded: §6.1 (drift — now closed, tests use the real table) and §6.5 (CI — now wired).

Still open, unchanged: §6.3 (a module ignoring `tx` and writing on its own pool handle is unseen), §6.4 (`.sql` unscanned), §6.6 (no caller yet), §6.7 (audit idempotency on retry). §6.2 `tests/**` is now a **named exemption** in `UNSCANNED_ROOTS` with its reason and its residual stated, printed by the command and asserted by a test, per your ruling.

New:
1. **Defect 3 is a design property, carried to GEN-009**, not fixed here.
2. **CI runs node 22, I proved on node 24.** First real CI run is the test of that.
3. **`0116` remains untracked and applied locally.** Anyone running migrations in this worktree gets a table that is not in `main` — invisible until it is committed by GEN-009.
