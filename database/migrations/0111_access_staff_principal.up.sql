-- A staff principal.
--
-- NO ROLE COLUMN, AND THAT IS A DECISION (ADR-007 D4, A4).
--
-- D4 requires authorization expressed structurally, and A4 records that role
-- differentiation is entirely undesigned: the export shows ONE role, and no
-- screen renders differently for another. "A single designed role is not evidence
-- that one role is enough. It is the absence of evidence either way."
--
-- For read operations SCOPE IS THE ONLY GATE, which is exactly what makes this
-- PID buildable with the role list open. Adding a role column later is additive;
-- inventing a vocabulary now would decide a product question by omission — the
-- same failure ADR-006 was written to prevent, and the same reservation it made
-- for the severity policy table's contents.
CREATE TABLE access.staff_principal (
  principal_id     text        PRIMARY KEY,
  -- The tenancy root (ADR-002). Cross-organization isolation is ABSOLUTE and is
  -- not a role: no grant at any level reaches another Organization's data. A
  -- stable identifier with NO foreign key — platform.organization is another
  -- module.
  organization_id  text        NOT NULL,
  display_name     text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_principal_organization_idx ON access.staff_principal (organization_id);

COMMENT ON TABLE access.staff_principal IS
  'A member of estate staff. ADR-007 D3 tier 2. This table deliberately carries no role: the role list is an open product decision and, for reads, scope is the only gate.';
