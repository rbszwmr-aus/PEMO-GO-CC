-- RT5-F6 rollback of the idempotency commands. No row data is rewritten or deleted.
DROP FUNCTION IF EXISTS platform.record_idempotency(text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS platform.lookup_idempotency(text,text,text);
