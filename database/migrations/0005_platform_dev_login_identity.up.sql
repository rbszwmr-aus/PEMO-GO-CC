-- DEVELOPMENT-ONLY authentication stub identity.
--
-- The identity provider is Unresolved in the committed architecture baseline and
-- is NOT selected here. This table exists so that the development auth stub has
-- somewhere to look up a subject, and for no other reason.
--
-- It is deliberately NOT in the resident schema. Resident business identity is
-- separate from login identity, that separation is locked, and the PID requires
-- it to be visible in the schema rather than merely intended. Putting the login
-- subject in another module's schema makes the separation structural: resident_id
-- here is a stable identifier with NO foreign key, exactly like every other
-- cross-module reference.
--
-- Identity and Access will own this concept properly. When it does, this table is
-- DELETED, not migrated.
CREATE TABLE platform.dev_login_identity (
  subject       text        PRIMARY KEY,
  resident_id   text        NOT NULL,
  is_dev_only   boolean     NOT NULL DEFAULT true
                            CHECK (is_dev_only),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform.dev_login_identity IS
  'DEVELOPMENT ONLY. Not an identity provider, not production identity, no credential storage. The is_dev_only CHECK cannot be satisfied by a non-development row.';
