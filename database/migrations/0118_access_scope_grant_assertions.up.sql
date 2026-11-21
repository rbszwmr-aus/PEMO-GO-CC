-- ADR-013 applied to access.scope_grant — THE AUTHORITY TABLE.
--
-- 0112 and 0115 ARE NOT EDITED. A migration that has run is immutable; this one
-- alters the table they built.
--
-- ─── WHY THIS TABLE, AND WHY IT IS THE HARD ONE ──────────────────────────────
--
-- Ending a grant was NOT EXPRESSIBLE BY THE RUNTIME AT ALL. Both routes were
-- closed, and GEN-023 Step 1 measured each rather than reasoning about it:
--
--   shorten effective_to    an UPDATE. pemo_app holds SELECT + INSERT (GEN-010);
--                           has_table_privilege(...,'UPDATE') is false.
--   append a closing row    refused by scope_grant_no_overlapping_periods, because
--                           the original grant's ASSERTED period still runs to
--                           infinity and the closing row overlaps it.
--
-- So the only way to revoke authority was a DBA with an UPDATE — which is the
-- blocker WEB-15 exists to remove. A grant administration surface that can confer
-- authority and cannot withdraw it is worse than none.
--
--   assertion_id   the row identity (new primary key)
--   grant_id       the INSTANCE identity (was the primary key)
--   version        monotonic per instance; the current assertion is MAX(version)
--   recorded_at    system time, for as-of ordering (D3)
--
-- UNIQUE (grant_id, version) IS THE WHOLE OF SUPERSESSION SAFETY (D2), exactly as
-- 0117 established it for resident.occupancy. This table is the second of the
-- four state-change tables and it reuses that shape rather than inventing one.
--
-- VALID-TIME IS ALREADY HERE AND IS NOT RENAMED, per 0117:
--   D3 valid_from == effective_from     D3 valid_to == effective_to
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHY scope_grant_no_overlapping_periods IS DROPPED, AND WHAT REPLACES IT
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 0115 re-keyed this constraint and re-added it WITHOUT restating what it then
-- protected, so the only stated rationale in the repository was 0112's — written
-- about a `principal_id` column 0115 had just dropped. That omission is not
-- repeated here. This is the full statement.
--
-- WHAT IT CLAIMED TO PROTECT (0112, verbatim):
--   "One principal cannot hold the same node over two overlapping periods, or
--    'what was in force then' would have two answers — the ambiguity effective
--    dating exists to remove."
--   "Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
--    exactly how bad history arrives."
--
-- WHAT IT ACTUALLY PROTECTED, MEASURED AT GEN-023 STEP 1b:
--
--   1. NOT that. Since 0115 the key is (group, role, node) — so a principal CAN
--      already hold two fully overlapping identical grants at one node, through
--      two groups, and the probe that inserted exactly that was ACCEPTED. Under
--      ADR-012 D5 that is legal by design, not a leak, and the reader returns
--      both. The claimed invariant has been false since 0115.
--
--   2. NOT authorization. A probe inserting a brand-new live grant_administrator
--      grant at an arbitrary node was ACCEPTED: the constraint restricts only
--      DUPLICATES WITHIN ONE KEY. It never stood between a bulk load and
--      unauthorized access. It stood between a bulk load and AMBIGUOUS HISTORY.
--
--   3. Rights are a UNION and are MONOTONIC (ADR-012 D5). admits() returns on
--      first match; admitsUnassigned() tests grants.length > 0; both are
--      unchanged by a duplicate. findAuthorizingGrant collects ALL authorizing
--      grants and reduces to the narrowest with a deterministic grantId
--      tie-break — written because multiplicity is EXPECTED. No reader depends
--      on at-most-one.
--
-- So what is being given up is HYGIENE — the legibility of history — and not
-- safety.
--
-- WHY NO DECLARATIVE FORM SURVIVES. The constraint compares ASSERTED periods,
-- and under the assertion model an instance's own history overlaps itself:
-- version 1 asserts [t0, infinity) and version 2 asserts [t0, t1). Adding
-- `version` to the key looks like the cure and is not — a RE-GRANT is a NEW
-- instance whose first assertion is also version 1, so [t2, infinity) collides
-- with the old instance's version 1. Every remaining candidate needs "is this the
-- latest assertion" as a STORED predicate, and storing it means a flag something
-- must flip: an UPDATE, which is what ADR-013 D2 abolished and what pemo_app
-- cannot issue.
--
-- ─── THE TRADE, PLAINLY ──────────────────────────────────────────────────────
--
--   GIVEN UP    write-time PREVENTION of ambiguous history, declaratively, for
--               one (group, role, node) key.
--   REPLACED BY (a) write-path prevention — a per-key advisory transaction lock
--               with the conflict check inside the act, per ADR-013 D5/C3 and
--               the GEN-016 precedent; and
--               (b) WHOLE-TABLE DETECTION — docs/governance/bin/live-grant-
--               cardinality.sh runs in the battery and reds on two live
--               assertions sharing (group, role, node), whatever wrote them.
--   BOUGHT      THE ABILITY TO REVOKE AUTHORITY AT ALL.
--
-- (a) is bypassable by a bulk load in the way 0112 warned about. (b) is not: it
-- reads the whole table and does not care who wrote the row. Prevention becomes
-- detection for the bulk-load case — the ambiguity is FOUND rather than
-- forbidden. That is a real reduction and it is stated rather than glossed.
--
-- DEFAULTS EXIST SO THE SEEDS KEEP WORKING, per 0117.
-- database/seeds/40-access-staff-and-grants.sql inserts by column list and does
-- not name assertion_id or version. A caller that forgets `version` writes 1, and
-- UNIQUE then rejects it for any instance that already exists — so the omission
-- is loud exactly where it would matter.

