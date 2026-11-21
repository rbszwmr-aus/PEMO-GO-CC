# P1 fix round 4 — test run v0.12 (Batch B round 4)

- Version: v0.12
- Date: 2026-11-20 AEDT (gates 14:20–14:23 AEDT)
- Branch: `fix/p1-review-r1-r3`
- Starting HEAD: `097f2b7936ec31884b80484c29ce6c6cad1a1356` (clean tree recorded before edits)
- Product SHA (every gate below ran on this commit): `664d7f5dcf24f676474793ebea03c0c80f38b0ca`
- Candidate SHA: the note-only commit that adds this file
- Authority: `/home/luipt/codex-workspaces/物管/reviews/rt-independent-097f2b7_v1.0.md`
- F6 parked SHA (not rebased, not touched this round): `260b3623d94485f3d8acd41c8aacf4c09368897b` on `fix/rt5-f6-module-privileges` in `~/code/PEMO-grok-wt/rt5-f6`. The F6 run note, when work resumes, is v0.13.

## Changelog

- v0.12 (2026-11-20 AEDT): Batch B round 4, after R&T rejected 097f2b7 on one blocker (P1-1: management-web production build). Records the corpus digest for the 47e258a problem fixtures, drops the false `/notices` paging contract, tightens `limit` parsing, and makes the flaky BITING unmapped-unit lookup deterministic. v0.11 was reserved for the parked F6 run and was not written.
- v0.10 (2026-11-20 AEDT): Batch B round 3. See that note. Its build/`test:node` gate table was taken at `9826086`, before `47e258a` — that is the root of P1-1.

## What this round changed

| Finding | Commit | Fix | Focused evidence |
| --- | --- | --- | --- |
| P1-1 BLOCKER: `pnpm run build` exited 1 (`CorpusGuardError`); `test:node` then failed 17/404 | `c73e8ba` | The two fixtures added in `47e258a` (`problems/cursor-expired.json`, `problems/invalid-request.json`) and the `index.json` entries were read. They match the staff problem bodies for 410 cursor-expired and 400 invalid-request. Then `pnpm run digest` and `pnpm run generate` were run so `corpus-digest.json` (55 files) and `corpus.g.ts` record them. | Gate: management-web `pnpm run build` exits 0; `test:node` 401 pass, 0 fail, 3 skipped, all at `664d7f5`. |
| P2-1: `/notices` was documented as paged but the handler ignores `limit`/`after` and returns no `page` | `12fa90f` | Removed `PageLimit`, `PageAfter`, 400, and 410 from `listNotices` in OpenAPI; removed `page` from `StaffNoticeListResponse`; removed `listNotices` from `emittedOnlyBy` on `cursor-expired` and `invalid-request`. Notice-list paging is deferred (not trivial: the handler, fixtures, and client walk would all have to change together). | Contract still 116/117, same named 9-operation debt only. |
| P3-4: `Number()` accepted `1e3`, `0x10`, `+5`, and whitespace | `03ef76a` | `parsePageParams` accepts a present `limit` only when it is a string of decimal digits (`^\d+$`) and the integer is ≥ 1. | `parsePageParams: scientific, hex, signed, and whitespace limits are rejected (P3-4)` in `tests/integration/p2-r5-paging.test.ts`. Focused file 9/9. |
| P3-3: BITING "unmapped unit" used `LIMIT 1` without `ORDER BY` | `664d7f5` | Both mutant queries now `ORDER BY unit_id` (after `levenshtein` when that function exists), so a reseed cannot return `a2` instead of `a1`. | Official integration on `664d7f5` did not fail this test. |

## Deferred (named, not fixed in this round)

- **P3-1.** A mid-walk 410 arrives as `kind=problem`. The UI shows a load error. The problem text and OpenAPI say the client must restart the walk. Not done.
- **P3-2.** `/properties/tree` walks are a 15 s snapshot; `/scope` walks are live. Role/node/date/revoke changes are covered by the fingerprint; only data changes are snapshotted. Not documented in the contract this round.
- **Notice-list paging (P2-1 implementation).** GET `/notices` remains an unpaged list. The client already treats an absent `page` as the end.
- **Previously deferred, unchanged:** `/scope` row order; page size default and max of 2,000; `getResidents` fan-out and the per-ticket helpdesk query; 9-operation fixture debt; RT5-F12; RT5-F6 (parked, see above).

## Gates (2026-11-20 14:20–14:23 AEDT, private cluster, every row on `664d7f5`)

