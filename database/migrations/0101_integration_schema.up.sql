-- Integration Hub schema (ADR-006).
--
-- The device-and-zone mapping and the two classification artifacts belong to
-- Integration Hub, not Home Safety. The module catalogue already gives
-- Integration Hub "connections, mappings, translation"; Home Safety owns
-- resident presentation and response. If Home Safety also owned device
-- correspondence, the module boundary that has held for the whole project would
-- start carrying exceptions — and an enforcement rule with one exception decays
-- into a rule with three.
--
-- Storing a device reference here does NOT breach the resident boundary.
-- forbidden-terms.json governs what crosses into a resident-facing RESPONSE, not
-- what PEMO persists internally. PEMO may hold a device or zone identifier in
-- integration.* and must never render one — which is why an explicit test proves
-- these identifiers cannot reach a resident payload.
CREATE SCHEMA IF NOT EXISTS integration;
COMMENT ON SCHEMA integration IS
  'Integration Hub: connections, mappings, translation, source vocabulary and approved severity policy. Holds device and zone references, which are never rendered to a resident. Owns no resident presentation decision.';

-- btree_gist supplies GiST operator classes for scalar equality, which the
-- exclusion constraints on the effective-dated tables need in order to say
-- "same key AND overlapping period".
--
-- It is a PostgreSQL contrib extension, not an application runtime dependency:
-- nothing in package.json changes and no module imports anything new.
--
-- It was not installed at the pin, so the down migration drops it and the
-- database returns to exactly the pinned shape.
CREATE EXTENSION IF NOT EXISTS btree_gist;
