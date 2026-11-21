# GEN-019 — close BLOCKED at the gate. Not committed.

**Status:** the pre-close edit is made; the merge is **refused by the battery**. Nothing committed — `main` is still `5f8475d2`, the allocation.
**The check is telling the truth, so I have not overruled it.**

---

## 1. What happened

The R4 note was added and verified. Carrying GEN-019's own artifacts into `docs/governance/reports/` under Rule 7 then turned the battery red:

```
FAIL  adrs-present: 3 cited principle(s) do not resolve
        [no-such-principle] — GEN-019-step1.md
        [probe-must-bite]   — GEN-019-step2.md, GEN-019-RULINGS-step2-and-close.md
        [slug]              — GEN-019-step1/step2.md, GEN-019-RULINGS-step2-and-close.md
21 passed, 1 failed
```

**I stopped there.** The gate is the thing the last two PIDs existed to make real; landing my own close by stepping around it would be the exact failure this corpus keeps recording.

## 2. The finding — it is structural, not an accident of wording

**A PID's own Rule-7 artifacts can red the check that PID just built**, because reports *about* the principle system necessarily contain citation-shaped text. Three kinds, and they are not the same kind:

| slug | what it actually is | can it be fixed at source? |
|---|---|---|
| `[slug]` | a **syntax metavariable** in prose — "citations are written `` `[slug]` ``" | no: in my reports **and** in your ruling, both now immutable once carried |
| `[no-such-principle]` | a **deliberate example**, from my own Step-1 list of proposed reds | no: same |
| `[probe-must-bite]` | a **genuine forward reference** — a real principle your ruling schedules for **batch B** | not a placeholder at all |

The first two are the `[other]` class exactly, one PID later and three instances wider. **The third is different and more interesting: the check is correctly reporting that the repository now cites a principle that does not exist yet.** That is the arm working as designed, on a reference the ruling itself created.

## 3. Why I did not just extend the allowlist

Your R2 constrained it: closed, provenance per entry, **adding an entry requires a ruling**, and *"a real dangling citation must never be relabelled a placeholder to silence it."*

`[probe-must-bite]` **is** a real citation. Allowlisting it would be precisely the relabelling R2 forbids, and it would go on masking the id after batch B creates it. So the allowlist cannot absorb this, and I have not touched it.

## 4. Why leaving it red until batch B is not an option either

`[expected-red-stops-being-read]` — *"A guard may be red only while someone is actively fixing it; a knowingly-red guard left standing teaches people to skip the output, and it takes the guards beside it down with it."*

Merging GEN-019 with a red battery would leave the repository's newest guard knowingly red across at least one PID boundary. That is the one outcome worse than not merging.

## 5. What I propose — one ruling, two parts

**(a) Allowlist the two metavariables**, with provenance, as the `[other]` precedent: `slug` (the syntax metavariable) and `no-such-principle` (the example). Both are strings that can never be real ids — the second is self-describing, and I would happily rename it to something structurally impossible if you prefer a stronger guarantee.

**(b) Add `[probe-must-bite]` to `PID-PRINCIPLES.md` in THIS PID**, as a single line, rather than in batch B.

The reason is not convenience. Your ruling authored the citation and scheduled the definition one PID later; the check now — correctly — reports the gap between them. Closing that gap where it was opened is the smaller change, and it keeps the guard green rather than knowingly red across a PID boundary. The alternative that also works is landing batch B before GEN-019, which reorders two approved batches to avoid a one-line edit.

**I did not do (b) unilaterally** — the ruling placed it in batch B explicitly, and moving a scheduled item is yours to authorise, not mine to assume.

## 6. Also worth your ruling: the design consequence

The Rule-7 asymmetry is right, and this is its second cost in two PIDs. **Every future report that discusses the principle system will carry citation-shaped text**, and each one is either a placeholder (allowlist, ruling-gated) or a forward reference (must be defined before the report is carried).

That is livable but it is a standing tax, and there is a cheaper shape if you want it: **make a citation and a mention syntactically different** — a citation stays `` `[slug]` ``, a mention becomes something the scanner ignores. It would need one convention line in `PID-PRINCIPLES.md` and a narrowing of the arm's pattern, and it would retire the allowlist entirely. **Not proposed for this PID** — it is a design change and this PID is meant to close.

## 7. State

- **Nothing committed.** `main` = `5f8475d2` (the allocation). Working tree holds the R4 note, the fold, the extended checker and the carried artifacts, staged and uncommitted.
- Everything else is green: `--check` OK, suite 343, validator PASS, boundaries PASS. **The only red is the one described here.**

## 8. Ruling sought

1. Allowlist `slug` and `no-such-principle` as declared placeholders?
2. Add `[probe-must-bite]` in this PID, or land batch B first?
3. §6 — is the citation-versus-mention syntax split worth a later item?

**HARD STOP — the gate refused, and I am not stepping around it.**
