# GEN-015 — Step 1: applying ADR-013 to occupancy

**Status:** assessed. **HARD STOP.** Nothing built beyond the allocation.
**Two headlines.** **D5 is not what the dispatch's question assumed** — one-active-occupancy-per-unit is *false* in this model, and the seeded world proves it: one unit carries **three** live occupancies. The real invariant is per `(resident, unit)`, it is computed-current, and it cannot be held by an exclusion constraint. And **the resolver must not execute the query** — if platform ran it, it would read another module's schema, which is the boundary breach the audited-write exemption exists to avoid repeating.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `c4d6a016bdd45c845855e0ceb2c3198689e65943`, re-read from the remote and equal to HEAD, tree `3b61a704…`, 820 files |
| **Number** | **015**; next is 016. Push gated on `pid-index --check`. |
| **`main` now** | `55a5c472c40d2c43a67c37cea0ad9544c56d9cd2` — the allocation |

**ADR-013 read in full from `rewrite/decisions/adr-013-append-only-state-the-assertion-model.md`.** Note for the record: **its own status line says `Proposed` — "Awaiting Product Owner acceptance."** The acceptance is real and is recorded in `STATE-2026-08-29b-adr013-accepted.md` ("PO-ACCEPTED 2026-08-29"), so the dispatch is right and the ADR's header is stale. Reading the ADR alone would have given the wrong answer — the same class as GEN-014's amendment finding, one turn later, and further evidence for the elevated ADR-consolidation item. ADR-013 also names its own target as `docs/adr/ADR-013-append-only-state.md`, where it is not.

## 2. Deliverable 1 — `0022` in full

`database/migrations/0022_resident_membership_occupancy.up.sql:25`. Exact columns:

| column | type | notes |
|---|---|---|
| `occupancy_id` | text | **PRIMARY KEY** |
| `resident_id` | text NOT NULL | FK → `resident.resident` |
| `household_id` | text NULL | FK → `resident.household` |
| `unit_id` | text NOT NULL | **stable id, NO FK** — Property Core's fact |
| `unit_class` | text NOT NULL | CHECK `residential\|parking\|storage`; a copied projection |
| `role` | text NOT NULL | CHECK `owner_occupier\|tenant\|household_member\|caregiver` |
| `status` | text NOT NULL | CHECK `active\|ended` |
| `source` | text NOT NULL | no CHECK |
| `effective_from` | timestamptz NOT NULL | |
| `effective_to` | timestamptz NULL | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Constraints: PK on `occupancy_id`; two FKs; three CHECKs; `occupancy_period_ordered` (`effective_to IS NULL OR effective_to > effective_from`). Indexes on `resident_id` and on `unit_id`. **Nothing anywhere FK-references `resident.occupancy`** — verified against the live catalogue, which is what makes re-keying it feasible.

### The instance identity — `occupancy_id`, and today it is also the row identity

ADR-013 D1 says an occupancy is *"a party's tenure in a unit, keyed by its own id"*, and *"two successive occupancies of one unit are two instances, two identities — not two versions of one."* So the instance is **`occupancy_id`**, not `(unit, party)`.

**The problem is that `occupancy_id` is currently the PRIMARY KEY**, i.e. one row per instance. The assertion model needs many rows per instance, so `occupancy_id` must stop being the row identity and become the instance identity. That is the migration's central move, and it is why this is a re-keying rather than a column add.

### How `isActiveAt` reads today — and why it is wrong under D1

`modules/resident/src/authorization/unit-authorization.ts:22`:

```ts
const isActiveAt = (r, now) =>
  r.status === 'active' && new Date(r.effectiveFrom) <= now &&
  (r.effectiveTo === null || new Date(r.effectiveTo) > now);
```

`authorizeUnit` then takes `relationships.find(r => residential && isActiveAt(r, now))` — **any** row that evaluates active. This is exactly the *"evaluate each row"* shape D4 replaces, and it is the mechanism GEN-013 proved defeats append-modelling: an appended `ended` assertion leaves the earlier `active` one still matching, so `authorizeUnit` still returns `authorized`.

