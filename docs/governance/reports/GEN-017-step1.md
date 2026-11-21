# GEN-017 — Step 1: the ADR inventory

**Status:** inventory only. **Nothing moved.** HARD STOP.
**Two headlines.** The **reference rewrite is essentially zero** — every ADR reference in the repository is by *name*, not by path, so adding the files makes them resolve; this PID is far smaller than "size the reference rewrite" implies. And **`docs/adr/README.md` already records this exact failure**, diagnosed in the same words, fixed with a mandatory header field — which then did not hold. That is the argument for the check, with a worked instance inside the directory being fixed.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `1db840268f03668da0ef6da5b0a5aa7be3186303`, re-read from the remote and equal to HEAD, tree `90fcb1de…`, 837 files |
| **Number** | **017**; next is 018. Push gated on `--check`. |
| **`main` now** | `a945ab1f3384a2a06915e8064a9d12bc12b941f8` — the allocation |

## 2. Deliverable 1 — every ADR and amendment, with path

### In the repository (`docs/adr/`) — ten ADRs

`ADR-001` … `ADR-010`, plus `README.md` and one non-ADR (`API-015-ST-implementation-plan-deferred-findings.md`).

### Out of the repository — eight artifacts

| artifact | path | status line |
|---|---|---|
| `ADR-011-party-and-interest.md` | `Prompt/specs/` | **Accepted** v1.1 |
| `ADR-012-user-groups-and-the-delegated-scope-tree.md` | `Prompt/specs/` | `Proposed` v1.1 — **stale**, see §6 |
| `ADR-010-AMENDMENT-open-questions-closed.md` | `Prompt/specs/` | **Accepted** v1.0, 2026-08-19 |
| `ADR-008-AMENDMENT-lock-and-stamp.md` | `Prompt/specs/` | `Proposed` v1.1 — **already folded into the repo's ADR-008 as "Amendment A4"** |
| `ADR-003-AMENDMENT-public-facility-nesting-and-location-identity.md` | `Prompt/specs/` | Proposed — **not folded**, and `PID-PRINCIPLES` cites its `AM4` |
| `adr-013-append-only-state-the-assertion-model.md` | `rewrite/decisions/` | `Proposed` — **stale**, see §6 |
| `adr-012-core-acceptance.md` | `rewrite/decisions/` | Accepted (PO, 2026-08-28) |
| `adr-013-core-acceptance.md` | `rewrite/decisions/` | Accepted (PO, 2026-08-29) |

### And five ADRs exist in BOTH places, all diverged

`ADR-002`, `ADR-003`, `ADR-006`, `ADR-007`, `ADR-010` are in `docs/adr/` **and** `Prompt/specs/`, and **no pair is byte-identical**. Four of them are already handled by an existing convention:

> **SUPERSEDED COPY — do not read this as current.** … The repository copy is authoritative. This file is retained as a historical artifact only.

That banner sits on the `specs` copies of `ADR-002`, `ADR-003`, `ADR-006` and `ADR-007`, and the repo copies are genuinely ahead — `ADR-006`'s repo copy carries an `API-017-ST` amendment the specs copy lacks. **So the project already chose "copy with a pointer", and it works.**

**`ADR-010` is the exception, and it is inverted.** The `specs` copy is `Accepted v1.1` (2026-08-19, all three open questions closed by the amendment); **the repository copy is `Proposed v1.0` and still says "Three questions remain open by design."** It carries no superseded banner because for this one ADR the out-of-tree copy is the newer. A reader of the repository is told three questions are open that were closed eleven days ago.

## 3. Deliverable 2 — what references each ADR, and the rewrite this implies

| ADR | files referencing it | resolves in repo? |
|---|---|---|
| 001 / 002 / 003 / 004 / 005 | 10 / 37 / 50 / 5 / 4 | ✓ |
| 006 / 007 / 008 / 009 / 010 | 39 / 42 / 18 / 14 / 48 | ✓ |
| **011** | **19** | ✗ |
| **012** | **21** | ✗ |
| **013** | **24** | ✗ |

**The rewrite is essentially zero, and that is the sizing answer.** Every reference is by **name** — `` `ADR-011` `` in prose, comments and SQL — not by path. There are only three path-shaped references in the whole repository: one relative markdown link in `packages/api-contracts/resident-mobile/severity.md` to `ADR-001` (which stays put and keeps resolving), the self-referential `**Target location:**` header inside each ADR, and prose in `docs/adr/README.md`. **Adding the missing files to `docs/adr/` makes all 64 name-references resolve with no edit.**

