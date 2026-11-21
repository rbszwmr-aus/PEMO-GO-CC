# GEN-042 — notices routes + first read surface (cut B) — build + merge report

**Merged.** `b5b30bb4` → **`e8a3a1228b186057c1d9c395ff6d2ca6841bba3d`**
**Tree-hash `04ad86a36f836fdb23edb8e72bd875902c4e9046`** — local and remote EQUAL via `ls-remote`.
Refspec push, `main` never checked out, through the hook (31/0), no `--no-verify`. **Date** 2026-09-02.

## THE CLOSE IS NOT DONE — no filed ruling, and ONE ITEM IS DEFERRED FOR A RULING

---

## THE DEFERRAL — R2's ROUTES, and why it is not mine to decide

`listNotices` and `getNotice` **already exist** in management-web as S5 read placeholders. Their
schemas encode a **pre-ADR-019 notice model**:

| | S5 placeholder | ADR-019 |
|---|---|---|
| title | one `title` | `titleEn` + `titleZhHant` |
| type | `building-services`, `planned-interruption`, `community`, `emergency-follow-up` | `general`, `planned_interruption`, `emergency`, `event_community` |
| state | `awaiting-approval`, `published` | `pending_approval`, `live`, `expired` |
| shape | `audience`, `channels`, `approval` objects | targeting rule, disposition history |

**Three fixtures pin that shape** (`mob-s5-notices/list.json`, `detail.json`, `lifecycle.json`), and
`apps/management-web/src/data/states.ts` names both operations.

Reshaping them **renames enum values and removes fields on operations that have fixtures**, which
ADR-008's amendment makes **BREAKING** — a MAJOR bump. **This PID was scoped MINOR**, and the two
cannot both be true, so I built and tested the projections and **deferred only their routes**.

That placeholder's own description is worth quoting, because it anticipated this PID exactly:
*"Deferred writes, named rather than omitted: create draft, save draft, submit for approval, approve,
schedule, publish, correct, withdraw."* Those writes all landed here. The reads it contracted did not,
because it contracted them against a model ADR-019 replaced.

**FOR RULING — three options, none of them free:**
1. **MAJOR bump** management-web to `2.0.0`, reshape both operations to ADR-019, update the three
   fixtures. Honest, and the version says what happened.
2. **New operationIds** (`listNoticesV2`) — additive and ugly; leaves two contradictory notice models
   contracted at once, which is the thing `a-check-fails-for-its-own-rules-reason` is about one layer up.
3. **Delete the placeholders** as never-implemented, then add the real ones. Also breaking; same bump
   question, but leaves a cleaner contract.

I recommend **(1)**. The placeholders were never implemented — no route ever served them — so the
"breaking" change breaks a promise nothing kept, and a MAJOR bump is the objective form of saying so.

---

## PART 1 — the carried hygiene, all four bitten

| item | bite | result |
|---|---|---|
| **H1** publisher qualified at source, adapter deleted | revert to unqualified SQL | reds — `relation "outbox_message" does not exist` |
| **H2** disjoint vocabularies | compare a state against `'approval_granted'` | **TS2367 "no overlap"** — exactly the ruling's requirement |
| **H3** ack lock deleted | drop the partial unique index | two rows, cases 4 and 7 red |
| **H4** `[sql-literals-hold-only-sql]` | — | **10 prose lines swept out, repo-wide count now 0** |

**H4 SWEEP COUNT: 10 lines across 3 files** — `access-repository.ts` (3), `scope-expansion.ts` (4),
`resident-text-pairing.test.ts` (3). The notices module itself was already clean, because GEN-041 had
fixed its only occurrence. The principle is defined with the six incidents that earned it.

**H2 is the one worth dwelling on.** The generator now REFUSES to emit an overlap and names the
offending literal, and a compile-time `Extract<NoticeDisposition, NoticeLifecycleState>` asserts
disjointness — so the guarantee holds at three levels: the declaration, the type, and the DDL.

---

## PART 2 — fifteen routes, and what they deliberately do not do