PostgreSQL 16, `initdb` under `/tmp/pemo-r4pg`, `listen_addresses=''`, unix socket only at `/tmp/pemo-r4pg-sock` (outside DATADIR), port 5506 naming the socket file. Shared `127.0.0.1:5432` was not written to. The cluster was stopped and deleted at the end of the run (`private_cluster_removed=/tmp/pemo-r4pg`). The F6 worktree stayed clean at `260b362`. Live :3200 / :5185 / :5186 were not restarted. This note is committed after the gates; it is documentation only, so the gates were not re-run on the note commit.

| Gate | SHA | Result |
| --- | --- | --- |
| management-web `pnpm typecheck` | `664d7f5` | PASS, exit 0 |
| `apps/api` `pnpm exec tsc -b` | `664d7f5` | PASS, exit 0 |
| Focused `tests/integration/p2-r5-paging.test.ts` | `664d7f5` | 9/9 pass, 0 fail (includes the new P3-4 test) |
| management-web `pnpm run build` | `664d7f5` | PASS, exit 0 (this is the P1-1 gate; it was red at 097f2b7) |
| management-web `test:node` | `664d7f5` | 401/404 pass, 0 fail, 3 skipped |
| `grants-complete` (`REQUIRE_DB=1`) | `664d7f5` | PASS |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `664d7f5` | PASS |
| `pnpm run test:contract` | `664d7f5` | 116/117. The only failure is the pre-existing `operation-fixture-parity` list of nine operations (`listHelpdeskQueue`, `getHelpdeskContact`, `listStrataCharges`, `getStrataCharge`, `listStrataPayments`, `sendStrataChargeInvoiceEmail`, `sendAdminEmailTest`, `getNoticeEmailDelivery`, `sendNoticeEmail`). Same debt as v0.8.1 / v0.10. |
| `pnpm run test:integration` | `664d7f5` | 545/555 pass, 10 fail: the known ten (see below). The flaky BITING "unmapped unit" test is not among them. |

Playwright was not re-run. The 14 visitor `state-matrix` failures remain as recorded in v0.7 / v0.8.1.

## The ten known integration failures

These are the same ten named in v0.10 and in `rt-independent-097f2b7_v1.0.md`. None is a Round 4 product test. Failures 3–9 depend on test order / harness pollution in a full-suite run (they pass against a clean seed). Failures 1, 2 and 10 are environment/process shape.

| # | Test | File | Why it fails in a full-suite run |
| --- | --- | --- | --- |
| 1 | BITING — database state disappearing after a restart is caught | `biting-tests.test.ts` | Asserts PGDATA is the Docker volume `/var/lib/postgresql/data`; a private initdb does not use that path. |
| 2 | F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist | `p1-f2-send-key-migration.test.ts` | Requires `PEMO_F2_DB_NAME`, a throwaway clone of a pre-0145 database, which a fresh private cluster does not provide. |
| 3 | the seeded magnitudes are UNCHANGED — interests are additive, no household added | `party-interest-seed.test.ts` | Household counts drift vs the corpus once earlier tests have written seed-shaped rows. |
| 4 | D7 — the Novatek case: five occupied units, the company holds the tenancy, occupants hold NO interest | `party-interest-seed.test.ts` | Occupancy counts drift in the full-suite run. |
| 5 | D7 — occupancy WITHOUT interest and interest WITHOUT occupancy both exist, which is the whole point | `party-interest-seed.test.ts` | Occupied-unit counts drift in the full-suite run. |
| 6 | F1 as a tested STATE — the contradiction is CONSTRUCTED in a test, never seeded | `party-interest-seed.test.ts` | Legacy occupancy counts drift in the full-suite run. |
| 7 | the total is the PRODUCT of the basis, not a number anybody typed | `seed-basis.test.ts` | Block A 8×35 expected 280; the world is larger after earlier tests. |
| 8 | households are NOT units — vacancy is non-zero at every block | `seed-basis.test.ts` | Block A household counts drift in the full-suite run. |
| 9 | the corpus-stated fact is a FACT, and the rest are inventions | `seed-basis.test.ts` | Same household-count drift as #8. |
| 10 | invoice email records a log-transport outbox row when SMTP is unset | `strata-live-reads.test.ts` | Official `pnpm test` uses `--env-file`. A copied gov env can still carry SMTP settings, so the test sees `smtp` instead of `log`. |

## RT5-F6 parking

R&T rejected 097f2b7 on P1-1 while F6 implementation was in flight on `fix/rt5-f6-module-privileges`. F6 was parked immediately and was not rebased onto this Round 4 work. Worktree `~/code/PEMO-grok-wt/rt5-f6` is clean at `260b3623d94485f3d8acd41c8aacf4c09368897b` (rebased earlier onto 097f2b7, then continued: uuid-cast, USAGE, module-login tests). No leftover private F6 cluster. The F6 run note, when work resumes, is v0.13.
