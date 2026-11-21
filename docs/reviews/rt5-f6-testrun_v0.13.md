# RT5-F6 per-module privileges — test run v0.13

- Version: v0.13
- Date: 2026-11-20 AEDT (gates 14:49–14:53 AEDT)
- Branch: `fix/rt5-f6-module-privileges` in `~/code/PEMO-grok-wt/rt5-f6`
- Base: `b4fe994c4aa7e99e184d6eebdf04f2d5dea45b0d` (`fix/p1-review-r1-r3`, Batch B accepted on product SHA `664d7f5`). That branch and worktree were not touched.
- Product SHA (every gate below ran on this commit): `f0e1dc03366def3025c8d074911048a01e2cce3d`
- Candidate SHA: the note-only commit that adds this file
- Authority: `/tmp/RT5-F6-architect-decision-2026-11-20.md` (workspace copy under `~/codex-workspaces/物管/`)
- Call-site table: `docs/design/rt5-f6-call-sites_v0.2.md`

## Changelog

- v0.13 (2026-11-20 AEDT): F6 rebased onto `b4fe994`, finished, and gated on the final product SHA after the outbox named command and N1. v0.11 was reserved earlier and was never written.

## What landed

Parked F6 work at `260b362` was rebased onto `b4fe994`. The two F6 digest/corpus commits for the Round 3 problem fixtures were dropped; they are already on the base as `c73e8ba`. There was no other file overlap and no conflict.

The product is the architect model: one NOLOGIN privilege role per production module schema; distinct module logins on the existing nine pools (no `service_case` or `integration` pool); no shared login that can `SET ROLE` to a peer or to the command definer; tightly scoped `SECURITY DEFINER` named commands on the caller's current transaction; the six `strata.email_outbox` UPDATE columns stay on the Strata privilege role; `dev_scaffold` stays out of production identities; aggregate pool capacity stays inside the 90/100 budget.

`platform.enqueue_outbox_message` (migration 0149) is the additional crossing required so notice publish can record `platform.outbox_message` on the notices transaction. The definer holds `SELECT, INSERT` on that table because `ON CONFLICT DO NOTHING` needs `SELECT`. Direct `INSERT` from a producing module login is denied. The call-site table is v0.2.

N1 (steering, after Batch B was accepted): `page?: PageMeta` was removed from `StaffNoticeListResponse`, and `listNotices` no longer uses `getPaged`. Tree `PageMeta` and tree walks are unchanged. Management-web `pnpm typecheck` passed on the N1 follow-up commit and again on the final product SHA.

## Commits since `b4fe994` (product, oldest first)

| SHA | Subject |
| --- | --- |
| `f28d6d1ab531f805428e923d354c600e8d1cc4af` | feat(db): RT5-F6 per-module roles, named commands, and grant split |
| `07466b34b3761562f9de63e6e8bd565689c23b45` | feat(api): wire module logins and named-command call sites |
| `01c5fb21ac685db618c3eaeab9101e210d5be32a` | fix(db): grant schema USAGE so module logins can call named commands |
| `8e2579261b385ab31d29f1f61045e19b6347b34f` | test(db): resolve pg from platform and cover command-schema isolation |
| `b8af9d5dcc5d2c1ed8147538e417ff2ecf2b1161` | docs(design): record schema USAGE for named-command resolution |
| `97549fe1c31e029cb8f6e99f5a620bf6df9c07ed` | fix(db): cast append_audit_event correlation_id to uuid |
| `6cb95ff0256d80a5659308c0c8b44ace63944fdc` | test(db): retarget F6 exit and privilege probes at module logins |
| `68961305848abd2ed625698aa06e8e91cb3c0f42` | test(db): probe inherited module privileges and seed-valid audit plants |
| `d3c5c4c6e43f6f3a844e8f220ddfb88dca81a8b1` | test(db): give the denied audit insert distinct text and uuid parameters |
| `30f77adeed6b4f1e3203f297bd4fb7d208516801` | feat(db): named command for same-transaction outbox enqueue |
| `e050cfb9bb9041ef5110696ab9903a9d178ea889` | fix(management-web): drop deferred notice-list page field (N1) |
| `3a01d0cc904f9bea2c09702b2a3535dd4dcef107` | fix(management-web): load the notices list without paging (N1) |
| `f0e1dc03366def3025c8d074911048a01e2cce3d` | fix(db): grant the outbox-enqueue definer SELECT for ON CONFLICT |

N1 is a separate small commit (plus a typecheck follow-up) after the already-landed F6 work. History was not rewritten to move it immediately after the rebase.

## Exit evidence (`tests/integration/rt5-f6-module-privileges.test.ts` on `f0e1dc0`)

12/12 pass, 0 fail. Official integration also ran this file and it passed there too.

| Item | Test | Result |
| --- | --- | --- |
| Connect with the actual module logins | `real module logins connect as themselves` | PASS |
| Allowed and denied qualified reads/writes | `allowed and denied qualified reads and writes` | PASS |
| Peer and coordinator role-switch denials | `peer and coordinator (definer) SET ROLE are denied` | PASS |
| Authorized command success and denied direct access | `named command succeeds; direct access is denied` (audit append, case open, outbox enqueue; direct inserts denied) | PASS |
| Peer logins can call commands but cannot read or write the command tables | `peer logins can call named commands but cannot read or write the command tables` | PASS |
| Cross-estate and historical recipient access | `cross-estate SQL is denied for foreign schemas; historical recipient rows stay on the notices login` | PASS |
| Outbox column limits | `strata outbox UPDATE is limited to the six delivery columns` | PASS |
| Pool reuse after success and rollback | `pool is reused after a successful transaction and after a rollback` | PASS |
| Aggregate connection capacity | `aggregate connection capacity stays inside the 90/100 budget` | PASS |
| Forced failure of both case commands, no partial state | `forced failure of both case commands leaves no partial state` | PASS |
| Governance detects an unexpected grant | `governance detects an unexpected grant and is green when it is revoked` | PASS |
| Rollback preserves data | `rollback of the named-command migrations preserves data` (0149–0146 and the legacy-login rollback script) | PASS |

