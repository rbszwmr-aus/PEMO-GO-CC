# Implementation plan — `G2`, `G6`, `G7`, `truncated-copy`

**Written under:** `API-015-ST`, 2026-08-13. **No code. Nothing applied.**
**Applies:** `ADR-008` (versioning granularity), `ADR-009` (`Problem.type` registry).
**Runs after:** `GEN-013-ST` merges. `packages/api-contracts/**` is read-only until then, because that session is live against it.
**Pin this plan was written against:** `main` `669d2ae8`, tree `3763efa1`, 429 files.

All four land in **one contract change**, which under `ADR-008` is a **single minor bump to `0.3.0`** — three of the four are surface changes and the level is taken at the highest any part reaches. Bundling them is not convenience: under `ADR-008` Decision 3 the version is authored once, so a second bump would cost one edit and gain nothing, while a second *review* of the same package costs a reviewer twice.

---

## `G2` — the denylist misses `sourceDeviceRef`

**The finding.** Testing the red condition of `GEN-012-ST`'s mapping-containment test showed `forbidden-terms.json` does not catch `sourceDeviceRef` — the actual column name — because the denylist **enumerates** identifier names and that one was never listed. `GEN-012-ST` drew the right conclusion: the **string-containment assertion is the guarantee**, catching a leaked identifier under any field name whatsoever; the denylist is **diagnostics**, making a leak legible and naming it in a report.

**What changes**

| File | Change |
|---|---|
| `packages/api-contracts/resident-mobile/forbidden-terms.json` | Add `sourcedeviceref` and the sibling column names. Fold in the **two outstanding local carries**: `GEN-012-ST`'s ten terms and the car-park terms carried before it. Add a `role` field stating that `forbiddenPropertyNames` is diagnostics and the containment assertion is the guarantee. |
| `tests/fixtures/validate.mjs` | Add the **property-based containment assertion** as a first-class check: no resident-facing payload may contain any known internal identifier value, under any field name. |

**What proves it.** Two mutations, both red-condition-first: a field named `sourceDeviceRef` must fail; and an internal identifier *value* placed under an innocuous field name — `note`, `label` — must fail the containment check while passing the name check. **The second is the one that matters**, because it demonstrates the guarantee holds where the enumeration cannot.

**Version:** the denylist constrains what may be emitted → **surface → minor**.

**Note on ordering.** Folding the local carries is what stops two divergences becoming permanent. The register already calls them "the beginning of drift", and each fold must delete the local copy rather than leave it — a stale local list that disagrees with the pinned file is worse than no local list, for the same reason `ADR-009` deletes `GEN-013-ST`'s local assertion.

---

## `G6` — the `Problem.type` registry

**Decided in `ADR-009`.** The plan is that ADR's Consequences section; restated here only for sequencing.

| File | Change |
|---|---|
| `packages/api-contracts/resident-mobile/problem-types.json` | New. Nine existing URIs plus `GEN-013-ST`'s second `401`, each with `status`, `httpStatus`, `surfaces`, `since`, summary and client guidance. |
| `packages/api-contracts/resident-mobile/openapi.yaml` | `Problem.type` gains an enum **generated** from the registry. |
| `tests/fixtures/validate.mjs` | Forward, reverse and surface-containment assertions. |
| `GEN-013-ST`'s local assertion | **Deleted** by this PID, not before. |

**What proves it.** Typo a URI in a fixture → forward fails. Add an active registry entry used nowhere → reverse fails. Put a management-only type in a resident fixture → containment fails.

**Version:** **surface → minor.**

**Sequencing constraint.** This cannot land before `GEN-013-ST` merges, because the registry must contain the type that session is adding. Landing first would either omit it — forcing a second change immediately — or declare it before it exists, failing `ADR-009`'s own reverse assertion.

---

## `G7` — fixtures record responses, not the conditions that produce them

**The finding.** The five `session-expired` fixtures were provoked by sending **no token**. A fixture claiming to describe session expiry was satisfied by the wrong cause, and it surfaced only because `B5` forced the question. **Nothing in the corpus would reveal a second instance.**

