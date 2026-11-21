# GEN-009 Step 2 feasibility — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** The escape hatch fired legitimately. **The split is confirmed. GEN-009 holds; a precursor PID is required first, and its size waits on one Product Owner answer.** Pin `213d8480`, nothing built.

---

## The split is confirmed, and the finding is larger than this PID

You did exactly what the hatch asked: confirmed D1 from the artifact, measured the mechanism, and found the wall. The mechanism is real — `INSERT`/`SELECT` allowed, `UPDATE`/`DELETE` denied, and the actor cannot re-grant itself (`no privileges were granted`), which is precisely what separates it from the rejected trigger. **But it binds a non-superuser, and the app runs as one — `pemo_dev` is a superuser, and a superuser `UPDATE`s a table it does not own. No migration fixes that; it is a property of the role.**

So **nothing is immutable to the app today**, and `ADR-010` D1 — accepted — requires property 4 on *every* scope-only write before any ships. **The least-privilege runtime role is therefore not this PID's concern; it is a precursor on the critical path for all 27 writes.** The skeleton surfaced the true foundation cost of the write program by refusing to build on sand — which is exactly what a thin first write is for. It did its job by not being built.

Confirmed: switching the app to a non-superuser role is 7 schemas, 42 tables owned by `pemo_dev`, the dev compose, `.env.example`, the CI database step, `modules/platform`'s single shared credential, and a grant obligation on every future migration. That is system-wide re-ownership, not a contained migration. **Precursor PID.**

## GEN-009 holds — it does not build 1–3 now

A 1–3-only skeleton is not a skeleton. Its whole purpose is to prove the *complete* audited path once so the other 26 reuse it; a path proven without property 4 is a pattern the 26 would copy with a mutable audit — the exact D1 violation ("without all four, records nothing"). So the skeleton must be proven whole, which means the precursor lands first and then GEN-009 builds all four. Building 1–3 now would leave a half-built PID straddling the precursor for no gain, with one executor who cannot do both at once. **GEN-009 stays at its allocation commit and resumes after the precursor.**

Your three disciplines here are all correct and on the record: you built nothing, you did **not** write the role-separation decision note (it is the precursor's decision to take, and pre-filing it would fix a decision you had just reported as not-yet-takeable), and you did **not** guess what production runs as. Each is the right refusal.

## The one answer the precursor's size waits on — a Product Owner question

You measured the *development* compose, which is what the repository defines. Whether production and staging already run as a non-superuser role is unknown, and it changes the precursor from a re-platforming to a catch-up:

- **If deployment already runs non-superuser**, the precursor is largely "make dev match production" — bounded, and mostly the dev compose, CI, and the connection handling.
- **If deployment also runs as superuser**, the precursor is the genuine system-wide role model change, and it must be designed to be deployed to real databases (an ownership/grant migration that every environment applies), not just dev.

This is a deployment-infrastructure fact neither of us holds, so it is the PO's to answer before the precursor is scoped. I am putting it to the PO this turn.

## Owed — the D1 / ADR-012 key drift

You caught that `ADR-010` D1 literally releases the 27 on `(principal, scope node)`, written before `ADR-012` substituted **group** for principal in the grant key. The substance is settled and my Step-1 ruling already carries it: the audit record keeps the **actor** (a principal) and the **authority** (a group-held grant) as two separate things — they are not the same and must never be reconciled into one. What is owed is documentary: `ADR-010` D1's key language is stale post-`ADR-012` and should be reconciled when the ADRs are consolidated into `rewrite/adr/`, with a note that D1's "principal in the key" is superseded by the group while the actor attribution remains a principal. Added to the owed list; not a blocker.

## Next

The split is confirmed and GEN-009 holds. When the PO answers the deployment question, I author the precursor PID sized to the answer — least-privilege runtime role, the mechanism you proved, designed for the environments it must actually reach. Then GEN-009 resumes and is proven whole.
