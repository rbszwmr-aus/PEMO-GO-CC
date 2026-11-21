# ADR-012 — User groups, and the scope tree as a delegation surface

**Status:** **`Accepted`** — accepted by the Product Owner 2026-08-28 (see `ADR-012-ACCEPTANCE-product-owner.md`). `Proposed` — `v1.1`. `D1`–`D9` taken 2026-08-20 on Product Owner rulings; `D2`/`D4`/`D5` corrected the same day, each by the Product Owner. **One open question remains: group nesting.**
**Date:** 2026-08-20
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-012-user-groups-and-the-delegated-scope-tree.md`
**Committing session:** `PEMO Contract`
**Amends:** `ADR-007` `A2` (clarifies); `ADR-010` `D3` and `D4` (changes the exclusion key).
**Gates:** `WEB-15` grant administration · every write surface · the `getScope` and `getPropertyTree` fixture regeneration.
**Related:** `ADR-002`, `ADR-003`, `ADR-007` (`A2`, `A3`, `D4`), `ADR-010` (`D1`–`D6`), `ADR-011`, `GEN-018-ST`.

---

## Why this exists

Two questions were being asked as one, and only one of them was real.

**The unreal one:** *"which Locations appear in the scope navigator?"* — asked as a global filter, with three candidate rules. **The Product Owner rejected the framing on 2026-08-20**, and was right: grantability is not a property of a Location. **It is a property of the grant chain that reaches it.**

**The real one:** *"the core value of PEMO"* — the Product Owner's words — **user groups**, which the model does not have.

---

## Decisions

### D1 — Every hierarchy node and every Location is a scope node. The navigator renders the viewer's own scope.

**Confirmed 2026-08-20:** *"你揸住咩就見到咩,而你揸住咩係委派出嚟嘅."*

There is no class filter. A system administrator holding the estate grants **會所** to 黃主任; 黃主任 grants the **gym** to a gym group; 李小姐 is in that group. **That chain is `ADR-010` `D3` `G-2` already in force** — *a principal may create a scope grant only within a node they already hold* — and it needed no new mechanism, only the recognition that it was the answer.

**`ADR-007` `A2` had already ruled out all three candidate filters and nobody noticed.** Its worked example is *"a principal who works the counter"* — a Location that is not a clubhouse, not a container, and not estate-serving. **A decision already taken can be re-opened by asking the question in a different vocabulary**, and the register should treat a "new" question that an existing ADR's example already answers as a signal that the vocabulary drifted, not that the question is open.

**Consequence, immediate:** `getScope`'s `default.json` is an **estate grant** and therefore must show **every Location under the estate**. It shows one of eight. **It is a confirmed defect**, the same one already ruled for `getPropertyTree`'s `tree.json`, and **one Contract regeneration carries both.** `GEN-018-ST`'s *"underdetermined location rule"* was never underdetermined; the fixture was under-inclusive.

### D2 — A grant is held by a **group**, always. Groups are core, not an optimisation.

`ADR-010` `D4` built `access.scope_grant` as `(principal, role, node_kind, node_id)` — **a grant names a person.**

**A group holds the grant, and members inherit it.** Grant once to a group; change membership without re-granting. At an estate with staff turnover this is the difference between an administration surface people maintain and one that decays into everyone holding everything — **which `ADR-010` `D2` already named as the too-many failure arriving slowly and with paperwork asserting otherwise.**

**Groups-only, confirmed 2026-08-20. There are no direct grants to a principal.** A one-off permission for one person means **a group of one**, and the Product Owner accepted that cost explicitly when it was named.

**And this makes the migration SMALLER, not larger — which is the opposite of what I expected when I drafted it.** A model permitting *principal or group* needs a polymorphic subject: a type discriminator, a branch at every resolution point, and a foreign key that points at one of two tables. **Groups-only needs none of it.** The key stays a plain four-tuple over one kind of subject, and *"is this a principal or a group?"* is a question no code ever asks. **The simpler model was also the one that removed a branch from every query.**

### D3 — The group holds the role, not the member.

A grant is `(group, role, node)`, and every member holds that role at that node for as long as they are a member.

**The alternative — a group that bundles only people, with roles still assigned per person — was available and is rejected**, because it removes the operational value entirely: you would still be making one grant per person per role, with the group as decoration.

### D4 — The exclusion key becomes `(group, role, node_kind, node_id)`, and the migration is a prerequisite, not a convenience.

`ADR-010` `D4` set the key as `(principal, role, node_kind, node_id)` with a half-open `tstzrange`, and warned: *a semantic migration over an effective-dated table with a live constraint … **the trigger is the first production deployment, not the first convenient moment.***

**`D2` changes that trigger.** `WEB-15` grant administration is among the **first write surfaces released** by `ADR-010-AMENDMENT`, and building it against a principal-keyed table means building the administration surface for the wrong model. **So the migration moves ahead of the first write, not merely ahead of the first deployment.**

**It is a substitution, not a widening:** `principal` leaves the key and `group` takes its place, with membership as a separate effective-dated relationship. **No column is polymorphic and no row is ambiguous.**

### D5 — Rights are the union of a principal's groups. This is correct, and what I first called a defect is a display requirement.

**Corrected 2026-08-20, and the correction is the Product Owner's.**

**My first draft said:** removing 李小姐 from a group *"appears to revoke her access, and does not"*, framed as a security consequence of the model.

**The Product Owner disagreed and is right:** *"if 李小姐 is kicked out of the group she certainly does not have the rights of that group — unless she still belongs to another group, because one user can belong to multiple groups and the rights are the total of the two."*

**That is the standard union-of-groups model and there is nothing wrong with it.** Remove a member from a group and she loses **exactly that group's** grants. If another group still grants the same role at the same node, she keeps it **through that group** — which is not a leak, it is the union working as specified.

**What survives is smaller and is not a modelling defect.** An operator who removes 李小姐 from `gym-group` intending to revoke her gym access, while `clubhouse-group` also grants it, **has not achieved their intent** — and nothing on the screen tells them.

> **So the requirement is on the administration surface, not on the model: show a principal's EFFECTIVE rights and the group each one comes from.**

Then removing her from one group visibly leaves the other, and the operator sees the remaining path **before** acting rather than discovering it afterwards.

**And I should record what I got wrong, because it is the same fault twice in two days.** I described a display gap as a security hole — *overstating a hazard is the same fault as understating one, and both are assertions made without checking.* The register already carries that sentence from the `GEN-005-SG` withdrawal. **This is its second instance and the first where the Product Owner caught it rather than a session.**

### D6 — Membership is effective-dated, and the historical question resolves through **both** relationships.

`ADR-007` `D4` requires *what was this person permitted to see **then***. With groups, that answer depends on the grant **and** the membership as they each stood at that instant.

**A system that resolves the grant historically and the membership currently is worse than one that does neither**, because it produces a confident answer that is wrong only for people whose membership has changed — the exact population an incident review is about.

### D7 — Groups are Organization-scoped. Cross-organization isolation is absolute and is not a role.

`GEN-018-ST` states it for principals and it extends unchanged. **A group never spans Organizations**, and the same real-world team operating two Organizations is two groups — the same shape `ADR-011` `D3` gives a party.

### D8 — Groups carry scope. They do not carry tiers.

`ADR-010` `D5` is untouched: **`ADR-007` `D3`'s tiers decide what a surface may show; roles and scope decide what a principal may do; neither mechanism reads the other.** A group is a way to **hold** grants. **It is not a way to change what a surface contains**, and a group named `integration-support` must not become a tier check by the back door — the trap `D5` was written to name.

### D9 — The car park node is named `車場`. The authority is legible from the functions inside it.

**The Master Brain proposed renaming the node to describe what it grants — *空間配置 / Space allocation* — so nobody would expect gate, tariff or occupancy authority. The Product Owner rejected it, and the rejection is right.**

**A node named for its grant is a place named after a screen.** Add a second function to the car park later and the name is wrong again. Worse: **it makes the scope tree a list of capabilities**, which is `ADR-010` `D5`'s role/scope conflation arriving in a different guise — the tree says **where**, never **what**.

> **Name the place for the place. Let the absence of functions state the boundary.**

A user opens `車場` and finds exactly one function — **車位及儲物室配置**. No gate, no tariff, no live occupancy. **The absent capabilities are the boundary, stated more clearly by their absence than any label could.**

**And parking and storage are two `unit_class` values, not one list** — 236 and 41 in the seeded world. The display string is **derived from `unit_class`**, per the precedent `API-020-ST` set when it structured the counts rather than carrying a scalar.

---

## What this does not decide

**Group nesting.** May a group contain a group? **[my view] no, for now.** Nesting makes `D6`'s historical question materially harder — the answer must walk a graph as it stood at a past instant — and nobody has asked for it. **Cheap to add later, expensive to remove**, which is the direction this project prefers.

**~~Whether a principal may hold a direct grant.~~ CLOSED 2026-08-20: groups-only.** The cost was named — *a one-off permission for one person requires a group of one* — and the Product Owner accepted it. Folded into `D2`.

**The administration surface itself** — `WEB-15` — which `ADR-010` `D3` established is PEMO's to build.

---

## Consequences

**Released.** The `getScope` and `getPropertyTree` fixture regeneration, together, with a stated rule rather than a curve fit. The scope navigator becomes specifiable: it renders the viewer's scope, and grantability is delegated.

**Required, before the first write ships.**

- **`D4`'s migration** — subject in the exclusion key, ahead of `WEB-15` rather than ahead of the first deployment.
- **`D5`'s multi-path revocation check**, on the revocation surface, before it exists rather than after somebody is removed from a group and keeps their access.
- **`D6`'s two-relationship historical resolution**, proven in both directions as `GEN-018-ST` proved effective dating for grants — *the two answers must differ, or the historical arm is untested.*

**Still open.** Group nesting. Direct-grant permissibility. And `ADR-011`'s `authorized representative`, which is a different relationship and must not be absorbed into groups because it looks adjacent — **a representative acts for a party; a group holds permissions. Neither is the other.**

## Decision record

```text
Scope nodes:        every hierarchy node and every Location; the
                    navigator renders the viewer's own scope        — decided 2026-08-20
                    getScope default.json and getPropertyTree
                    tree.json are both confirmed defects
Groups:             core, and GROUPS-ONLY — no direct grants; a
                    one-off permission is a group of one; the GROUP
                    holds the role                                  — decided 2026-08-20
Exclusion key:      (group, role, node_kind, node_id) — a SUBSTITUTION,
                    not a widening; no polymorphic subject; migration
                    moves ahead of the first WRITE                  — decided 2026-08-20
Rights:             the UNION of a principal's groups — correct as
                    designed; the requirement is that the admin surface
                    SHOW effective rights and their source group     — corrected 2026-08-20
Membership:         effective-dated; the historical question
                    resolves through grant AND membership           — decided 2026-08-20
Isolation:          groups are Organization-scoped, absolutely      — decided 2026-08-20
Tiers:              groups carry scope, never tiers (ADR-010 D5)    — decided 2026-08-20
Car park node:      named 車場; authority legible from the one
                    function inside it, 車位及儲物室配置             — decided 2026-08-20
Group nesting:      open — [my view] no, for now
```