### How a provocation is recorded

In `index.json`, beside the existing `operationId` and `httpStatus`, as **structured data a test can execute** rather than prose a reader must trust:

```json
{
  "file": "mob-11-account/session-expired.json",
  "operationId": "getAccount",
  "httpStatus": 401,
  "provocation": {
    "claim": "causal",
    "auth": "expired-token",
    "seed": "resident-with-two-units",
    "request": { "unitId": "unit_wfg_a_12_a1" }
  }
}
```

For a fixture that makes no causal claim, the field is present and says so:

```json
"provocation": { "claim": "shape-only", "why": "Describes the payload shape of a populated Home. No condition is asserted." }
```

**Recording the absence deliberately is the point.** Without it, "no provocation needed" and "nobody wrote one" are indistinguishable — the same reasoning that put `clientOnly` declarations with reasons into `index.json` rather than letting those states be silently missing.

### How it is checked, and by whom — this splits across two owners

- **The fixture validator** (`API-*` scope) asserts every fixture declares a `provocation`, that `claim` is one of the two values, and that a `causal` claim names an `auth` mode and a `seed` from a declared set. It **cannot** verify the provocation actually produces the bytes — it has no server.
- **`GEN-006-ST`'s contract suite** (`GEN-*` scope) executes it: apply `seed`, authenticate per `auth`, issue `request`, and assert the response is **byte-identical** to the fixture. That is the assertion that converts the caption into a claim.

**This is a cross-scope change and must be scheduled as two coordinated PIDs, not one.** The contract PID adds the field and the well-formedness checks; the backend PID adds the execution. Neither alone closes `G7`: the field without execution is a caption with better formatting.

### Honest estimate for all 69

Counted from `index.json` at the pin, not estimated:

| Class | Count | Cost |
|---|---:|---|
| **Makes a causal claim** | **43** | — |
| — of which `Problem` responses | 25 | **Cheap.** Provocation is an auth mode or a malformed request against existing seed state. |
| — of which `200` responses naming a condition | 18 | **Expensive.** `sensor-offline`, `stale`, `no-installed-sensors`, `late-event`, `all-clear` each need a **distinct seeded database state** in `GEN-006-ST`'s harness. |
| **Describes shape only** | **26** | One line each — `claim: "shape-only"` with a reason. |

The 18 are the real work, and they are not the contract track's: each is a seed variant in the backend harness. Their cost is roughly one seed fixture plus one harness state per fixture, and several will share states.

### Recommendation — do the 43, not the 69

**Do it where a fixture makes a causal claim; mark the rest explicitly.** A fixture named `session-expired` asserts a cause and is therefore falsifiable; one named `default` asserts a shape and has nothing to be wrong about. Extending execution to all 69 would add 26 seeded states to prove that a populated Home looks like a populated Home.

**And stage it:** the 25 `Problem` fixtures first. They are cheap, they include the five that produced the finding, and they cover the class where a wrong cause is most likely — because error responses are the ones provoked by manipulating conditions rather than by reading data. The 18 seeded `200`s follow when the backend track is next in that harness, per the register's own defer-until-someone-is-there rule.

**Version:** `index.json` metadata alters nothing any implementation may emit or must accept → **artifact → patch**. It will nonetheless ride the `0.3.0` minor bump, since level is taken over the whole change.

**One dependency worth stating.** The five `session-expired` fixtures cannot get an honest provocation until `B1`'s configurable TTL exists — minting a genuinely expired token is what makes the honest provocation possible. `B1` and `B5` are already required to land together for that reason; `G7`'s first five entries land with them or immediately after.

---

## `truncated-copy` — the title gap

**The finding.** The assertion covers **prose fields only** — `detail`, `instruction`, `summary`, `body`, `note`, `residentMessage`, `lockReason`. Applying it to titles and labels produced false positives, because `Existing visitor system integration pending` is the specified copy and not a fragment. So a truncated **title** still ships undetected — the same class as `…通知各住`, which reached a committed artifact.

