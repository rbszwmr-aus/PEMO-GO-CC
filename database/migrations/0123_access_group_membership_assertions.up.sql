-- ADR-013 applied to access.group_membership -- the THIRD state-change table,
-- and the second half of the authority model.
--
-- 0115 IS NOT EDITED. A migration that has run is immutable; this one alters the
-- table it created.
--
-- =============================================================================
-- WHY: ENDING A MEMBERSHIP WAS NOT EXPRESSIBLE BY THE RUNTIME
-- =============================================================================
--
-- Both routes were closed, and GEN-029 measured each rather than reasoning:
--
--   shorten effective_to    an UPDATE. pemo_app holds SELECT + INSERT; both
--                           has_table_privilege(...,'UPDATE') and DELETE are false.
--   append a closing row    refused by group_membership_no_overlapping_periods,
--                           because the row it supersedes still ASSERTS a period
--                           running to infinity.
--
-- That is exactly the wall scope_grant hit before 0118, and removing a member is
-- half of what W3 exists to make possible.
--
--   assertion_id     the row identity (new primary key)
--   membership_id    the INSTANCE identity (was the primary key)
--   version          monotonic per instance; the current assertion is MAX(version)
--   recorded_at      system time, for as-of ordering (D3)
--
-- UNIQUE (membership_id, version) IS THE WHOLE OF SUPERSESSION SAFETY (D2), as
-- 0117 and 0118 established. This is the third application of one shape.
--
-- =============================================================================
-- WHY group_membership_no_overlapping_periods IS DROPPED -- AND WHY THIS
-- MIGRATION SAYS MORE THAN 0118 DID
-- =============================================================================
--
-- 0115 re-added scope_grant's exclusion without restating what it protected, and
-- 0118 had to reconstruct it. That omission is not repeated here, and neither is
-- the assumption that ran the other way: ADR-013 C6 requires each constraint to
-- be assessed on ITS OWN rationale, and this one's turned out to differ.
--
-- ITS OWN STATED RATIONALE (0115, verbatim):
--
--   "One person cannot hold the same membership twice over overlapping periods.
--    Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
--    exactly how bad history arrives."
--
-- AND IT IS ACCURATE, WHICH 0112'S WAS NOT. 0112 described "one principal ... the
-- same node" after 0115 had re-keyed its constraint to the group, so it named an
-- invariant the schema no longer had. Here the claim is exactly what
-- (group_id, principal_id, range) enforces. The staleness finding did not
-- transfer, and it was checked rather than inherited.
--
-- WHAT IT ACTUALLY STOPS, MEASURED (GEN-029):
--
--   with the constraint dropped and one duplicate membership inserted, the
--   grant reader returned  3 ROWS FOR 2 DISTINCT GRANTS.
--
-- THIS TABLE IS A JOIN MULTIPLIER, WHICH scope_grant WAS NOT. Membership sits on
-- the join side of grant resolution, so a duplicate here does not add a second
-- grant -- it returns the SAME grant twice. scope_grant's exclusion, dropped at
-- 0118, could only ever produce two distinct grants, which a monotonic union
-- absorbs.
--
-- NO AUTHORIZATION DECISION CHANGES EITHER WAY. admits() returns on first match;
-- admitsUnassigned() tests grants.length > 0; findAuthorizingGrant collects all
-- and reduces to the narrowest with a stable tie-break. All three are idempotent
-- under row duplication. So this is hygiene, as 0118's was -- but hygiene with a
-- dependant, which 0118's did not have. See 0118 for the fuller statement of the
-- union-and-monotonic argument; it is not repeated here.
--
-- --- THE TRADE, PLAINLY ------------------------------------------------------
--
--   GIVEN UP    write-time PREVENTION of a duplicate membership, declaratively.
--   REPLACED BY (a) write-path prevention -- a per-(group, principal) advisory
--               transaction lock with the check inside the act (ADR-013 D5/C3);
--               (b) whole-table DETECTION --
--               docs/governance/bin/live-membership-cardinality.sh, in the
--               battery, which a bulk load cannot bypass because it reads every
--               row and does not care who wrote it; and
--               (c) DEDUPLICATION RESTORED in findGrantsAsAt, because the reader
--               is where a duplicate would otherwise become visible.
--   BOUGHT      THE ABILITY TO END A MEMBERSHIP AT ALL.
--
-- (a) is bypassable by a bulk load in the way 0115 warned about; (b) is not.
-- Prevention becomes detection for that case: the duplicate is FOUND rather than
-- forbidden. That is a real reduction, stated rather than glossed.
--
-- --- AND ONE THING 0118 DID NOT HAVE TO SAY ---------------------------------
--
-- GEN-024 REMOVED findGrantsAsAt's `SELECT DISTINCT` on the reasoning that
-- "grant_id is the row identity, so every row was already distinct". That was
-- true ONLY BECAUSE THIS CONSTRAINT MADE A DUPLICATE MEMBERSHIP UNWRITABLE --
-- a premise this table supplied silently, to code in another module, which cited
-- it without naming it. Dropping the constraint would have made that removal
-- retroactively wrong with no edit to the file it lives in. The deduplication is
-- restored in the same change as this drop, and its comment now states why it is
-- there NOW, so it cannot be removed a second time on a premise that no longer
-- exists.
--
-- DEFAULTS EXIST SO THE SEEDS KEEP WORKING, per 0117 and 0118.

