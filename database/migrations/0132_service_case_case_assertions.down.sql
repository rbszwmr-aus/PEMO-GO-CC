-- Reverse of 0132. Refuses once a chain, a note, a link or a rating exists: each
-- is a record of work done or of a resident's judgement of it.
DO $$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM (SELECT case_id FROM service_case.service_case
                                 GROUP BY case_id HAVING max(version) > 1) s)
       + (SELECT count(*) FROM service_case.case_note)
       + (SELECT count(*) FROM service_case.case_external_link)
       + (SELECT count(*) FROM service_case.case_satisfaction) INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0132: % superseded assertion(s), note(s), external link(s) or rating(s) '
      'exist. Each records work done or a resident''s judgement of it. Remove them deliberately '
      'first, or do not reverse.', n;
  END IF;
END $$;

DROP VIEW IF EXISTS service_case.case_current;
DROP TABLE IF EXISTS service_case.case_satisfaction;
DROP TABLE IF EXISTS service_case.case_external_link;
DROP TABLE IF EXISTS service_case.case_note;
DROP TABLE IF EXISTS service_case.service_case;
