# GEN-064-RULINGS — close: Overview, one source per counter

**Date:** 2026-09-06
**PID:** GEN-064 (backend) — `getOverview(scope)`, three server-owned counters, per-node tree counts + occupied/vacant, contract 2.3.0.
**Authorises:** the Rule 7 close (archive, `status: merged`, `closed:` UTC, carry this artifact as the `-RULINGS-`).
**Merged:** `main` @ `5d3cdb8`, CI green (run 34016626006).
**Rulings absorbed:** the GEN-064 ruling + Amendments 1–6, and `RULING-corpus-digest-hashes-authored-not-stamped` (b), which UI-066 delivered to unblock the rebase.

---

## 1. Accepted — and what it actually removed

GEN-064 replaced a screen whose four numbers were fixture literals (14 / 6 / 2 / 31, over an estate the seed says holds 815, not the mockup's 812) with three counters each computed by the server under a stated definition, a scope-parameterised list read sharing that definition, and a count that cannot drift from its list. `open-cases` is absent, not zero. The unsourced fields are omitted, never fabricated. Occupancy is derived, `status` never read. This is `a-surface-that-displays-without-a-source-is-a-drawing` reversed, in the layer where the drawing lived.

The proof is the four instrument controls, red-on-mutation and restored — including the one that took two amendments to force: keying the building bump by estate makes the per-node building stat vanish and reds control 4, which is what proves the tree count is **per node** and not per estate. That is the claim Amendment 3 said `7 / 808` could not carry; it is carried now.

All green as reported: fixture-parity 70/0, gen064 suite 5/5, four bites 4/0, scope/tree suite 10/10.

## 2. The four close-log items — carried, and consistent with what was ruled

1. **`ScopeTreeNode.counts` optional-now / required-once-populated.** Server always returns it; the schema is optional only to let pre-counts fixtures validate. When UI-065 populates counts into every fixture, tighten to required so the contract matches the server's always-returns guarantee. A UI-065 input.
2. **`ScopeTreeNode.attention`** — no source, consumed by S3Properties/S2Overview. Left, mandatory UI-065 input (source it or remove it, with the screen).
3. **`OverviewResponse.attention[]` / `integrationHealth[]`** — left optional, route omits them. Deferral targets: the late-arrival read (attention), the integration-health ADR (integrationHealth). UI-065 renders them not-yet-available, never as live.
4. **The delete-the-route-must-change-the-screen acceptance** is the GEN-064 + UI-065 **pair's**, not GEN-064's alone. It is not a debt against GEN-064; it is the criterion UI-065 must meet.

All four match Amendments 4–6 and the bridge note. No drift between what was ruled and what is being closed.

## 3. The CI-red-then-fixed detour — recorded, and it is the through-line

The pre-push gate passed (37/0); CI then caught two things the gate does not run:

- **`contract-lock.json`'s `contractVersion` left at 2.2.0** while `meta.contractVersion` (from openapi) is 2.3.0.
- **`getOverview` still listed in the stay-unregistered guard**, fixed by removing it from the inventory per that test's own remove-don't-loosen discipline.

Both fixed, CI green. Recorded as **the second logged instance of `a-gate-that-runs-less-than-CI-is-not-the-gate-it-claims-to-be`** (the first: governance #130's empty-pids red). Two transient reds have now landed on main because the gate is weaker than CI. That is no longer a stray event; it is a pattern, and it makes the gate-coverage PID the priority it was queued to become.

One of the two is more than a coverage gap — it is a **copy-drift with a named root**:

> `contract-lock.json` carries a `contractVersion` that `stamp-version` does **not** stamp. It is a hand-maintained second copy of `info.version`, so it drifts exactly as the corpus digest's stamped-version did, and only CI catches it. This is `a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy`, in the lock file.

**Remedy, for the gate-coverage PID (not a GEN-064 reopen):** bring `contract-lock.json`'s version under `stamp-version` (one source stamps it), **or** drop the version from the lock entirely and let the surfaceHash/corpusHash carry the coupling — the same move UI-066 made when it declared the digest `versionIndependent`. Whichever, a hand-maintained copy of `info.version` should not exist. Recorded so the fix is a decision, not a rediscovery next bump.

## 4. The gate-coverage PID — its inputs are now assembled

It is the next governance PID after GEN-063 D4–D7, and it now carries, as recorded inputs:

- `--next` must resolve against in-flight branch allocations, not main's register alone, or refuse (UI-066's 063 collision).
- the gate must run what CI runs, or name precisely what it does not — the two escapes above are its first cases, with the empty-pids red as the zeroth.
- `contract-lock.json` version drift (§3), remedy stated.
- the empty-case debt survivors; the resident-mobile dead-display recurrence (`safety_overview_screen.dart:92-104`); the UI-side stamp/strip regex-drift round-trip (from UI-066's close, on UI's next PID).

Not started now. Assembled so it starts complete.

## 5. Close

GEN-064 is **cleared to close under Rule 7**: archive, `status: merged`, `closed: 2026-09-06` (UTC), carry this artifact as the `-RULINGS-`. Read the close-push run.

Then **GEN-063 D4–D7 proceeds** — the authoritative 17-line capture: distil with the dropped/kept table (including the 409-by-design confirmation for approval-exempt notice types), the three C3 cases from `PEMO-demo-cases.md` (CASE 2 = two tickets / one case at `loc_wfg_lift_bank_low`), re-record both corpora so UI tests and the demo see one world, the computed-summary bite, D3 green against the committed script, merge, close. GEN-063 and 55490 untouched until then.

UI-065 is now unblocked to be **specified** (its subject settled by Amendments 1 + design-authority ruling); it is dispatched when I issue its PID, after GEN-064's close is confirmed.

## 6. Principles

No new principle. Cited: `a-surface-that-displays-without-a-source-is-a-drawing`, `a-gate-that-runs-less-than-CI-is-not-the-gate-it-claims-to-be`, `a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy`.
