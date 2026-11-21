# GEN-011 — Step 1: the primitive's shape, and the enforcement's real difficulty

**PID:** GEN-011 v1.0 · **Status:** **HARD STOP.** Nothing built.
**Headline:** the primitive needs **no new pool and no `search_path` change** — a qualified write inside the module's own transaction is already atomic, proven in §2. The hard part is the enforcement, and §4 is why.

---

## 1. Pin

| | |
|---|---|
| **Pin** | `db73c447e77980bd14987a7e86d628f604653177` — the GEN-011 allocation commit |
| **Tree / files** | `bf7aadf46f49d131f3a93f1aefcc18e787f4740f` / **779** files |
| **`origin/main`** | re-read from the remote (`git ls-remote`), **equal** to the pin — not trusted from a local ref |
| **Working tree** | clean at the pin **except** two untracked files: `database/migrations/0116_access_audit_event.{up,down}.sql`. These are **GEN-009's**, written and held, not GEN-011's and not to be committed here. |
| **Number** | **011** from `--next`; next is 012 |

## 2. The primitive — proven before proposed

**Hypothesis:** `search_path` governs *unqualified* resolution. A **fully-qualified** `access.audit_event` write should resolve from a module's connection regardless of its `search_path` — so the audit can be written on the module's *own* connection, inside the module's *own* transaction, and be atomic by construction.

Tested against a real database, as `pemo_app`, with `search_path=home_safety,pg_catalog`:

```
transaction threw: deliberate failure AFTER both writes
after ROLLBACK — act rows: 0   audit rows: 0     ← both rolled back
on success      — act rows: 1   audit rows: 1     ← both committed
```

**Both directions hold.** GEN-009's 0-act/1-audit state is unreachable this way, because there is only one connection and one transaction.

**So the primitive is small.** No second pool, no `search_path` widening, no distributed transaction, no two-phase commit. Platform exposes something of the shape:

```
auditedWrite(moduleDb, auditRecord, act) →
  moduleDb.transaction(async tx => {
    const result = await act(tx);                    // the module's own act, its own schema
    await tx.query('INSERT INTO access.audit_event …', […]);   // qualified, same tx
    return result;
  })
```

The module hands platform its act and its audit fields; platform writes the audit. **The module never names another schema** — the qualified write lives in platform, the sanctioned owner, once.

`pemo_app` already holds `USAGE` on `access` and `INSERT` on `audit_event`, granted by rule under GEN-010 — verified, nothing to add.

## 3. What the primitive must not become

Two shapes I am explicitly **not** proposing, because each would quietly undo something already paid for:

- **A pool whose `search_path` spans both schemas.** That would make unqualified cross-schema resolution possible everywhere on that connection, dissolving the layer-4 enforcement `verify-boundaries` provides. The qualified-name form keeps the isolation and takes only the one crossing it needs.
- **A generic `crossSchemaTransaction`.** A primitive that can pair *any* two schemas is a sanctioned crossing with no shape — it would be used for the next convenient thing. It should do exactly one thing: pair a module act with **its audit record**, and be unable to express anything else.

## 4. The enforcement — and the discriminator is the whole difficulty

The gap is real: `verify-boundaries.ts:72` walks `modules/` only (`walk(MODULES)`), so **`apps/api` is never scanned**. Extending it there is the obvious move and the naive form would be a disaster.

**Measured before proposing.** `apps/api` contains 9 matches for `<schema>.<identifier>`:

| match | what it actually is |
|---|---|
| `resident.residentId`, `resident.organizationId`, `resident.displayName`, `resident.preferredLanguage` (8×) | **JavaScript property access** on a variable named `resident` |
| `home_safety.safety_event` (1×) | inside a **deliberate SQL-injection probe string**: `"'; DROP TABLE home_safety.safety_event; --"` |

**All nine are benign. `apps/api` does not cross schemas in SQL today** — so the enforcement starts from a clean floor, which is the right moment to add it.

But a naive regex would flag **all nine**, a 100% false-positive rate on first run — the cry-wolf failure that gets a check switched off, and the same class as the `npx` guard flagging its own ban and the merged-but-draft guard warning on its own allocation. Twice now that pattern has cost a rebuild; this is the third and it is foreseeable.

**So the discriminator must be SQL context, not textual proximity.** `verify-boundaries` already strips comments and keeps only string literals containing SQL keywords — but it then tests the *whole stripped body*, which in `modules/` is harmless (no module has a variable named `resident`) and in `apps/api` is not. The check for `apps/api` must match only **inside a SQL string**, never bare identifier access.

I propose: match `<schema>.<identifier>` only within a string or template literal that also contains a SQL verb, and validate the discriminator against these 9 known-benign cases plus a planted real crossing — **test the decision, not the read**. The exemption for platform's primitive is one named file and one named table, in the `TAG_EXEMPT` shape, so it is a visible diff and not a widened rule.

## 5. Gaps — this list is complete

1. **Nothing built.**
2. **§2's proof used a probe table** (`access.audit_probe`), not `access.audit_event` — `0116` belongs to GEN-009 and is not on `main`. The mechanism is identical; the real table changes nothing about connection or transaction, but I did not test against it.
3. **I did not test the primitive under an act that itself opens a nested transaction.** `clientDb` does not emulate nesting with savepoints (`module-db.ts:53-56`); an act that calls `transaction()` inside the primitive would silently join rather than nest. Whether that is acceptable is a design question the shape must answer.
4. **The enforcement's cost is unmeasured.** `verify-boundaries` currently walks ~59 module files; `apps/api/src` adds ~43. Fine, but the check runs in CI and I have not timed it.
5. **`dev_scaffold` is a schema the composition layer legitimately reads** (`apps/api/src/scaffold/screen-content.ts` via its own `ModuleDb`). It is not a cross-schema SQL crossing — it has its own handle — but any `apps/api` rule must be checked against it or it becomes a tenth false positive.
6. **No decision on where the enforcement lives.** `verify-boundaries` (needs a database, runs as owner) or a `docs/governance/bin/` check (no database, joins the battery). The battery has the better failure ergonomics; `verify-boundaries` has the existing four-layer framing. I lean to the battery and have not decided.

## 6. What the Brain is asked to rule

1. **§2 — the primitive's shape**: qualified write inside the module's own transaction, platform-owned, no new pool.
2. **§3** — that it stays audit-specific rather than a general cross-schema facility.
3. **§4 — the discriminator**, and that it be validated against the 9 known-benign cases plus a planted crossing before it is trusted.
4. **§5.6** — where the enforcement lives: `verify-boundaries` or the battery.
5. **§5.3** — what the primitive does if the act opens its own transaction.

**HARD STOP.**
