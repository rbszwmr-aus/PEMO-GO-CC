CREATE SCHEMA IF NOT EXISTS resident;
COMMENT ON SCHEMA resident IS
  'Resident and Household: resident business identity, household membership, effective-dated occupancy, resident-to-unit authorization, preferences and pass. Owns NO login credential and NO property master.';