-- Nothing FK-references access.group_membership (verified against pg_constraint),
-- so the primary key can be moved without touching another table.
ALTER TABLE access.group_membership DROP CONSTRAINT group_membership_no_overlapping_periods;
ALTER TABLE access.group_membership DROP CONSTRAINT group_membership_pkey;

ALTER TABLE access.group_membership
  ADD COLUMN assertion_id text        NULL,
  ADD COLUMN version      integer     NULL,
  ADD COLUMN recorded_at  timestamptz NULL;

-- THE BACKFILL, EXPLICIT. Every row 0115 created is the FIRST assertion about its
-- instance. The assertion id is DERIVED from the instance id rather than
-- generated, so a re-run on an equivalent database produces identical rows.
UPDATE access.group_membership
   SET assertion_id = 'gma_' || membership_id,
       version      = 1,
       recorded_at  = created_at
 WHERE version IS NULL;

ALTER TABLE access.group_membership
  ALTER COLUMN assertion_id SET NOT NULL,
  ALTER COLUMN version      SET NOT NULL,
  ALTER COLUMN recorded_at  SET NOT NULL,
  ALTER COLUMN assertion_id SET DEFAULT ('gma_' || gen_random_uuid()),
  ALTER COLUMN version      SET DEFAULT 1,
  ALTER COLUMN recorded_at  SET DEFAULT now();

ALTER TABLE access.group_membership ADD CONSTRAINT group_membership_pkey PRIMARY KEY (assertion_id);
ALTER TABLE access.group_membership ADD CONSTRAINT group_membership_version_unique UNIQUE (membership_id, version);
ALTER TABLE access.group_membership ADD CONSTRAINT group_membership_version_positive CHECK (version >= 1);

CREATE INDEX group_membership_instance_version_idx
  ON access.group_membership (membership_id, version DESC);

COMMENT ON COLUMN access.group_membership.membership_id IS
  'THE INSTANCE identity (ADR-013 D1) -- one person''s tenure in one group. No longer the row identity: many assertions share one membership_id and the current one is MAX(version). RE-JOINING after removal is a NEW instance with a new membership_id, never a new version of the old one.';

COMMENT ON COLUMN access.group_membership.version IS
  'Monotonic per instance. The current assertion is MAX(version); UNIQUE (membership_id, version) is the whole of supersession safety (ADR-013 D2). There is no active flag to flip, and removing a member is an append.';

COMMENT ON TABLE access.group_membership IS
  'ADR-012 D6 + ADR-013 D1-D4. Effective-dated membership, held as an append-only assertion series so a member can be REMOVED by the runtime -- pemo_app has no UPDATE, and before 0123 no removal was expressible. group_membership_no_overlapping_periods was dropped here; unlike scope_grant''s, its stated rationale was ACCURATE, and what it protected was the reader: this table is a JOIN MULTIPLIER, so a duplicate returns one grant twice rather than two grants once. Its role is now held by the write-path advisory guard, by the battery detector, and by the deduplication restored in findGrantsAsAt. See 0123 for the full statement.';
