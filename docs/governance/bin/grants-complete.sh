#!/usr/bin/env bash
#
# RT5-F6: each module login's ROLE MODEL holds, and its grants are complete
# AND not excessive.
#
# THE PREMISE ARM COMES FIRST, AND IT IS THE ONE WITHOUT WHICH THE REST IS THEATRE.
# A superuser bypasses privilege checks and acquires nothing that appears in
# role_table_grants, so the EXCESS arm is blind to the one drift that fully
# defeats ADR-010 D1's fourth property. The role model is asserted before
# anything else runs, for every production login, every privilege role, and
# the command definer.
#
# Expected grants are derived by rule, never a maintained table list:
#   * pemo_priv_<schema> holds SELECT+INSERT on that schema's tables only
#   * pemo_app_<schema> is a member of only that privilege role (INHERIT)
#   * helpdesk may SELECT (not INSERT) service_case — case-command reads
#   * the definer holds only the grants the named commands need
#   * the legacy shared login pemo_app holds no table grants
#   * dev_scaffold stays off production identities
#
# EXPECTED_EXTRA lists documented exceptions (the six-column UPDATE on
# strata.email_outbox, granted to the Strata privilege role).
#
# Point this check at a throwaway database without editing database/dev/.env
# by exporting PEMO_GOVERNANCE_ENV to a copy of that file.
#
#   docs/governance/bin/grants-complete.sh          loud skip with no database
#   REQUIRE_DB=1 …                                  absent database is FATAL

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="${PEMO_GOVERNANCE_ENV:-$REPO/database/dev/.env}"

EXPECTED_EXTRA="
# 0145: claim, requeue and markResult on an admitted outbox row.
# Column-level only — to_address and body stay immutable.
strata.email_outbox:UPDATE:attempt,claimed_at,send_key,status,transport,transport_detail
"

skip(){ printf '  SKIP  grants-complete: %s\n        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n' "$1"
        [ -n "${REQUIRE_DB:-}" ] && { printf '  FAIL  %s, and REQUIRE_DB is set\n' "$1"; exit 1; }; exit 0; }

[ -f "$ENVF" ] || skip "no database/dev/.env"
# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a
export PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}"
PSQL=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_OWNER_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)
"${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1 || skip "database ${PEMO_DB_NAME:-?} unreachable"

LOGIN_PREFIX="${PEMO_DB_LOGIN_PREFIX:-pemo_app_}"
PRIV_PREFIX="${PEMO_DB_PRIV_PREFIX:-pemo_priv_}"
DEFINER="${PEMO_DEFINER_ROLE:-pemo_definer_commands}"
LEGACY="${PEMO_APP_ROLE:-${PEMO_DB_USER:-pemo_app}}"
OWNER="${PEMO_OWNER_ROLE:-pemo_owner}"
MODEL="${PEMO_APP_ROLE_MODEL:-pemo_app}"
PROD_SCHEMAS="platform property resident home_safety access notices helpdesk strata"
DEV_SCHEMA_SQL=""
if [ "${PEMO_ENV:-}" = "development" ] || [ "${PEMO_ENV:-}" = "test" ] || [ "${PEMO_ENV:-}" = "ci" ]; then
  DEV_SCHEMA_SQL="UNION ALL SELECT '${PRIV_PREFIX}dev_scaffold', 'dev_scaffold', 'SELECT', NULL::text UNION ALL SELECT '${PRIV_PREFIX}dev_scaffold', 'dev_scaffold', 'INSERT', NULL::text"
fi
ident(){ case "$1" in ''|*[!a-zA-Z0-9_]*) printf '  FAIL  grants-complete: %s is not a safe SQL identifier: %s\n' "$2" "$1"; exit 1;; esac; }
ident_prefix(){
  body="${1%_}"
  case "$body" in ''|*[!a-zA-Z0-9_]*) printf '  FAIL  grants-complete: %s is not a safe prefix: %s\n' "$2" "$1"; exit 1;; esac
  [ "$1" = "${body}_" ] || [ "$1" = "$body" ] || { printf '  FAIL  grants-complete: %s is not a safe prefix: %s\n' "$2" "$1"; exit 1; }
}
ident_prefix "$LOGIN_PREFIX" PEMO_DB_LOGIN_PREFIX
ident_prefix "$PRIV_PREFIX" PEMO_DB_PRIV_PREFIX
ident "$DEFINER" PEMO_DEFINER_ROLE
ident "$LEGACY" PEMO_APP_ROLE
ident "$OWNER" PEMO_OWNER_ROLE
ident "$MODEL" PEMO_APP_ROLE_MODEL

