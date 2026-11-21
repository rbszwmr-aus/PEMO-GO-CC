# GEN-014 — Step 2: the third scope-only write, and the in-query filter proven AS the gate

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** R3 is closed — the in-query filter is the deciding layer here, and deleting it turns the suite red **at the route**, which GEN-013 could not achieve. No new mechanism, no shared code widened. Two small findings, both mine: a **lost contract edit from GEN-013**, and a teardown that **deleted seeded fixture data**.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `304ebeb121d73088e08c76ac10ee6d3ff079bd10` (Step 1) |
| **`main`** | `8839d42fcfa6a1189fbd163d8df45a302cf2afd5` — the allocation only. **Nothing since.** |
| **Green** | integration+contract **327** (105 + 222), 0 failures · boundaries `PASS` · battery **21/21** · validator PASS · index `--check` OK |

## 2. R3 CLOSED — the filter is the gate, and it is provable at the route

GEN-013's act was scoped by a **unit**, which is Property Core's fact, so the writing module could not resolve it: the authorizing-grant lookup had to decide, the in-query filter sat behind it unreachable, and a filter mutation survived green at the route.

Here the scope node is an **estate** and `property.estate` is the **writing module's own table**. So `findEstateInScope` resolves and filters in one query:

```sql
SELECT estate_id, organization_id FROM estate
 WHERE estate_id = $1 AND estate_id = ANY($2::text[])
```

**That query is the decision, and nothing runs before it.** The authorizing-grant lookup that follows does not gate — it runs on an already-admitted estate purely to name the narrowest authority for the audit record.

**One deciding layer, deliberately.** I did not add a second filter to the INSERT. It would have been harmless, unprovable, and the same shadowing GEN-013 hit, inverted.

**The proof:**

```
M1  the in-query scope filter deleted    ✖ 3 tests, INCLUDING the route-level gate test
M3  the per-kind domain rule unreachable ✖ 1 test, precisely
```

M1 turning the **route** red is the whole point: on this surface the query is the gate, so an ordinary end-to-end test can see it. The contract says so explicitly, and says which layer decides on *each* write, because reading one operation's arrangement into the other would be reasoning about the wrong control.

**Two mutations that did NOT bite, reported rather than dressed up:**

- **M2 — the empty-scope early return removed: all 13 stayed green.** Correctly so: `= ANY('{}')` is already false for every row, so the guard changes no behaviour. It is documentation of intent, not a control, and my own comment says as much. A redundant check is a witness; it is not an oracle.
- **M4 — narrowest replaced by broadest: this suite stayed green**, because every grant that can admit an estate is at estate-or-above and my tie test uses two estate-level grants, so only the tie-break applies. Confirmed it still bites where depth is exercised: `occupancy-scope-write` ✖1 and `audited-scope-write` ✖2 under the same mutation. This surface cannot test the depth ordering, and saying so is better than implying it did.

## 3. Generalisation — the cleanest yet

**No new mechanism. No shared code widened.** GEN-013 had to widen `findAuthorizingGrant` from `estateId` to `{kind, id}`; this write consumed that generalisation unchanged, which is the first time a new write has cost the shared layer nothing.

**Shared, used as-is:** `auditedWrite`; `estateStaffGrants` → `scopeExpansion.expand`; `findAuthorizingGrant` at `{kind:'estate'}`; the audit record shape; property 4 inherited; `403`-absent-by-decision.

**This surface's own:** the vehicle and `property`'s estate-contact command; the contract operation, bump, stamp; two problem types; the domain precondition (one management office per estate, **per kind rather than blanket** — emergency and approved-service contacts are legitimately plural, and a blanket rule would have refused a legitimate act).

**A first assertion, cleanly:** `estate_contact` has many rows per estate, no status column, no effective dating. Nothing to supersede, so the supersession wall is not touched.

## 4. Two findings, both mine