**Two readers** feed it, both in `modules/resident/src/repository/resident-repository.ts`: `findRelationships` (`:56`) and `findRelationshipsForUnit` (`:65`). Both `SELECT … FROM occupancy WHERE resident_id = $1 …` with no version awareness. These are the only SQL readers of the table.

### The seed rows — 7, and one of them is already inconsistent

```
occ_412_p101          res_wfg_000412  unit_wfg_cp_p101  owner_occupier   active  2019-12-31 → NULL
occ_412_s021          res_wfg_000412  unit_wfg_st_s021  owner_occupier   active  2019-12-31 → NULL
occ_733_a12a1         res_wfg_000733  unit_wfg_a_12_a1  caregiver        active  2025-12-31 → 2026-08-11
occ_777_b05b2         res_hbv_000777  unit_hbv_b_05_b2  owner_occupier   active  2022-04-30 → NULL
occ_908_a12a1         res_wfg_000908  unit_wfg_a_12_a1  household_member active  2021-02-28 → NULL
occ_res_wfg_000412_0  res_wfg_000412  unit_wfg_a_12_a1  owner_occupier   active  2020-01-01 → NULL
occ_res_wfg_000412_1  res_wfg_000412  unit_wfg_c_08_c3  household_member active  2020-01-02 → NULL
```

**`occ_733_a12a1` carries `status = 'active'` with an `effective_to` in the past** — the expired-caregiver fixture. So the two representations of liveness already disagree in the shipped seed, and `isActiveAt` resolves it by requiring *both*. That is the ambiguity §3 must settle rather than inherit.

## 3. Deliverable 2 — the proposed migration (a NEW file; `0022` untouched)

`database/migrations/0117_occupancy_assertions.up.sql`:

```sql
ALTER TABLE resident.occupancy DROP CONSTRAINT occupancy_pkey;

ALTER TABLE resident.occupancy
  ADD COLUMN assertion_id text NOT NULL DEFAULT ('occa_' || gen_random_uuid()),
  ADD COLUMN version      integer NOT NULL DEFAULT 1,
  ADD COLUMN recorded_at  timestamptz NOT NULL DEFAULT now();

UPDATE resident.occupancy SET recorded_at = created_at;      -- backfill, migration-time only
ALTER TABLE resident.occupancy ADD PRIMARY KEY (assertion_id);
ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_version_unique UNIQUE (occupancy_id, version);
ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_version_positive CHECK (version >= 1);
```

Four things to rule on, each a real choice:

1. **Valid-time is NOT absent — it is already here under other names.** D3 asks for `valid_from`/`valid_to`; `0022` has `effective_from`/`effective_to` carrying exactly that meaning. I propose **keeping the existing names** and recording the mapping in the migration, rather than renaming and touching every reader and seed for vocabulary. The dispatch says "where absent"; they are not absent. **Confirm.**
2. **The defaults on `assertion_id` and `version` exist to keep the seeds working.** `database/seeds/30-*.sql` inserts by `occupancy_id` and is **not in this PID's write-scope**; without defaults every seed row would fail. The cost: a caller who forgets `version` silently writes `1` — though `UNIQUE(occupancy_id, version)` then rejects it for any existing instance, so the failure is loud where it matters. **Alternative: no defaults, and widen scope to the seeds.**
3. **`status` versus `effective_to` — two representations of one fact, and the seed already disagrees.** Under D2 there is no flag to flip, and `status` is now an attribute of an assertion rather than mutable liveness, which is legal. But which is authoritative when they conflict? I propose **valid-time is authoritative** and `status` becomes descriptive, with the end assertion setting both consistently — and `occ_733_a12a1` stays exactly as it is, since `isActiveAt` already resolves it correctly by requiring both. **Ruling sought;** the alternative is dropping `status` entirely, which is a wider change than this PID should take.
4. **The down migration** must refuse if any instance has `MAX(version) > 1`, on GEN-006/0116's precedent: reversing after a real supersession would silently resurrect a superseded assertion as current.