The 64 references sit in migrations (`0114`–`0117`), seeds, five module source files, five test files, the resident-portal divergence log, and the governance reports — i.e. **the committed code and schema rest on three decisions a reader of the repository cannot open.**

## 4. Deliverable 3 — the stale `D1` key language, precisely

`ADR-010` `D1` releases the 27 on `(principal, scope node)`. `ADR-012` substituted the group, and `0115` implements the grant key as:

```sql
EXCLUDE USING gist (group_id WITH =, role WITH =, node_kind WITH =, node_id WITH =,
                    tstzrange(effective_from, effective_to) WITH &&)
```

**Exactly one live place needs reconciling:**

- **`docs/adr/ADR-010-role-list.md:33`** — D1's own sentence. This is the one.

**Three places carry the phrase and must NOT be changed**, each for its own reason:

- **`database/migrations/0112_access_scope_grant.up.sql:3` and `:71`** — a migration comment describing the key *as it was at 0112*, before `0115` re-keyed it. **Migrations are immutable**, and the comment was accurate when written. Editing it would falsify the history the assertion model exists to preserve.
- **`database/migrations/0116_access_audit_event.up.sql:26`** — already *explains* the staleness correctly: *"D1's own '(principal, scope node)' key language predates ADR-012 and is stale."* Nothing to fix.
- **Six governance reports** — the historical record of the finding. Rule 7 artifacts are not edited.

**The substance is already settled and unchanged**: the actor is a principal, the authority is a group-held grant, and they are two facts. Only D1's *wording* trails the decision.

## 5. Deliverable 4 — what is missing entirely

`ADR-011`, `ADR-012`, `ADR-013`, the `ADR-010` amendment, the `ADR-003` amendment, and both acceptance records (`adr-012-core-acceptance`, `adr-013-core-acceptance`). Sizes are in §2; **I have `ADR-011`, `ADR-012` and the amendments in hand and can carry them verbatim. `ADR-013`'s canonical text is yours to supply**, as you said.

## 6. Findings

**A. The stale-status class is wider than the four instances.** Two more, both discovered here: **`ADR-012`'s status line says `Proposed`** while `adr-012-core-acceptance.md` records PO acceptance on 2026-08-28; **`ADR-013`'s says `Proposed — Awaiting Product Owner acceptance`** while `adr-013-core-acceptance.md` records acceptance on 2026-08-29. In both cases the ADR file and its acceptance record contradict each other, and the ADR file is the one a reader opens. **Six instances, not four.**

**B. This directory already diagnosed this failure, and the fix was documentary.** `docs/adr/README.md` says, in its own words:

> `ADR-002`, `ADR-003` and `ADR-006` were all `Accepted` while absent from this directory … **Three accumulated before anyone noticed**, and `docs/adr/` existing implies the ADRs are here.

The response was two mandatory header fields — `Target location` and `Committing session` — backfilled across all nine ADRs, with the explicit reasoning that *"a rule that ships with standing exceptions … reads as a suggestion."* **Every one of the missing artifacts carries a correct `Target location` pointing at `docs/adr/`.** The header field was necessary and not sufficient: it records where a document belongs and cannot notice that it never arrived. Three accumulated before; three accumulated again. **This is "a principle is not a control" with a worked instance inside the very directory this PID is repairing** — and it is why the check is the deliverable, not the file moves.

**C. `ADR-003`'s amendment is cited by a principle but absent from the repository.** `PID-PRINCIPLES.md` invokes *"`ADR-003` `AM4`'s Location-identity rule"*; `AM4` lives only in `Prompt/specs/` and is not folded into the repo's `ADR-003`.

