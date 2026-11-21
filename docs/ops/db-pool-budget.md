# Database pool budget

The API opens one `pg` pool per module schema it wires (nine in
`apps/api/src/wiring.ts` today: platform, property, resident, home_safety,
dev_scaffold, helpdesk, strata, access, notices). Each pool connects as that
module's own login (`pemo_app_<schema>` by default). The pool count is
unchanged; only the credentials change. The runtime never opens the
admin/owner pool.

Per process:

    configured_capacity = PEMO_DB_POOL_MAX × <module pool count> × PEMO_DB_REPLICA_COUNT

Defaults: `PEMO_DB_POOL_MAX=5`, `PEMO_DB_REPLICA_COUNT=1`, so one process
budgets 45 connections. `PEMO_DB_REPLICA_COUNT` is advisory only: it is
read for this note and is not checked at startup against
`max_connections`. Two replicas at the defaults are 90 connections; a
cluster with `max_connections=100` (97 usable after
`superuser_reserved_connections=3`) has only a thin remainder, and would
breach a one-third reserve.

Do not add replicas that would push `configured_capacity` into that reserve.
If more capacity is needed, raise `max_connections` or lower `PEMO_DB_POOL_MAX`
first; do not let each replica silently multiply past the isolated database
limit.

Waits are bounded: `PEMO_DB_CONNECT_TIMEOUT_MS` (default 2000) caps pool
acquisition, `PEMO_DB_STATEMENT_TIMEOUT_MS` (default 5000) cancels a slow
runtime query, and a cancelled client is released so the process recovers.
Admin and migration connections use `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS`
instead (default 0, meaning off) so a migrate longer than five seconds is
not cancelled. `/health` reports each pool's `totalCount`, `idleCount`,
`waitingCount` and `max`.

A send request claims and attempts at most `PEMO_EMAIL_BATCH_SIZE` (default
50) outbox rows; the rest stay queued for a later request. Two API replicas
must not both dispatch the same outbox row — the existing atomic claim is
what prevents duplicate send, not this budget.
