# GEN-035 — ADR-018 hardening — MERGE report

**Merged.** `origin/main` `c1f69b67` → **`dcaec05db902b9c360bb00319059042fe1b3e743`**
**Merged tree-hash:** `5392740fc5db7f68ad14652316b231905c990b4b` — local and remote EQUAL,
the remote value re-read from `git ls-remote` after the push, not taken from the push output.
Refspec push from the worktree; `main` never checked out; **through the pre-push hook, no `--no-verify`**
(the hook printed `27 passed, 0 failed` / `gate passed` before the ref moved).
**Date** 2026-09-01 (read from `date`).

---

## THE CLOSE IS NOT DONE. The register refused it, and I did not override it.

I attempted the Rule 7 close and the generator refused with **exit 6**:

```
GEN-035 is 'merged' but no file matching reports/GEN-035-*-RULINGS-* (or
reports/GEN-035-RULINGS-*) exists — a PID does not close without a filed ruling
(global rule 2).
```

**There is no filed ruling artifact for `GEN-035`.** I enumerated
`/home/luipt/gdrive/PEMO/rewrite/governance/` and `/home/luipt/gdrive/PEMO/rewrite/reports/`
at the moment of this claim: `GEN-035-spec-adr018-hardening.md` and `GEN-035-step2.md` are
there, no `-RULINGS-` file is. Every prior close in this chain carried one
(`GEN-032-RULINGS-batch3bii-and-close.md`, `GEN-033-…`, `GEN-034-…`).

**I could have written that file myself in thirty seconds, and that is exactly why I did not.**
The artifact the check looks for is the record of YOUR authority to close; authoring it to satisfy
a gate on my own work would make the check certify nothing — the self-justifying-error loop, where
the document that authorises an act is produced by the act.

So I reverted the close half: `pids/GEN-035.md` is back in `pids/` at `status: draft`, with no
`closed:` stamp. The register is `OK` and reports the honest state:

```
WARNING: GEN-035 is 'draft' but 1 commit(s) tagged [GEN-035] have landed outside
docs/governance/ (dcaec05). It is either merged-and-awaiting-close, or
landed-and-legitimately-continuing — this check cannot tell those apart.
```

That warning is correct: **merged-and-awaiting-close.**

**TO CLOSE, I need from you:** a ruling filed as `GEN-035-*-RULINGS-*.md`. On receipt I will carry
it into `docs/governance/reports/` under that literal name, move the PID to `archive/` with
`status: merged` and `closed:` read from `date`, carry `GEN-035-step2.md` and this report, regenerate
the index, and push. One commit.

---

## ADR-018 — filed, and one thing the guard caught

`docs/adr/ADR-018-authority-owns-its-precondition.md`, your text, converted to the corpus's
conventions (uppercase `ADR-018-…` filename, backticked ids, the `**Status:** / **Carried in by:**`
header ADR-017 uses). The decision text is unchanged.

**The battery then refused it for a second, different reason**, which is worth recording:

```
FAIL  adrs-present: 1 cited principle(s) do not resolve
      `preserve-how-an-error-was-found` is not defined in PID-PRINCIPLES.md
      (quoted with backticks, not brackets: the guard reads bracket syntax as a live
       citation and would refuse this report for naming what it caught)
```

I had written a carry-in note citing `preserve-how-an-error-was-found` — **a name from my own
private memory index, not a principle of this corpus.** That is the same error as the invented
`[anchor-the-discriminator]` at `GEN-026`: a plausible-sounding bracketed id asserted from memory.
`GEN-034`'s `I5` was built for exactly this and caught it one PID later. I removed the citation and
wrote the sentence plainly rather than inventing a definition to make the guard pass. **27 passed,
0 failed** after.

### The `D3` discrepancy is now recorded in the ADR itself, not only in a report

Your `D3` names `findAuthorizingGrant`. Measured at the pin, it takes role-carrying
`ScopeGrant`s — not a flat node set — and is also called with `estateStaffGrants` for the
occupancy, contact and update routes, so narrowing it would be *wrong*, not merely unnecessary.
The hole was six `readonly string[]` parameters inside `@pemo/access`. I recorded this as a
**carry-in note under a rule off the decision text**, changing nothing you decided, so that a future
reader of `ADR-018` is not sent to a function that does not take the type. If you would rather it
were an amendment file or struck entirely, say so and I will refile.

---

## THE GATE, from a database rebuilt from nothing

Through `database/bootstrap.sh --with-seed` this time — the entrypoint that derives its target from
`database/dev/.env` and cannot address the wrong container.

| | |
|---|---|
| Tables before | **0**, verified against `information_schema` |
| bootstrap | ensure-roles, **41 migrations applied**, apply-grants, seed — ok |
| contract | **105 tests, 105 pass, 0 fail** |
| integration | **354 tests, 354 pass, 0 fail** |
| battery `prove.sh` | **27 passed, 0 failed** (and again inside the pre-push hook) |
| register `--check --require-git` | OK, next allocation **036** |
| `check:enums` | rc 0 |
| fixtures validator | rc 0 |

The `W3` floor battery (`delegation-floors.test.ts`) passed **unchanged and untouched** — it drives
the routes, so it never saw the parameter type and is an independent witness that `D4` holds.

Both bites, proven by mutation before the merge and reported in full in `GEN-035-step2.md`:
type-level reds with `TS2578` on exactly the line "accept the raw set" makes legal; filter-correctness
reds **1 of 354** under `const administrated = grants`, and only that one.

---

## STILL OPEN, and this list is complete

1. **The close** — needs your filed ruling. Above.
2. **`pemo_dev@55433`** — the database I wrongly dropped (Section 0 of `GEN-035-step2.md`), restored
   to its 2026-08-13 backup: the `access` and `integration` schemas are absent and rows written there
   since are unrecoverable. Leave it, or migrate it forward to 41? **Unanswered from my last report.**
3. **The `[destructive-target-confirmed]` sharpening** I proposed — *when the repository provides an
   entrypoint that derives the target from configuration, using anything else is the unconfirmed act.*
   **Unanswered.** Not blocking.
4. **The `ADR-018` carry-in note** — standing unless you rule otherwise.

Out of scope as dispatched: subtree/cross-node covering; R5b; notices/cases.

**HARD STOP for the close ruling.**
