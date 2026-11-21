-- ADR-013 applied to resident.occupancy — the FIRST state-change table.
--
-- 0022 IS NOT EDITED. A migration that has run is immutable; this one alters the
-- table it created.
--
-- WHAT CHANGES, AND WHY THE SHAPE OF THE CHANGE IS A RE-KEYING.
--
-- Under ADR-013 D1 a mutable fact is a stable INSTANCE plus an append-only series
-- of immutable ASSERTIONS. `occupancy_id` is the instance — ADR-013 names it, "a
-- party's tenure in a unit, keyed by its own id" — but 0022 made it the PRIMARY
-- KEY, i.e. one row per instance. The assertion model needs MANY rows per
-- instance, so `occupancy_id` must stop being the row identity and become the
-- instance identity. That is the whole of this migration.
--
--   assertion_id   the row identity (new primary key)
--   occupancy_id   the INSTANCE identity (was the primary key)
--   version        monotonic per instance; the current assertion is MAX(version)
--   recorded_at    system time, for as-of ordering (D3)
--
-- UNIQUE (occupancy_id, version) IS THE WHOLE OF SUPERSESSION SAFETY (D2). Two
-- concurrent acts that both believe version N is current both append N+1; one
-- wins, the other takes a unique violation and re-reads. There is no interval to
-- close, no prior row to touch, and no `active` flag to flip — flipping one would
-- be an UPDATE the runtime cannot issue.
--
-- VALID-TIME IS ALREADY HERE AND IS NOT RENAMED. D3 asks for a valid interval;
-- 0022's `effective_from`/`effective_to` carry exactly that and every reader,
-- seed and fixture spells them. Renaming would be vocabulary churn across the
-- resident surface for no semantic gain, so the mapping is recorded instead:
--
--   D3 valid_from  ==  effective_from        D3 valid_to  ==  effective_to
--
-- `status` IS NOT TOUCHED HERE, AND IT IS NO LONGER A LIVENESS SOURCE. See the
-- COMMENT at the foot of this file.
--
-- DEFAULTS EXIST SO THE SEEDS KEEP WORKING. database/seeds/30-*.sql inserts by
-- occupancy_id and is outside this PID's scope; without defaults every seed row
-- would fail. A caller that forgets `version` writes 1, and UNIQUE then rejects
-- it for any instance that already exists — so the omission is loud exactly
-- where it would matter.

-- Nothing FK-references resident.occupancy (verified against pg_constraint), so
-- the primary key can be moved without touching another table.
ALTER TABLE resident.occupancy DROP CONSTRAINT occupancy_pkey;

ALTER TABLE resident.occupancy
  ADD COLUMN assertion_id text        NULL,
  ADD COLUMN version      integer     NULL,
  ADD COLUMN recorded_at  timestamptz NULL;

-- THE BACKFILL, EXPLICIT. Every row 0022 created is the FIRST assertion about its
-- instance: version 1, recorded when it was created. The assertion id is derived
-- from the instance id rather than generated, so a re-run of this migration on an
-- equivalent database produces identical rows and the seed stays diffable.
UPDATE resident.occupancy
   SET assertion_id = 'occa_' || occupancy_id,
       version      = 1,
       recorded_at  = created_at
 WHERE version IS NULL;

ALTER TABLE resident.occupancy
  ALTER COLUMN assertion_id SET NOT NULL,
  ALTER COLUMN version      SET NOT NULL,
  ALTER COLUMN recorded_at  SET NOT NULL,
  ALTER COLUMN assertion_id SET DEFAULT ('occa_' || gen_random_uuid()),
  ALTER COLUMN version      SET DEFAULT 1,
  ALTER COLUMN recorded_at  SET DEFAULT now();

ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_pkey PRIMARY KEY (assertion_id);
ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_version_unique UNIQUE (occupancy_id, version);
ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_version_positive CHECK (version >= 1);

-- The resolver reads MAX(version) per instance. Without this it is a sort per
-- instance over the resident index; with it, an index scan.
CREATE INDEX occupancy_instance_version_idx ON resident.occupancy (occupancy_id, version DESC);

COMMENT ON COLUMN resident.occupancy.occupancy_id IS
  'THE INSTANCE identity (ADR-013 D1) — a party''s tenure in a unit. No longer the row identity: many assertions share one occupancy_id, and the current one is MAX(version). Two successive tenures of one unit are two instances, never two versions of one.';

COMMENT ON COLUMN resident.occupancy.version IS
  'Monotonic per instance. The current assertion is MAX(version); UNIQUE (occupancy_id, version) is the whole of supersession safety (ADR-013 D2). There is no active flag to flip.';

COMMENT ON COLUMN resident.occupancy.status IS
  'DATA, NOT A LIVENESS SOURCE. Liveness is COMPUTED: resolve the MAX(version) assertion, then evaluate its effective dating. status was the only other liveness signal and it was redundant — its single behavioural use was a "status = active" gate in unit-authorization, and no row has ever carried "ended". Two sources for one fact is why the shipped seed disagrees with itself: occ_733_a12a1 is status=active with an effective_to in the past, and it is CORRECT — the expired-caregiver fixture is a tenure that lapsed by its own dating and was never explicitly ended. Once liveness is computed, the disagreement is not a data bug; it was a model bug, and this comment records the resolution.';
