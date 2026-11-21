#!/usr/bin/env bash
#
# EVERY FIXTURE INSERT IS IDEMPOTENT — AND THE MEMBERSHIP IS DERIVED.
#
# Seeding twice must be a no-op. A seed that fails the second time makes a
# rebuilt database a different thing from a re-seeded one, and the difference
# shows up as a test failure far from its cause.
#
# The rule is NOT "every insert carries `ON CONFLICT`", and that distinction is
# the point of `R5b`. `ON CONFLICT` is a MECHANISM; idempotency is the PROPERTY.
# This repository already achieves the property three different ways, and a check
# that demanded one mechanism would have been wrong on two of them:
#
#   ON CONFLICT   the ordinary case, for a fixture that layers.
#   DELETE-first  the scenarios, whose own header says they "REPLACE rather than
#                 layer" — deleting the population and reinserting it is MORE
#                 idempotent than `ON CONFLICT DO NOTHING`, not less, because it
#                 also removes rows a previous version of the scenario left behind.
#   TEMP TABLE    `block_basis` and friends are `ON COMMIT DROP` scratch tables
#                 inside one transaction. There is no conflict to resolve; a
#                 conflict clause there would be noise asserting nothing.
#
# So the check enumerates every `INSERT` in `database/seeds/` and asks whether it
# is idempotent BY SOME MECHANISM, naming which. A new seed file is covered the
# moment it is written; nothing is listed by hand.
#
# ─── THIS IS THE STATIC HALF ─────────────────────────────────────────────────
#
# It reads text, so it can be fooled by SQL it does not parse. The GROUND TRUTH
# is `seed-twice-is-a-noop` in the integration suite, which actually runs the
# seed twice against a real database and compares. This check exists because the
# runtime one needs a database and the hook must stay fast — they are two
# witnesses to one property, and the runtime one is the authority.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
cd "$REPO" || exit 2

python3 - <<'PY'
import io, os, re, sys

SEEDS = 'database/seeds'

# COMMENTS ARE STRIPPED BEFORE ANYTHING IS JUDGED.
#
# Measured, not assumed: the first bite of this check commented out an
# `ON CONFLICT` and the check still passed, because the words were still in the
# text. A checker that reads commented-out SQL as live SQL reports the mechanism
# a file USED TO have. `--` to end of line; `$$`-quoted bodies are not used in
# these seeds, and a string literal containing `--` would be misread, which is
# stated here rather than left to be discovered.
comment_re = re.compile(r'--[^\n]*')
stmt_split = re.compile(r';\s*(?:\n|$)')
insert_re  = re.compile(r'\bINSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_.]*)', re.I)
conflict_re= re.compile(r'\bON\s+CONFLICT\b', re.I)
delete_re  = re.compile(r'\bDELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_.]*)', re.I)
temp_re    = re.compile(r'\bCREATE\s+(?:TEMP|TEMPORARY|UNLOGGED)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_.]*)', re.I)

total = 0
by_mech = {'on-conflict': 0, 'delete-first': 0, 'temp-table': 0}
bad = []

files = []
for dp, dn, fn in os.walk(SEEDS):
    for f in sorted(fn):
        if f.endswith('.sql'):
            files.append(os.path.join(dp, f))
files.sort()

for path in files:
    src = comment_re.sub('', io.open(path, encoding='utf-8').read())
    temps = {t.lower() for t in temp_re.findall(src)}
    deleted = set()
    for stmt in stmt_split.split(src):
        for t in delete_re.findall(stmt):
            deleted.add(t.lower())
        m = insert_re.search(stmt)
        if not m:
            continue
        total += 1
        target = m.group(1).lower()
        if conflict_re.search(stmt):
            by_mech['on-conflict'] += 1
        elif target in temps:
            by_mech['temp-table'] += 1
        elif target in deleted:
            # The DELETE must come BEFORE the INSERT to make it idempotent, which
            # it does: `deleted` is accumulated as the file is walked in order.
            by_mech['delete-first'] += 1
        else:
            bad.append((path, target))

if bad:
    print(f'  FAIL   fixtures-idempotent: {len(bad)} INSERT(s) with no idempotency mechanism')
    for path, target in bad[:20]:
        print(f'          {path}: INSERT INTO {target}')
    print('          ^ Add ON CONFLICT, or DELETE the population first (scenarios do),')
    print('            or make it a TEMP table if it is scratch.')
    sys.exit(1)

print(f'  ok     every fixture INSERT is idempotent          {total} insert(s): '
      f"{by_mech['on-conflict']} on-conflict, {by_mech['delete-first']} delete-first, "
      f"{by_mech['temp-table']} temp-table")
PY
