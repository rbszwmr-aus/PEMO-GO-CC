# GEN-007 (DOC-002 F1) Step 2 — Rulings and close

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Accepted. GEN-007 closes on this ruling — commit released. Pin `d94cc4cc`, two files, nothing staged.

---

## Accepted

Both done-whens discharged by running, not argued. **Done-when 1** measured the cost rather than describing it — pre-fix `seed exit=1`, 0 `dev_scaffold` and 0 `safety_event` rows, GEN-006's 163/7 partial world reproduced deliberately; post-fix `exit=0`, 5 and 7 rows. **Done-when 2** — `migrate; seed; run` with no manual scenario application: 166/0, 105/0, differential 8519/0, the world reachable by the documented commands. Each of the six rows carries a one-line derivation comment, and the Group-3 row states its own constraint in the file. That is the seed reproducing from nothing, proven the only way it can be — by producing the world from the commands and reading what came out.

## The wider finding — accepted, owned, and larger than F1

You traced every candidate and the answer is that **nothing consumes the management manifest.** `tests/fixtures/management-web/index.json` declares the binding (`mob-s1-safety` / `partial` / `__partial.sql`); the seed CLI globs `*__default.sql` by filename and never reads the manifest; `applyScenario` is called in seven suites and never with a `management*` screen. So `__partial`, `__empty`, `__resolved` — all four management scenarios — are **latent, not dead**: a binding declared and nothing that executes it. A management scenario can be wrong in any way at all and nothing says so.

This is DOC-002 F2 one layer out, and you are right that it is not GEN-007's to resolve — your scope is the two files, and you fixed both (default via `seed`, partial by applying it directly and saying so, exactly so a fixed-but-unexercised file does not read as verified). **It becomes two owed items, recorded so neither is lost:**

1. **Wire the management manifest into a runner, or remove the dead bindings** — a decision, not a mechanical fix. Until the declared bindings are executed by something, every management scenario is unguarded. This is the class; F1 was one instance of it that also broke `seed`.
2. **The seed-reproduces-from-nothing guard belongs in the battery.** No test asserts `migrate; seed` completes and yields a complete world, which is why GEN-003, GEN-006 and now GEN-007 each learned it by being bitten. **Three PIDs is the signal principle 11 names: a class that recurs after being noticed is closed by building the check, not by noticing it a fourth time.** Fold this guard into battery-hardening.

## Close

GEN-007 commits: the two seed files, from `d94cc4cc`, under the standard gate — refspec push from your worktree, `main` never checked out, tree-hash equality, ancestry and clean push. Under rule 7 the PID file moves to `archive/` with its row and `closed:` is stamped in front-matter. Carry the Step 1 and Step 2 rulings and reports into the register in the same commit. Report `main` and tree.

The Group-3 placeholder stands with its shape locked; the wording remains flagged to the PO and is changeable without a migration.

## Owed list after this close

Schema-coupling runtime check · `verify-boundaries.ts` PASS-string · revalidation of the other three depcruise rules · **battery hardening** (now carrying: GEN-003's two post-close principles, GEN-006 §A's guard-atomicity principle, BOUNDARY_TARGETS derivation, **and the seed-reproduces-from-nothing guard**) · migration-replay test's home · **wire-or-remove the management scenario manifest bindings** (new). Each number allocated from the directory when issued; I sequence them.
