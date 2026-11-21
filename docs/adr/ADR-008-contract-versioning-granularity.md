# ADR-008 — Contract versioning granularity

**Status:** `Accepted` — engineering decision taken under `API-015-ST`, 2026-08-13. **Nothing here is applied.** Implementation is a later PID, after `GEN-013-ST` merges.
**Amended:** `ADR-008-AMENDMENT-field-removal-is-breaking.md` (2026-09-01) — **removing a field, or narrowing its presence or nullability, is BREAKING and forces a major bump.** The table below is retained **verbatim** as the record of what it said; **read it with the amendment, not instead of it.** The amendment also fixes the general rule: *not listed in the table is never a licence* — when the table is silent on a change shape, the conservative reading applies. (Same convention as `ADR-010`, whose open questions are closed by a sibling amendment rather than by editing the original.)
**Date:** 2026-08-13
**Author:** CC `PEMO Contract` session, under `API-015-ST`
**Decision owner:** PEMO Master Brain
**Target location:** `docs/adr/ADR-008-contract-versioning-granularity.md`
**Committing session:** `PEMO Contract` — authored and committed under `API-015-ST`; `Target location` and this field backfilled by `API-016-ST`.
**Supersedes:** the implicit rule that any change to the contract package is a contract version change.
**Reconciles:** `ADR-005`, whose Option D is adopted here as a precondition rather than an efficiency measure.
**Related:** `ADR-009` (`Problem.type` registry), which is a surface change under the test below.

## Context

Two version bumps landed on 2026-08-13, each rewriting **49 declarations across 48 files**. The pin at `669d2ae8` still carries 49: `openapi.yaml` `info.version`, `openapi.yaml` `Meta.contractVersion.const`, `severity.json`, `forbidden-terms.json`, `index.json`, and 44 fixture envelopes. **Nine tenths of the cost is the fixture corpus, and it grows with every fixture added.**

The stated risk is not edit cost. It is that **ceremony disproportionate to the change gets bypassed, and a bypassed bump is exactly the undetectable drift versioning exists to prevent.** A mechanism too expensive for its smallest case is not followed carefully; it is worked around quietly.

### One correction to the premise, because it changes what the test has to do

The brief describes `0.2.1` as "a two-line fixture fix". Checking the commit rather than the description:

| Bump | Commit | What it actually contained |
|---|---|---|
| `0.2.0` | `08f6e94` | **Version declarations only** — 49 insertions, 49 deletions, every one a version string. The palette itself landed separately in `UI-010-ST`'s merge. |
| `0.2.1` | `c11f164` | Two fixture values, **plus 52 lines of `validate.mjs` adding six new assertions** — `freshness-age`, `freshness-status`, `coverage-consistency`, `acknowledgement-consistency`, `update-pending-consistency`, `revision-consistency`. |

Those six assertions **constrain what a conforming implementation may emit**. Under the test below, `0.2.1` was a genuine surface change and its bump was proportionate. Only `0.2.0` — a palette change, carrying no constraint on any implementation — was disproportionate.

That matters because a test that reclassified both would be too permissive. The premise is one bump too strong, and the correction is evidence the test discriminates rather than merely relabels.

---

## Decision 1 — The test for what constitutes a contract change

> **Does the change alter what a conforming implementation may emit, or must accept?**

Not a list. A question answerable about a change nobody anticipated, by reading the change.

- **Yes → surface change.** Minor version.
- **No → artifact change.** Patch version.

Worked against real cases, including the ones that are not obvious:

