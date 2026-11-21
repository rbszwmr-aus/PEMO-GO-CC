# GEN-019 Step 2 — batch A: every governance reference resolves

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** all eleven reds behave, and the new principle arm **bit on its first run** — on two metasyntactic placeholders, one of them inside an immutable Rule-7 record. That is the cry-wolf risk arriving on schedule, and §4 is how it was closed without editing a record or weakening the check.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `ba7de991353311a396842cdc759ad0dbc6522354` (Step 1) |
| **`main`** | `5f8475d2a2cf522754e8f792a3d62a7613d5b150` — the allocation only. **Nothing since.** |
| **Green** | `adrs-present` **13 ADR / 6 amendment / 56 principle** · battery **22/22** · suite **343** · index OK · validator PASS |

## 2. `AM1`–`AM5` folded into `ADR-003`

Verbatim, under an **Amendments** section, per `ADR-007`'s folded precedent. **Each of the five verified byte-identical to the source** after the fold (502 / 1113 / 970 / 840 / 679 chars), so nothing was re-authored.

The source's own carry-in note asked for one verification — *"verify the letter in the repo copy; do not assert it here"* — and it verifies clean: `ADR-003` carried **no** amendment section and **no** `AM` letters, so `AM1`–`AM5` are genuinely next and the numbering is preserved.

**Status carried as authored, not reconciled.** The amendment is `Proposed` and `AM3` is explicitly provisional; the folded section says so and says *why* nothing here may promote it — `GEN-017` reconciled statuses only where an acceptance record existed, and there is none for this.

## 3. The checker, extended — one script, three arms

`adrs-present.sh` keeps one exclusion policy, one report format, one battery case. Arm 1 is unchanged.

**Arm 2 — amendments.** Two properties, each answering a risk named at Step 1:

- **Form-tolerant.** Letters are declared three ways in this repository already — `## A1 —` (`ADR-007`, folded), `### A1 —` (`ADR-010`, separate file), `**AM1 —**` (`ADR-003`, folded here). The resolver accepts a heading at any depth **or** a bold lead. **Existing headings were not normalised to suit the checker** — the checker accepts them as authored, which is the right direction of travel.
- **Namespace-scoped.** A letter resolves only against its own ADR's documents — the base file plus that ADR's own `-AMENDMENT-` files. `ADR-007 A4`, `ADR-010 A4` and `ADR-011 A4` are three different amendments and cannot satisfy one another.

**Arm 3 — principle citations, and the asymmetry is written into the script.** It does **not** exclude Rule-7 records, and the file states why, so nobody later "fixes" it into a bug: arm 1 excludes them because an ADR can legitimately be **withdrawn** and a closed report naming it would red forever; a principle id is **permanent and never reused** by `PID-PRINCIPLES`'s own scheme, so a dangling citation means the permanence rule was broken — the defect worth catching. The accepted cost is stated in the script too: remove a principle and every report citing it reds until reconciled.

## 4. The arm bit on its first run — on placeholders

Baseline failed immediately with two false positives:

- `` `[slug]` `` — in **my own script's** comment explaining the citation syntax;
- `` `[other]` `` — in `GEN-018`'s ruling, from the template *"distinguished from `[other]` by …"*, which is a **Rule-7 record and therefore immutable**.

The first was mine to fix, and I fixed it at the source: the comment no longer spells the citation form, exactly as `GEN-017`'s exemption text had to stop quoting the string its own checker matched on.

The second cannot be fixed at the source. So placeholders are **declared, not guessed** — a closed list in the script with the reason, in the same shape this repository already uses for sanctioned crossings: adding to it is a visible diff, never a flag set where it is used. One entry, `other`, with its provenance.

**This is what "does not exclude Rule-7" costs, arriving immediately**, and it is worth being plain about: the asymmetry is right, and it means the arm sees template text as well as citations. A one-entry declared exemption is the price; weakening the pattern or editing a record would both have been worse.

## 5. The eleven reds

