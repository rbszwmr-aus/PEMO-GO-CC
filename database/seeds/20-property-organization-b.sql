-- Organization B — Harbour Property Management.
--
-- This exists so that cross-organization isolation can be TESTED rather than
-- asserted. A resident of Organization A must not reach Organization B by any
-- path: not by unit id, not by event id, not by the unit switcher, not by
-- acknowledging someone else's event. A test proving that needs a real
-- Organization B with real rows behind those identifiers.
INSERT INTO property.estate (estate_id, organization_id, portfolio_id, name_en, name_zh_hant) VALUES
  ('est_harbour_view', 'org_harbour_property', NULL, 'Harbour View Court', '海景閣')
ON CONFLICT DO NOTHING;

INSERT INTO property.building (building_id, estate_id, phase_id, name_en, name_zh_hant) VALUES
  ('blk_hbv_b', 'est_harbour_view', NULL, 'Block B', 'B座')
ON CONFLICT DO NOTHING;

INSERT INTO property.floor (floor_id, building_id, label, ordinal) VALUES
  ('fl_hbv_b_05', 'blk_hbv_b', '5/F', 5)
ON CONFLICT DO NOTHING;

INSERT INTO property.unit (unit_id, floor_id, unit_class, label, external_ref) VALUES
  ('unit_hbv_b_05_b2', 'fl_hbv_b_05', 'residential', 'B2', NULL)
ON CONFLICT DO NOTHING;

BEGIN;
INSERT INTO property.location
  (location_id, organization_id, estate_id, location_class, physical_parent_type, physical_parent_id,
   parent_location_id, name_en, name_zh_hant, external_ref)
VALUES
  ('loc_hbv_lobby', 'org_harbour_property', 'est_harbour_view', 'common_area',
   'building', 'blk_hbv_b', NULL, 'Main lobby · Block B', 'B座 · 大堂', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO property.location_serving_scope (location_id, node_type, node_id) VALUES
  ('loc_hbv_lobby', 'building', 'blk_hbv_b')
ON CONFLICT DO NOTHING;
COMMIT;

INSERT INTO property.estate_contact
  (contact_id, estate_id, contact_kind, name_en, name_zh_hant, telephone,
   hours_en, hours_zh_hant, instructions_en, instructions_zh_hant, opens_at, closes_at,
   typical_reply_minutes, sort_order)
VALUES
  ('ctc_hbv_office', 'est_harbour_view', 'management_office',
   'Management Office', '管理處', '3123 2211',
   'Open 09:00–17:00 daily', '每日09:00至17:00開放',
   'Staff usually reply within 45 minutes during office hours.', '辦公時間內職員通常於45分鐘內回覆。',
   '09:00', '17:00', 45, 0)
ON CONFLICT (contact_id) DO NOTHING;
