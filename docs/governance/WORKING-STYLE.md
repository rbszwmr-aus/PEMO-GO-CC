# Working style — routing, supersession, and what a session actually holds

Companion to `PID-PRINCIPLES.md`. The principles are about *proving*; this file is about
*getting the right artifact to the right session, and not building on a state nobody
established*. Append-only; an entry arrives only with the incident that earned it.

Every item below was caught by an executor session rather than by the Brain. That is the
direction this class of failure travels: the party holding the wrong model is not the party
who notices.

## A — Supersession is per document, never per directory

> **A document is superseded at its staging location the moment it is carried into the
> register, regardless of which folder it sits in. Carried implies superseded.** A
> directory-scoped banner cannot see a file one level above it that has already been carried.

**Incident.** When the register moved into the repository, a `SUPERSEDED` banner was placed on
`rewrite/governance/` — deliberately scoped, because only that folder had moved.
`00-START-HERE.md` sits at `rewrite/`, one level *above* `governance/`, and had also been
carried. So it was in the register **and** un-bannered at its staging location. It was then
amended on the drive, and the register went on serving the older text: five of the eight global
rules diverged, with the repository — the copy the read order points at — holding the stale one.
The scoping was careful, and the carefulness is what opened the hole.

**Applied:** banner the document at the moment of carry, wherever it sits.

## B — Executor sessions do not have uniform reach

> **Some hold the repository, some hold a local drive path, and at least one holds only its own
> project sandbox with no external path under any scope. Before routing an artifact to a
> session, establish that session's reach by asking it to enumerate — never by assuming.**

Two topology failures occurred in one day and their mechanisms differ:

1. **Reach assumed uniform when it is not.** An artifact was filed and its path relayed to a
   session with no way to reach that path. Filing and notifying are two acts.
2. **Two distinct sessions addressed as one**, because they shared a role name and the role was
   used as the address. The path was reachable and the artifact was read — by the wrong session.

`PID-PRINCIPLES`' *a role name is not an identity* catches the second. **Only this note catches
the first**, because in that case the addressing was correct and the reach was not.

## C — Rule 3 generalises beyond repositories

> Global rule 3 says a PID must not assert repository state — it must **name it to be verified**.
> The same holds for **any** state an instruction depends on, including what a session holds.

**Incident.** An instruction was issued whose premise was that a session held six artifacts. The
premise would only have become true after an upload that had not been requested. The receiving
session refused it, correctly.

**Do not build an instruction on a state you have not established.** The refusal is the correct
response, not an obstruction — and the cost of checking the premise is always lower than the cost
of work built on a false one.

## Consequences for routing

- Ask a new session to **enumerate what it can reach** before its first task, and record it.
- A session that cannot reach the authority store holds a **mirror**, and mirrors are
  append-only: a delivered artifact is never edited in place; a change is a new artifact with a
  new name.
- When an artifact is carried into the register, banner the source **in the same act**. A carry
  that leaves the source live has created a second home — the defect the register exists to
  remove.
- Before requiring a protocol of a session, name the disaster it prevents **for that session**
  (`PID-PRINCIPLES`: *this rulebook has a scope*). A design hand that never merges does not need
  the merge discipline.
