# ADR-005 — Decoupling palette versioning from contract versioning

**Status:** `Proposed` — **not implemented.** Recorded now so the reasoning survives; implement when someone is working in this area anyway.
**Recommends:** Option D (stamp the version into the fixtures from `openapi.yaml`), with Option C as fallback. **Option B — a separate `paletteVersion` — is recorded and not recommended;** see the Recommendation section for why the framing this ADR started from turned out to be the weaker one.
**Date:** 2026-08-13
**Author:** CC Architecture Session, under `API-005-ST`
**Decision owner:** PEMO Master Brain
**Target location:** `docs/adr/ADR-005-palette-version-decoupling.md`
**Committing session:** `PEMO Contract` — authored and committed under `API-005-ST`; `Target location` and this field backfilled by `API-016-ST`.
**Related:** `ADR-001` (severity tokens), `UI-010-ST` (palette re-derivation), `GEN-006-ST` (contract consumer).
**Affects:** `packages/api-contracts/resident-mobile/severity.json`, `severity.md`, `tests/fixtures/validate.mjs`.

## Context

The resident-mobile contract declares one version, `contractVersion`, and `tests/fixtures/validate.mjs` asserts that all **49 declarations** of it agree. That assertion is load-bearing and is mutation-proven: a partial bump fails the build rather than shipping.

The 49 are distributed very unevenly:

| Location | Declarations |
|---|---:|
| Fixture envelopes — `meta.contractVersion` | **44** |
| `openapi.yaml` — `info.version` | 1 |
| `openapi.yaml` — `Meta.contractVersion` `const` | 1 |
| `severity.json`, `forbidden-terms.json`, `index.json` | 3 |

**Nine tenths of the cost is the fixture corpus**, and it grows with every fixture added.

### The evidence that prompted this

Two version bumps in one day, neither touching the contract surface — no path, schema, status, enum value or field changed in either:

| Bump | Cause | Actual change | Declarations touched |
|---|---|---|---:|
| `0.1.1` → `0.2.0` | `UI-010-ST` re-derived the palette | 21 colour values | 49 |
| `0.2.0` → `0.2.1` | Two fixture values corrected | 2 values | 49 |

Both bumps were correct. The `0.2.0` bump in particular prevented a real failure: shipping 21 changed colour values under an unchanged version would have let two sessions pin the same version and receive different palettes with no way to detect it. That option was considered and rejected, and rightly.

The problem is not that the bumps were wrong. It is what they cost relative to what changed.

### One cost has already been removed

`GEN-006-ST` reads the version from the pinned contract at module load rather than hard-coding it:

```ts
/** For example `0.2.0`. Emitted in every `meta.contractVersion`. */
export const CONTRACT_VERSION: string = readContractVersion();
```

with the reasoning recorded in that file: *"hard-coding it makes every future version-only bump a code change, and a code change that is easy to forget is a silent divergence between what the API claims to speak and what it was built against."*

That is the same argument as this ADR, applied one layer down, and it means **the backend's share of a version bump is now zero.** It also demonstrates the general shape of the fix: derive the version rather than restate it.

## The problem, stated precisely

**The risk is not edit cost.** Bumping 49 declarations is a scripted change taking under a minute, and it is fully guarded — mutations 13 and 14 prove that both a partial package-level bump and a single stale fixture envelope fail the build.

**The risk is that ceremony this heavy eventually gets bypassed, and the bypass is silent.** A 49-declaration, 49-file diff for a colour change is exactly the kind of overhead that someone under time pressure works around — by changing the palette without the bump. Nothing then fails: the validator only checks that declarations *agree with each other*, not that they were *updated when the content changed*. Two sessions pin the same version and get different colours.

That is precisely the failure this versioning scheme exists to prevent. The mechanism would fail in the way it was built to stop, and it would fail quietly.

The underlying cause is that two things change on completely different clocks under one version:

- **Contract structure** — paths, schemas, statuses, the severity enum. Changes rarely, always with consumer impact.
- **Palette values** — the 21 colour tokens. Changes at every design review, with no consumer impact beyond rendering.

The Product Owner has ruled the design export is the visual authority, and design review is an ongoing process. **The palette will move again.**

## Options

### Option A — Status quo. One version, 49 declarations.

