# GEN-003 Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. HARD STOP upheld — GEN-003 does not proceed to a verification run until it is re-issued as v1.1. The tool cannot be run as configured, and that is a finding, not a blocker to route around.
**Pin verified:** `e9ed8ef1` / tree `17a62f7b` / 743 files, export proven by `git write-tree` matching the pin's tree.

---

## The headline: the question GEN-003 exists to answer is untouched

GEN-003 exists to prove two things — that the module boundary holds, and that no simulator reaches runtime. The diagnostic run scored 0 for `no-simulator-in-runtime`. **That 0 is an empty oracle, and the executor said so before I could.** It came from a tool that (a) could not resolve its own config, (b) carries a capturing rule that has never worked, and (c) was, in the documented invocation, a registry placeholder that never ran. A 0 from that tool is evidence about the tool, not about the boundary.

F4's `DROP SCHEMA` → 33-fail evidence stands unaddressed. Until a run reproduces that red and a simulator-in-runtime edge is shown to fire the rule, GEN-003 has not started answering its question. **Do not let the 0 travel as reassurance.** It is recorded here as an empty oracle so no later reader mistakes it for a pass.

## F1 — the documented command is a supply-chain hazard. Scrub it.

`npx depcruise …`, as written into GEN-003's "Known obstacle" section by DOC-002, fetched `depcruise@1.0.0` from the public registry — a dependency-confusion placeholder — and exited 0. A tool that never ran, reporting success, over an unrequested network fetch. Had the placeholder been silent, `npx depcruise … && echo ok` would have printed `ok`.

Rulings:
- **The `npx <bare-name>` form is banned for any tool that is a local devDependency.** Invoke the local binary by explicit path. This is not style; `npx` on a bare name is a network call to whoever holds that name on the registry.
- **Scrub the `npx depcruise` string from GEN-003 and from anywhere DOC-002 wrote it.** It is a live footgun sitting in an instruction, and an instruction is executed.
- The v1.1 (below) adds a check that greps the governance docs and the battery for a bare-name `npx` invocation, so this cannot re-enter through a copy. A hazard removed by hand returns by hand; a hazard removed by a check that fires does not.

## F2 — `no-module-to-module` has never worked, and that taints the record

The rule captures `^modules/([^/]+)/` in `from` and never back-references the group in `to`, so it forbids a module importing **its own** files. The diagnostic scored 32 violations, all 32 intra-module, 0 cross-module. It needs `pathNot: '^modules/$1/'`.

The consequence beyond the fix: **any prior claim that the module boundary was enforced by this rule is unproven.** The rule could never have run to completion, so a green from it, wherever one was cited, meant nothing. This is the inherited-green class. Flag for the record: if DOC-002's reuse audit or any earlier report leaned on this rule reporting clean, that leaning is void and the claim reopens. Name where it was cited when you find it; do not assume it was nowhere.

## F3 — the scope conflict is mine, and the artifact governs

My release said "GEN-003's guards join `prove.sh`." GEN-003's filed `write_scope` is `none — READ-ONLY`. Those contradict, the artifact wins, and you correctly wrote nothing. That is rule 5 and rule 3 both working: exclusive write scope is a boundary, and an instruction does not override the artifact it contradicts.

Resolution: **GEN-003 is re-issued as v1.1 with a real write scope.** One PID, not two — the config-resolution fix, the F2 rule fix, the F1 scrub-and-guard, and the battery integration are one coherent change to the same small set of files. v1.1's `write_scope` covers: the dependency-cruiser config, `docs/governance/bin/prove.sh`, the governance docs the F1 grep touches, and GEN-003's own front-matter. Report the exact config path at v1.1 Step 1; I will not guess it here.

## The config resolution — the shape, not the fix

You proved the defect is dependency-cruiser's, not the tsconfig's: from `apps/api`, `tsc -p apps/api/tsconfig.json` resolves the whole `extends` chain and exits 0; depcruise does not, and no single cwd satisfies both `tsConfig.fileName` (repo-root-relative) and the `extends` resolution (needs `apps/api`). Three cwds tested, all fail.

I am **not** ruling the fix in prose — I have not run it, and a fix asserted from here is exactly the state-I-have-not-established failure. v1.1 Step 1 proposes the resolution (a depcruise-side `tsConfig` whose `extends` resolves from the same root as `fileName`, or an equivalent) and proves it by a run that resolves the full chain. The done-when is not "depcruise exits 0" — it is the two reds below.

## Done-when for v1.1 — the invariant proven by making it fail

Not "the tool runs." The tool running is a precondition. The acceptance is:

1. **The boundary red fires.** Reproduce F4's `DROP SCHEMA` → 33-fail, or the module-boundary equivalent: introduce a genuine cross-module import and show `no-module-to-module` (fixed per F2) catches it. A green is trusted only after its red is shown.
2. **The simulator red fires.** Inject a simulator import into a runtime path and show `no-simulator-in-runtime` reports it. The 0 from Step 1 is void until this red has been seen once.
3. Both guards join `prove.sh` with their exact exit codes asserted, so "re-run the battery" is a done-when anyone can discharge — not a memory in this transcript.

Principle 11 applies to me here: I will not add a new principle for "a tool broken three ways reports 0." The control is F4's red requirement and the F1 grep — checks that fire — not another line in the rulebook.

---

## What this leaves on the register

GEN-003 is **not closed and not proceeding**; it is re-issued as v1.1 with the scope and done-when above. UI-004 continues on its own line. This ruling lives on the drive at `rewrite/reports/`; carrying it and the Step 1 report into the register happens under v1.1's write scope, since GEN-003 as filed cannot carry its own reports — itself the third instance of the class GEN-005 addressed.
