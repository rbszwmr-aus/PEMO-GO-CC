-- The Ticket, as an assertion chain (ADR-020 D4, ADR-013).
--
-- Same discipline as scope_grant (0118), group_membership (0123) and notice
-- (0126): the instance is stable, every change is a NEW ASSERTION, current is
-- MAX(version), and there is no UPDATE path because pemo_app holds SELECT+INSERT
-- by rule. "Status and timeline" IS the assertion history — a resident asking
-- "what happened to my report?" is asking to see this chain.
--
-- STATE IS COMPUTED (`helpdesk.ticket_current`), never stored. A mutable status
-- column would be a second source of truth; 0117 records what that cost.

CREATE TABLE helpdesk.ticket (
  assertion_id    text PRIMARY KEY DEFAULT 'tkta_' || gen_random_uuid(),
  ticket_id       text        NOT NULL,
  version         integer     NOT NULL,
  organization_id text        NOT NULL,

  -- THE ACT, not the state. `escalated` is its own kind (dispatch D2) because
  -- escalation is a thing someone DID, and collapsing it into a priority change
  -- would lose who escalated and when.
  disposition     text        NOT NULL,

  -- ─── intake, CAS-01 (ADR-020 D7) ──────────────────────────────────────────
  channel         text        NOT NULL,
  -- NULLABLE ON PURPOSE: an anonymous report is a real intake channel, and the
  -- schema must be able to hold one. WHETHER anonymity is permitted for a given
  -- act is policy and belongs to the write surface; the NULLABILITY is the schema
  -- fact. Forcing a reporter here would make the model unable to represent a
  -- legitimate case, which is the worse error.
  reporter_ref    text,
  reporter_kind   text,
  category        text        NOT NULL,
  description     text        NOT NULL,
  -- Where it is, by stable id. An ADR-003 Location, or an ADR-002 node, or both.
  location_ref    text,
  node_kind       text,
  node_id         text,

  -- ─── triage, CAS-02 (ADR-020 D6) ──────────────────────────────────────────
  ticket_type     text,
  priority        text,
  -- A DECLARED QUEUE IDENTIFIER, not a team foreign key. ADR-020 OQ2's
  -- disposition: no team entity is invented, because a queue is what triage
  -- actually chooses and a team is an org-chart claim this model has not earned.
  queue           text,
  -- A FACT, not a rule. `due_at` is what was promised; the SLA engine that would
  -- compute it is explicitly out of scope, and storing the promise without the
  -- engine is honest rather than incomplete.
  due_at          timestamptz,
  related_ticket_ref text,

  -- ─── the link, owned by the TICKET (ADR-020 D3) ───────────────────────────
  -- Nullable: a Ticket exists before anyone decides which Case it belongs to.
  -- No foreign key — service_case is another module.
  primary_case_ref text,

  -- On the CLOSING assertion. Null elsewhere, and that asymmetry is the point:
  -- the reason belongs to the act of closing, not to the ticket.
  closure_reason  text,

  recorded_at     timestamptz NOT NULL DEFAULT now(),
  recorded_by     text        NOT NULL,

  CONSTRAINT ticket_version_unique UNIQUE (ticket_id, version),
  CONSTRAINT ticket_version_positive CHECK (version >= 1),
  CONSTRAINT ticket_disposition_check
    CHECK (disposition IN ('opened', 'triaged', 'escalated', 'closed', 'reopened')),
  CONSTRAINT ticket_channel_check
    CHECK (channel IN ('resident_app', 'staff_manual', 'phone', 'email', 'kiosk', 'external')),
  -- A reporter is named completely or not at all; a kind without a ref names
  -- nobody, and a ref without a kind is ambiguous across two id spaces.
  CONSTRAINT ticket_reporter_complete CHECK ((reporter_ref IS NULL) = (reporter_kind IS NULL)),
  CONSTRAINT ticket_reporter_kind_check
    CHECK (reporter_kind IS NULL OR reporter_kind IN ('resident', 'staff_principal')),
  CONSTRAINT ticket_node_complete CHECK ((node_kind IS NULL) = (node_id IS NULL)),
  -- Closure reason only on a closing assertion.
  CONSTRAINT ticket_closure_reason_placement
    CHECK (closure_reason IS NULL OR disposition = 'closed')
);

COMMENT ON TABLE helpdesk.ticket IS
  'ADR-020 D4 / ADR-013. Append-only assertions about a Ticket instance; current = MAX(version). Never UPDATEd — a triage, an escalation, a closure and a reopen are each a new assertion, so the timeline a resident asks for IS this table.';