- **For:** one number to reason about; a consumer that reads `contractVersion` detects every change of any kind; already built, proven and mutation-guarded.
- **Against:** every palette change costs a 49-file diff; the ceremony invites the silent bypass described above; the cost grows with the fixture corpus.

### Option B — Add `paletteVersion` to `severity.json`. *(not recommended — see Recommendation)*

`contractVersion` keeps its current meaning and its 49-declaration assertion, governing structure: paths, schemas, statuses, the severity enum, labels and display rules.

`paletteVersion` lives in `severity.json` alone, governing the colour values, and is asserted only between `severity.json` and `severity.md`.

A palette-only change then touches **2 declarations instead of 49**.

- **For:** cost becomes proportional to what changed; the two clocks are separated honestly; `severity.md`'s existing rule — *contract changes go back to `API-005-ST` as a new version* — is refined in scope rather than weakened, since a palette change still goes through this PID.
- **Against, and this is the serious one:** **it only works if consumers actually read `paletteVersion`.** A consumer that pins `contractVersion` alone and ignores the new field is back in exactly the rejected position — same version, different palette, no detection. Option B does not remove the need for a version signal; it splits one signal into two, and a split signal is only as good as the discipline of the party reading it.

  Mitigations, all of which would be part of implementing it: state the obligation in `severity.md` as a consumer rule alongside the existing ones; have `UI-007-ST` read `paletteVersion` the way `GEN-006-ST` reads `info.version`; and add a `palette-version` assertion so the two files cannot drift from each other.

- **Also against:** two version numbers is more to explain than one, and a reader must know which governs what.

### Option C — Reduce the declaration surface instead of splitting the version.

Stop hard-coding `meta.contractVersion` in the 44 fixture envelopes; have the validator supply and check it from `openapi.yaml`. A bump would then cost 5 declarations, not 49, without introducing a second version.

- **For:** attacks 90% of the cost directly; keeps one version number and therefore one signal, so it cannot recreate the rejected position; applies the same derive-rather-than-restate principle `GEN-006-ST` already used.
- **Against:** fixtures become slightly less faithful as literal response bodies, which is their main purpose — `UI-007-ST` feeds them in directly, and a real response *does* carry `meta.contractVersion`. Templating it means the fixture on disk is no longer byte-identical to what a server would send.

**Option C is not mutually exclusive with Option B**, and it may be the better first move: it removes most of the friction without touching version semantics at all. It is recorded here as a genuine alternative rather than a strawman, because if only one of these is ever done, C is the safer one.

### Option D — Keep the version in the fixtures, but stamp it from `openapi.yaml`.

Fixtures keep `meta.contractVersion` exactly as they carry it today. A build step derives the value from `openapi.yaml` and stamps all 44 envelopes, so the declarations stop being hand-maintained. One version number, and fixtures remain literal response bodies.

This is the shape neither Option B nor Option C reaches: B preserves fidelity but splits the signal, C keeps one signal but sacrifices fidelity. D keeps both and moves the cost into tooling.

- **For:** fixtures stay byte-faithful to what a server would send, which is their purpose; **one** version number, so like C and unlike B it cannot recreate the rejected position; the 44 hand-edits disappear; it applies the same derive-rather-than-restate principle `GEN-006-ST` already used for `CONTRACT_VERSION`.

- **Against — the objection that matters:** **a generated file in a fixture corpus is a file people stop reading.** The corpus is hand-authored content — bilingual resident copy, realistic estate context, deliberate state coverage — and its value depends on people reading and editing it. Introducing a machine-written field sets a precedent that these files are output rather than source, and the next generated field is easier to add than this one was.

Three points of scrutiny, each tested rather than assumed:

1. **Does it remove the ceremony, or just the typing?** It removes the typing. A 44-file diff still lands in review. But the residual weight is low in a way hand-editing's is not: every changed line is identical in form, and the `contract-version` assertion guarantees consistency, so a reviewer verifies the shape rather than 44 values. The bypass risk comes from the effort of *making* the change, and D removes almost all of it.

