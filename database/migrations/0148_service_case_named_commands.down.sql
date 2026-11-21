-- RT5-F6 rollback of the service_case named commands. No row data is rewritten or deleted.
-- Restoration of the legacy shared login's table grants lives in
-- 0148's companion rollback step at the end of a down sequence, applied by
-- the bootstrap/test harness via 010-grants' predecessor path:
-- database/migrations is schema-owned, so the cluster-level re-grant of
-- pemo_app is 0148_service_case_named_commands.down.sql's DO block only if it
-- does not name another schema. The full legacy re-grant is in
-- database/roles/010-grants-legacy.sql and is invoked explicitly by rollback tests.
DROP FUNCTION IF EXISTS service_case.append_assertion(text,text,integer,text,text,text,text,boolean,text,timestamptz,text,text,text,text);
DROP FUNCTION IF EXISTS service_case.open_from_ticket(text,text,text,text,text);
