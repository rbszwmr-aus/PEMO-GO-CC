-- Locations and serving scope (ADR-003).
--
-- Serving scope is inserted in the same transaction as each location, because the
-- deferred constraint trigger rejects at COMMIT any location that has none. That
-- is the intended behaviour: a location created without a serving scope is
-- REJECTED, not silently scoped to its physical parent.
--
-- The seeded set is chosen to make the divergent cases real rather than
-- theoretical:
--
--   corridor    physical parent and serving scope COINCIDE — the degenerate case
--   lobby       serves its own block — the common-area event audience
--   clubhouse   sits in Block C, serves the WHOLE ESTATE — the case that proves
--               an implicit default would produce a wrong audience
--   lift bank   serves floors 1-20 only          } partial floor sets, and the
--   shuttle     serves G/F plus 21-40 only       } case residents notice most
--   car park    serves the whole estate, and its audience is NOT its space-holders
--   public area serves nobody PEMO can notify

BEGIN;

INSERT INTO property.location
  (location_id, organization_id, estate_id, location_class, physical_parent_type, physical_parent_id,
   parent_location_id, name_en, name_zh_hant, external_ref)
VALUES
  ('loc_wfg_a_12_corridor', 'org_wingfu_holdings', 'est_wing_fu_garden', 'common_area',
   'floor', 'fl_wfg_a_12', NULL, '12/F Corridor', '12樓走廊', NULL),

  ('loc_wfg_block_a_lobby', 'org_wingfu_holdings', 'est_wing_fu_garden', 'common_area',
   'building', 'blk_wfg_a', NULL, 'Main lobby · Block A', 'A座 · 大堂', NULL),

  -- The clubhouse: a CONTAINER whose children are bookable facilities. Booking
  -- attaches to the child, not to this — a resident books the function room, not
  -- "the clubhouse". Booking fields belong to Amenities and Booking and are absent.
  ('loc_wfg_clubhouse', 'org_wingfu_holdings', 'est_wing_fu_garden', 'clubhouse',
   'building', 'blk_wfg_c', NULL, 'Wing Fu Clubhouse', '榮富會所', NULL),

  ('loc_wfg_function_room', 'org_wingfu_holdings', 'est_wing_fu_garden', 'public_facility',
   'building', 'blk_wfg_c', 'loc_wfg_clubhouse', 'Function room', '多用途室', NULL),

  ('loc_wfg_lift_bank_low', 'org_wingfu_holdings', 'est_wing_fu_garden', 'building_service',
   'building', 'blk_wfg_a', NULL, 'Lift 1-2 (low zone)', '升降機1-2（低層）', NULL),

  ('loc_wfg_lift_shuttle', 'org_wingfu_holdings', 'est_wing_fu_garden', 'building_service',
   'building', 'blk_wfg_a', NULL, 'Shuttle lift (high zone)', '穿梭升降機（高層）', NULL),

  -- Car park: a Location with an EXTERNAL REFERENCE, and nothing else. No gate, no
  -- tariff, no occupancy, no transaction. The individual spaces are Units.
  ('loc_wfg_carpark', 'org_wingfu_holdings', 'est_wing_fu_garden', 'public_facility',
   'estate', 'est_wing_fu_garden', NULL, 'Resident car park', '住戶停車場', 'carpark:WFG'),

  -- A public area. The public has a right of access here, PEMO has no channel to
  -- the public, and so this location has NO resident audience. It is a separate
  -- class from common_area precisely because collapsing the two fails silently:
  -- nobody would be notified and nothing would error.
  ('loc_wfg_public_passage', 'org_wingfu_holdings', 'est_wing_fu_garden', 'public_area',
   'estate', 'est_wing_fu_garden', NULL, 'Public through-passage', '公眾通道', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO property.location_serving_scope (location_id, node_type, node_id) VALUES
  -- Degenerate case: scope equals the physical parent. Recorded EXPLICITLY anyway.
  ('loc_wfg_a_12_corridor', 'floor', 'fl_wfg_a_12'),

  ('loc_wfg_block_a_lobby', 'building', 'blk_wfg_a'),

  -- The clubhouse sits in Block C and serves the WHOLE ESTATE.
  ('loc_wfg_clubhouse',     'estate', 'est_wing_fu_garden'),
  ('loc_wfg_function_room', 'estate', 'est_wing_fu_garden'),

  -- Partial floor sets. A lift bank serving 1-20 while a shuttle serves G/F plus
  -- 21-40 is the ordinary arrangement, and "Lift 3 is out of service" must reach
  -- exactly the residents whose floors that lift serves and nobody else.
  ('loc_wfg_lift_bank_low', 'floor', 'fl_wfg_a_01'),
  ('loc_wfg_lift_bank_low', 'floor', 'fl_wfg_a_12'),
  ('loc_wfg_lift_bank_low', 'floor', 'fl_wfg_a_20'),
  ('loc_wfg_lift_shuttle',  'floor', 'fl_wfg_a_gf'),
  ('loc_wfg_lift_shuttle',  'floor', 'fl_wfg_a_21'),
  ('loc_wfg_lift_shuttle',  'floor', 'fl_wfg_a_40'),

  -- A fire in the car park concerns everyone present, not only the people who own
  -- bays. The audience is the serving scope, never the set of space-holders.
  ('loc_wfg_carpark', 'estate', 'est_wing_fu_garden'),

  ('loc_wfg_public_passage', 'estate', 'est_wing_fu_garden')
ON CONFLICT DO NOTHING;

COMMIT;

-- Lift availability. NOTE what is absent: no examination date, no certificate, no
-- registration number, no contractor, no maintenance schedule, no fault code.
-- Lifts and escalators fall under Cap. 618 and that regime is FM's and the
-- statutory authority's. PEMO communicates; it does not comply on the building's
-- behalf, exactly as it does not operate the statutory fire alarm.
--
-- The shuttle lift is seeded with a DELIBERATELY OLD timestamp so that the
-- staleness rule is exercised by the default seed rather than only by a test:
-- a state with no recent update renders as `unknown`, never as in-service.
INSERT INTO property.building_service_availability
  (location_id, state, source, last_updated_at, freshness_window_seconds, note_en, note_zh_hant)
VALUES
  ('loc_wfg_lift_bank_low', 'in_service', 'management', '2026-08-13T09:55:00+08:00', 3600,
   'In service', '正常服務'),
  ('loc_wfg_lift_shuttle', 'in_service', '2iothub', '2026-08-10T09:00:00+08:00', 3600,
   'Last report is old', '最後回報時間已久')
ON CONFLICT (location_id) DO NOTHING;
