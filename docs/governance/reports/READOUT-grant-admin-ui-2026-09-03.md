# READOUT — grant administration, UI track

**Date:** 2026-09-03 · **From:** UI / management-web session · **To:** Product Owner
**A report, not a PID.** No register entry, no ruling, no PID allocated. Read-only: no file created
or modified except this one; nothing built, no suite run, no database touched.

**Pin.** `origin/main` = `75d92fe`, read via `git ls-remote` at the start of this readout.
Contract `management-web` **2.0.0** — `GEN-047` has not landed, so `2.1.0` and `canPerform` do not
exist yet and everything below is measured against 2.0.0.

**Verification you asked for: UI-004 reads `superseded` on `main`.** `archive/UI-004.md` carries
`status: superseded`, `closed: 2026-09-02`; the archive row shows `superseded`; and
`pid-index.mjs` now has `STATUSES = ['draft','running','done','merged','superseded']` with
`CLOSED_STATUSES` including it. `GEN-046` G7 landed as described.

---

## 1. Every operation that reads grant-administration state

**There is one, and it answers a different question from the slice.**

| operation | verb | reads | shape | fixture | wired |
|---|---|---|---|---|---|
| `getScope` | GET `/scope` | **the caller's own** scope grants + the node subtree they may address | `ScopeTreeResponse { meta, grants: ScopeRef[], nodes: ScopeTreeNode[] }` | **yes** — `scope/default.json`, `scope/portfolio-grant.json` | **yes** — sidebar on every screen; live-wired behind `?source=live` |

That is the complete list. The other six grant-administration operations are **all POSTs**:
`conferGrant`, `revokeGrant`, `addMembership`, `removeMembership`, `provisionOrganization`,
`registerPrincipal`. None has a read counterpart, none has a fixture, none is referenced anywhere in
`apps/management-web/src`.

**`getScope` cannot stand in for a grant-administration read, and the distinction is the whole
problem.** It returns *my* grants. A grant-admin screen asks *who holds grants here* — a different
set, over a different subject, with a different authorization rule. Reusing this payload to answer
that question would render the wrong set while looking correct, which is the failure mode the
`NoticeRow` / `lifecycleState` split in `UI-045` was kept apart to avoid.

**What `grants` actually carries — computed from the schema and confirmed against the fixture:**

```json
"grants": [ { "kind": "estate", "id": "est_wing_fu_garden", "label": { "en": "…", "zh-Hant": "…" } } ]
```

A bare `ScopeRef`: `kind`, `id`, `label`. **No `grantId`, no role, no holding group, no holder, no
`effectiveFrom`/`effectiveTo`, no conferring act.**

**The identifiers exist only on the way out of a write.** `grantId`, `groupId`, `membershipId` and
`principalId` appear in the contract in exactly three places: path parameters, request bodies, and
the **act responses** `GrantResponse` / `MembershipResponse` / `PrincipalResponse` (each carrying
`meta` and `replayed`, so each is a POST result). **No GET response anywhere in the contract returns
one.**

The consequence is sharper than "the reads are thin":

> **`revokeGrant` takes a `grantId` that nothing the client can read ever returns.** A grant is
> revocable only by a caller who already performed the confer in the same session and kept the
> response. The same holds for `removeMembership` and its `membershipId`.

---

## 2. What a reads-only grant-admin slice needs and the contract does not carry

Numbered `GA-` to keep them apart from `UI-045` §G's `G1–G7`, which are already routed to `GEN-047`.

