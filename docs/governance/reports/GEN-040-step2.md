# GEN-040 — N2 notices write surface (ADR-019 cut B) — build + merge report

**Merged.** `1a1d2ed0` → **`292f9da8a604e9865b14832116b42e8f30f15a37`**
**Tree-hash `b7580198c270e3b233695f99277d4bfbcad9eeb7`** — local and remote EQUAL, remote re-read via
`git ls-remote` after the push. Refspec push, `main` never checked out, through the hook (31/0), no
`--no-verify`. **PID `GEN-040`** from the directory scan (next: 041). **Date** 2026-09-02.

**Carry-in:** pin matched exactly; ADR-010/013/014/015/017/018/019 all resolve.

**ACTS ONLY, as dispatched.** No routes, no HTTP shape, no read surface.

## THE CLOSE IS NOT DONE — no filed ruling

No `reports/GEN-040-*-RULINGS-*` exists. The PID stays `draft`.

---

## THE TYPED-SCOPE GENERALISATION D2 ASKED ABOUT (reported item)

**Taken: a role-parameterised typed scope, `RoleScope<R>`, with the role IN THE BRAND.**

The alternative — copying `GrantAdministratorScope` once per role — reintroduces the original defect
one level up: three structurally identical types, each a flat set of node keys once constructed, with
nothing stopping an `estate_staff` scope reaching an approver's floor. The compiler would be
satisfied and the authority model would not.

The rejected middle option is worth naming too: **one `Scope { role, nodeKeys }` carrying the role as
a FIELD**. That type-checks everywhere and pushes the role comparison back into every caller — which
is exactly the "the filter lives in each caller" arrangement ADR-018 retired. The role must be in the
TYPE, or the type is not carrying the guarantee.

`GrantAdministratorScope` is now `RoleScope<'grant_administrator'>`, an alias, so every GEN-035 call
site is untouched. **GEN-035's type-level test passes unchanged**, which is the evidence the original
property survived rather than an assertion that it did. The fixture gained three new
`@ts-expect-error` cases proving the NEW property: staff↛approver, approver↛administrator, and the
raw set still refused whatever the role.

**Bite:** weakening the brand to optional (`[roleScopeBrand]?: R`) reds the type test with `TS2578`.

---

## CONTRACT / REGISTRY DELTA

**Contract: NONE.** No `openapi.yaml` and no file under `packages/api-contracts/` was touched.

**Registry: additive, and not yet published.** `NOTICE_REASONS` declares vocabularies for eight acts
and `NOTICE_STANCES` their idempotency stances, both at the composition layer — `@pemo/notices` still
never learns that an audit row or an idempotency key exists. These become contract surface when the
routes land; until then they are internal. A test derives the act list from the stance table and
asserts the two registries name exactly the same acts, so a ninth act cannot ship with no declared
stance (ADR-015 D1).

**Migration delta:** two. `0133` the approval policy; `0134` the gated-path dispositions.
`0126`'s CHECK is merged and immutable, so the two new dispositions arrive by ALTER in a new file —
and `notice_current` had to learn them, because its `ELSE` branch assumed every non-draft assertion
was published. That was true until this PID and is not now.

---

## ACCEPTANCE — sixteen cases, and what each bite proved