## 4. Deliverable 3 — the shared resolver (D4), and where it may live

### The finding: platform must NOT execute the query

The obvious design — platform exposes `resolveLatest(db, table, …)` and runs it — **would have platform reading `resident.occupancy`, `property.building_service_availability` and so on**. That is a cross-schema read from the shared layer, and the only sanctioned crossing in this codebase is the audited write's `access.audit_event` insert, exempted by name in `cross-schema-scan.ts`. Building the resolver that way would need a second exemption per table and would erode exactly the boundary GEN-011 spent a PID protecting.

**So the resolver is a SQL-fragment builder, and each module executes it on its own connection.** Platform owns the *shape*; the module owns the *reach*. `verify-boundaries` needs no new exemption, because platform never names another schema.

### Proposed home and signature

`modules/platform/src/assertions/latest-assertion.ts`, exported from platform's single entry:

```ts
export interface LatestAssertionQuery {
  readonly table: string;        // unqualified — the module's own schema
  readonly instanceKey: string;  // e.g. 'occupancy_id'
  readonly columns: readonly string[];
  readonly filter?: string;      // extra predicate, module-supplied, parameterised
}

/**
 * The one latest-then-evaluate shape. Returns SQL selecting exactly ONE row per
 * instance — the MAX(version) assertion as of $asOf — never a superseded one.
 */
export const latestAssertionSql = (q: LatestAssertionQuery): string;
```

producing

```sql
SELECT DISTINCT ON (occupancy_id) <columns>
  FROM occupancy
 WHERE recorded_at <= $asOf            -- as-of: never sees assertions recorded later
   AND <filter>
 ORDER BY occupancy_id, version DESC
```

### How `isActiveAt` is rewritten

Today: fetch every row for a resident, evaluate each. After: the **repository** selects only latest assertions via the shared SQL, and `isActiveAt` evaluates **the one assertion returned per instance**. The predicate body barely changes; what changes is that it can no longer be handed a superseded row. `authorizeUnit`'s `.find(... isActiveAt ...)` then means *"any instance whose current assertion is live"*, which is correct — a resident may hold several instances at once.

**This is a shared-code addition, and I am calling it out as a scope-touch now**: platform gains a public export, and every later state-change table consumes it.

## 5. Deliverable 4 — D5: the dispatch's question has a NO answer, with evidence

**Does the model require one active occupancy per unit? No, and it must not.**

- **The seeded world already violates it.** `unit_wfg_a_12_a1` carries **three** occupancies: a household member (live), an owner-occupier (live) and a caregiver (expired). Two are live now.
- **`ADR-011` `D7` makes it structural**, not incidental: *"Corporate tenant (Novatek: five flats for staff) … five households of employees occupy, holding no interest"*, and *"Hostel or dormitory operator … N household members occupy"*. A model in which one unit has one occupancy cannot represent either.
- **`0022` carries no such constraint** and never did.

So per-unit cardinality is a **no-op**, and imposing it would break the seed on the first migration.

### The invariant that IS real: one live occupancy per `(resident, unit)`

That is the precondition GEN-013 implemented in the route as count-then-insert — the same shape as GEN-014's one-office race, and D5's own text calls that out as forbidden: *"the invariant lives at the layer that can hold it, never in the route as count-then-insert."*

**Which menu option applies: (2), and (1) is impossible here.** A partial unique index cannot express it, because "live" is *computed* — it depends on `MAX(version)` for the instance and on the valid interval. **An exclusion constraint is also impossible**, and this is worth stating precisely because it is the tempting answer: `EXCLUDE USING gist (resident_id WITH =, unit_id WITH =, tstzrange(effective_from, effective_to) WITH &&)` would range over **every** assertion including superseded ones, so an ended-then-corrected instance would collide with its own history. There is no index predicate that can say "only the max-version row" — index predicates cannot contain subqueries.

