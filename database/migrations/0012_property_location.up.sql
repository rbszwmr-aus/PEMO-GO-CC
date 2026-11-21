-- Locations (ADR-003).
--
-- ONE Location entity with TWO INDEPENDENT relationships:
--
--   physical_parent  answers  "where is it?"   — exactly one node
--   serving_scope    answers  "whose is it?"   — one or more nodes
--
-- Neither is derivable from the other. For a floor corridor the two coincide and
-- the general case simply degenerates; that is not a reason to collapse them.
-- The clubhouse is the case that proves why: it sits in one block and serves the
-- whole estate, so an implicit default silently produces a wrong audience.
--
-- common_area and public_area are SEPARATE CLASSES and must not be merged. PEMO
-- has no channel to the public, so a public area has no resident audience — and
-- that failure is silent if the two are collapsed, because nobody is notified and
-- nothing errors.
CREATE TABLE property.location (
  location_id          text        PRIMARY KEY,
  organization_id      text        NOT NULL,   -- stable id, NO FK
  estate_id            text        NOT NULL REFERENCES property.estate (estate_id),
  location_class       text        NOT NULL
                                   CHECK (location_class IN ('common_area', 'public_area',
                                                             'public_facility', 'clubhouse',
                                                             'building_service')),
  physical_parent_type text        NOT NULL
                                   CHECK (physical_parent_type IN ('estate', 'phase', 'building', 'floor')),
  physical_parent_id   text        NOT NULL,
  parent_location_id   text        NULL REFERENCES property.location (location_id),
  name_en              text        NOT NULL,
  name_zh_hant         text        NOT NULL,
  description_en       text        NULL,
  description_zh_hant  text        NULL,
  external_ref         text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX location_estate_idx ON property.location (estate_id);
CREATE INDEX location_class_idx ON property.location (location_class);
CREATE INDEX location_parent_idx ON property.location (physical_parent_type, physical_parent_id);

COMMENT ON TABLE property.location IS
  'A Location carries identity, class, position, serving scope, an optional external reference, an optional resident-facing availability state and descriptive text. It carries NO asset, condition, inspection, warranty, maintenance or cost attribute, and NO booking fields — those belong to Amenities and Booking, FM, CMMS and EAM. For lifts and escalators this is strictest: Cap. 618 examination certificates, registration and contractor records are the statutory regime''s, exactly as statutory fire alarms are.';

COMMENT ON COLUMN property.location.parent_location_id IS
  'Clubhouse containment only: a clubhouse is a container whose children are bookable public_facility locations. Booking attaches to the CHILD — a resident books the function room, not "the clubhouse".';

-- Serving scope. NOT optional, and never defaulted to the physical parent.
CREATE TABLE property.location_serving_scope (
  location_id  text NOT NULL REFERENCES property.location (location_id) ON DELETE CASCADE,
  node_type    text NOT NULL CHECK (node_type IN ('estate', 'phase', 'building', 'floor', 'unit')),
  node_id      text NOT NULL,
  PRIMARY KEY (location_id, node_type, node_id)
);
CREATE INDEX location_serving_scope_node_idx ON property.location_serving_scope (node_type, node_id);

COMMENT ON TABLE property.location_serving_scope IS
  'Who this location serves. A lift bank serving floors 1-20 while a shuttle serves G/F plus 21-40 is the ordinary case, not an edge case: "Lift 3 is out of service" must reach exactly the residents whose floors that lift serves and nobody else. Notifying a whole block about a lift they never use is how residents learn to ignore PEMO notifications, which then degrades the safety channel sharing the same inbox.';

-- A location created without a serving scope is REJECTED, not silently scoped to
-- its parent. Deferred so that a location and its scope rows can be inserted in
-- either order within one transaction; the check fires at COMMIT.
CREATE FUNCTION property.assert_serving_scope_present() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_id text;
  scope_count integer;
BEGIN
  target_id := COALESCE(NEW.location_id, OLD.location_id);

  -- A location deleted in the same transaction needs no scope.
  IF NOT EXISTS (SELECT 1 FROM property.location WHERE location_id = target_id) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO scope_count
  FROM property.location_serving_scope
  WHERE location_id = target_id;

  IF scope_count = 0 THEN
    RAISE EXCEPTION
      'location % has no serving scope. serving_scope is not optional and must not default to the physical parent (ADR-003).',
      target_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER location_requires_serving_scope
  AFTER INSERT ON property.location
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION property.assert_serving_scope_present();

CREATE CONSTRAINT TRIGGER serving_scope_removal_leaves_none
  AFTER DELETE ON property.location_serving_scope
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION property.assert_serving_scope_present();
