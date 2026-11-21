-- Identity and Access schema (ADR-007 D4, A2).
--
-- WHY HERE AND NOT IN property.*, WHICH IS THE TEMPTING PLACE.
--
-- The module catalogue gives Identity and Access "accounts, authentication,
-- roles, permissions, sessions and ACCESS SCOPE". The datum is named there, so
-- the boundary is decided by the catalogue rather than by which module happened
-- to need it first.
--
-- Property Core owns WHAT EXISTS — the hierarchy and the Locations. Access owns
-- WHO MAY SEE IT. Those are different questions, and Property owning both is
-- precisely the shape ADR-006 refused when it kept device correspondence out of
-- Home Safety: the owner is the module whose RESPONSIBILITY the datum is, not the
-- module that reads it. Home Safety, Property and Integration will all read
-- scope; none of them owns it.
--
-- Platform Foundation was the other candidate and is wrong for a simpler reason:
-- it owns no business workflow, and an authorization assignment is business
-- policy.
CREATE SCHEMA IF NOT EXISTS access;
COMMENT ON SCHEMA access IS
  'Identity and Access: staff principals and their effective-dated scope grants over ADR-002 hierarchy nodes and ADR-003 Locations. Owns who may see what. Owns no hierarchy, no property master and no resident data.';
