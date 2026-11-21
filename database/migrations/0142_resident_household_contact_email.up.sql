-- Household billing / invoice delivery address.
--
-- Invoice send (fixture and later live) uses this as To. Nullable: a household
-- may exist before anyone supplies an email. Aligns with management-web
-- fixture field `contactEmail`. Secrets for SMTP stay out of this table —
-- Administration Email config / server env hold the From side.
ALTER TABLE resident.household
  ADD COLUMN contact_email text NULL;

COMMENT ON COLUMN resident.household.contact_email IS
  'Household contact email used when sending invoices. Nullable when not supplied. Maps to fixture/API contactEmail.';
