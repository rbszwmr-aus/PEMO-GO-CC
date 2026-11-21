-- ADR-016 applied to access.staff_principal -- the identity boundary.
--
-- 0111 IS NOT EDITED (nor 0115). A migration that has run is immutable.
--
-- =============================================================================
-- WHY: PEMO AUTHORIZES, IT DOES NOT AUTHENTICATE
-- =============================================================================
--
-- ADR-016 D1: a `staff_principal` is never MINTED by PEMO (that invents a
-- person) and is never AUTHENTICATED by PEMO (verifying a credential is an
-- external concern, always). It is an external identity that PEMO RECORDS so it
-- can authorize it.
--
-- GEN-030 hit the floor of that: `group_membership.principal_id` foreign-keys
-- this table, and nothing but the seed writes it -- so a genuinely empty
-- organization had no person to seat, and PEMO had no defined way for ANY staff
-- member to come into existence. This migration gives the recording a shape.
--
-- NO CREDENTIAL COLUMN. NOT NOW, NOT EVER (ADR-016 D3). Authentication happens
-- elsewhere; what is recorded here is the minimum needed to attribute and
-- authorize: who the external authenticator says this is, and what to call them
-- in an audit or a member list. A password, hash, token or secret in this table
-- would move the authentication boundary into PEMO, which is the one thing
-- ADR-016 decides against. A test asserts the shape, because a comment cannot.
--
-- --- WHY external_id IS NULLABLE, AND WHAT THE DISCRIMINATOR IS FOR ----------
--
-- The six seeded principals have NO external identity, because there is no
-- external system: they are fixtures that predate this boundary. Backfilling
-- them with something like `seed:stf_wfg_manager` would put a value no
-- authenticator will ever produce into a column that MEANS "the person's id in
-- the external authenticator" -- a fiction, in the one place ADR-016 exists to
-- keep honest.
--
-- So this takes resident.party's shape (0114), which solved the same problem for
-- the same reason: a source, a nullable subject, and a biconditional binding
-- them. ADR-010 A1's rule, applied one table over: A FICTION IS WORSE THAN A
-- NULL, BECAUSE A NULL IS LEGIBLE.
--
-- --- ONE COLUMN, SO THE SIMPLE BICONDITIONAL HAS NO HOLE ---------------------
--
-- 0119 could not use this form: it gated THREE columns, and
-- `(source = 'x') = (a IS NOT NULL AND b IS NOT NULL AND c IS NOT NULL)` reads
-- "NOT (all three present)" on the other branch, which permits one or two. That
-- hole is why 0119 counts non-nulls instead. Here exactly ONE column is gated,
-- so `(source = 'external') = (external_id IS NOT NULL)` is exact in both
-- directions and there is no partial state to admit. Considered, and the
-- simpler form is correct rather than merely shorter.
--
-- --- UNIQUENESS IS PER ORGANIZATION -----------------------------------------
--
-- Verified before building: `organization_id` is NOT NULL on this table, so
-- per-organization uniqueness is expressible directly.
--
-- A GLOBAL unique would do two wrong things. It would forbid one person working
-- for two Organizations -- under ADR-007 those are two separate worlds and two
-- principal rows, which is legitimate. And it would LEAK: an insert refused
-- because the same external_id exists in someone else's Organization tells the
-- caller a person exists in a tenancy they cannot see, and ADR-007 makes that
-- isolation absolute.
--
-- NULLS ARE DISTINCT HERE -- DELIBERATELY THE OPPOSITE CALL FROM 0120.
-- 0120 needed NULLS NOT DISTINCT because a NULL principal meant "the one
-- provisioning act" and two of them had to collide. Here NULL means "no external
-- identity recorded", which is not an identity at all: many such principals may
-- coexist in one organization, and making them collide would allow exactly one
-- seeded principal per Organization. Default semantics are correct, and the
-- reason is written down because the neighbouring migration chose the reverse.

ALTER TABLE access.staff_principal
  ADD COLUMN identity_source text NULL,
  ADD COLUMN external_id     text NULL;

-- THE CLAIM ABOUT THE PAST (ADR-010 D4's rule). Every row that exists now was
-- written by the seed, before any external authentication existed, and carries
-- no external identity. `recorded_seed` states that rather than inventing one.
UPDATE access.staff_principal SET identity_source = 'recorded_seed' WHERE identity_source IS NULL;

ALTER TABLE access.staff_principal ALTER COLUMN identity_source SET NOT NULL;

-- NO DEFAULT ON identity_source, AND THAT IS THE OPPOSITE CHOICE FROM 0117/0118.
--
-- Those added defaults so the seeds would keep working, and it was right there:
-- `version = 1` is what a first assertion IS, so a caller that omits it gets the
-- true value and UNIQUE catches the case where it would not.
--
-- Here a default would be a LIE WITH A FALLBACK. Defaulting to `recorded_seed`
-- would mean any writer that forgets the column silently records a real person's
-- identity as a fixture, and the biconditional would then force their
-- external_id to NULL -- discarding the very thing ADR-016 exists to record,
-- quietly, at a call site that still looks correct.
--
-- So every writer states what it is, exactly as `audit_event.source` is required
-- rather than defaulted (W1b) so that an act with no actor cannot inherit an
-- attribution by omission. The cost is five call sites -- the seed and four test
-- fixtures -- and the failure when one is missed is a NOT NULL violation at
-- write time, which is loud and immediate.

ALTER TABLE access.staff_principal
  ADD CONSTRAINT staff_principal_identity_source_check
  CHECK (identity_source IN ('external', 'recorded_seed'));

-- THE BICONDITIONAL. An external identity carries its id; anything else carries
-- none. Both directions are unrepresentable rather than merely discouraged.
ALTER TABLE access.staff_principal
  ADD CONSTRAINT staff_principal_external_id_only_when_external
  CHECK ((identity_source = 'external') = (external_id IS NOT NULL));

CREATE UNIQUE INDEX staff_principal_external_identity
  ON access.staff_principal (organization_id, external_id);

COMMENT ON COLUMN access.staff_principal.external_id IS
  'ADR-016 D3. The stable identifier of this person in the EXTERNAL authenticator -- an IdP subject, when one exists. NULL when no external identity was recorded, which the biconditional makes required rather than merely allowed: a fiction here would be worse than a null, because a null is legible (ADR-010 A1, one table over). NOTHING SECRET IS EVER STORED IN THIS TABLE -- PEMO authorizes, it does not authenticate.';

COMMENT ON COLUMN access.staff_principal.identity_source IS
  'WHERE this identity came from. `external` -- recorded from an external authenticator, and external_id is present. `recorded_seed` -- a fixture principal predating the identity boundary, carrying no external identity. Gated all-or-nothing by staff_principal_external_id_only_when_external.';

COMMENT ON INDEX access.staff_principal_external_identity IS
  'PER ORGANIZATION, not global. A global unique would forbid one person working for two Organizations -- two separate worlds and two principal rows under ADR-007 -- and would LEAK: a refusal would tell a caller that a person exists in a tenancy they cannot see. NULLs are DISTINCT here, the opposite of 0120''s index and for the opposite reason: NULL means "no external identity", not "the one act with no principal", so many may coexist.';