| # | case | expected | result |
|---|---|---|---|
| 1 | `AM4` present, its `PID-PRINCIPLES` citation resolves | green | ✔ |
| 2 | reference `ADR-003 AM9` | **red** | ✔ names `PID-PRINCIPLES.md` |
| 3 | `ADR-007` `A2`–`A6`, folded | green | ✔ |
| 4 | `ADR-010` `A1`, separate file | green | ✔ |
| 5 | delete `ADR-007`'s `## A5` | **red** | ✔ names the contract that references it |
| 6 | reference `ADR-010 A6` (exists only as `ADR-007`'s) | **red** | ✔ namespace scoped |
| 7 | dangling principle citation from a live file | **red** | ✔ |
| 8 | valid principle citation | green | ✔ |
| 9 | delete a principle a report cites | **red** | ✔ names three citing files |
| 10 | legacy numbers in the map | green | ✔ numbers are prose, not slugs |
| 11 | Rule-7 exclusion, **both directions** | in reports green / outside red | ✔ same reference, two places, two answers |
| 11b | vacuity, **both scanning arms** | **red, loudly** | ✔ |

Restores verified by `cmp` after every probe.

**One probe was wrong before the check was.** My first attempt at red 2 used a `sed` pattern that never matched the file, so it reported green and I nearly recorded a check failure that was actually a probe failure. Re-run with the file state verified before and after — 1 occurrence replaced, then red. **A probe that does not change what it claims to change is indistinguishable from a check that does not fire**, which is the same family as trusting a patch script's success report.

**And red 11b was wrong the first time too**: my initial vacuity attempt did not narrow the scan at all — the fallback `sed` silently failed — so the arm returned its normal 8 ADRs and I would have recorded an untested guard as tested. Redone by replacing the exact anchor and verifying the change landed; both guards then failed loudly.

## 6. Weight

**Two files.** `docs/adr/ADR-003-…` (+62 lines, the folded amendments) and `docs/governance/bin/adrs-present.sh` (+~110 lines, two arms). No code, no schema, no contract, no test file — the checker *is* the test.

**Light, and the effort went where Step 1 predicted it would not**: not the fold, which was mechanical, but the placeholder collision and two bad probes. The eleven reds took longer to run correctly than the arms took to write.

## 7. Gaps — this list is complete

1. **The amendment arm has no vacuity guard**, unlike the other two. Amendment references are legitimately optional — a repository can correctly reference none — so a guard would red where nothing is wrong. **But it means that arm can pass by examining nothing**, and the reason it is safe today is only that six references exist. Stated rather than silently accepted; if you want the guard, it needs a different formulation than "the scan found nothing".
2. **`AM3` is provisional and is now in the repository.** Carried as authored, flagged in the fold.
3. **I have not read `AM1`–`AM5` in full for conflict with `ADR-003`'s body** — Step 1 flagged this and I verified only that the text is verbatim and the letters do not collide. A semantic conflict would be a finding, not a copy.
4. **The placeholder list is a hand-maintained set of one.** It is the frozen-axis shape, mitigated only by being closed, declared, and a visible diff to extend.
5. **The `A<n>` grep could over-match prose** — "Section A1" adjacent to an ADR id. It did not here (6 matches, all genuine), but the pattern is proximity-based and I checked the match list rather than proving the pattern cannot over-match.
6. **Nothing checks that a folded amendment's letters are contiguous** — `ADR-003` could gain an `AM7` with no `AM6` and the checker would not care.

## 8. Rulings sought

1. **§7.1** — the amendment arm's missing vacuity guard: leave it, or formulate one?
2. **§4** — the declared-placeholder mechanism: accepted as the right price for the Rule-7 asymmetry?
3. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**

---

# Addendum — the R4 note, added before merge

Ruled: state the amendment arm's deliberate absence of a vacuity guard in the script, and add no numeric guard.

The note records three things a later reader needs: that **zero amendment references is a legitimate state**, so an "at least one" guard would red where nothing is wrong; that non-vacuity therefore rests on the **dangling and namespace reds** — `ADR-010 A6` resolving green would mean the scan had silently stopped seeing references, and that red is what surfaces it; and consequently that **those reds are not redundant with each other and must not be deleted.**

Re-verified after the edit: `13 ADR / 6 amendment / 56 principle`, exit 0.

`[probe-must-bite]` is **not** added here — the ruling places it in batch B, alongside `[teardown-isolation]`, so this PID does not reopen the C+F basket.

---

# Addendum 2 — the blocker, unblocked

The close was refused by the battery when GEN-019's own Rule-7 artifacts were carried in; the blocker is reported in full at `GEN-019-step2-BLOCKER-close.md`. Ruled and resolved as three items.

**1. `[probe-must-bite]` defined in this PID**, moved out of batch B. Its citation and its definition now land in the same commit — which is the discipline the check enforces, applied to the check's own paperwork. It carries a **distinguishing note on both sides** against `[patch-verify-on-disk]`, as GEN-018 established for near-pairs: there, verifying an **edit landed on disk**; here, verifying a **probe changed the input a check reads**. Same root — an effect assumed rather than observed — at two different moments.

**2. `slug` and `no-such-principle` allowlisted**, with provenance. Both are strings that can never name a principle: one is the syntax metavariable, the other exists precisely to not exist. The script now also records **the line between allowlisting and defining** — a genuine reference whose definition is merely *late* is defined, not listed, which is exactly what happened to `[probe-must-bite]` — and **the growth trigger**: if the list would need another entry, do the citation-versus-mention syntax cure instead of growing it.

**3. `[expected-red-stops-being-read]` — confirmed, no action.** It resolves to one of the 48 originals, defined at `PID-PRINCIPLES.md:38`, and the checker never listed it among the unresolved. Checked rather than assumed, as instructed.

**Batches were not reordered.**

Final: **56 principles, 56 unique ids**; the check reports `13 ADR / 6 amendment / 59 principle` — 56 defined plus the 3 declared metavariables. Battery **22/22**, suite **343**, boundaries PASS, validator PASS, index OK.

**What the episode is worth keeping for:** the gate refused a close, and the close was the gate's own author's. That is the first time a guard in this programme has stopped the session that built it, and it stopped it for a true reason — the repository really did cite a principle that did not exist.
