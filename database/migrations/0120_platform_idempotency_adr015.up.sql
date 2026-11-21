-- ADR-015 replaces platform.idempotency_record.
--
-- 0004 IS NOT EDITED. This migration replaces what it built, and the replacement
-- is a DROP-and-CREATE rather than an ALTER because every column changes meaning.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- WHY THE SHIPPED MECHANISM IS REMOVED RATHER THAN ADAPTED
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 0004's table was keyed (scope, idempotency_key) and stored `outcome jsonb` —
-- the response body. ADR-015 D3 keys on (principal, operation, key) and D4 states
-- that no response blob is stored and a repeat RE-DERIVES the response by reading
-- the act it produced. Those are not variants of one design; they are opposite
-- answers to the same question.
--
-- AND THE SHIPPED ONE DID NOT WORK. GEN-023 Step 1b drove it against a database
-- and measured, rather than reading the source:
--
--     SEQUENTIAL: compute ran 1x   -> correct
--     CONCURRENT: compute ran 2x   -> its own comment claims "two simultaneous
--                                     taps still produce one effect". FALSE.
--
-- `once()` checked for a row, ran the act, then inserted ON CONFLICT DO NOTHING.
-- Two concurrent callers both found nothing, BOTH RAN THE ACT, and only then did
-- one lose the insert race and read the winner's row. One response, two effects,
-- and the loser's act unrecorded and unreturned — the worst of the outcomes,
-- because it is invisible. A second window: the act and the INSERT were in
-- DIFFERENT transactions, so a crash between them left the act done and the key
-- unwritten, and a retry ran it again.
--
-- It was used by NOBODY (constructed in wiring.ts, called by no route) and tested
-- by nothing. A broken mechanism that is wired but unused is a landmine: the
-- first caller to reach for it would inherit both defects believing they were
-- solved. Removing it is part of the fix, not tidying.
--
-- ─── THE NULL TRAP, WHICH IS THE WHOLE REASON FOR NULLS NOT DISTINCT ─────────
--
-- A PROVISIONING act has NO principal (ADR-010 A1 — the bootstrap is an event,
-- not a role), so principal_id is NULL in the uniqueness tuple. Postgres treats
-- NULLs as DISTINCT in a unique index BY DEFAULT: two rows with principal_id
-- NULL and the same (operation, key) would BOTH be accepted, and idempotency
-- would silently not hold for exactly the acts that create authority.
--
-- NULLS NOT DISTINCT (PostgreSQL 15+) makes two NULL principals collide, which is
-- what the invariant means. It is stated here rather than worked around with a
-- sentinel value, because a sentinel principal is the fabricated principal A1
-- forbids, arriving through a different door.
--
-- ─── WHAT IS STORED: THE ACT'S IDENTITY (D4) ─────────────────────────────────
--
-- act_kind / act_id name the thing the act produced. A repeat reads THAT and
-- re-derives its response, so the response is never stale and no personal data is
-- copied into a second place. act_kind carries no foreign key: the act lives in
-- another module's schema and cross-module foreign keys are forbidden.
--
-- ─── RETENTION (D6) ──────────────────────────────────────────────────────────
--
-- Keys are RETAINED. Pruning is an owner-level maintenance act, never a runtime
-- delete — pemo_app holds SELECT + INSERT and cannot delete one at all, so the
-- append-only floor holds here by construction rather than by policy.

DROP TABLE IF EXISTS platform.idempotency_record;

CREATE TABLE platform.idempotency_record (
  -- ADR-015 D3's key. principal_id is NULLABLE and NOT a foreign key: it names a
  -- principal in the access schema, and cross-module foreign keys are forbidden.
  -- NULL means the act had no principal — a provisioning act — and is honest
  -- absence, the same representation ADR-010 A1 requires of the audit spine.
  principal_id     text        NULL,
  operation        text        NOT NULL,
  idempotency_key  text        NOT NULL,

  -- THE ACT'S IDENTITY, never its response (D4).
  act_kind         text        NOT NULL,
  act_id           text        NOT NULL,

  -- The audit event this act wrote, so a repeat can be traced to the original
  -- act's record rather than only to its result.
  audit_id         text        NOT NULL,

  first_seen_at    timestamptz NOT NULL DEFAULT now()
);

-- NULLS NOT DISTINCT is the whole of the provisioning half of D3. Without it two
-- provisioning acts sharing a key both land.
CREATE UNIQUE INDEX idempotency_record_key
  ON platform.idempotency_record (principal_id, operation, idempotency_key)
  NULLS NOT DISTINCT;

COMMENT ON TABLE platform.idempotency_record IS
  'ADR-015. Request identity: (principal, operation, key), where principal is NULL for an act with no actor. Stores the ACT''S IDENTITY, never a response blob — a repeat re-derives its response by reading the act (D4). Written in the SAME TRANSACTION as act and audit by the audited-write primitive (D2), which is what closes the two windows the mechanism 0004 shipped left open: two concurrent callers both running the act, and a crash between the act and the key.';

COMMENT ON INDEX platform.idempotency_record_key IS
  'NULLS NOT DISTINCT, deliberately. A provisioning act has no principal (ADR-010 A1), so principal_id is NULL; under Postgres''s default NULL-distinct semantics two provisioning acts with one key would BOTH be accepted and idempotency would fail for exactly the acts that create authority. A sentinel principal would fix the index and reintroduce the fabricated principal A1 forbids.';
