# GEN-017 Step 2 — ADR consolidation, and the check that keeps it

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** all 13 referenced ADRs now resolve inside `docs/adr/`, and the check bites three ways. **The check's first version was wrong, and the red that failed to fire is what exposed it** — `ADR-012`'s *acceptance record* satisfied the presence test for `ADR-012` itself. A presence check an auxiliary file can answer is not a presence check.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `1db840268f03668da0ef6da5b0a5aa7be3186303` (Step 1) |
| **`main`** | `a945ab1f3384a2a06915e8064a9d12bc12b941f8` — the allocation only. **Nothing since.** |
| **Green** | battery **22/22** (was 21) · integration+contract **343** · boundaries `PASS` · validator PASS · index OK |

## 2. What is now in `docs/adr/`

| file | how |
|---|---|
| `ADR-011-party-and-interest.md` | copied verbatim |
| `ADR-012-user-groups-and-the-delegated-scope-tree.md` | copied verbatim, status reconciled |
| `ADR-010-AMENDMENT-open-questions-closed.md` | **its own file** — it amends three ADRs, so folding it into any one puts a decision where readers of the others will not look |
| `ADR-013-append-only-state.md` | **base body copied byte-identical, then the delta applied** — verified identical to the Drive base *before* the delta, so no wording drifted |
| `ADR-012-ACCEPTANCE-product-owner.md`, `ADR-013-ACCEPTANCE-product-owner.md` | carried so the reconciled status lines cite something that resolves |

**ADR-013 assembled per the delta, not retyped.** Status → `Accepted v1.1` citing its acceptance record; the five corollaries (`C1` lapse-vs-end, `C2` orthogonal guards, `C3` the D5 mechanism refinement, `C4` a constraint violation is never a 500, `C5` reason is act-metadata) appended before *Decision record*; `Target location` marked as carried in by this PID.

**The two acceptance records are a small scope judgement I am flagging** — they were in my Step 1 plan but not in the Step 2 DO list. I carried them because `ADR-013`'s new status line cites `ADR-013-ACCEPTANCE-product-owner`, and a canonical file whose status cites a document the repository does not hold is the defect this PID exists to remove.

## 3. `ADR-010` reconciled

- **Status** `Proposed v1.0` → **`Accepted v1.1`**, naming the amendment and `A1`/`A2`/`A3`, and noting `A4` closed `ADR-011`'s OQ1 in the same pass.
- **"Three questions remain open by design"** → **"All three open questions are now CLOSED"**, with the *Open questions* section **retained verbatim** as the record of what was open, and the instruction to *read it with the amendment, not instead of it*.
- **`D1`:33** — `(principal, scope node)` → **released on scope alone**, with a `GEN-017` reconciliation note stating the current key `(group_id, role, node_kind, node_id, tstzrange)` as `0115` implements it, and that **only the wording trailed**: the actor is a principal, the authority is a group-held grant, and they are two facts.

**Not touched, as instructed:** `0112`'s comment (immutable migration, accurate when written), `0116` (already explains the staleness), the Rule-7 reports. The one remaining occurrence of the old phrase in `ADR-010` is inside my reconciliation note, quoting what it used to say.

## 4. Status lines single-sourced

`ADR-010` → Accepted v1.1 · `ADR-012` → Accepted (PO 2026-08-28, citing its record) · `ADR-013` → Accepted v1.1 (PO 2026-08-29, citing its record) · `ADR-011` was already Accepted v1.1 and **already records that `A4` lifts `D10`** in its status line, so it needed nothing.

## 5. Out-of-repo copies bannered

The repository's existing banner text, verbatim, on `ADR-011`, `ADR-012` and the `ADR-010` amendment in `Prompt/specs/`; on `ADR-008-AMENDMENT` too, which was already folded into the repo as *Amendment A4* and was still reading as pending; and on `ADR-013`'s Drive copy in `rewrite/decisions/`, whose banner additionally says its `Proposed` status line is what it said when written **and is exactly why the repository copy exists**.

## 6. THE CHECK — and the defect the red exposed

`docs/governance/bin/adrs-present.sh`, wired as the battery's 22nd case. Needs no database.

**It derives, never lists.** It greps the tree for `ADR-NNN`, then asks the filesystem about each id it finds — so a new ADR is covered the moment anything mentions it. A maintained list of "ADRs we have" is the frozen-axis failure. Exclusions are stated as decisions: `docs/governance/reports|archive` are Rule-7 record (a closed report naming a withdrawn ADR must not turn this red forever), `docs/adr` itself (an ADR citing its neighbours is not a dangling reference). It fails loudly if the scan matches nothing, so it cannot pass vacuously.

