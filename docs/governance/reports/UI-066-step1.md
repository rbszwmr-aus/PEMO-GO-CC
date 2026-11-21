# UI-066 — Step 1: the corpus digest hashes what is authored, not what is stamped

| | |
|---|---|
| PID | `UI-066`. Allocation `b960e5e` on `main` (skipped 063/064 held by GEN-063/GEN-064 on codex branches, 065 reserved for UI-065 — documented in the allocation) |
| Pin | `origin/main` at `b28717c` (GEN-062 close) when work began; contract 2.2.0 |
| Ruling | `RULING-corpus-digest-hashes-authored-not-stamped-2026-09-06.md`, decision (b). Principle `a-digest-must-hash-what-is-authored-not-what-is-stamped`. |
| Written | 2026-09-06 (UTC) |

## What was done

**The fix (`apps/management-web/tool/corpus-source.ts`).** The corpus digest now
excludes the stamped `contractVersion` from every hash. `stamp-version.mjs` writes that
field into each fixture from `openapi.yaml`'s `info.version`; UI CC neither authors nor
owns it, so a backend contract bump (GEN-064's 2.2.0→2.3.0) reddened `CorpusGuardError`
with ~29 diffs that are pure version-stamp noise. The change is a single neutralisation
in the shared `sha256` path — `stripStampedVersion` replaces the stamped value with a
fixed sentinel before hashing — so **record and check stay identical**. It mirrors
`stamp-version`'s own targeted byte substitution (`/("contractVersion": ")[^"]*(")/`),
never a JSON round-trip, so hand-authored bilingual copy is untouched and the digest and
the stamper stay in lock-step.

**Re-recorded once (`corpus-digest.json`), and `corpus.g.ts` regenerated** (it embeds
`CORPUS_DIGESTS`). This is the guard's own instruction honoured, not the blind re-record
decision (a) refused: the corpus **content is unchanged** — only what the digest hashes
changed — so the screens render exactly as before. `write-digest.ts` no longer records a
top-level `contractVersion` (it would be a stale, misleading note now the digest is
version-independent); it records `versionIndependent: true`. Nothing reads that field —
`loadCorpus` reads only `.digests`.

**Not in scope (ruling §4):** GEN-064's `counts` and `getOverview` corpus. Their digest
certification is deferred to the UI track that renders them (UI-065), if contract-parity
requires it at all. This PID touches only the version-stamp coupling.

## Proof — the guard bites both ways and stays complete

`test/guard/digest-version-independent.test.ts` (3 assertions, all green):

1. **A contract-version bump alone leaves every digest unchanged** — a fixture stamped
   `2.2.0` and the same fixture stamped `2.3.0` hash identically; asserted **non-vacuous**
   (the two raw buffers differ first, so the stamp really was present).
2. **An authored content change still moves the digest** — tampering a `titleEn` changes
   the hash, so stripping the stamp did not blind the guard.
3. **`stamp-version` stamps no fixture field beyond `contractVersion`** — every
   two-group value-substitution regex in `stamp-version.mjs` names `contractVersion`, so
   neutralising that one field is complete. If a second field is ever stamped, this reds
   and names the fix. That is the ruling's "any other stamp-version-derived field" clause
   honoured **structurally, not by enumeration**.

## Carried on this PID

- **D0:** `READOUT-mockup-vs-built-ui.md` and `READOUT-demo-readiness-ui.md`, now tracked.
- **UI-058 UTC date:** `archive/UI-058.md` `closed:` corrected `2026-09-03` → `2026-09-04`
  (the UTC date of its close push, 2026-09-04T06:59Z), and the archive index regenerated.
  Not a reopen — a stale row fixed in the next PID's commit, per the one-clock ruling.

## Verification

- `pnpm run typecheck` clean.
- node suite: **136 tests, 133 pass, 3 live skips** (the +3 are this guard). Includes
  `corpus-source-guard` "not stale", `inventory-complete` against the runner, and the
  new digest guard.
- `pnpm run build` ✓; browser suite **380 passed, 5 live skips** — screens render.

## Sequencing this unblocks

Lands to main. GEN-064 then rebases main and its 2.3.0 stamp no longer reds the corpus
guard (ruling §5.2). UI-065 stays after GEN-064's close.

Merged tree-hash and the main run reported with the landing. **HARD STOP for the close
ruling** — this dispatch authorised the fix and the landing; the Rule 7 close awaits the
PO's word.