| # | Finding |
|---|---|
| **GA-1** | **No operation lists grants at a node.** The slice's first screen has no source at all. Needs a `GET /nodes/{nodeKind}/{nodeId}/grants` (or `GET /grants?nodeId=`) returning, per grant: `grantId`, `role`, the holding `groupId`, the node, `version`, `effectiveFrom`/`effectiveTo`. Read must be **inclusive over the caller's scope** the way `listNotices` is, or a building manager cannot see the estate-wide grant that governs them. |
| **GA-2** | **No operation reads a group or its members.** `addMembership`/`removeMembership` exist; nothing lists what a group is or who is in it. Needs a group read carrying `groupId`, a label, and members as `{ membershipId, principalId, displayName, effectiveFrom, effectiveTo }`. |
| **GA-3** | **No operation returns effective administrators — but the query already exists.** `modules/access/src/repository/effective-administrators.ts` returns `AdministratorWitness { principalId, grantId, groupIdOfGrant, membershipId }`. It has no contract operation and no route. **It is also scoped to an ORGANIZATION**, while the slice asks for effective administrators *for a node* — a different question, not a rename. Whether the node form is derivable from the organization form is a backend judgement, not a UI one. |
| **GA-4** | **No READ returns a human name.** `displayName` is in the contract three times — the `registerPrincipal` and `provisionOrganization` requests, and the `PrincipalResponse` act result — and in no GET. `AdministratorWitness` carries ids only. So a name is knowable at the moment you create a principal and never afterwards, and a grant-admin screen would render columns of `principalId` to the person deciding whether to revoke something. Needs `displayName` on whatever principal a read returns. |
| **GA-5** | **No fixture exists for any of this.** The frozen corpus has the two `scope/*` fixtures and nothing else; no fixture carries a `grantId`, `groupId`, `membershipId` or `principalId`. This is `UI-045` `G1` again, one slice later — and `GEN-047` is already adding fixture parity for `GEN-042`'s operations, so the same instruction should cover the grant-administration reads when they are contracted. |
| **GA-6** | **The audit facts a revoke decision rests on are unreadable.** `ADR-014` requires a `reasonCode` per act and `ADR-013` makes every grant an append-only assertion chain, so "who conferred this, when, and why" is recorded — and no read exposes it. Without it the screen can show *that* a grant exists but nothing about how it came to. A grant history read is the analogue of `getNotice`'s `history`, which `UI-045` already renders. |
| **GA-7** | **`revokeGrant`'s two refusal states have no read-side signal.** The contract refuses `409` for the last live `grant_administrator` in an organization, and `409` for an already-non-live grant. A staff member should learn *before* pressing that this grant is the last way in. `wouldRemoveLastAdministrator` exists in the module; nothing surfaces it. Absent that, the UI can only show the refusal after the fact. |
| **GA-8** | **Scope kind coverage.** `ScopeRef.kind` spans `organization … unit` plus `ADR-003` Locations, and `conferGrant`'s request takes `nodeKind`/`nodeId`. If grants may be conferred at a Location as well as a hierarchy node, the node picker must offer both; if not, the contract should say which kinds are grantable rather than leaving the UI to infer it from an enum that exists for a different purpose. |

---

## 3. Permitted actions — confirming the shape, so `GEN-047`'s `canPerform` is reused, not re-invented

**Confirmed: the six grant-administration POSTs need exactly the same affordance, for exactly the
same reason.** The client has no role concept and, per `UI-004`'s overview ruling, must not acquire
one; `UI-045` already ships a guard asserting no code path branches on a role name, and a second
asserting no control bears the name of a deferred act. Part 2 adds controls **only** behind a
server-stated permission, and grant administration must bind to the same thing.

**But a notice-shaped `canPerform` will not cover four of the six, and this is the one design point
worth settling before `GEN-047` freezes.**

Every notices act operates on an **existing notice**, so a `canPerform` hanging off `getNotice`
covers all eight. Grant administration splits in two:

| act | authorized against | a resource-hung `canPerform` covers it? |
|---|---|---|
| `revokeGrant` | an existing grant | **yes** — hangs off the grant row |
| `removeMembership` | an existing membership | **yes** — hangs off the membership row |
| `conferGrant` | a **node** + role — nothing exists yet | **no** |
| `addMembership` | a **group** — nothing exists yet | **no** |
| `provisionOrganization` | an **organization** | **no** |
| `registerPrincipal` | an **organization** | **no** |

Four of six are **creations**, authorized against a container rather than an object. If `canPerform`
is designed as "fields on the resource you just read", grants will need a second mechanism — which is
precisely the re-invention this readout is meant to prevent.

**The shape I would bind to, and would ask `GEN-047` to freeze:**

```yaml
canPerform:
  type: array
  items:
    type: object
    required: [operationId, allowed]
    properties:
      operationId: { type: string }        # the contract's OWN operationId
      allowed:     { type: boolean }
      reason:      { type: string, nullable: true }   # machine-readable code, never prose, never a role name
```

