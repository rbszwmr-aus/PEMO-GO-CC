-- Reverse of 0131. Refuses once a chain or a thread exists: collapsing the
-- assertions would discard a Ticket's timeline, and dropping the thread would
-- destroy correspondence with a resident. Both are the record itself.
DO $$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM (SELECT ticket_id FROM helpdesk.ticket
                                 GROUP BY ticket_id HAVING max(version) > 1) s)
       + (SELECT count(*) FROM helpdesk.ticket_message) INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0131: % superseded ticket assertion(s) and/or message(s) exist. '
      'Reversing would discard a Ticket''s timeline and its correspondence with a resident. '
      'Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP VIEW IF EXISTS helpdesk.ticket_current;
DROP TABLE IF EXISTS helpdesk.ticket_message;
DROP TABLE IF EXISTS helpdesk.ticket_reference;
DROP TABLE IF EXISTS helpdesk.ticket;
