DROP TRIGGER IF EXISTS serving_scope_removal_leaves_none ON property.location_serving_scope;
DROP TRIGGER IF EXISTS location_requires_serving_scope ON property.location;
DROP FUNCTION IF EXISTS property.assert_serving_scope_present();
DROP TABLE IF EXISTS property.location_serving_scope;
DROP TABLE IF EXISTS property.location;