-- Nothing FK-references access.scope_grant (verified against pg_constraint: the
-- query returns NONE), so the primary key can be moved without touching another
-- table.
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_no_overlapping_periods;
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_pkey;

ALTER TABLE access.scope_grant
  ADD COLUMN assertion_id text        NULL,
  ADD COLUMN version      integer     NULL,
  ADD COLUMN recorded_at  timestamptz NULL;

-- THE BACKFILL, EXPLICIT. Every row 0112/0115 created is the FIRST assertion
-- about its instance: version 1, recorded when it was created. The assertion id
-- is derived from the instance id rather than generated, so a re-run of this
-- migration on an equivalent database produces identical rows.
UPDATE access.scope_grant
   SET assertion_id = 'sgra_' || grant_id,
       version      = 1,
       recorded_at  = created_at
 WHERE version IS NULL;

ALTER TABLE access.scope_grant
  ALTER COLUMN assertion_id SET NOT NULL,
  ALTER COLUMN version      SET NOT NULL,
  ALTER COLUMN recorded_at  SET NOT NULL,
  ALTER COLUMN assertion_id SET DEFAULT ('sgra_' || gen_random_uuid()),
  ALTER COLUMN version      SET DEFAULT 1,
  ALTER COLUMN recorded_at  SET DEFAULT now();

ALTER TABLE access.scope_grant ADD CONSTRAINT scope_grant_pkey PRIMARY KEY (assertion_id);
ALTER TABLE access.scope_grant ADD CONSTRAINT scope_grant_version_unique UNIQUE (grant_id, version);
ALTER TABLE access.scope_grant ADD CONSTRAINT scope_grant_version_positive CHECK (version >= 1);

-- The resolver reads MAX(version) per instance. Without this it is a sort per
-- instance; with it, an index scan.
CREATE INDEX scope_grant_instance_version_idx ON access.scope_grant (grant_id, version DESC);

COMMENT ON COLUMN access.scope_grant.grant_id IS
  'THE INSTANCE identity (ADR-013 D1) — one conferral of one role at one node to one group. No longer the row identity: many assertions share one grant_id and the current one is MAX(version). A RE-GRANT after a revocation is a NEW instance with a new grant_id, never a new version of the old one.';

COMMENT ON COLUMN access.scope_grant.version IS
  'Monotonic per instance. The current assertion is MAX(version); UNIQUE (grant_id, version) is the whole of supersession safety (ADR-013 D2). There is no active flag to flip, and revoking is an append.';

COMMENT ON TABLE access.scope_grant IS
  'ADR-010 D4 + ADR-012 D4 + ADR-013 D1-D4. (group, role, scope node) effective-dated, held as an append-only assertion series so authority can be REVOKED by the runtime — pemo_app has no UPDATE, and before 0118 no revocation was expressible. scope_grant_no_overlapping_periods was dropped here: it compared ASSERTED periods, so an instance''s own history collided with itself. Its hygiene role is now held by the write-path advisory-lock guard and by the whole-table detector in the governance battery. See 0118 for the full statement of the trade.';
