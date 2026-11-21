-- Notices schema (ADR-019 D2).
--
-- WHY A MODULE OF ITS OWN, when Home Safety already broadcasts to residents.
--
-- ADR-019 D1 makes PEMO the SYSTEM OF RECORD for a notice: the notice exists,
-- and is answerable for, independently of whether anything was ever delivered.
-- D2 then splits that from delivery — `notices` owns the notice, Notification
-- owns getting it to a device. Folding notices into Home Safety would tie a
-- planned water interruption to the safety-event lifecycle, which is a different
-- thing with a different urgency and a different audience rule.
--
-- NO CROSS-MODULE FOREIGN KEY (D1). Property nodes, Locations, households and
-- residents are referenced BY STABLE ID ONLY. A foreign key here would make
-- `notices` a reader of another module's storage rather than of its interface,
-- and the boundary check exists to keep that true.
CREATE SCHEMA IF NOT EXISTS notices;
COMMENT ON SCHEMA notices IS
  'Notices: the notice as a record of what management told residents, when, and to whom. Owns the notice instance, its assertion chain, the audience snapshot and acknowledgements. References property nodes, Locations, households and residents BY STABLE ID ONLY — no cross-module foreign key. Owns no delivery: Notification owns that (ADR-019 D2).';
