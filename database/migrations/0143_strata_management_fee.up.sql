-- Strata management-fee ledger for the management-web live slice.
--
-- Charges, receipts, and the staff email outbox (invoice, admin test, notice
-- email). Households, units and notices are named by stable id only. This
-- schema does not own notice content and does not foreign-key another module.
CREATE SCHEMA IF NOT EXISTS strata;
COMMENT ON SCHEMA strata IS
  'Strata management fees: charges, payments and the staff email outbox. References households, units and notices by stable id only. Does not own notice content.';

CREATE TABLE strata.charge (
  charge_id           text        PRIMARY KEY,
  organization_id     text        NOT NULL,
  household_id        text        NOT NULL,
  resident_id         text        NOT NULL,
  payer_name          text        NOT NULL,
  unit_id             text        NOT NULL,
  floor_id            text        NOT NULL,
  building_id         text        NOT NULL,
  estate_id           text        NOT NULL,
  unit_label_en       text        NOT NULL,
  unit_label_zh_hant  text        NOT NULL,
  scope_json          jsonb       NOT NULL,
  period              text        NOT NULL,
  kind_en             text        NOT NULL,
  kind_zh_hant        text        NOT NULL,
  issued_on           date        NOT NULL,
  due_on              date        NOT NULL,
  amount_hkd          integer     NOT NULL CHECK (amount_hkd >= 0),
  status              text        NOT NULL CHECK (status IN ('due', 'paid', 'partial', 'overdue')),
  tone                text        NOT NULL CHECK (tone IN ('normal', 'information', 'warning', 'unknown')),
  staff_notes_en      text,
  staff_notes_zh_hant text,
  invoice_number      text        NOT NULL,
  scheduled_send_at   timestamptz NOT NULL,
  contact_email       text        NOT NULL,
  line_kind_en        text        NOT NULL,
  line_kind_zh_hant   text        NOT NULL
);

CREATE TABLE strata.payment (
  payment_id          text    PRIMARY KEY,
  organization_id     text    NOT NULL,
  household_id        text    NOT NULL,
  resident_id         text    NOT NULL,
  payer_name          text    NOT NULL,
  unit_id             text    NOT NULL,
  floor_id            text    NOT NULL,
  building_id         text    NOT NULL,
  estate_id           text    NOT NULL,
  unit_label_en       text    NOT NULL,
  unit_label_zh_hant  text    NOT NULL,
  scope_json          jsonb   NOT NULL,
  paid_on             date    NOT NULL,
  method              text    NOT NULL CHECK (method IN ('fps', 'cheque', 'cash', 'octopus')),
  amount_hkd          integer NOT NULL CHECK (amount_hkd >= 0),
  reference_en        text    NOT NULL,
  reference_zh_hant   text    NOT NULL,
  staff_notes_en      text,
  staff_notes_zh_hant text
);

CREATE TABLE strata.payment_allocation (
  allocation_id text    PRIMARY KEY,
  payment_id    text    NOT NULL REFERENCES strata.payment (payment_id),
  charge_id     text    NOT NULL REFERENCES strata.charge (charge_id),
  amount_hkd    integer NOT NULL CHECK (amount_hkd >= 0)
);

CREATE TABLE strata.email_outbox (
  outbox_id        text        PRIMARY KEY,
  organization_id  text        NOT NULL,
  kind             text        NOT NULL CHECK (kind IN ('invoice', 'admin_test', 'notice')),
  subject_id       text,
  to_address       text        NOT NULL,
  from_address     text        NOT NULL,
  subject          text        NOT NULL,
  body_text        text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('logged', 'sent', 'failed')),
  transport        text        NOT NULL CHECK (transport IN ('log', 'smtp')),
  transport_detail text        NOT NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  recorded_by      text        NOT NULL
);

CREATE INDEX email_outbox_subject_idx
  ON strata.email_outbox (organization_id, kind, subject_id, recorded_at DESC);