# ─── PREMISE: the role model, derived from the declaration ───────────────────
ROLES_SQL="$REPO/database/roles/000-roles.sql"
[ -f "$ROLES_SQL" ] || { printf '  FAIL  grants-complete: %s is missing — the declared role posture cannot be derived, so nothing below can be trusted\n' "$ROLES_SQL"; exit 1; }

DECL="$(grep -iE "^[[:space:]]*ALTER[[:space:]]+ROLE[[:space:]]+$MODEL\b" "$ROLES_SQL" | head -1)"
[ -n "$DECL" ] || { printf '  FAIL  grants-complete: no ALTER ROLE declaration for %s in %s.\n        ^ The posture is DERIVED, never assumed. No declaration means no expectation,\n          and an empty expectation would pass vacuously — which is the failure this names.\n' "$MODEL" "$ROLES_SQL"; exit 1; }

DENIED="$(printf '%s' "$DECL" | tr 'a-z' 'A-Z' | grep -oE '\bNO(SUPERUSER|CREATEDB|CREATEROLE|BYPASSRLS|INHERIT|REPLICATION|LOGIN)\b' | sed 's/^NO//' | sort -u)"
[ -n "$DENIED" ] || { printf '  FAIL  grants-complete: the ALTER ROLE line for %s declares no NO<attribute> tokens, so this check would assert nothing.\n        %s\n' "$MODEL" "$DECL"; exit 1; }

col_for(){ case "$1" in
  SUPERUSER) echo rolsuper;; CREATEDB) echo rolcreatedb;; CREATEROLE) echo rolcreaterole;;
  BYPASSRLS) echo rolbypassrls;; INHERIT) echo rolinherit;; REPLICATION) echo rolreplication;;
  LOGIN) echo rolcanlogin;; *) echo "";; esac; }

DENIED_ATTRS="$(printf '%s\n' "$DENIED" | grep -v '^LOGIN$' || true)"
[ -n "$DENIED_ATTRS" ] || DENIED_ATTRS="SUPERUSER
CREATEDB
CREATEROLE
BYPASSRLS"

roles_to_check=""
add_role(){ roles_to_check="${roles_to_check}${roles_to_check:+ }$1"; }
add_role "$LEGACY"
add_role "$DEFINER"
for s in $PROD_SCHEMAS; do
  add_role "${LOGIN_PREFIX}${s}"
  add_role "${PRIV_PREFIX}${s}"
done
if [ "${PEMO_ENV:-}" = "development" ] || [ "${PEMO_ENV:-}" = "test" ] || [ "${PEMO_ENV:-}" = "ci" ]; then
  add_role "${LOGIN_PREFIX}dev_scaffold"
  add_role "${PRIV_PREFIX}dev_scaffold"
fi

premise=""
for role in $roles_to_check; do
  if [ "$("${PSQL[@]}" -c "SELECT count(*) FROM pg_roles WHERE rolname='$role';")" != "1" ]; then
    premise="$premise${premise:+$'\n'}role $role does not exist — every grant assertion below would pass vacuously"
    continue
  fi
  for attr in $DENIED_ATTRS; do
    col="$(col_for "$attr")"
    [ -n "$col" ] || { printf '  FAIL  grants-complete: declaration names NO%s and this check has no pg_roles column for it.\n        ^ Unmapped means unchecked, silently. Add the mapping.\n' "$attr"; exit 1; }
    if [ "$("${PSQL[@]}" -c "SELECT $col FROM pg_roles WHERE rolname='$role';")" = "t" ]; then
      premise="$premise${premise:+$'\n'}$role has $col=true but 000-roles.sql declares NO$attr"
    fi
  done
  owned="$("${PSQL[@]}" -c "
    SELECT n.nspname||'.'||c.relname
      FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE r.rolname='$role' AND c.relkind IN ('r','p') ORDER BY 1;")"
  [ -z "$owned" ] || premise="$premise${premise:+$'\n'}$role OWNS $(printf '%s\n' "$owned" | wc -l) table(s): $(printf '%s' "$owned" | tr '\n' ' ')"