| # | criterion | mutation → result |
|---|---|---|
| 1 | gated happy path | — 4 audit rows, each carrying the GEN-030 witness; snapshot; one event |
| 1b | ungated happy path | — compose → publish, no approval step |
| 2 | covering conjunction | `uncovered.length < addressed.length` (any-node) → **case 2 reds** |
| 3 | approver's own floor | approve skips its floor check → **case 3 reds** |
| 4 | fail-closed policy | `row === undefined ? false` → **case 4 reds** |
| 5 | bilingual required | drop the emptiness check → **case 5 reds** |
| 6 | empty audience refused | `length < 0` → **case 6 reds** |
| 7 | snapshot as at publish | *no mutation — see below* |
| 8 | correct cannot retarget | disable the comparison → **case 8 reds** |
| 9 | withdraw retains snapshot | — snapshot intact, `notice.withdrawn` emitted |
| 10 | decline → draft, revise → resubmit | — full round trip |
| 11 | compose is client-keyed | — same key, one draft |
| 11b | publish is derived-keyed | — stale `from_version` is a refusal, one snapshot |
| 12 | concurrency | **drop the advisory lock → case 12 reds** |
| 13 | ADR-018 property | weaken the brand → **type test reds** |
| 14 | stances + vocabularies | — derived from the act surface, both registries agree |
| 14b | refusals are values | — `out-of-scope` and `no-such-notice` returned, never thrown |

**Case 7 has no bite, and I am reporting that rather than contriving one.** The dispatch names
mutations for 2, 3, 4, 5, 6, 8, 12 and 13 — not for 7 — and the reason is structural: nothing in this
cut re-resolves a snapshot. It is written once at publish and never recomputed, so the plausible
wrong rule that would break it (re-resolving on READ) does not exist until there is a read surface.
I attempted a mutation anyway (`actor.now` → `new Date()`) and it correctly did **not** red, because
both instants precede the mover-in. Case 7 therefore asserts a property that currently holds by
construction. **It becomes bitable when the read surface lands, and that is where it should be
re-proven.**

**Case 12 is a real race, not a sequential pair.** The lock mutation reds it, which is the evidence —
GEN-024's lesson was that `Promise.all` over two pools can complete sequentially and prove nothing.

---

## THREE DEFECTS, each caught by something refusing rather than by inspection

1. **A fixture invented a group id.** `audit_event`'s foreign key refused it — correctly: an audit row
   naming a group that does not exist records authority nobody held. Replaced with the real seeded
   witness.
2. **A state check compared against a DISPOSITION name, not the computed LIFECYCLE name.** The view
   maps disposition `pending` → state `pending_approval`; `approve` tested for `pending`, so the
   condition **silently never matched** and every approval refused as `wrong-state`. The two names
   differ deliberately — one is the act, one is the state it produces — and that is now written beside
   the field.
3. **The outbox publisher emits unqualified SQL.** `createOutboxPublisher` writes `outbox_message`
   unqualified, so it resolves only under a platform-scoped `search_path` — while D5 requires the
   event in the same transaction as the assertion, which is `notices`-scoped. The composition adapter
   qualifies the insert. **Reported as a finding:** the publisher is written for a caller already
   inside platform, and every cross-schema act must qualify or supply its own adapter.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| tables before | **0** |
| bootstrap | **51 migrations**, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **407 / 407** (391 + 16) |
| battery | **31 / 31** |
| boundaries | **PASS** |
| ADR-018 type test | **PASS** |
| validator / three generators | rc 0 |
| register | OK, next **041** |
| contract delta | **NONE** |

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-040-*-RULINGS-*`.
2. **Case 7 is unbitable in this cut** (above). Owed at the read surface.
3. **`decline` has no terminal state.** A declined notice returns to `draft`; who declined and why is
   on the audit row and the assertion's reason code. If a distinct `declined` state is wanted for
   reporting, that is a decision, not an omission — flagged.
4. **`expiry` is computed and has no act**, as dispatched. A published notice whose `expire_at`
   passes reads `expired`; changing it is a `correct`.
5. **The outbox adapter is supplied by the caller.** These acts take `publishEvent` injected, so the
   routes PID must supply one that writes in the act's transaction. Named so it is not rediscovered.
6. **`notice_audience` is now written**, but nothing reads it — the read surface is a later cut.

Out of scope as dispatched and untouched: routes and the HTTP contract; the read surface and preview;
templates (COM-05); ack acts (N3); Notification delivery; emergency auto-template; reminders;
resident cohorts (OQ1); owner audience (OQ2).

**HARD STOP for the close ruling.**