**D. The stop condition does NOT fire.** No ADR's repository text needs a *decision* changed to match the code. `ADR-010`'s repo copy is behind on **status** (three questions closed by an amendment it does not carry) and on **wording** (`D1`'s key phrase), and both are reconciliation, not revision — `D1`–`D6` themselves are untouched and the code implements them. Stated explicitly because you asked me to stop if it were otherwise.

## 7. Deliverable 5 — the proposed plan

**Per ADR — follow the convention the repository already set.**

| artifact | proposal |
|---|---|
| `ADR-011`, `ADR-012` | **Copy into `docs/adr/` verbatim**; leave the `specs` file in place with the existing **SUPERSEDED COPY** banner, as `ADR-002/003/006/007` already have. Reconcile `ADR-012`'s status line to Accepted, citing its acceptance record. |
| `ADR-013` | Same, from the canonical text you supply. Status reconciled to Accepted (2026-08-29), citing `adr-013-core-acceptance`. |
| `ADR-010` | **Reconcile the repo copy** to `Accepted v1.1`, and reconcile `D1`:33's key wording per your ruling. The `Open questions` section is **retained verbatim** as the record of what was open — the `specs` v1.1 does exactly that and I would follow it. |
| `ADR-010` amendment | **A linked `-AMENDMENT` file in `docs/adr/`**, not folded — it amends *three* ADRs (010's Q1–3 and 011's Q1), so folding it into any one of them puts a decision in a place a reader of the others will not look. `ADR-010`'s status line links it. |
| `ADR-008` amendment | **Nothing to do** — already folded as "Amendment A4". Add the superseded banner to the `specs` copy so it stops reading as pending. |
| `ADR-003` amendment | **Fold into the repo's `ADR-003`** as an `AM4` section, matching the `ADR-008` precedent: it amends one ADR only. |
| acceptance records | Carry both into `docs/adr/` alongside their ADRs. They are the evidence a status line is true, and they are why two stale status lines were caught. |

**On fold-vs-link, the rule I propose:** *an amendment that touches one ADR is folded into it; an amendment that touches several gets its own file and is linked from each.* That is not invented — it is what the repository already does for `ADR-008`, and it is the only shape that avoids a decision living where one of its subjects will not find it.

**Where the check lives: the battery** (`docs/governance/bin/prove.sh` plus a script beside it), not a `verify-*` step. Reasons: this is a governance invariant, not a software one; the battery already runs in CI with `REQUIRE_*` making a skip fatal; and `verify-boundaries` needs a database while this check needs only the filesystem and would then be gated behind one for no reason.

**What the check asserts — derived, never a list**, because a maintained list is the frozen-axis failure the corpus names:

1. Extract every `ADR-NNN` referenced anywhere in the repository (excluding `docs/governance/reports/` and `archive/`, which are historical record).
2. Assert each resolves to a file in `docs/adr/`.
3. Assert every ADR in `docs/adr/` carries `Target location` and `Committing session` — the README's own rule, currently unenforced.
4. Assert no ADR in `docs/adr/` has a status of `Proposed` while an acceptance record for it exists — the stale-status class, made mechanical.

**Its red:** delete one ADR from `docs/adr/` and the check must name it and the files that reference it. Proven by firing, not by passing.

## 8. Gaps — this list is complete

1. **I have not read `ADR-011`/`ADR-012`/`ADR-013` in full for internal contradictions** with the repo's ten. I read `ADR-011` D7/D10 and `ADR-013` D1–D6 during earlier PIDs; the rest is unread, and a contradiction found at Step 2 would be a finding, not a copy.
2. **`API-015-ST-implementation-plan-deferred-findings.md` sits in `docs/adr/` and is not an ADR.** Whether it belongs there is out of scope and unasked.
3. **The check's exclusion of `docs/governance/reports/` is a judgement.** Those reports reference ADRs heavily and are historical; including them would make the check red on any report that ever named a since-removed ADR. I propose excluding them and state it as a choice.
4. **I have not measured the check's runtime.** It greps the tree; the battery is already the slowest gate.
5. **`Prompt/specs/` is outside the repository**, so Step 2 can add superseded banners there only if that path is writable to this session — it is on the G-drive, and I have written there. Whether the PID *should* write outside the repo is a scope question I have not assumed.

## 9. Rulings sought

1. **§7** — the plan: copy-with-banner, fold-vs-link by how many ADRs an amendment touches, check in the battery.
2. **§4** — `D1`'s reconciled wording. The substance is settled; the sentence is yours to write.
3. **§6.A** — reconcile `ADR-012`'s and `ADR-013`'s status lines as part of this PID?
4. **§6.C** — fold `ADR-003`'s `AM4` in, given a principle already cites it?
5. **§8.5** — may Step 2 write the superseded banners into `Prompt/specs/`, outside the repository?
6. **`ADR-013`'s canonical text**, as you offered.

**HARD STOP.**