2. **Can the stamp be silently forgotten?** No — and this is the property that makes D safe. Bumping `openapi.yaml` without stamping leaves the envelopes stale, and the existing assertion fails loudly:

   ```text
   [contract-version] mob-02-home/default.json
       meta.contractVersion is 0.2.0, OpenAPI declares 0.2.1
   ```

   That is mutation 14, already in the suite. Unlike the palette-bump bypass this ADR exists to prevent, D's failure mode is already guarded.

3. **Would stamping clobber hand-authored formatting?** This was the objection I expected to sink it — a JSON round-trip normalising key order and whitespace across 44 files of carefully authored bilingual copy. **Tested: a round-trip is byte-identical**, because the corpus is canonical two-space JSON with a trailing newline throughout. So a naive `JSON.parse`/`stringify` stamp is safe *today*. It is safe only while the corpus stays canonical, so the implementation should still do a targeted substitution and assert that nothing but the version line changed — cheap insurance against a future hand-edit in a different style.

**Verdict: D survives scrutiny.** The one objection that stands is the cultural one — generated content in a source corpus — and it is a real cost rather than a fatal one.

### Option E — Keep one version, add a bump script.

- **For:** trivial; removes the manual labour immediately.
- **Against:** it edits 49 declarations that each remain an independent source of truth, so the version is still restated in 49 places and can still be edited by hand into disagreement. Option D differs in kind rather than degree: it makes `openapi.yaml` the only place the version is authored and everything else derived. A script automates restating; a stamp removes the restatement.

## Recommendation

**Option D, with Option C as the fallback. Option B is not recommended.**

This reverses the direction this ADR was originally framed in, and the reason is an objection to B that came out of writing it down:

> **`paletteVersion` only works if consumers actually read it.** A consumer that pins `contractVersion` and ignores the new field is back in exactly the position that was rejected — same version, different palette, no detection. B does not remove the need for a version signal; it splits one signal into two, and a split signal is only as good as the discipline of the party reading it.

That is decisive. The whole purpose of the versioning scheme is that divergence cannot go undetected, and B makes detection conditional on every future consumer doing the right thing with a second field. C and D both keep **one** version number and therefore cannot fail that way at all.

Between C and D: both remove the hand-maintenance, and the choice is which cost to accept.

- **C** sacrifices fixture fidelity. A fixture that does not carry `meta.contractVersion` is no longer a literal response body — which is its entire purpose, since `UI-007-ST` feeds these straight into a client and a real response does carry that field.
- **D** sacrifices a little of the corpus's hand-authored character, and leaves a 44-file diff that is mechanical rather than manual.

**D is preferred because fixture fidelity is load-bearing and the corpus's authorship is not.** The fixtures exist to be a truthful stand-in for a server that does not exist yet; every departure from what a real response looks like is a way for a client to be built against something subtly wrong. The "generated file people stop reading" objection is real, but it applies to one machine-written line in a file whose other several hundred lines stay hand-authored — and it can be blunted by a comment in `index.json` recording which field is stamped and why.

If the cultural objection to generated content is judged decisive, **C is the correct fallback** and is strictly better than B on the criterion that matters.

### Not now, either way

Nothing is blocked. The current scheme is correct, guarded, and has executed two bumps cleanly. Implement when someone is already working in the validator and the fixture corpus — most naturally alongside the next palette change — and never folded into a defect fix.

## Consequences if Option D is accepted

- A stamp step derives `meta.contractVersion` from `openapi.yaml` and writes it into all 44 fixture envelopes, wired into `package.json` alongside `validate:fixtures`.
- The stamp performs a targeted substitution and asserts that no byte outside the version line changed.
- `validate.mjs` is unchanged. The existing `contract-version` assertion already catches an unstamped envelope — mutation 14 — so the guard is in place before the tooling is.
- `index.json` records which field is stamped and why, so the corpus documents its own one generated field.
- One version number, one signal. `contractVersion` keeps its present meaning and its 49 declarations; `paletteVersion` is not introduced.
- Palette changes still go through `API-005-ST`. The ownership rule does not move.

## Consequences if this is declined

- Every palette change continues to cost 49 hand-maintained declarations.
- The bypass risk stays, and should then be managed by review discipline rather than by design — which means whoever reviews a palette change must confirm the bump happened, because the validator cannot.

Recording it as declined is still worth doing, so the next person to ask finds a decision rather than an absence.