## Journeys under the final module logins (2026-11-20 14:51:53 AEDT, `f0e1dc0`)

73/73 pass, 0 fail, `--test-concurrency=1`:

- `tests/integration/p2-r5-paging.test.ts`
- `tests/integration/p2-r4-tree-authorization.test.ts`
- `tests/integration/scope-list-filtering.test.ts`
- `tests/integration/scope-differential-property.test.ts`
- `tests/integration/notice-acts.test.ts`
- `tests/integration/case-acts.test.ts`
- `tests/integration/case-handling.test.ts`
- `tests/integration/notice-acknowledgement.test.ts`

Adapted privilege/runtime tests (same identities, concurrency 1): 77/77 pass, including `audited-write`, `notices-origination`, `cases-origination`, `cross-schema-discriminator`, `occupancy-end-write`, `p1-r1-runtime-role`, `p2-r6-db-boundaries`.

## Gates (2026-11-20 14:49–14:53 AEDT, private cluster, every row on `f0e1dc0`)

PostgreSQL 16, `initdb` under `/tmp/pemo-f6v13`, `listen_addresses=''`, unix socket only at `/tmp/pemo-f6v13-sock` (outside DATADIR), port 5508 naming the socket file. Shared `127.0.0.1:5432` was not written to. Module logins were created from `database/roles/000-roles.sql`, migrated, granted with `010-grants.sql`, and seeded. The cluster was stopped and deleted at the end of the run (`private_cluster_removed=/tmp/pemo-f6v13`). `fix/p1-review-r1-r3` stayed clean at `b4fe994`. Live :3200 / :5185 / :5186 were not restarted. No corpus fixtures or OpenAPI documents were changed after `f0e1dc0`, so digest/generate was not re-run. This note is committed after the gates; it is documentation only, so the gates were not re-run on the note commit.

| Gate | SHA | Result |
| --- | --- | --- |
| management-web `pnpm typecheck` | `f0e1dc0` | PASS, exit 0 (also ran and passed on the N1 follow-up `3a01d0c` before the final product commit) |
| `apps/api` `pnpm exec tsc -b` | `f0e1dc0` | PASS, exit 0 |
| Focused `tests/integration/p2-r5-paging.test.ts` | `f0e1dc0` | 9/9 pass, 0 fail |
| management-web `pnpm run build` | `f0e1dc0` | PASS, exit 0 |
| management-web `test:node` | `f0e1dc0` | 401/404 pass, 0 fail, 3 skipped |
| `grants-complete` (`REQUIRE_DB=1`, updated for the new model including definer `SELECT, INSERT` on `platform.outbox_message`) | `f0e1dc0` | PASS |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `f0e1dc0` | PASS |
| `pnpm run test:contract` | `f0e1dc0` | 116/117. The only failure is the pre-existing `operation-fixture-parity` list of nine operations (`listHelpdeskQueue`, `getHelpdeskContact`, `listStrataCharges`, `getStrataCharge`, `listStrataPayments`, `sendStrataChargeInvoiceEmail`, `sendAdminEmailTest`, `getNoticeEmailDelivery`, `sendNoticeEmail`). Same debt as v0.12. |
| F6 exit-evidence tests | `f0e1dc0` | 12/12 pass, 0 fail |
| Journey reruns under final module logins | `f0e1dc0` | 73/73 pass, 0 fail, `--test-concurrency=1` |
| `pnpm run test:integration` | `f0e1dc0` | 557/567 pass, 10 fail: the known ten only (see below). Notice HTTP e2e, F1/F3/P1-R2/P1-R3 outbox, and readiness all passed on this SHA. |

Playwright was not re-run.

## The ten known integration failures

These are the same ten recorded in v0.12 on product SHA `664d7f5`. None is an F6 product hole. Failures 3–9 depend on test order / harness pollution in a full-suite run (they pass against a clean seed). Failures 1, 2 and 10 are environment/process shape.

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

## Deferred (named, not fixed in this run)

- **N2.** An empty `limit=` should mean the default. Not done. (Related to, but not the same as, the P3-4 tightening that rejected non-digit `limit` values.)
- **N3.** GET `/notices` remains unbounded. Notice-list paging stays deferred (the handler, fixtures, and client walk would all have to change together). N1 only removed the leftover `page` field and stopped the client from walking a page that the contract no longer declares.
- **Previously deferred on Batch B, unchanged:** P3-1 mid-walk 410 UI restart; P3-2 `/properties/tree` 15 s snapshot vs live `/scope` walks; `/scope` row order; page size default and max of 2,000; `getResidents` fan-out and the per-ticket helpdesk query; 9-operation fixture debt; RT5-F12.

## Deviations

- Official integration is not exit 0: the known ten only, same as v0.12. They were not "fixed."
- Journey reruns used `--test-concurrency=1`. At default file-parallelism, C3-5 and notice-ack #3 have previously interfered; official integration already passed those two at `d3c5c4c` and again at `f0e1dc0`.
- `/ready` still probes `modules.platformDb` only. The readiness test was retargeted so it breaks `moduleDatabases.*.port` (and the leftover `database.port`), because a dead shared-login port is no longer what readiness checks.
- The platform privilege role still has direct `INSERT` on `platform.outbox_message` (own-schema table). Production publish paths use the named command so the write can share the act's transaction.
- No history rewrite to place N1 first after the rebase. It landed as two small commits after the outbox work.
- Batch C was not started.

