# Architecture Decision Records

ADR status: **Locked** means approved; **Proposed** means awaiting approval; **Unresolved** means intentionally undecided. Future ADRs record context, decision, alternatives, consequences and evidence. GEN-001-ST does not select a framework, cloud, broker, vendor or exact external payload.

## Every ADR carries a target location and a committing session

Two header fields are **mandatory**, and both exist because of a defect this directory actually had:

| Field | What it states |
|---|---|
| `**Target location:**` | The repository path this ADR belongs at. |
| `**Committing session:**` | The named session authorised to put it there. |

**Why.** `ADR-002`, `ADR-003` and `ADR-006` were all `Accepted` while absent from this directory. `ADR-002` and `ADR-003` named a committing session the write-scope map forbade, so no authorised route existed. `ADR-006` named none at all — and `GEN-012-ST` built its schema regardless, leaving the repository holding a schema shaped by a decision the repository did not record. Three accumulated before anyone noticed, and `docs/adr/` existing implies the ADRs are here.

**An ADR without a committer is a decision with nowhere to go.**

The fields were backfilled across all nine existing ADRs by `API-016-ST` rather than applied only to new ones. A rule that ships with standing exceptions does not read as a rule with exceptions — it reads as a suggestion, and the next author correctly infers that skipping the field is normal.

## Template

```markdown
# ADR-0NN — Short decision title

**Status:** `Proposed` | `Accepted` — who decided it, and when.
**Date:** YYYY-MM-DD
**Author:**
**Decision owner:**
**Target location:** `docs/adr/ADR-0NN-short-decision-title.md`
**Committing session:** the session authorised to commit it, and by which PID.
**Supersedes:** / **Amends:** where applicable.
**Related:** other ADRs this depends on or constrains.

## Context
## Decision
## Alternatives, with the reason each was rejected
## Consequences
## Open questions, deliberately not closed
```

## Amending an ADR

An ADR corrected by the PID that first applies it is **amended in place, with the amendment marked and dated**, naming the PID and the reason. Not a silent edit, and not a second ADR for the same question.

`ADR-008` and `ADR-009` both carry such amendments from `API-016-ST`, their first application: `ADR-009`'s registry path moved up one level once `ADR-007` `D2` decided separate packages with shared vocabulary, and `ADR-008`'s content hash was found to be circular — it covered the file that stores it.

**The test for whether a decision is written down completely** is not whether its author could implement it. It is whether an independent reader, reaching only for the text, arrives at the same artifact.

## Numbering

Sequential, never reused. Numbers are allocated in `PID-INDEX.md`, which is authoritative — an ADR may be allocated a number before it is written, and reserved numbers are recorded there.