### Why the heuristic approach fails here by construction

Every candidate tested or considered fails in one of two directions:

| Approach | Fails because |
|---|---|
| Require terminal punctuation | Titles legitimately have none. This is the false-positive wave already observed. |
| Detect mid-word truncation | For English, unreliable without a dictionary; **for Traditional Chinese, there are no word boundaries at all** — `各住` is a valid prefix of `各住戶` and nothing in the string says which was intended. |
| Flag suspicious lengths (30, 40, 60) | Catches only the historical slice constants; brittle, and silent against any other truncation. |
| Flag a string that is a proper prefix of another string in the corpus | Real but narrow: catches slicing **only when the full string survives elsewhere**, and produces false positives on short labels — `Home` is a proper prefix of `Home Safety`. |

**The common defect is that all of these guess at wrongness from the string alone.** A truncated title and a short title are the same object; nothing intrinsic distinguishes them. That is why every attempt has landed either noisy or blind, and it will keep doing so.

### What would actually make a title checkable

**Equality against the authored source.** If every resident-visible string in the corpus carried the key of the copy it came from, and that copy lived in one catalogue, then a fixture string is correct exactly when it **equals** its catalogue entry. Truncation of any kind, in any field, in either language, becomes detectable — not by heuristic but by comparison. `各住` fails not because a rule guessed it looked short, but because the catalogue says `各住戶`.

**This is the same mechanism as `G7`, and that is not a coincidence.** Both findings are one defect class: **an artifact asserts something it has no means to verify.** `G7` — the fixture asserts a cause it cannot check. `truncated-copy` — the fixture asserts copy fidelity it cannot check. Both are closed by recording provenance and comparing against it, and neither is closable by inspecting the artifact alone.

`UI-007-ST` already maintains ARB files for the client, so a catalogue partly exists. Whether the fixture corpus should share it is a real question with a real cost: it couples the contract's fixtures to the client's i18n, and the contract deliberately does not depend on any client.

### Recommendation — state it as a known gap, and narrow it

**It remains a known gap for titles.** Recorded as a gap rather than solved, and this plan does not pretend otherwise. Three things make that honest rather than resigned:

1. **The source is removed.** The generator no longer slices; the mechanism that produced `…通知各住` is gone, and the remaining risk is a hand-authored truncation nobody has yet made.
2. **One cheap narrowing is available now** if wanted: the proper-prefix check restricted to strings of 40 characters or more, where an intentional prefix relationship is implausible. It catches slice-recurrence when the full string survives, has no plausible false positive at that length, and is honest about being partial.
3. **The real fix is scoped, not hand-waved.** It is a copy catalogue with fixtures referencing keys — the same provenance mechanism as `G7`. That is a contract-shape change deserving its own decision, and it should not be smuggled in under a lint fix.

**Version:** if the narrowing is added, a new assertion constrains emissions → **surface → minor**, riding the same `0.3.0`. If the gap is simply restated, **no version change** — a documentation-only note.

---

## Summary

| Item | Files | Proof | Version |
|---|---|---|---|
| `G2` | `forbidden-terms.json`, `validate.mjs` | Containment catches a leaked value under an innocuous field name | surface → minor |
| `G6` | `problem-types.json` (new), `openapi.yaml`, `validate.mjs` | Typo fails forward; unused entry fails reverse | surface → minor |
| `G7` | `index.json`, `validate.mjs`, **plus `GEN-006-ST` harness** | Provocation executes and reproduces the bytes | artifact → patch |
| `truncated-copy` | `validate.mjs`, or documentation only | Prefix check red-conditioned, if adopted | surface → minor, or none |

**One bundled change, `0.3.0`.** Sequenced after `GEN-013-ST` merges; `G6` depends on its new type URI, and `G7`'s first five entries depend on `B1`'s TTL.

**Two items are not the contract track's to finish alone:** `G7`'s execution belongs to the backend harness, and `truncated-copy`'s real fix needs a decision about a copy catalogue that does not exist yet.