carried **on whatever a read returns that an act can be aimed at** — the notice, the grant row, the
membership row, *and* the container: `ScopeTreeNode` for node-scoped creations, a group for
`addMembership`. Same array, same three fields, wherever an act can be aimed.

Four properties make it reusable verbatim, and each is load-bearing:

1. **Keyed by `operationId`,** the contract's own vocabulary. The UI binds a control to an
   `operationId` and to nothing else, so a widened act list is a contract change the client picks up
   rather than a hand-kept table that goes stale — `UI-024`'s rule, derive the values, not the binding.
2. **`allowed` is a boolean the server computed**, stated by `ADR-019`'s own logic as a dry-run of the
   act's `RoleScope` check (`modules/access/src/authority/role-scope.ts`,
   `administration-floor.ts`), **never a parallel hand list** — a second implementation of a floor is
   a second thing to get wrong, and the two would diverge silently.
3. **`reason` is a code, not a sentence.** Prose cannot be branched on and would be rendered
   untranslated; a role name would smuggle the role concept back into the client through the one door
   `UI-004`'s ruling closed.
4. **It hangs off containers as well as objects,** so creations are expressible. Without this, four of
   six grant acts have nowhere to attach.

**What the UI does with it, so the contract knows what it is promising:** a control renders **iff**
`canPerform` names its `operationId` with `allowed: true`. Absent means absent — no disabled control,
no greyed button. `UI-045`'s state-matrix guard currently asserts that *no* control in `main` bears a
deferred act's name; part 2 relaxes that to "no control bears an act's name **unless** the payload
permits it", and the relaxation is the conscious act the guard was written to force.

---

## 4. What a grant-admin slice builds on — and where it collides

**Builds on, and should not rebuild:**

- **The scope tree is already the node picker.** `getScope` returns `ScopeTreeNode { node, parent,
  label, depth, attention }`, and `apps/management-web/src/screens/tree-collapse.ts` already provides
  `nodeKey`, `parentKey`, `indexByKey`, `withChildren`, `visibleNodes`, `expandAll`, `collapseAll`,
  `toggleExpanded` — nested preorder from `055`, expand/collapse from `057` (which closed `B12`).
  "Choose a node, then act at it" is the shape the S3 tree already has.
- **The live seam exists.** `LiveManagementClient` wires `getScope` and `getPropertyTree`; a grant
  read is a third method on the same class, with the same problem-state handling and the same rule
  that a missing token produces the server's real 401 rather than a fabricated tree.
- **The state and claim machinery.** Four states per screen, the `no-fixture` stated-gap pattern with
  a bilingual reason, the data-claim register, the mutation harness under the stricter bite criterion
  `GEN-046` adopted. A grant slice adds screens to `SCREENS`, not machinery.

**Collides — three, and the first is the one to decide before the brief:**

- **The word "grants" already means something else on screen.** The shell's sidebar renders
  `Your scope grants` with the note *"The server filters every list to the scopes granted here."* A
  grant-administration screen shows **other people's** grants at a node. Two different sets under one
  word, on the same page, one of them describing what the viewer may see and the other what someone
  else may do. Either the sidebar or the screen needs different copy, and the choice is the PO's.
- **`getScope` is load-bearing for the shell.** It is fetched on every screen and its `grants` drive
  the sidebar. If a grant-admin read is added to the same endpoint rather than beside it, every screen
  pays for it and the sidebar's meaning shifts. A separate operation keeps the shell's contract intact.
- **The S2 structural divergence is still open and this slice walks into it.**
  `DIVERGENCES.md` §C records that the overview's identity block *"asserts a role vocabulary the
  contract deliberately has none of"*, needing the role list decided — the same open item `UI-045`'s
  named-absence panel exists to evidence. A grant-administration screen **renders roles as data**
  (`conferGrant`'s enum is `estate_staff | approver | integration_support | grant_administrator |
  resident`). That is legitimate — displaying a role the server sent is not branching on one — but the
  guard `UI-045` added forbids role literals in client source, so the role labels must come through a
  value map keyed by the contract enum, exactly as `lifecycleState` and `disposition` do. Worth naming
  in the brief so it is designed rather than discovered when the guard reds.

---

**HARD STOP.** No PID allocated, no register entry, no file created or modified outside this report.
Awaiting `2.1.0` on `main` for notices part 2, and the grant-administration brief.