**So the mechanism is `SERIALIZABLE` isolation on the check-and-append**, with retry on `40001`.

**The trade-off, stated:** it costs a retry loop and it is the only correct option, but **it requires widening a shared primitive.** `ModuleDb.transaction()` issues a bare `BEGIN` (`module-db.ts:108`), and `auditedWrite` owns the transaction — so SERIALIZABLE has to be expressible through the audited write, e.g. `auditedWrite(db, audit, act, { isolation: 'serializable' })`. That is a second scope-touch on shared code, and it is the main reason I recommend the split in §6.

## 6. Deliverable 5 — build plan, weight, and I recommend SPLITTING

| | work | weight |
|---|---|---|
| **A. Migration + resolver + reader rewrite** | `0117` up/down; `latestAssertionSql` in platform; rewrite 2 repository readers and `isActiveAt`; prove no reader can see a superseded assertion | ~5 files, 1 new migration, 1 new shared export. **Touches every existing occupancy read path** — the resident surface's authorization. |
| **B. The END write** | `auditedWrite` isolation option; occupancy end command; route; contract op + bump + stamp; problem types; D5 SERIALIZABLE guard + retry; concurrency proof | ~8 files, a second shared-primitive widening, and a concurrency test that must actually race. |

**Recommend splitting, and the reason is specific rather than general.** A is a *silent* change: it rewrites how existing reads resolve, and its whole risk is a regression in resident authorization that no new endpoint would reveal. B is an *additive* change with its own novel machinery. Landing them together means a failure in the concurrency work and a regression in resident authorization arrive in one diff, and GEN-013 already taught that mixing surfaces multiplies findings. **A is also independently valuable**: it makes every later state-change table cheap, and it can be proven entirely against existing behaviour — the whole 327-test suite is A's oracle.

**Estimate: A is lighter than GEN-014; B is heavier than GEN-013.**

## 7. Gaps — this list is complete

1. **I have not verified `DISTINCT ON` performs acceptably** on the two indexes `0022` provides; a `(occupancy_id, version DESC)` index is probably wanted and I have not measured.
2. **`recorded_at <= $asOf` gives as-of-system-time reads, which nothing currently asks for.** I propose it because D3 names it, but no caller needs it yet, and an unused parameter is a thing to get wrong.
3. **The contract impact of A is unassessed.** If a reader's behaviour changes for the expired-caregiver fixture, resident-mobile fixtures move; I believe they do not, because `isActiveAt`'s predicate is unchanged, but I have not run it.
4. **I have not designed B's concurrency test.** Proving a serialization failure actually occurs needs two real connections racing, and node's test runner is single-threaded per file; the harness has no pattern for it.
5. **`source` is `NOT NULL` with no CHECK** and an end assertion must supply one; the vocabulary is still undecided (carried from GEN-013).
6. **`household_id` on an end assertion is undecided** — copy from the superseded assertion, or null it.
7. **Whether the seeds should be re-expressed as explicit `version = 1` rows** rather than relying on the default (§3.2) is a scope question I have not resolved.

## 8. Rulings sought

1. **§3.1** — keep `effective_from`/`effective_to` as valid-time, or rename to `valid_from`/`valid_to`?
2. **§3.2** — defaults on `assertion_id`/`version` to keep seeds working, or no defaults and widen scope to the seeds?
3. **§3.3** — valid-time authoritative and `status` descriptive?
4. **§4** — the resolver as a **SQL-fragment builder** executed by each module, given that a platform-executed resolver would breach the module boundary.
5. **§5** — D5: per-unit cardinality is a no-op; the real invariant is per `(resident, unit)` and needs `SERIALIZABLE`, which requires widening `auditedWrite`. Confirm both.
6. **§6** — split A from B?

**HARD STOP.**