done

for s in $PROD_SCHEMAS dev_scaffold; do
  login="${LOGIN_PREFIX}${s}"
  priv="${PRIV_PREFIX}${s}"
  if [ "$s" = "dev_scaffold" ] && [ "${PEMO_ENV:-}" != "development" ] && [ "${PEMO_ENV:-}" != "test" ] && [ "${PEMO_ENV:-}" != "ci" ]; then
    continue
  fi
  if [ "$("${PSQL[@]}" -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='$login';" 2>/dev/null || true)" = "f" ]; then
    premise="$premise${premise:+$'\n'}$login is NOLOGIN; a module pool cannot connect as it"
  fi
  if [ "$("${PSQL[@]}" -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='$priv';" 2>/dev/null || true)" = "t" ]; then
    premise="$premise${premise:+$'\n'}$priv can log in; privilege roles must be NOLOGIN"
  fi
done
if [ "$("${PSQL[@]}" -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='$DEFINER';")" = "t" ]; then
  premise="$premise${premise:+$'\n'}$DEFINER can log in; the command definer must be NOLOGIN"
fi

for s in $PROD_SCHEMAS; do
  login="${LOGIN_PREFIX}${s}"
  priv="${PRIV_PREFIX}${s}"
  members="$("${PSQL[@]}" -c "
    SELECT r.rolname
      FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      JOIN pg_roles u ON u.oid = m.member
     WHERE u.rolname='$login'
     ORDER BY 1;")"
  if ! printf '%s\n' "$members" | grep -Fxq "$priv"; then
    premise="$premise${premise:+$'\n'}$login is not a member of $priv"
  fi
  unexpected="$(printf '%s\n' "$members" | grep -v -x "$priv" | grep -v '^$' || true)"
  [ -z "$unexpected" ] || premise="$premise${premise:+$'\n'}$login has unexpected memberships: $(printf '%s' "$unexpected" | tr '\n' ' ')"
done

if [ -n "$premise" ]; then
  printf '  FAIL  grants-complete: THE ROLE MODEL IS BREACHED — every grant assertion below is void\n'
  printf '%s\n' "$premise" | sed 's/^/          /'
  printf '          ^ A superuser bypasses table permissions without appearing in role_table_grants,\n            and an owner can re-grant itself. ADR-010 D1 property 4 is not held.\n'
  exit 1
fi

missing=$("${PSQL[@]}" -c "
  WITH owner_schemas AS (
    SELECT n.nspname
      FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
     WHERE r.rolname='$OWNER' AND n.nspname NOT LIKE 'pg\\_%'
       AND n.nspname NOT IN ('information_schema','public')
  ),
  expected(grantee, schema, priv) AS (
    SELECT '${PRIV_PREFIX}'||s, s, p
      FROM unnest(string_to_array('$PROD_SCHEMAS' || CASE WHEN '${PEMO_ENV:-}' IN ('development','test','ci') THEN ' dev_scaffold' ELSE '' END, ' ')) AS s
      CROSS JOIN unnest(ARRAY['SELECT','INSERT']) AS p
    UNION ALL
    SELECT '${PRIV_PREFIX}helpdesk', 'service_case', 'SELECT'
    UNION ALL
    SELECT '$DEFINER', 'access', 'INSERT'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'SELECT'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'INSERT'
    UNION ALL
    SELECT '$DEFINER', 'service_case', 'SELECT'
    UNION ALL
    SELECT '$DEFINER', 'service_case', 'INSERT'
    UNION ALL
    SELECT '$DEFINER', 'helpdesk', 'SELECT'
  )
  SELECT t.table_schema||'.'||t.table_name||' missing '||e.priv||' for '||e.grantee
    FROM information_schema.tables t
    JOIN expected e ON e.schema = t.table_schema
   WHERE t.table_type='BASE TABLE'
     AND t.table_schema IN (SELECT nspname FROM owner_schemas)
     AND NOT (e.grantee = '$DEFINER' AND t.table_schema='access' AND t.table_name <> 'audit_event')
     AND NOT (e.grantee = '$DEFINER' AND t.table_schema='platform' AND t.table_name NOT IN ('idempotency_record','outbox_message'))
     AND NOT (e.grantee = '$DEFINER' AND t.table_schema='helpdesk' AND t.table_name <> 'ticket')
     AND NOT (e.grantee = '${PRIV_PREFIX}access' AND t.table_schema='access' AND t.table_name='audit_event' AND e.priv='INSERT')
     AND NOT (e.grantee = '${PRIV_PREFIX}platform' AND t.table_schema='platform' AND t.table_name='idempotency_record')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.role_table_grants g
        WHERE g.grantee=e.grantee AND g.table_schema=t.table_schema
          AND g.table_name=t.table_name AND g.privilege_type=e.priv)
   ORDER BY 1;")

