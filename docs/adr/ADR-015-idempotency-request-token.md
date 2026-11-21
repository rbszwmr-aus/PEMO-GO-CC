# ADR-015 — Idempotency: the request-identity half

**Status:** `Accepted` — `v1.1`. Accepted by the Product Owner 2026-08-31 with **`D1`
amended** on their direction (see `ADR-014-015-ACCEPTANCE-and-amendment.md`). `D2`–`D6` stand as
proposed.
**Carried in by:** `GEN-023`.
**Date:** 2026-08-31
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-015-idempotency-request-token.md`
**Related:** `ADR-013` `D6` (which split the halves), `D2` (`UNIQUE(instance, version)`), `D5` +
corollary C3 (the advisory-lock cardinality guard) · GEN-014 (the one-office race) · GEN-016 (the
state-identity half, built and proven).
**Gates:** reliance on every write already landed.

---

## The problem

`ADR-013` `D6` split idempotency into two halves and built one. The **state-identity** half is done and
proven: `UNIQUE(instance, version)` holds within-instance supersession, a per-key advisory lock holds
cross-instance cardinality, and a constraint violation maps to the winning act's truthful client
response rather than a server fault.

The **request-identity** half is missing. A retried request — a double-click, a client timeout and
retry, a flaky network — still writes the act **and its audit row** twice. Two identical audit entries
for one intent is a false record by duplication, and the audit is immutable, so it cannot be tidied
afterwards. No production exists, so nothing is harmed today; but nothing may be **relied upon** until
this closes.

---

## Decisions

### D1 (amended v1.1) — Every write operation **declares its idempotency stance**.

> **Amended 2026-08-31 by the Product Owner.** The originally proposed D1 — *"a client-supplied key,
> **required on every write**"* — was declined as a blanket rule. The text below replaces it in full.
> The superseded wording is preserved in the Decision record at the foot of this document.

Every write in PEMO is an append and therefore not naturally idempotent. Its stance is **stated in the
operation's contract**, as exactly one of:

- **`client-key`** — a client-supplied idempotency key. The default for user-facing writes.
- **`derived-key`** — the key is derived from the act's own originating event (an inbound integration
  message id; the Organization-creation provisioning event). For system-originated acts where no
  client exists to supply one.
- **`exempt`** — permitted, with a **stated reason** in the contract.

**A write operation that declares nothing is refused by a check.**

**What this relaxes:** no write is forced to invent a client key where none naturally exists, and a
deliberate exemption is available.

**What it preserves, and why it is not simply optional:** *forgetting becomes impossible.* An
undeclared operation reds; it does not sail through unnoticed. This corpus has recorded the opt-in
failure shape repeatedly — the ADR header field that could not notice a missing file, the opt-in
teardown prefix, the advisory lock a new command could bypass — and this amendment keeps the
flexibility the Product Owner asked for without reproducing it.

### D2 — The key is recorded **in the same transaction as the act**, by the audited-write primitive.

Act + `audit_event` + key, one transaction, atomically — the primitive's existing guarantee extended
by one row. **A key that could be written separately from its act is not a key**: a crash between the
two leaves an act whose retry duplicates it, which is precisely the failure being closed.

### D3 — Uniqueness is `(principal, operation, key)`.

Scoped so one caller's key cannot collide with another's, and so the same key on a different operation
is a different request. Enforced by a unique constraint — the same instrument as `ADR-013` `D2`, for
the same reason: the invariant lives at the layer that can hold it.

### D4 — A repeat **re-derives** the original response by reading the act it produced. No response blob is stored.

The key record holds the key and **the identity of the act it produced**, not a serialised response.
On a repeat, the response is produced by reading that act — so the answer is **current truth, never a
stale snapshot**, no payload (and no personal data) is stored a second time, and the table stays
narrow. This is available because every PEMO write produces an identifiable row; where a future write
does not, that is a finding to raise, not a reason to store blobs.

### D5 — The same key with a **different** act is **refused** — never silently answered with the first response.

Answering a changed request with the earlier response would mask a client bug and could hide a lost
write. A key asserts *"this is the same request"*; when that assertion is false, the honest answer is
a refusal.

### D6 — Keys are **retained**. Pruning is an owner-level maintenance act, never a runtime delete.

`pemo_app` is `SELECT`+`INSERT`; a runtime delete path would breach the append-only floor everything
else inherits its guarantees from. Keys accumulate; at this scale that is fine. If volume ever
warrants pruning, it is specified then as a `pemo_owner` maintenance operation — the floor is not
weakened to make room for housekeeping.

---

## How the two halves compose

- The **token** (this ADR) resolves *the same request arriving twice*.
- The **state guards** (`ADR-013` `D2`/`D5`) resolve *two different requests conflicting over one
  piece of state*.

Neither substitutes for the other, and both map their outcome to the client's truthful answer. Two
staff recording the same resident into the same unit are two distinct intents that no request identity
relates — that is the guard's job; one staff member double-clicking is one intent — that is the
token's.

## Consequences
- A new platform table for keys; a new migration; the audited-write primitive extended by one row
  inside its existing transaction.
- Every write contract declares the key; every client sends one. A write without a key is refused.
- GEN-014's one-office race and GEN-016's concurrent-create case keep their existing state guards —
  this adds the retry half, it does not replace them.

## Decision record

```text
Mechanism:        every write DECLARES its stance — client-key / derived-key /
                  exempt (with a stated reason); an UNDECLARED operation is
                  refused by a check                                           — amended, accepted 2026-08-31
                  [superseded: a client-supplied key REQUIRED on every write    — proposed 2026-08-31]
Atomicity:        written in the same transaction as act + audit, by the
                  audited-write primitive                                      — proposed 2026-08-31
Uniqueness:       (principal, operation, key), enforced by constraint          — proposed 2026-08-31
Repeat:           re-derive the response by reading the act; store the act's
                  identity, never a response blob                              — proposed 2026-08-31
Same key,
different act:    refused, never answered with the earlier response            — proposed 2026-08-31
Retention:        keys retained; pruning is an owner maintenance act, never
                  a runtime delete (the append-only floor stands)              — proposed 2026-08-31
```
