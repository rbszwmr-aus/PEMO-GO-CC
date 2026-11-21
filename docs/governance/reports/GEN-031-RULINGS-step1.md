# GEN-031 (W3 batch 3b) — Step 1 rulings

Date: 2026-09-01
Report: rewrite/reports/GEN-031-step1.md — read-only, HARD STOP. Pin 6f87b264.

## Five ruled. §1's backfill is not a fresh PO decision — it is ADR-016 applied, so I rule it.

---

## R1 — §1 backfill: NULLABLE + discriminator + biconditional. `seed:<id>` is the fiction ADR-016 forbids.

You framed this as the PO's, but it is **determined by the ADR just accepted**, so it is mine to
apply: ADR-016 D1 says a `staff_principal` is a **recorded** external identity, **never minted**.
`seed:<principal_id>` under `NOT NULL` is precisely a **minted fiction** — a value no authenticator
will ever produce, sitting in the column that means *the person's id in the external authenticator*.
The corpus already forbids it (`[unrepresentable-over-forbidden]`; a fiction is worse than a null
because a null is legible). So: **nullable `external_id` + a discriminator + a biconditional**
(external_id present **iff** the identity is externally sourced), the `resident.party` shape — a
seeded principal that predates any external authentication **has** no external_id, and the schema
must be able to say so honestly. Prove the biconditional both ways.

**Uniqueness PER ORGANIZATION.** Your reasoning is decisive: a person may work for two organizations,
and a **global** unique on `external_id` would let one tenant probe whether a person exists in
another — a cross-tenant existence leak, and ADR-007 makes that boundary absolute. If the current
`staff_principal` shape does not carry an organization (so per-org uniqueness is non-trivial), **STOP
at build-start and report** — do not assume the scoping.

## R2 — §2 sequencing: the zero-grants-ever predicate is evaluated FIRST, before any of the four writes.
Fail-fast, and it makes the intent explicit rather than resting the whole invariant on rollback.
`committed:false` rolling the transaction back is the **backstop**, not the primary guarantee — a
belt-and-suspenders you correctly want both halves of. Accepted.

## R3 — §3 the `provision` contract break: it IS breaking, version it as such; ADR-008's table has a gap I am closing.

`groupId` leaving `ProvisionRequest` while identity fields arrive is a **breaking request-shape
change** — a client sending the old shape, or not sending the new required fields, fails. ADR-008's
table calls a new required field *minor* and is **silent on removal**; that silence is a gap, not a
licence. Ruling: **removing a required request field is breaking** — version it at ADR-008's breaking
tier, and state the change in the contract. No client ships, so it is safe in practice, but **the
version must tell the truth.** Refusing to invent the rule yourself was right; the rule is now ruled,
and **ADR-008 gets an amendment** (owed) listing field removal as breaking so the next one is not
re-litigated.

## R4 — §4 split: THREE batches, accepted, and the seam is right.
Your seam beats my two-batch prior: **(i) schema + `registerPrincipal`** isolated (the backfill is a
decision and a migration that reds must not tangle with a surface); **(ii) bootstrap** with its
contract break visible in its own diff; **(iii) membership routes** separate — *because that is the
diff that actually removes the DBA for the common case and it must not be gated behind the identity
backfill ruling.* Do not fold (i) into either (a red would become ambiguous); (ii)+(iii) may merge if
you want fewer.

**Dependency, ruled:** (i) → (ii) [bootstrap needs `registerPrincipal`]; **(iii) depends on neither**
— it makes 3a's shipped commands reachable and is blocked on nothing. So (i) and (iii) are both
unblocked now; (ii) waits on (i). Sequence them i → ii → iii, or lead with iii if you want the
DBA-for-membership gone first — your call on the independent one; the i→ii order is fixed.

## R5 — The grep-cluster is now urgent, not owed-someday.
`[anchor-the-discriminator]` bit a **third** consecutive PID (a char class excluding uppercase
truncated `:grantId`/`:organizationId`). Three-in-three is the signal: the cluster
(LIKE-`_`/`%`-escape sweep, fixtures `ON CONFLICT`, derive-refusing-commands-from-types,
`with-mutation.sh`) gets its **own governance PID immediately after W3**, before notices/cases —
these are all one disease (*a rule whose membership is grepped by hand is a suggestion*), and it is
now taxing the executor's own searches every PID.

## Dispatch: GEN-031 → Step 2 = batch (i) — schema + registerPrincipal — with the R1 shape. (ii), (iii) are new PIDs.
- Schema: `external_id` nullable + discriminator + biconditional; **per-org uniqueness** (STOP if the
  table is not org-scoped).
- `registerPrincipal`: records `(external_id, display_name)`; **no credential column, ever**; audited
  (source follows the caller). **Report, do not assume:** whether standalone registration (onboarding
  the 2nd+ staff member) requires authority, and what — that gates a *route* (iii), not the recording
  primitive; flag it for my ruling when the route is wired, do not build an authorization guess into
  the primitive.

## Owed ledger — additions
- ADR-008 amendment: field removal is breaking (R3).
- The grep-cluster governance PID — **first thing after W3** (R5).
- Standalone-registration authorization — ruled when iii wires the route.
