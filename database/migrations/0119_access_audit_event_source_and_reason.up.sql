-- ADR-010 A1 and ADR-014 applied to access.audit_event.
--
-- 0116 IS NOT EDITED. A migration that has run is immutable; this one alters the
-- table it created.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHY: THE PROVISIONING ACT COULD NOT BE AUDITED AT ALL
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ADR-010 A1 closes Open question 1 with "the bootstrap is an EVENT, not a role":
-- when an Organization is created, its first scope grant is created as part of
-- that act, recorded with D1's four audit properties. A1 is explicit about how
-- that act is attributed:
--
--   "Whoever builds the provisioning path adopts GEN-029-ST's shape — honest
--    absence with the source recorded, never a fabricated principal id, never
--    'system'. A fiction is worse than a null because a null is legible."
--
-- 0116 made that shape UNREPRESENTABLE. principal_id, group_id and role are all
-- NOT NULL, and a provisioning act has none of the three — no principal, no
-- group, and no grant, because the grant is what it is creating. So the only
-- ways to record one were a fabricated principal (forbidden by name) or no audit
-- at all (forbidden by D1). GEN-023 Step 1 found this by inspection; this
-- migration is the fix.
--
-- THE SHAPE IS COPIED FROM resident.party, NOT INVENTED. 0114 solved the same
-- problem for the same reason — a bulk-imported party has no acting principal —
-- with `source` NOT NULL, a nullable actor, and a biconditional CHECK tying them.
-- A1 requires ONE representation, not two: "two different fictions in two modules
-- is how the same question gets two answers."
--
-- ─── WHY `staff` IS THE ONLY AUTHORITY-BEARING SOURCE ────────────────────────
--
-- `source` NAMES WHAT ORIGINATED THE ACT. IT IS NOT THE CHANNEL THE ACT ARRIVED
-- THROUGH, and reading it as a channel is the mistake this paragraph exists to
-- prevent.
--
-- A person's act that reaches PEMO via an integration is still THAT PERSON'S
-- act, carrying THEIR authority: it is `staff`, and the integration is merely how
-- the bytes travelled. `integration` means something different and narrower —
-- that the INTEGRATING SYSTEM ITSELF acted, with no person behind the act at all.
--
-- Once source is read that way the constraint follows without a judgement call.
-- ADR-010 D1's second property requires attribution to "a principal, not a
-- session, a service or a job". A provisioning act has no actor by definition,
-- and an integrating system is a job — so per D1 it is never a principal, and
-- naming one for it would be the same fiction in different clothes as a
-- fabricated provisioning principal. Authority is therefore carried by exactly
-- one source, and the constraint says so rather than leaving it to convention.
--
-- ─── ONE CONSTRAINT, AND WHY IT IS WRITTEN WITH num_nonnulls ─────────────────
--
-- The obvious spelling has a hole:
--
--   CHECK ((source = 'staff') = (principal_id IS NOT NULL
--                                AND group_id IS NOT NULL AND role IS NOT NULL))
--
-- For a non-staff source that reads "NOT (all three present)", which PERMITS one
-- or two of them being present — a half-attributed provisioning act, which is
-- exactly the half-claimed provenance 0114's own constraint refuses. Counting
-- closes it: staff means exactly three, anything else means exactly zero, and
-- there is no third state.
--
-- ─── BACKFILL ────────────────────────────────────────────────────────────────
--
-- Every row 0116 accepted carried all three authority columns NOT NULL, so every
-- existing row IS a staff act. `source = 'staff'` is therefore a claim about the
-- past that the old schema itself guarantees — not a default chosen for
-- convenience. (ADR-010 D4's rule: a backfill is a claim about the past, and it
-- is recorded with its basis.)

ALTER TABLE access.audit_event
  ADD COLUMN source      text NULL,
  ADD COLUMN reason_code text NULL;

-- The claim about the past, stated before it is enforced.
UPDATE access.audit_event SET source = 'staff' WHERE source IS NULL;

ALTER TABLE access.audit_event
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN principal_id DROP NOT NULL,
  ALTER COLUMN group_id     DROP NOT NULL,
  ALTER COLUMN role         DROP NOT NULL;

ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_source_check
  CHECK (source IN ('provisioning', 'staff', 'integration'));

-- THE BICONDITIONAL. Authority is present if and only if the source bears it,
-- and it is all-or-nothing: three columns or none, never a partial attribution.
ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_authority_only_when_staff
  CHECK (num_nonnulls(principal_id, group_id, role) = CASE WHEN source = 'staff' THEN 3 ELSE 0 END);

-- reason_code CARRIES NO VOCABULARY IN THE SCHEMA, AND THAT IS ADR-014 D3.
-- The vocabulary is declared PER ACT TYPE in the contract registry and validated
-- at the write path, because ADR-006 D3 requires vocabulary and policy to be
-- separately holdable: a CHECK here would freeze every act's vocabulary into one
-- list that only a migration could change, and one act's new code would become a
-- schema change for all of them. The column's job is to carry a validated code,
-- not to be the validator.
--
-- NO FREE-TEXT NOTE (ADR-014 D5). An immutable, actor-undeletable free-text
-- column in the audit spine is a permanent personal-data hazard and no motivating
-- case needs more than a code.

COMMENT ON COLUMN access.audit_event.source IS
  'HOW this act reached the system, and the gate on attribution. ADR-010 A1: the bootstrap is an EVENT, not a role — a provisioning act has no principal, no group and no grant (the grant is what it creates), and an integration act is a job. Only `staff` bears authority, and audit_event_authority_only_when_staff makes any other combination unrepresentable rather than merely discouraged.';

COMMENT ON COLUMN access.audit_event.principal_id IS
  'THE ACTOR — the person — or NULL when the act legitimately had none. Distinct from group_id, which is the AUTHORITY. Nullable since 0119 and gated all-or-nothing against source: a fiction here would be worse than a null, because a null is legible and a fabricated principal is not (ADR-010 A1).';

COMMENT ON COLUMN access.audit_event.reason_code IS
  'WHY the act happened, as a controlled code (ADR-014 D1/D2). On the ACT record, never on the fact row — ADR-013 C5: an assertion states the fact, not the act. Nullable here and required only where the act''s own contract says so (D4); the vocabulary is declared per act type in the contract registry and validated at the write path (D3), never enumerated in this schema.';