| Change | May emit / must accept altered? | Level |
|---|---|---|
| New path, or a new status on an existing operation | Yes — a server may now emit it, a client must accept it | minor |
| New enum value; new required field | Yes | minor |
| **New validator assertion** (`0.2.1`'s six) | **Yes** — it forbids emissions previously permitted | **minor** |
| **A `forbidden-terms.json` entry added or removed** (`0.2.2`) | **Yes** — it changes which field names may be emitted | **minor** |
| **A severity hex value** (`0.2.0`) | **No** — carried through the contract; no implementation's accept/emit set changes | **patch** |
| A corrected fixture value; a fixed typo in prose; a description edit | No | patch |
| Removing a path, status, or enum value; tightening a required field | Yes, incompatibly | **major** |

Two results worth drawing out, because a weaker test would have got them wrong in opposite directions:

- **The denylist is surface.** It reads like a lint configuration, but it is a constraint on emissions, so it versions like a schema. `0.2.2` was correct.
- **The palette is not.** It is the most visible thing in the package and changes nothing any implementation may emit or must accept. `0.2.0` was over-declared.

### The boundary case the test resolves cleanly

*A fixture is corrected because it was wrong.* `103000` → `103560` was never a valid response, so nothing a conforming implementation may emit changed — patch. But the assertion added **in the same commit** to prevent recurrence is a new constraint — minor. **The commit is minor because it contains a surface change, not because the fixture moved.** Level is taken over the whole change, at the highest level any part reaches.

---

## Decision 2 — One version. The surface and its artifacts do not version separately.

This is the crux, and the answer is the opposite of the one the cost pressure suggests.

Splitting — a `contractVersion` for the surface and something else for artifacts — is `ADR-005`'s Option B in a new costume, and it fails for the reason recorded there:

> A consumer that pins `contractVersion` and ignores the second field is back in exactly the rejected position — same version, different artifacts, no detection. It does not remove the need for a signal; it splits one into two, and a split signal is only as good as the discipline of the party reading it.

The governing constraint is absolute: **two artifacts claiming the same version must be identical, and two that differ must not both claim it.** A split satisfies that only if every consumer always quotes the pair, which is a discipline requirement rather than a mechanism. One number cannot be misread that way.

So: **every change to any byte of the contract package bumps the version. No exemptions, no exempt class.** The test in Decision 1 does not decide *whether* to bump — it decides *how far*.

That is the reconciliation the cost pressure was really asking for. The complaint was never "we bump too often"; it was "bumping costs too much". Decision 3 answers the cost, which removes the incentive to invent an exempt class, which is what would have destroyed the constraint.

---

## Decision 3 — Adopt `ADR-005` Option D. The version is authored once and derived everywhere else.

`ADR-005` recommends Option D — `meta.contractVersion` stamped into the fixtures from `openapi.yaml` — with Option C as fallback, and defers implementation to "when someone is working in this area anyway".

**`ADR-008` adopts Option D and promotes it from optimisation to precondition.** Decision 2 makes every change a bump; 49 hand-maintained declarations per bump is then not merely tedious but actively dangerous, because it is the pressure that produces a bypass. Cheap bumps are what make an unconditional bump rule survivable.

- `openapi.yaml` `info.version` is the **sole authored declaration**.
- `Meta.contractVersion.const`, `severity.json`, `forbidden-terms.json`, `index.json` and the 44 fixture envelopes are **stamped** from it.
- The stamp is a targeted substitution that asserts nothing but the version line changed — `ADR-005` §Option D, retained.
- `GEN-006-ST` already reads `info.version` at boot, so the backend's cost is already zero. Same principle, one layer up.

`ADR-005`'s status becomes: Option D **adopted here**; Option B remains rejected for the reason quoted in Decision 2; Option C remains the fallback if stamping is judged too much machinery, at the cost of fixtures no longer being literal response bodies.

**Deliberately not decided here:** whether the stamp runs as a pre-commit step, a script, or inside the validator. That is an implementation choice for the applying PID, and any of the three satisfies this ADR.

---

## Decision 4 — What makes a bypass detectable: bind the version to the content

The existing `contract-version` assertion checks that all 49 declarations **agree with each other**. It cannot detect a bypass: after a content change with no bump, all declarations still agree, and the check passes. **The property that is missing is not internal agreement — it is agreement between the version and what it names.**

**Add `packages/api-contracts/resident-mobile/contract-lock.json`:**

```json
{ "contractVersion": "0.3.0", "contentHash": "sha256:…" }
```

`contentHash` is computed over every file in the resident contract package, in sorted path order, **with every version string replaced by a fixed placeholder** so the hash does not depend on the version it is paired with. Without that substitution the hash changes whenever the version does and the check degenerates.

> **Amended by `API-016-ST`, 2026-08-14 — two omissions found while implementing this ADR.**
>
> **1. The lock file must be excluded from its own hash.** As originally written the definition was circular: the hash covers the package, the lock file lives in the package, and writing the hash into it changes the input. The hashed set is therefore the package **minus `contract-lock.json`**.
>
> **2. The hashed set must include the shared `problem-types.json`.** `ADR-009`'s registry sits at `packages/api-contracts/problem-types.json`, outside `resident-mobile/`, but under this ADR's own test it is resident surface — it constrains what a resident implementation may emit. Left out, the one file most central to `G6` could change without the lock noticing, which is the defect this mechanism exists to close.
>
> **The hashed set is:** `packages/api-contracts/resident-mobile/**` + `tests/fixtures/resident-mobile/**` + `packages/api-contracts/problem-types.json`, **minus `contract-lock.json`**.
>
> **Third amendment, `API-017-ST`, 2026-08-14 — hash the surface's PROJECTION of a shared file, not its bytes.**
>
> Adding a management-only entry to the shared registry failed the **resident** lock — `contract-lock-hash`, and nothing else. No `problem-type-enum-agreement` failure, because the resident enum is generated filtered by `surfaces` and was genuinely unchanged. **So this ADR's test said the resident surface did not change while this ADR's mechanism said it did.** Neither is wrong about its own subject; the mechanism is coarser than the decision it enforces.
>
> That coarseness is not a nuisance. **A mechanism coarser than its decision produces false positives, and false positives are how a check earns a reputation for crying wolf and is then bypassed** — which is the failure this ADR exists to prevent, arriving through this ADR.
>
> **Corrected:** where a file in the hashed set is shared across surfaces, the hash is taken over **that surface's projection of it** — for `problem-types.json`, the entries whose `surfaces` include this surface, canonically serialised. A change affecting only another surface no longer moves this surface's hash. Whole-file bytes are still used for files belonging to one surface.
>
> This is the same move as `D2` choosing separate packages over a conditional scan, and as splitting a detail endpoint so a boundary sits on an operation: **when a rule applies to a subset, apply the mechanism to the subset — never to the container with a condition attached.**
>
> Recorded as defects in this ADR rather than as implementation detail. The test for a complete specification is not whether its author can implement it, but whether an independent reader reaching only for the text arrives at the same artifact — and on the original wording they would have computed a different hash and concluded the lock was wrong.

Three assertions, and the third is the one that closes the loop:

| Assertion | Catches |
|---|---|
| `contract-lock-hash` — recomputed hash equals the recorded hash | **Content changed, nothing bumped.** The bypass. |
| `contract-version` — all declarations agree (existing) | A partial stamp |
| `contract-lock-version` — if `contentHash` differs from the merge-base's, `contractVersion` must differ too | **Content and hash both updated, version left alone** — the informed bypass |

The third needs git history. That is already precedented: `GEN-006-ST`'s scope test resolves `git merge-base HEAD origin/main` for exactly this kind of comparison, so the technique is in the repository and proven.

**And a property that costs nothing:** `contract-lock.json` is two lines. A change to it is the smallest possible diff a reviewer cannot miss, which is the same reasoning that put the wrapper jar's sha256 into `android/.gitignore` rather than only into a commit message — the expected value belongs where someone meets the change.

Each assertion must ship with its red condition demonstrated, per the standing rule that a green check is not evidence unless its failure has been observed.

---

## Consequences

- The next contract change is a **minor** bump under Decision 1: `ADR-009`'s registry, `G2`'s denylist terms and `G6` are all surface changes. Target `0.3.0`.
- One authored version declaration; 48 derived. A palette-only change becomes a patch bump costing one edit.
- A bypass is detectable rather than merely discouraged, which is what makes Decision 2's unconditional rule enforceable rather than aspirational.
- `severity.md`'s standing rule is unchanged: contract changes go back to the contract track as a new version. This ADR refines the *level*, never the ownership.

## Open questions, deliberately not closed

- **Does the management-web contract share this version line?** `ADR-007` owns the surface split. If management ships as a second OpenAPI document, it needs its own version and its own lock; if it ships as role-scoped responses in one document, it shares both. This ADR's mechanism works either way, and deciding it here would pre-empt `ADR-007`.
- **Pre-`1.0.0` semantics.** The project is on `0.x`, where a minor bump conventionally may break compatibility. That has been harmless so far because every consumer re-pins by commit hash. It stops being harmless the first time something consumes the contract without re-pinning, and that is the moment to decide whether `1.0.0` is declared.

---

## Amendment A4 — The lock and the stamp are two mechanisms, and one of them was doing two jobs

**Status:** Accepted. `v1.1` of the amendment, written 2026-08-15 by PEMO Master Brain on three measured data points; implemented by `API-026-ST`. Decision owner: Product Owner.
**Supersedes** the single-hash lock of Decision 4 for the purpose of *what moves the version*. Decision 4's binding-the-version-to-content principle stands; A4 splits the content it binds to.

### Why this was amended

`ADR-008` had been amended three times for its own mechanism and never for its purpose. Three measurements forced the question: a corpus addition rewrote 44 files; a pure-metadata field rewrote 63; and a pure-metadata change **across a scope boundary** rewrote 44 scenario files in another session's artifact, making them read as stale when nothing they transcribe had changed. The first two are inefficiency; the third **manufactures work in a scope that cannot see why.** A versioning mechanism that creates unobservable work has stopped describing the system and started disturbing it.

### D1 — The lock and the stamp are different mechanisms; neither may acquire the other's job

The lock does **integrity** (did a set of bytes change without authority). The stamp does **derived restatement** (do N places still agree with the one authored place). These are not variants of one idea, and **a mechanism may not be extended to a second concern because it happens to run over the same files. Proximity is not a reason.**

### D2 — The corpus and the surface are unchained

The one lock hashed the fixture corpus and the contract surface together and paired the result with the version, so any corpus byte moved the version. Their change rates differ by an order of magnitude — the exact coupling `ADR-006` `D3` paid to remove for vocabulary and severity policy. **A corpus-only change must not move the contract version.** *Corpus-only* is a property of **what a change determines**, not of which file it touched — read with D6.

### D3 — Churn a client cannot observe trains people to ignore version numbers

A version that moves for unobservable reasons teaches the same habit toward version numbers that a 5% flake teaches toward a test suite: re-run, or ignore, instead of look. The cost lands the day one of them matters.

### D4 — A derived restatement is written where it is read

`ADR-005` Option D's derivation is sound; its **target choice** is the defect. A fixture envelope carries a `contractVersion` no consumer branches on, and the scenario generator propagates it into a third artifact that reads it even less. A target that never reads the value is a **copy**, and every copy can go stale in someone else's tree. *(Scoped as a follow-on: `API-026-ST` unchains the version so corpus changes no longer bump — which stops the stamp firing on corpus edits — and leaves removing the fixture stamp itself to a dedicated change, so the machinery diff stays legible.)*

### D5 — The renderer substitutes into an authored frame; it never authors the frame

For derived display copy: `zh-Hant` word order and measure words do not follow from substituting a numeral, which is why `mixed-language` and `truncated-copy` exist. Assertions run over the **rendered** sentence, not the frame, at the widest plausible value, with the basis for "widest" stated.

### D6 — The partition is by what an artifact **determines**, not where it lives

`problem-types.json` and `severity.json` each carry both concerns, so a partition drawn by file is wrong for every commit that edits both. Both prior incidents were in `problem-types.json`. This is `D1` turned around: **proximity is not a reason to separate either** — one file carrying two concerns is classified per concern.

### D7 — Removing a backstop promotes what it was backing up to load-bearing

With the version paired to surface content only, the classifier that decides *surface or corpus* is no longer backstopped by the hash, so a misclassification becomes silent. **It carries its own mutation coverage.** Generally: **a redundant check is also a witness; removing it promotes whatever it was witnessing, and that is the moment that thing needs coverage of its own.**

### As implemented by API-026-ST — the derived shape

Derived from the artifacts, then ruled by the Product Owner:

- **Two hashes per surface, asymmetric roles.** `surfaceHash` (openapi.yaml + the registry's **surface projection**) is paired with the version — a moved `surfaceHash` is the objective form of Decision 1's test, now **sufficient** as well as necessary. `corpusHash` (fixtures, `forbidden-terms.json`, `severity.md`, `severity.json`, the registry's **corpus projection**) is integrity only and never moves the version.
- **`problem-types.json` is field-split.** Its `httpStatus` is surface content with **no other authoritative home** — openapi's `Problem.type` enum is URIs only — so wholly-corpus would let a real surface change never bump. Surface fields: `uri`, `status`, `httpStatus`, `emittedOnlyBy` (filtered per surface, so a shared type's cross-surface emitters do not move the wrong surface); corpus fields: `summary`, `clientGuidance`, `note`, `since`, `declaredSince`; `surfaces` is the applicability filter.
- **`severity.json` is wholly corpus.** Its only surface content — the level enum and the connectivity rule — is mirrored into openapi.yaml and guarded by `severity-enum-agreement`, which is therefore load-bearing and carries its own witness in the D7 battery. A dual-nature file is field-split **iff its surface content has no other authoritative home.**
- **The classifier is exhaustive.** A registry field in neither the surface nor the corpus set halts hashing rather than entering a hash silently — there is no safe default, because unknown→surface reintroduces churn and unknown→corpus ships a real change silently.
