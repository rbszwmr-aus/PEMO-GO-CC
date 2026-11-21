# GEN-043 — cut B completion — build + merge report

**Merged.** `04a436b5` → **`e51aa70a44f2c439c934737c148627566a297469`**
**Tree-hash `5db409c74ca8a1ab90bad97eae3cd9926bd6ded0`** — local and remote EQUAL via `ls-remote`.
Refspec push, `main` never checked out, through the hook (31/0), no `--no-verify`. **Date** 2026-09-02.

**Carry-in:** pin matched; `[adapter-bite-severs-the-plumbing]` correctly ABSENT beforehand.

## THE CLOSE IS NOT DONE — no filed ruling. The PID stays `draft`.

---

## THE MAJOR DIFF (reported item)

**management-web `1.3.0` → `2.0.0`.**

| | |
|---|---|
| operations **added** | **none** |
| operations **removed** | **none** |
| operations **RESHAPED** | **`listNotices`, `getNotice`** — and only these two |

`NoticeListResponse` and `NoticeDetailResponse` are gone; `StaffNoticeListResponse`,
`StaffNoticeDetailResponse`, `StaffNoticeDetail`, `NoticeTarget`, `NoticeHistoryEntry` replace them.
Old vocabulary retired: `building-services | planned-interruption | community | emergency-follow-up`
and `awaiting-approval | published`, plus the `audience` / `channels` / `approval` objects — channels
being Notification's, not this surface's.

**`NoticeRow` STAYS, UNCHANGED.** The S2 overview's `recentNotices` still uses it, and the dispatch's
constraint — *a MAJOR is not a licence to tidy* — is exactly right. I found this by deleting it and
watching the parser fail with `EMISSINGPOINTER` from `OverviewResponse`. The old vocabulary therefore
survives in one place, on one unrelated operation, and that is the correct outcome rather than an
oversight.

Three fixtures rewritten to the ADR-019 shape (`list`, `lifecycle`, `detail`); `lifecycle.json` now
carries one notice per computed state so the enum is exercised rather than asserted. Both locks
regenerated in the same commit as the bump.

**One design correction inside C1:** `StaffNoticeDetail` was written as `allOf: [listItem, extension]`,
which does not work when both branches say `additionalProperties: false` — under JSON Schema each
branch is evaluated independently and they reject each other's properties, so nothing validates. It
is flat now, with the repetition noted as the price of a strict contract. And the detail response
gained the `{ meta, notice }` envelope every management response on this surface carries; the parity
harness caught its absence.

---

## ROUTES COVERED END TO END: **15** (reported item)

| group | routes | asserted |
|---|---|---|
| staff writes | compose, revise, submit, approve, decline, publish, correct, withdraw | resulting state AND content; the snapshot and outbox row on publish |
| resident writes | markRead, acknowledge, respond | the `notice_acknowledgement` rows, the chosen option, and the 404 for a resident outside the snapshot |
| reads | R1, R2 list, R2 detail, R3 | projection boundary, ADR-019 shape, per-recipient status, and a caller scoped away seeing nothing |

**Not one assertion is a bare status code.** That is the whole point of C3: `GEN-042`'s route tests
asserted a version had advanced, which a route discarding its body satisfies.

**The approver had to be a different principal.** `approve` and `decline` demand
`RoleScope<'approver'>`, which the manager's `estate_staff` grants cannot produce — my first version
used the manager throughout and got 404 from an empty approver scope. Seeded `stf_wfg_dual_role` holds
approver at Block A. The type-level role distinction from GEN-040 D2 is visible here at HTTP.

---

## C4 — THE ADAPTER BITES, and two that failed first

| bite | fired |
|---|---|
| compose ignores its body | ✓ |
| revise/correct ignore their body | ✓ — **this is the GEN-042 defect, now caught** |
| respond ignores its option | ✓ |
| R1 ignores the caller identity | ✓ |
| R2 list ignores the caller scope | ✓ *(after the test was fixed)* |
| R2 detail ignores the caller scope | ✓ *(same)* |

**The R2 bites did not fire at first, and the fault was mine.** My HTTP test asserted only that the
notice **was** present, so a route ignoring the caller's scope entirely would pass it — the exact
vacuity `[adapter-bite-severs-the-plumbing]` describes, inside the test written to prevent it. Fixed
by adding `stf_wfg_counter`, a seeded principal scoped to a clubhouse Location and therefore excluded
from Block A: the list must not contain the notice and the detail must answer 404.

---

## A GUARD I BUILT CAUGHT ITSELF — and the diagnosis is uncomfortable

The reshape made OpenAPI validation fail, which executed a `fail()` path **that had never run before**.
GEN-041's runtime check then refused the code `openapi-3.1` as undeclared.

**The reason is exact: the extraction pattern was `[a-z0-9][a-z0-9-]*`, and the code contains a DOT.**

- `validator-codes.mjs` was generated with that pattern, so the code was never declared.
- `validator-codes.test.ts` extracted "call sites" with **the same pattern**, so it agreed.
- `adrs-present.sh` used **the same pattern** again.

Three checks, one blind spot, unanimous. That is `[correlated-lists-certify-nothing]` **inside the
check written to prevent it** — and GEN-036's report called that regex an *"independent witness"*. It
was not independent; it shared the other side's flaw. All three now accept dots and the declaration
went **73 → 74**.

It also demonstrates the limitation I named at GEN-036 and could not then exercise: **runtime
enforcement only covers codes that actually fire**, and `openapi-3.1` fires only when a contract is
invalid — which had never happened until this PID broke one on purpose.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| bootstrap | 53 migrations, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **436 / 436** (425 + 11) |
| battery | **31 / 31** |
| boundaries / ADR-018 type test | **PASS** / **PASS** |
| enums, notice-types, case-vocabularies, stamp, contract-hash, validator | rc 0 |
| register | OK, next **044** |

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-043-*-RULINGS-*`.
2. **No fixtures for the eleven write operations.** The validator requires consistency for fixtures
   that exist, not one per operation. The three read fixtures are updated; request/response fixtures
   for the writes remain a follow-up.
3. **`submit` on an ungated type is refused as `wrong-state` (409)**, which is correct but means a
   caller must know the policy to know which path to take. A `GET` exposing whether a type is gated
   would remove the guesswork; not contracted here.
4. **`revise` cannot clear a field.** Only supplied fields are forwarded, so `undefined` means "leave
   it" — there is no way to blank a body or remove an expiry. Deliberate for now (it makes a partial
   update safe) and named, because the opposite reading is equally defensible.
5. **The two `derivation-unevaluable` findings on `mob-s2-overview`** are pre-existing and declared
   open; untouched.

Out of scope as dispatched: templates; Notification; staff-recorded ack; free-text responses;
XLSX/CSV; any UI; cut C.

**HARD STOP for the close ruling. THIS CLOSES CUT B.**