grantee_list=""
schema_list="$PROD_SCHEMAS"
if [ "${PEMO_ENV:-}" = "development" ] || [ "${PEMO_ENV:-}" = "test" ] || [ "${PEMO_ENV:-}" = "ci" ]; then
  schema_list="$PROD_SCHEMAS dev_scaffold"
fi
for s in $schema_list; do
  grantee_list="${grantee_list},'${LOGIN_PREFIX}${s}','${PRIV_PREFIX}${s}'"
done
grantee_list="${grantee_list#?}"
grantee_list="${grantee_list},'$DEFINER','$LEGACY'"

excess=$("${PSQL[@]}" -c "
  WITH expected(grantee, schema, priv, only_table) AS (
    SELECT '${PRIV_PREFIX}'||s, s, p, NULL::text
      FROM unnest(string_to_array('$PROD_SCHEMAS' || CASE WHEN '${PEMO_ENV:-}' IN ('development','test','ci') THEN ' dev_scaffold' ELSE '' END, ' ')) AS s
      CROSS JOIN unnest(ARRAY['SELECT','INSERT']) AS p
    UNION ALL
    SELECT '${PRIV_PREFIX}helpdesk', 'service_case', 'SELECT', NULL
    UNION ALL
    SELECT '$DEFINER', 'access', 'INSERT', 'audit_event'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'SELECT', 'idempotency_record'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'INSERT', 'idempotency_record'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'SELECT', 'outbox_message'
    UNION ALL
    SELECT '$DEFINER', 'platform', 'INSERT', 'outbox_message'
    UNION ALL
    SELECT '$DEFINER', 'helpdesk', 'SELECT', 'ticket'
    UNION ALL
    SELECT '$DEFINER', 'service_case', 'SELECT', NULL
    UNION ALL
    SELECT '$DEFINER', 'service_case', 'INSERT', NULL
  )
  SELECT g.grantee||' '||g.table_schema||'.'||g.table_name||' grants '||g.privilege_type
    FROM information_schema.role_table_grants g
   WHERE g.grantee IN ($grantee_list)
     AND g.table_schema IN (SELECT n.nspname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
                    WHERE r.rolname='$OWNER' AND n.nspname NOT LIKE 'pg\\_%'
                      AND n.nspname NOT IN ('information_schema','public'))
     AND NOT EXISTS (
       SELECT 1 FROM expected e
        WHERE e.grantee=g.grantee AND e.schema=g.table_schema AND e.priv=g.privilege_type
          AND (e.only_table IS NULL OR e.only_table=g.table_name)
     )
   ORDER BY 1;")

expected_table=""
expected_col=""
expected_desc=""
while IFS= read -r raw || [ -n "$raw" ]; do
  line="${raw%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [ -z "$line" ] && continue
  rel="${line%%:*}"
  rest="${line#*:}"
  [ "$rel" = "$line" ] || [ -z "$rest" ] && {
    printf '  FAIL  grants-complete: EXPECTED_EXTRA line is not schema.table:PRIVILEGE: %s\n' "$line"
    exit 1
  }
  priv="${rest%%:*}"
  cols="${rest#*:}"
  if [ "$cols" = "$rest" ]; then
    expected_table="${expected_table}${rel} ${priv}"$'\n'
    expected_desc="${expected_desc}${expected_desc:+, }${rel} ${priv}"
  else
    expected_desc="${expected_desc}${expected_desc:+, }${rel} ${priv} (columns)"
    oifs=$IFS
    IFS=,
    for col in $cols; do
      IFS=$oifs
      col="${col#"${col%%[![:space:]]*}"}"
      col="${col%"${col##*[![:space:]]}"}"
      [ -z "$col" ] && continue
      expected_col="${expected_col}${rel} ${priv} ${col}"$'\n'
    done
    IFS=$oifs
  fi
done <<EXPECTED_LINES
$EXPECTED_EXTRA
EXPECTED_LINES

filtered=""
if [ -n "$excess" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    rest="${line#* }"
    rel="${rest%% grants *}"
    priv="${rest#* grants }"
    if printf '%s\n' "$expected_table" | grep -Fxq "${rel} ${priv}"; then
      continue
    fi
    filtered="${filtered}${line}"$'\n'
  done <<EXCESS_LINES
$excess
EXCESS_LINES
  excess="${filtered%"${filtered##*[![:space:]]}"}"
fi

col_excess=$("${PSQL[@]}" -c "
  SELECT DISTINCT g.grantee||' '||g.table_schema||'.'||g.table_name||' grants '||g.privilege_type||' on column '||g.column_name
    FROM information_schema.role_column_grants g
   WHERE g.grantee IN ($grantee_list)
     AND g.table_schema IN (SELECT n.nspname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
                    WHERE r.rolname='$OWNER' AND n.nspname NOT LIKE 'pg\\_%'
                      AND n.nspname NOT IN ('information_schema','public'))
     AND g.privilege_type NOT IN ('SELECT','INSERT')
   ORDER BY 1;")
filtered_cols=""
if [ -n "$col_excess" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    body="${line#* }"
    left="${body%% on column *}"
    col="${body#* on column }"
    rel="${left%% grants *}"
    priv="${left#* grants }"
    if printf '%s\n' "$expected_col" | grep -Fxq "${rel} ${priv} ${col}"; then
      continue
    fi
    filtered_cols="${filtered_cols}${line}"$'\n'
  done <<COL_LINES
$col_excess
COL_LINES
  col_excess="${filtered_cols%"${filtered_cols##*[![:space:]]}"}"
else
  col_excess=""
fi

dev_leak=$("${PSQL[@]}" -c "
  SELECT g.grantee||' '||g.table_schema||'.'||g.table_name||' grants '||g.privilege_type
    FROM information_schema.role_table_grants g
   WHERE g.table_schema='dev_scaffold'
     AND g.grantee IN ($grantee_list)
     AND g.grantee NOT IN ('${PRIV_PREFIX}dev_scaffold','${LOGIN_PREFIX}dev_scaffold')
   ORDER BY 1;")

rc=0
if [ -n "$missing" ]; then
  printf '  FAIL  grants-complete: %s table/privilege pair(s) MISSING — the app breaks on deploy\n' "$(printf '%s\n' "$missing" | wc -l)"
  printf '%s\n' "$missing" | sed 's/^/          /'; rc=1
fi
if [ -n "$excess" ] || [ -n "$col_excess" ]; then
  printf '  FAIL  grants-complete: EXCESS grant(s) — append-only is eroding, and silently\n'
  [ -n "$excess" ] && printf '%s\n' "$excess" | sed 's/^/          /'
  [ -n "$col_excess" ] && printf '%s\n' "$col_excess" | sed 's/^/          /'
  rc=1
fi
if [ -n "$dev_leak" ]; then
  printf '  FAIL  grants-complete: production identity holds dev_scaffold grants\n'
  printf '%s\n' "$dev_leak" | sed 's/^/          /'; rc=1
fi
if [ "$rc" -eq 0 ]; then
  extra_note="SELECT+INSERT only, per module"
  [ -n "$expected_desc" ] && extra_note="SELECT+INSERT per module, plus documented extra: $expected_desc"
  table_n="$("${PSQL[@]}" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema IN (SELECT n.nspname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
                    WHERE r.rolname='$OWNER' AND n.nspname NOT LIKE 'pg\\_%'
                      AND n.nspname NOT IN ('information_schema','public')) AND table_type='BASE TABLE';")"
  printf '  ok    %-52s role model holds for module logins (%s), %s tables, %s\n' "grants complete and not excessive" \
    "$(printf '%s' "$DENIED_ATTRS" | tr '\n' ',' | sed 's/,$//')" \
    "$table_n" \
    "$extra_note"
fi
exit $rc