Eight staff acts, three resident acts, `getMyNotices`, `getNoticeOutstanding`. The seven transitions
are **registered from a table**, not written seven times: seven near-identical handlers is seven
places for one of them to quietly differ.

**The refusal mapping is exhaustive by a `never`**, so a refusal kind added to the acts and forgotten
in the route does not compile. No route re-implements a floor, a state check or a snapshot lookup —
all of that stays where GEN-040 and GEN-041 proved it.

**14 problem types registered**, each a domain refusal, never a 500. Out-of-scope answers **404**
identically to not-found, as everywhere on this surface: a distinct 403 would confirm the notice
exists to somebody with no authority over it.

---

## PART 3 — the read surface

| # | criterion | mutation → result |
|---|---|---|
| 6 | R1 membership is the SNAPSHOT | join `resident.occupancy` instead → **reds** |
| 7 | state filter | admit `withdrawn` → **reds** |
| 8 | projection boundary | leak the approver → **reds** |
| 8b | one resident never sees another's status | — |
| 9 | staff read INTERSECTS | use a COVERING filter → **reds** (proves intersect, not cover) |
| 9b | detail carries the disposition history | — |
| 10 | outstanding, unacknowledged first, scoped like detail | — |

**Case 6 discharges GEN-040's owed read-path bite.** At N2 nothing re-resolved a snapshot, so the
wrong rule was not expressible; here it is a one-line change that compiles and reads plausibly.

**Case 9 is the asymmetry made concrete:** read is inclusive, write is conjunctive. The same test
shows the same caller CANNOT revise the notice it can read.

---

## CONTRACT DELTAS (reported item)

| surface | before | after | change |
|---|---|---|---|
| **management-web** | 1.2.0 | **1.3.0** | MINOR — `composeNotice` (new POST on an existing path), 7 transition paths, `getNoticeOutstanding`; 9 schemas, 1 parameter, 2 responses. **Nothing removed or renamed.** |
| **resident-mobile** | 0.3.4 | **0.4.0** | MINOR — `getMyNotices`, `markNoticeRead`, `acknowledgeNotice`, `respondToNotice`; 4 schemas, 2 parameters. |
| problem types | 31 | **45** | +14, all additive |

Both locks regenerated in the same commit as the bump. **resident-mobile's Problem enum is now
GENERATED** — it was hand-maintained, which is the drift GEN-034's `I3` retired for the other surface.

**A guard caught me here too:** `contract-hash.mjs` refused my `//why` annotation as UNCLASSIFIED —
A4 D7, an unclassified field would enter neither hash silently. Renamed to `note`, a classified
corpus field, rather than inventing a classification.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| bootstrap | 53 migrations, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **425 / 425** (418 + 7) |
| battery | **31 / 31** |
| boundaries / ADR-018 type test | **PASS** / **PASS** |
| enums, notice-types, case-vocabularies, stamp, contract-hash, validator | rc 0 |
| register | OK, next **043** |

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-042-*-RULINGS-*`.
2. **R2's ROUTES are deferred** on the versioning ruling above. The projections and their tests are
   merged and green; only the two GET handlers are absent.
3. **No fixtures were added** for the new operations. The validator requires consistency for fixtures
   that EXIST, not a fixture per operation — I verified that rather than assumed it. Fixtures for the
   write routes would pin request/response shapes and are worth a follow-up.
4. **The resident routes are untested end-to-end.** The ACTS have 11 passing cases and the routes are
   thin adapters over them, but no test drives HTTP for the resident surface. Named rather than
   implied.
5. **`revise` and `correct` routes accept no content changes yet** — they pass an empty `content`, so
   they currently only advance the version. The acts support content; the route body parsing for it
   is not written. A real gap, not a design decision.

Out of scope as dispatched: Notification and reminders; templates; staff-recorded ack on behalf;
free-text responses; household aggregation; XLSX/CSV; resident cohorts; owner audience; any UI.

**HARD STOP for the close ruling.**
