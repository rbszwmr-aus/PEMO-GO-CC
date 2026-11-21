-- A reference to a file, with the file deliberately absent (ADR-019 D8).
--
-- ─── WHAT THIS IS NOT ───────────────────────────────────────────────────────
--
-- NO BYTES. This table holds a REFERENCE and its metadata; the object itself lives
-- wherever the storage decision eventually puts it. Bytes in a relational row make
-- every backup, replica and query pay for them forever, and the decision to do
-- that should be made deliberately rather than by defaulting.
--
-- AND NO OBJECT STORE IS CHOSEN HERE. `GEN-006-ST` left cloud provider and
-- environment topology Unresolved, and picking a store as a side effect of needing
-- an attachment column would decide an infrastructure question inside a notices
-- PID. `storage_ref` is therefore OPAQUE TEXT WITH NO FORMAT CONSTRAINT — the
-- absence is the design. A CHECK enforcing an S3 key shape, or a URL, would
-- enshrine exactly the choice being deferred, and would have to be migrated away
-- the moment the real decision is made.
--
-- ─── WHY platform AND NOT notices ───────────────────────────────────────────
--
-- Notices are the first caller, not the owner. A tenancy document, a work order
-- photo and a meeting minute are all attachments, and none of them belongs to
-- `notices`. Platform Foundation owns the cross-cutting record; the owning module
-- is named in the row.
CREATE TABLE platform.attachment_ref (
  attachment_id     text PRIMARY KEY DEFAULT 'att_' || gen_random_uuid(),

  -- WHO IT BELONGS TO, by stable id and WITHOUT A FOREIGN KEY. The owner may live
  -- in any module's schema, and a foreign key would make this table a reader of
  -- all of them — the same boundary rule notices follows (ADR-019 D1).
  owner_module      text NOT NULL,
  owner_entity_kind text NOT NULL,
  owner_entity_id   text NOT NULL,

  filename          text NOT NULL,
  content_type      text NOT NULL,
  size_bytes        bigint NOT NULL,

  -- OPAQUE. See the header: no format constraint, deliberately.
  storage_ref       text NOT NULL,

  -- A declared vocabulary, because "was this file scanned?" is a question with a
  -- fixed set of answers and an unconstrained string would accumulate synonyms.
  -- `pending` is the default because a file is unscanned until something scans it,
  -- and defaulting to `clean` would be a security claim made by a schema default.
  scan_status       text NOT NULL DEFAULT 'pending',

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT attachment_scan_status_check
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed')),
  CONSTRAINT attachment_size_nonnegative CHECK (size_bytes >= 0)
);

COMMENT ON TABLE platform.attachment_ref IS
  'ADR-019 D8. A reference to an attached file and its metadata. NO BYTES, and NO OBJECT STORE CHOSEN: storage remains an open decision (GEN-006-ST left provider and topology Unresolved), so this record is store-agnostic by design.';
COMMENT ON COLUMN platform.attachment_ref.storage_ref IS
  'OPAQUE. Deliberately unconstrained text: an S3 key, a URI, a filesystem path or something not yet imagined. The ABSENCE OF A FORMAT CONSTRAINT IS THE DESIGN — a CHECK here would enshrine the storage decision this record exists to defer, and would have to be migrated away when the real decision is made.';
COMMENT ON COLUMN platform.attachment_ref.owner_entity_id IS
  'The owning entity''s stable id. NO FOREIGN KEY: the owner may live in any module''s schema, and a key here would make platform a reader of all of them.';
COMMENT ON COLUMN platform.attachment_ref.scan_status IS
  'Declared vocabulary. Defaults to pending, never clean: a schema default must not make a security claim about a file nothing has scanned.';

CREATE INDEX attachment_owner_idx
  ON platform.attachment_ref (owner_module, owner_entity_kind, owner_entity_id);
