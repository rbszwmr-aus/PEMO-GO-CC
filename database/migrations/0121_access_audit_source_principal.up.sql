-- The authority-bearing source is renamed `staff` -> `principal`.
--
-- 0119 IS NOT EDITED. It is merged; even a comment would have to be a new
-- migration now, and GEN-025 learned that the hard way — a comment-only edit to
-- 0119 tripped the runner's immutability check on a database that had already
-- applied it, which is the rule working exactly as designed.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHY: `staff` UNDER-NAMED THE VALUE. THE ENUM WAS NOT INCOMPLETE.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 0119 introduced `source` and made `staff` the only authority-bearing value,
-- reasoning that a provisioning act has no actor and an integrating system is a
-- job. Both of those still hold. What was wrong was the NAME.
--
-- The schema ALREADY declares `resident` in audit_event_role_check and in
-- scope_grant's role CHECK (0115), so the model anticipates a resident actor. And
-- under 0119's own origin-not-channel rule — source names what ORIGINATED the
-- act, not the channel it arrived through — a resident's own act IS that person's
-- act carrying their own authority. That is the SAME CATEGORY as a staff act, not
-- a fourth source. Calling the category `staff` would have forced a resident's
-- act to be labelled with an audience it does not belong to, and the first
-- audited resident write would have discovered it.
--
-- `principal` is ADR-010 D1's own word: attribution is to "a principal, not a
-- session, a service or a job". With it the biconditional reads almost
-- tautologically — AUTHORITY IS PRESENT IFF source = 'principal' — which is what
-- the constraint has always meant.
--
-- ─── WHY NOW, AS A MEASUREMENT AND NOT AN ASSUMPTION ─────────────────────────
--
-- `SELECT count(*) FROM access.audit_event` returned **0**, and no seed writes
-- the table (checked: nothing under database/seeds/ names it). So today this is a
-- pure rename of a value nothing holds. The moment one audited act runs it
-- becomes a data migration over the one table whose whole purpose is to be
-- immutable and complete. The UPDATE below is written anyway — it is correct for
-- any database that does hold rows, and a rename that only works on an empty
-- table is not a rename.
--
-- ─── AND WHY BEFORE W2 ───────────────────────────────────────────────────────
--
-- W2 builds the grant write surface, which is audited. Landing this after it
-- would mean writing the new call sites against a name already being changed.

-- The data first, while the old CHECK still permits it.
UPDATE access.audit_event SET source = 'principal' WHERE source = 'staff';

-- Then the vocabulary. The old constraints must go before the new ones can hold:
-- the biconditional names the value, so it is re-created rather than altered.
ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_authority_only_when_staff;
ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_source_check;

ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_source_check
  CHECK (source IN ('provisioning', 'principal', 'integration'));

-- THE BICONDITIONAL, RENAMED WITH ITS VALUE. A constraint called
-- ..._only_when_staff over a vocabulary with no `staff` in it would be a name
-- contradicting its own contents — the stale-comment shape this corpus keeps
-- catching, in a constraint identifier where it is harder to notice.
--
-- The spelling is unchanged and deliberately so. `num_nonnulls(...) = CASE ...`
-- is counted rather than conjoined because the obvious form
--
--   CHECK ((source = 'principal') = (principal_id IS NOT NULL AND ...))
--
-- reads "NOT (all three present)" for a non-principal source and therefore
-- PERMITS one or two — a half-attributed act. GEN-025 built that spelling into a
-- live schema as a mutation and exactly one test caught it. Three or zero, no
-- third state.
ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_authority_only_when_principal
  CHECK (num_nonnulls(principal_id, group_id, role) = CASE WHEN source = 'principal' THEN 3 ELSE 0 END);

COMMENT ON COLUMN access.audit_event.source IS
  'WHAT ORIGINATED the act — NOT the channel it arrived through. A person''s act reaching PEMO via an integration is still THAT PERSON''S act with THEIR authority (`principal`); `integration` means the integrating SYSTEM itself acted, with no person behind it. ADR-010 A1: the bootstrap is an EVENT, not a role — a provisioning act has no principal, no group and no grant, because the grant is what it creates. Only `principal` bears authority, and audit_event_authority_only_when_principal makes any other combination unrepresentable rather than merely discouraged. Renamed from `staff` by 0121: the category covers any person acting as themselves, including a resident, and the schema already declares `resident` as a role.';
