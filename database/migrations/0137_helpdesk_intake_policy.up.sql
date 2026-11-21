-- May a report be filed anonymously? (GEN-044 D3)
--
-- ─── FAIL-CLOSED: NO ROW MEANS NOT PERMITTED ────────────────────────────────
--
-- The third time this repository makes the same choice, and for the same reason
-- (GEN-039 G4's revoke gate, GEN-040 D3's approval policy): the absence of a row
-- is "nobody has decided", and an undecided question about accepting reports from
-- an unidentified person resolves toward NOT accepting them.
--
-- The cost of the opposite default is concrete. An organization that never
-- configured anything would silently accept anonymous reports, and an anonymous
-- report cannot be replied to, cannot be verified, and cannot be attributed if it
-- turns out to be malicious. That is a decision somebody must make on purpose.
--
-- ─── WHAT ANONYMOUS MEANS HERE ──────────────────────────────────────────────
--
-- `reporter_ref` NULL, and NO RESIDENT-VISIBLE CONVERSATION: one-way feedback.
-- There is nobody to hold the other end of a thread, so a Ticket with no reporter
-- has no addressee for a reply — which the read surface must respect and this
-- schema makes true by construction.
CREATE TABLE helpdesk.intake_policy (
  organization_id text    NOT NULL PRIMARY KEY,
  allow_anonymous boolean NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE helpdesk.intake_policy IS
  'GEN-044 D3. Whether an organization accepts anonymous reports. FAIL-CLOSED: NO ROW MEANS NOT PERMITTED — the absence of a row is "nobody has decided", and an anonymous report cannot be replied to, verified or attributed, so accepting one must be a deliberate choice.';
COMMENT ON COLUMN helpdesk.intake_policy.allow_anonymous IS
  'Explicit, with no default: a policy a schema default could set is a policy nobody chose.';
