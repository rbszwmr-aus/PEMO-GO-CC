# GEN-010 (least-privilege role model) Step 2 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Three done-whens accepted. **Commit is gated on done-when 3 going green after the tests/ fix below.** Pin `fab3c54a`, nothing staged.

---

## Accepted

- **Done-when 1** — `pemo_app` `superuser=false`, owns 0 tables; `pemo_owner` owns all 42.
- **Done-when 2** — the five-line contrast is the whole PID: identical `UPDATE`/`DELETE` refused for the app, refused to re-grant itself, succeeds for the superuser. **GEN-009 inherits property 4.** This is the result the precursor existed to produce.
- **Done-when 4** — the grant check fires `MISSING` on a revoked `SELECT` and `EXCESS` on a stray `GRANT UPDATE`, quiet when complete, across 42 tables. The `EXCESS` direction is the one that matters and it works.

## Done-when 3 — the block is the finding, and the ruling is tests/ into scope, NOT a grant

`tenancy-negative.test.ts:213` deletes its probe grant through `accessDb` — `createModuleDb`, the app credential — the `DELETE` is refused, the probe survives, and the next `reseed()` hits the FK, cascading to 197 contract failures from one refused statement.

You diagnosed it correctly and refused the fix that would defeat the PID. Granting `pemo_app` `DELETE` on `scope_grant` would green the suite by making the very table that holds authorization mutable — append-only gone from the one place it matters most. That grant is forbidden, and your refusal to take the easy green is the single most important judgement in this report.

**Ruling: `tests/` comes into scope, narrowly, for the correct fix — fixture writes go through the harness's owner/`admin` handle (already `pemo_owner`), not the app credential.** This is not a concession; it is the least-privilege split doing exactly what it is for. A test that deletes a grant through the app credential was asserting owner work through the wrong seam, and the role separation just exposed it. Fixtures are owner work — the same ruling that made the seeds' 192 `DELETE`s owner work applies to test fixtures.

**Fix the class, not the instance.** The tenancy-negative `DELETE` is the one that happened to cascade to an FK; enumerate **every** fixture setup/teardown in `tests/` that runs through `createModuleDb`/the app credential and route all of them through the owner handle. Others may not have failed only because their ordering never hit a constraint — leaving them is leaving the same defect, unlit.

**Then re-run done-when 3 as `pemo_app`.** The commit is gated on the green run, not on the fix being plausible. If the re-run surfaces a genuine app-credential privilege the grep missed (a sequence `USAGE`, an advisory lock), that is a minimal grant folded into the rule — but distinguish it sharply from fixture-owner-work, which is never a grant.

## Principle this earns — a new one, and the least-privilege split is what made it real

> **Fixture setup and teardown are owner work. A test that performs them through the application credential cannot distinguish "the app is forbidden this" from "my fixture could not run."** Route fixtures through the owner handle; let the app credential exercise only application behaviour. Until the roles were separated the distinction was invisible — one credential did both — which is why the test could delete a grant it was meant to prove the app cannot.

Add it to `PID-PRINCIPLES.md` under the next governance carry, with principle 43's ordering amendment and the others owed.

## The two integration defects — both accepted

**seed-reproduces.sh left a database the app couldn't read** — dropping schemas drops grants — fixed by routing through `bootstrap.sh`. This is the one-entrypoint rule (`ensure-roles` then `migrate` then `seed`) earning itself the first time: after a drop, roles and grants must be re-ensured before the app can read, and the single entrypoint is what guarantees it. Approved.

**prove.sh:234 hard-codes `"010"` as the expected next number** — the battery's frozen-axis again, and allocating GEN-010 broke it. GEN-008 derived the mutation *victim* and left this *expected value* hard-coded — the same class, half-fixed. **Derive it, do not patch `011`** — patching just moves the bomb to the next allocation, which is the anti-pattern principle 11 names. In scope because this PID's own allocation is what lit it. Approved as you propose.

## The four caller files outside declared scope — accepted

The three `apps/api` CLIs and the test harness, one line each, to pass the owner credential to `createAdminDb`. The scope named `modules/platform`'s connection handling but not its callers, and an owner credential nothing passes is useless. Mechanical, unavoidable, flagged rather than assumed — which is the right way to cross a scope line. Accepted.

## Commit

After the tests/ class-fix and the green done-when 3 re-run: commit under the standard gate and close under rule 7 — archive with its row, `closed:` stamped, all Step reports and rulings carried in the same commit. Report `main` and tree, confirm the active register.

Then GEN-009 resumes — and it is lighter now: property 4 is inherited, the append-only floor is real, and it proves the audit record's principal + grant + effective instant on a table that is already immutable to the app by construction.