### The first version was wrong, and the failing red is what found it

I resolved an id by globbing the **filename**: `ADR-NNN-*.md`. Deleting `ADR-012`'s decision document left the check **green** — because `ADR-012-ACCEPTANCE-product-owner.md` matched the glob and answered for it. `ADR-010-AMENDMENT-…` would have done the same for `ADR-010`.

**I had introduced that hole in this very PID** by carrying the acceptance records in, and the only reason it surfaced is that I ran the red I had proposed at Step 1 and it did not fire. A check whose red passes is not a passing check.

Fixed by testing the **document's own H1**, which distinguishes the three kinds mechanically:

```
# ADR-012 — ...            the decision      ← must exist
# ADR-012 core — ...       an acceptance record
# ADR-010 AMENDMENT — ...  an amendment
```

**Three reds, all firing, each naming the offending files:**

| red | result |
|---|---|
| a reference pointed at `ADR-099` | ✖ names `audited-write.ts` |
| `ADR-012` deleted, **only its acceptance record left** | ✖ names four module/app files |
| `ADR-010` deleted, **its amendment left** | ✖ names the contract, problem registry and two app files |

Restores verified by `cmp`.

## 7. Carried fix

`GEN-016`'s `closed:` date corrected `2026-08-29` → **`2026-08-30`**, the day it actually closed, and the archive index regenerated with it. Folded into this commit as instructed.

## 8. The stop condition did NOT fire

No ADR's repository text needs a **decision** changed to match the code. Checked, not assumed:

- **`ADR-012` `D4`** states the exclusion key as `(group, role, node_kind, node_id)`; `0115` implements `EXCLUDE USING gist (group_id, role, node_kind, node_id, tstzrange(...))`. Agree.
- **`ADR-011` `D7`** separates occupancy from interest — occupancy writes exist, interest writes do not.
- **`ADR-011` `D10`/`A4`** — lifted, and requires an Approver; no interest write is built, so nothing contradicts it.
- **`ADR-013` `D1`–`D6` and `C1`–`C5`** describe exactly what `GEN-015`/`GEN-016` built, including `C3`'s advisory lock with the check inside the act.

Everything done here was relocation, reconciliation or a status line.

## 9. Weight

**11 repository files — 4 modified, 7 new** (5 ADR/acceptance documents, the check, and the battery wiring), plus **5 Drive files bannered**. No code, no schema, no contract, no version bump; the suite is untouched at 343 and the battery gained one case.

Light, and the time went where Step 1 said it would not: **the check**. The file moves were mechanical because Step 1 had established that references are by name and no rewrite was needed. What cost the effort was discovering that my own check could be satisfied by a file I had just added.

## 10. Gaps — this list is complete

1. **`ADR-003`'s `AM4` amendment is still not in the repository**, and `PID-PRINCIPLES` cites it. It was in my Step 1 plan and not in the Step 2 DO list, so I did not fold it. **The check does not catch this**, because it works at ADR-id granularity and `ADR-003` itself is present — a sub-reference to an amendment is invisible to it.
2. **The check does not verify a status line is true.** Step 1 proposed asserting "no `Proposed` ADR has an acceptance record"; the DO list scoped the deliverable to presence, so I built presence. The stale-status class (2 of the 6 instances) remains uncaught mechanically.
3. **The check does not read `Prompt/specs/`**, so a *new* ADR authored there and never carried in is invisible until something in the repository references it. That is the trigger by design — an ADR nothing references is not yet load-bearing — but it is a delay, not a guarantee.
4. **`API-015-ST-implementation-plan-deferred-findings.md` still sits in `docs/adr/`** and is not an ADR. Out of scope, unasked, still true.
5. **I did not read `ADR-011` (35KB) or `ADR-012` in full.** I verified the decisions the code depends on (§8) and the status lines; a contradiction elsewhere in their text would not have been caught.
6. **The banners in `Prompt/specs/` and `rewrite/decisions/` are outside version control.** Nothing prevents them being lost or edited, and no check covers them.

## 11. Rulings sought

1. **§10.1** — fold `ADR-003`'s `AM4` in a follow-on, given a principle cites it?
2. **§10.2** — extend the check to the stale-status class, or leave it?
3. **§2** — the two acceptance records carried beyond the DO list: accepted?
4. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**