**A GEN-013 contract edit was silently lost.** `info.summary` still read *"and the first scope-only write"* — GEN-013's change to it never landed, because that script asserted mid-way and aborted **before its single `write()`**, discarding edits that had already "succeeded" in memory. So GEN-013 shipped a stale summary and nothing noticed: the surface hash covers the file, but the *statement* was merely wrong, not inconsistent. Corrected here to *"the first three"*. **The lesson is about my tooling, not the contract:** a patch script that batches edits and writes once loses every earlier edit when a later anchor fails — and it reports the successes it printed. I have written all four edits in one guarded pass since.

**My teardown deleted seeded fixture data.** `DELETE … WHERE contact_id LIKE 'ctc_%'` also matched the seeds' `ctc_wfg_office`, `ctc_wfg_emergency`, `ctc_twc_office`. It surfaced as the 409 domain test failing to find a conflict that should have existed — **a fixture fault wearing the costume of a code fault**, which is the third time in this programme that a teardown problem has read as unrelated breakage. Narrowed to the UUID shape the route mints, seeds restored, and the reason recorded in the test file.

## 5. Weight — lighter, as predicted

- **9 files hand-edited** (3 `apps/api`, 3 `modules/property`, 2 contract, 1 test) plus 21 restamped.
- **One new module file**, ~115 lines. **No shared code touched.** No new primitive, migration, boundary work or precursor.
- **The write itself was mechanical.** The two findings above were fixture and tooling problems, not architecture — which is what "lighter" should look like. GEN-013 needed a design decision about which layer gates; this one inherited the answer and only had to say which case it was.

## 6. Gaps — this list is complete

1. **`estate_contact`'s membership in the 27 remains inferred**, not stated (Step 1 §3). Building it does not settle it.
2. **`estate_contact` has no `organization_id`.** Tenancy is reached through the estate, and the estate lookup is scope-filtered — so cross-organization isolation holds *because* the filter does. There is no test asserting a cross-organization estate is refused; the seeded world's other organization has no `estate_staff` principal in the caller's org to attempt it with.
3. **`sortOrder` is unconstrained** — any integer, no uniqueness, no meaning enforced.
4. **No idempotency.** A retry adds a second contact and a second audit row. Owed, third time.
5. **No fixture for the new operation** — contract exercised by integration tests, not fixture parity. Same as GEN-009 and GEN-013.
6. **The 409 rule lives in the route, not the database.** Two concurrent requests could both pass the count and both insert a management office; nothing in `estate_contact` prevents it. A partial unique index would, and I did not add one — it is a migration, and this PID may not originate schema.
7. **M2 and M4 are non-biting mutations** (§2), stated rather than hidden.

## 7. Rulings sought

1. **§6.6** — the one-management-office rule is advisory under concurrency. Follow-on migration, or accepted for now?
2. **§6.2** — should a cross-organization estate test be added, and does the seeded world need a second organization's staff principal to make it possible?
3. **§4** — the lost GEN-013 edit: anything to re-record against GEN-013, or is correcting it here enough?
4. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**

---

# Addendum — the one change made before merge

Ruled: the concurrency race must be disclosed **in the contract**, not only in this report.

`addEstateContact`'s description now states it, in the same form `recordOccupancy` states its deferred end path:

> **THE ONE-MANAGEMENT-OFFICE INVARIANT IS NOT YET DATABASE-ENFORCED.** It is applied in the write path as *count, then insert*, so two concurrent requests can both observe zero and both insert … The fix is a **partial unique index** on `(estate_id)` where `contact_kind = 'management_office'`, with the resulting unique violation mapped to the same `management-office-contact-exists` response, so the answer a client sees does not change when the enforcement moves. It is **bound to the idempotency decision** … and is deliberately not taken here: it is a migration, and this operation's PID may not originate schema.

No index and no migration were added. Re-verified after the change: **327** tests (105 + 222), 0 failures · boundaries `PASS` · battery **21/21** · validator PASS · index `--check` OK. Contract surface hash regenerated (`a149ef97cd3b947`, v0.4.0).