COMMENT ON COLUMN helpdesk.ticket.reporter_ref IS
  'NULLABLE BY DESIGN: an anonymous report is a real intake, and the schema must hold one. Whether a given act may be anonymous is POLICY and belongs to the write surface (cut C); the nullability is the schema fact.';
COMMENT ON COLUMN helpdesk.ticket.queue IS
  'ADR-020 OQ2 — a DECLARED QUEUE IDENTIFIER, not a foreign key to a team. No team entity is invented: a queue is what triage chooses, and a team is an org-chart claim this model has not earned.';
COMMENT ON COLUMN helpdesk.ticket.primary_case_ref IS
  'ADR-020 D3: THE TICKET OWNS THE LINK. A stable service_case id with no foreign key. service_case reaches its Tickets through the helpdesk public interface, never by joining or by holding its own join table (D9).';
COMMENT ON COLUMN helpdesk.ticket.due_at IS
  'A FACT — what was promised — not a computed rule. The SLA engine is out of scope; recording the promise without the engine is honest rather than incomplete.';

CREATE INDEX ticket_instance_version_idx ON helpdesk.ticket (ticket_id, version DESC);
CREATE INDEX ticket_org_idx ON helpdesk.ticket (organization_id);
CREATE INDEX ticket_primary_case_idx ON helpdesk.ticket (primary_case_ref);

-- ─── the DISPLAY REFERENCE: a per-organization human sequence ───────────────
--
-- DISTINCT FROM THE STABLE ID, deliberately (dispatch D3). `ticket_id` is opaque
-- and permanent; the display reference is what a resident reads over the phone,
-- and it must be short, ordered and unique WITHIN an organization. Making them one
-- column would either leak a global count across tenants or force the stable id to
-- carry presentation.
--
-- It belongs to the INSTANCE, not the assertion — a reference that changed when a
-- ticket was retriaged would be useless for the one thing it exists to do.
CREATE TABLE helpdesk.ticket_reference (
  ticket_id       text PRIMARY KEY,
  organization_id text   NOT NULL,
  display_ref     text   NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_reference_unique_per_org UNIQUE (organization_id, display_ref)
);
COMMENT ON TABLE helpdesk.ticket_reference IS
  'The human-facing reference, unique PER ORGANIZATION and distinct from the opaque stable ticket_id. One column serving both would leak a cross-tenant count or push presentation into the identifier. Belongs to the instance, so it survives every reassertion.';

-- ─── computed state ─────────────────────────────────────────────────────────
CREATE VIEW helpdesk.ticket_current AS
SELECT DISTINCT ON (ticket_id) *,
       disposition AS lifecycle_state
  FROM helpdesk.ticket
 ORDER BY ticket_id, version DESC;

COMMENT ON VIEW helpdesk.ticket_current IS
  'ADR-020 D4. The current assertion and the state read off it. The single definition — a reader computing state independently would be a second implementation of the rule.';

-- ─── the message thread (ADR-020 D5) ────────────────────────────────────────
--
-- VISIBILITY IS SET AT INSERT AND NEVER CHANGES. There is no flip act and no
-- UPDATE path: an internal note cannot become visible, and a visible update is a
-- NEW MESSAGE. This is the whole privacy model of the Ticket/Case group — the
-- resident projection filters on THIS COLUMN ALONE, so a leak requires somebody
-- to write a resident_visible message on purpose.
CREATE TABLE helpdesk.ticket_message (
  message_id  text PRIMARY KEY DEFAULT 'tmsg_' || gen_random_uuid(),
  ticket_id   text        NOT NULL,
  author_ref  text        NOT NULL,
  author_kind text        NOT NULL,
  body        text        NOT NULL,
  visibility  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ticket_message_author_kind_check
    CHECK (author_kind IN ('staff_principal', 'resident')),
  CONSTRAINT ticket_message_visibility_check
    CHECK (visibility IN ('resident_visible', 'internal'))
);

COMMENT ON TABLE helpdesk.ticket_message IS
  'ADR-020 D5. Append-only thread. VISIBILITY IS IMMUTABLE: set at insert, never changed — there is no flip act and no UPDATE grant. A visible correction is a NEW message, so the record of what the resident could see at any past moment survives.';
COMMENT ON COLUMN helpdesk.ticket_message.visibility IS
  'THE ONLY THING A RESIDENT PROJECTION MAY FILTER ON for message visibility (ADR-020 D5). No default: a message''s audience must be a decision the writer made, never one a schema made for them.';

CREATE INDEX ticket_message_ticket_idx ON helpdesk.ticket_message (ticket_id, created_at);
CREATE INDEX ticket_message_visibility_idx ON helpdesk.ticket_message (ticket_id, visibility);
