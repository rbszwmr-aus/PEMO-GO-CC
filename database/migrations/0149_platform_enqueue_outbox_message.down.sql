-- RT5-F6 rollback of the outbox enqueue command. No row data is rewritten or deleted.
DROP FUNCTION IF EXISTS platform.enqueue_outbox_message(uuid,text,text,timestamptz,timestamptz,text,uuid,uuid,jsonb,jsonb);
