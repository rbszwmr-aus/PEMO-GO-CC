-- The notice, as an assertion chain (ADR-019 D3, ADR-013 D1/D2).
--
-- SAME SHAPE AS scope_grant (0118) AND group_membership (0123), deliberately.
-- A notice is corrected, republished and withdrawn; each of those is a NEW
-- ASSERTION about the same instance, never an edit of the old one. What a notice
-- said last Tuesday is the thing a dispute turns on, so the old text must survive
-- the correction that replaced it.
--
--   notice_id   the INSTANCE — one notice, stable across every revision
--   version     the assertion — 1, 2, 3 ...; current is MAX(version)
--
-- LIFECYCLE IS COMPUTED, NEVER STORED (ADR-019 D4). There is no mutable `state`
-- column, because a stored state is a second source of truth that drifts from the
-- chain that produced it — 0117 recorded exactly that failure for `status` on
-- occupancy, where the seed disagreed with itself and was RIGHT to. The state of a
-- notice is a function of its latest assertion's `disposition` and its schedule,
-- and `notices.notice_current` computes it.
--
-- AND THERE IS NO UPDATE PATH. `pemo_app` holds SELECT+INSERT by rule
-- (database/roles/010-grants.sql), so the append-only property is enforced by
-- privilege rather than by everyone remembering.

CREATE TABLE notices.notice (
  -- The ASSERTION's own identity. Every row is one, and rows are never modified.
  assertion_id   text PRIMARY KEY DEFAULT 'nota_' || gen_random_uuid(),
  -- The INSTANCE this asserts about, and its place in that instance's chain.
  notice_id      text        NOT NULL,
  version        integer     NOT NULL,

  organization_id text       NOT NULL,

  -- WHAT THIS ASSERTION SAYS THE NOTICE NOW IS.
  --
  -- `disposition` is the ACT, not the state: publishing, correcting and
  -- withdrawing are the three things a person does to a notice, and the state is
  -- read off the latest one together with the schedule. Encoding the act rather
  -- than the state is what makes "withdrawn, then corrected, then republished" a
  -- history rather than a contradiction.
  disposition    text        NOT NULL,

  notice_type    text        NOT NULL,

  -- PER-LANGUAGE FIELDS ON ONE ASSERTION (ADR-019 OQ3).
  --
  -- Not a translations side-table. A notice's two languages are ONE editorial act
  -- — they are corrected together and must never be separately versionable, or a
  -- correction could land in English and not in Chinese and the record would show
  -- a notice that said two different things at once.
  title_en       text        NOT NULL,
  title_zh_hant  text        NOT NULL,
  body_en        text        NOT NULL,
  body_zh_hant   text        NOT NULL,

  -- THE SCHEDULE. Part of the assertion, because rescheduling is a revision of
  -- what was said, not a separate mutable knob.
  publish_at     timestamptz,
  expire_at      timestamptz,

  -- Cross-module reference BY STABLE ID, no foreign key (ADR-019 D1): a notice may
  -- accompany a safety event, and Home Safety owns that event.
  incident_ref   text,

  mandatory_ack  boolean     NOT NULL DEFAULT false,

  -- Provenance of the assertion itself (ADR-013).
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  recorded_by    text        NOT NULL,

  -- ADR-013 D2. The supersession key: one assertion per (instance, version), so a
  -- concurrent second writer at the same version loses here rather than both
  -- landing and leaving the chain ambiguous.
  CONSTRAINT notice_version_unique UNIQUE (notice_id, version),
  CONSTRAINT notice_version_positive CHECK (version >= 1),
  CONSTRAINT notice_disposition_check
    CHECK (disposition IN ('drafted', 'published', 'withdrawn')),
  -- ADR-019 D7. The vocabulary is DECLARED in packages/api-contracts/notice-types.json
  -- and this constraint is a PROJECTION of it, verified by `pnpm check:notice-types`.
  -- Adding a type means editing the declaration and writing a NEW migration to alter
  -- this constraint: migrations are immutable, so the generator refuses a disagreement
  -- rather than editing history to match the present.
  CONSTRAINT notice_type_check
    CHECK (notice_type IN ('general', 'planned_interruption', 'emergency', 'event_community')),
  -- A schedule that ends before it starts is not a schedule.
  CONSTRAINT notice_schedule_ordered
    CHECK (expire_at IS NULL OR publish_at IS NULL OR expire_at > publish_at)
);

COMMENT ON TABLE notices.notice IS
  'ADR-019 D3 / ADR-013. Append-only assertions about a notice instance. Current = MAX(version) per notice_id. Never UPDATEd: a correction, a withdrawal and a republication are each a NEW assertion, so what the notice said before the correction survives it.';
COMMENT ON COLUMN notices.notice.disposition IS
  'The ACT this assertion records — drafted, published or withdrawn — NOT the lifecycle state. State is computed from the latest assertion plus the schedule (notices.notice_current). Storing state would be a second source of truth; 0117 records what that cost on resident.occupancy.status.';
COMMENT ON COLUMN notices.notice.incident_ref IS
  'The stable id of a home_safety safety event this notice accompanies, or NULL. NO FOREIGN KEY, by ADR-019 D1: notices references other modules by stable id and reads them through their interfaces, never through their storage.';
COMMENT ON COLUMN notices.notice.title_en IS
  'ADR-019 OQ3: both languages live on ONE assertion, so a correction cannot land in one language and not the other.';

CREATE INDEX notice_instance_version_idx ON notices.notice (notice_id, version DESC);
CREATE INDEX notice_org_idx ON notices.notice (organization_id);

-- ─── the computed current state ──────────────────────────────────────────────
--
-- This is the ONLY definition of what state a notice is in. A reader that decides
-- for itself is a second implementation of the rule, which is how the two answers
-- start to differ.
CREATE VIEW notices.notice_current AS
WITH latest AS (
  SELECT DISTINCT ON (notice_id) *
    FROM notices.notice
   ORDER BY notice_id, version DESC
)
SELECT
  l.*,
  CASE
    WHEN l.disposition = 'withdrawn' THEN 'withdrawn'
    WHEN l.disposition = 'drafted'   THEN 'draft'
    -- published, and the schedule decides which side of live it is on
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;

COMMENT ON VIEW notices.notice_current IS
  'ADR-019 D4. The computed lifecycle state: latest assertion by version, then its disposition evaluated against the schedule. There is no stored state column anywhere and this view is the single definition — a reader computing it independently would be a second implementation of the rule.';
