-- A notice targeting a PARTIAL-FLOOR LIFT (ADR-019 D5, GEN-037 D8).
--
-- WHY THIS PARTICULAR FIXTURE. `loc_wfg_lift_bank_low` serves floors 01, 12 and 20
-- of Block A and NOT the rest of the block — the serving-scope case GEN-006 seeded
-- precisely because it is the one a physical-parent lookup gets wrong. A notice
-- about that lift must reach those three floors' households and nobody else, so
-- the serving_scope test has real data rather than a fixture invented to pass.
--
-- IDEMPOTENT BY DELETE-THEN-INSERT (R5b H2). The notice tables are append-only in
-- production, but a seed is a REPLACEMENT of a known fixture population, and the
-- assertion chain makes ON CONFLICT the wrong instrument: re-seeding should
-- restore the fixture exactly, not append a second assertion to it.
--
-- ESCAPED: `_` is a LIKE wildcard (R5b H1).
DELETE FROM notices.notice_target
 WHERE assertion_id IN (SELECT assertion_id FROM notices.notice
                         WHERE notice_id LIKE 'ntc\_seed\_%' ESCAPE '\');
DELETE FROM notices.notice WHERE notice_id LIKE 'ntc\_seed\_%' ESCAPE '\';

-- Two assertions on ONE instance, so the fixture exercises supersession rather
-- than only the happy single-row case: drafted, then published.
INSERT INTO notices.notice
  (assertion_id, notice_id, version, organization_id, disposition, notice_type,
   title_en, title_zh_hant, body_en, body_zh_hant,
   publish_at, expire_at, mandatory_ack, recorded_by)
VALUES
  ('nota_seed_lift_1', 'ntc_seed_lift', 1, 'org_wingfu_holdings', 'draft_saved',
   'planned_interruption',
   'Low-zone lift maintenance', '低層升降機維修',
   'The low-zone lift bank will be out of service for annual maintenance.',
   '低層升降機組將暫停服務，以進行年度維修。',
   NULL, NULL, false, 'stf_wfg_manager'),
  ('nota_seed_lift_2', 'ntc_seed_lift', 2, 'org_wingfu_holdings', 'publication_released',
   'planned_interruption',
   'Low-zone lift maintenance', '低層升降機維修',
   'The low-zone lift bank will be out of service for annual maintenance on 15 September, 09:00-17:00.',
   '低層升降機組將於九月十五日上午九時至下午五時暫停服務，以進行年度維修。',
   now() - interval '1 day', now() + interval '30 days', true, 'stf_wfg_manager');

-- The targeting rule belongs to the PUBLISHED assertion. A Location target, not a
-- building target: that distinction is the whole fixture.
INSERT INTO notices.notice_target
  (target_id, assertion_id, node_kind, node_id, location_id, resident_group_id)
VALUES
  -- LOCATION ONLY, no node. Naming the block as well would resolve to the whole
  -- building and hide the very distinction this fixture exists to show.
  ('ntgt_seed_lift', 'nota_seed_lift_2', NULL, NULL,
   'loc_wfg_lift_bank_low', NULL);

-- ── approval policy for the demonstration organization (GEN-040 D3) ──────────
--
-- SEED VALUES, NOT CODE DEFAULTS. The gating decision is data: an emergency and a
-- planned interruption reach every household and are approved by a second person;
-- a community event is not. Another organization may choose differently, and the
-- code must not know which.
--
-- Note what is NOT here: no row for any other organization, so every other org is
-- gated on all four types until somebody decides. That is the fail-closed default
-- doing its job rather than an omission.
DELETE FROM notices.approval_policy WHERE organization_id = 'org_wingfu_holdings';
INSERT INTO notices.approval_policy (organization_id, notice_type, requires_approval) VALUES
  ('org_wingfu_holdings', 'emergency',            true),
  ('org_wingfu_holdings', 'planned_interruption', true),
  ('org_wingfu_holdings', 'general',              false),
  ('org_wingfu_holdings', 'event_community',      false);
