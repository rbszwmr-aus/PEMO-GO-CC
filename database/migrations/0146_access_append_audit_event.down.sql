-- RT5-F6 rollback of the audit-append command. No row data is rewritten or deleted.
DROP FUNCTION IF EXISTS access.append_audit_event(text,text,text,text,text,text,text,text,text,text,timestamptz,text,text);
