#!/usr/bin/env bash
#
# Every ADR the repository REFERENCES has a file in docs/adr/.
#
# WHY THIS IS A CHECK AND NOT ANOTHER HEADER FIELD.
#
# docs/adr/README.md records this exact failure once already: "ADR-002, ADR-003
# and ADR-006 were all Accepted while absent from this directory ... Three
# accumulated before anyone noticed, and docs/adr/ existing implies the ADRs are
# here." The response was two mandatory header fields — Target location and
# Committing session — backfilled across every ADR.
#
# EVERY ONE of the ADRs missing at GEN-017 carried a correct Target location
# pointing at docs/adr/. The field records where a document BELONGS; it cannot
# notice that it never arrived. Three accumulated before; ADR-011, ADR-012,
# ADR-013 and the ADR-010 amendment accumulated again, and reading the repository's
# ADRs alone gave a wrong answer four times over — including one PID reasoning from
# a closure that had been lifted ten days earlier.
#
# A principle is not a control. This is the control.
#
# THE REFERENCE SET IS DERIVED, NEVER LISTED. A maintained list of "ADRs we have"
# is the frozen-axis failure: it is correct only on the day it is written. This
# greps the tree for ADR-NNN and asks the filesystem about each id it finds, so a
# new ADR is covered the moment anything mentions it.
#
# WHAT IS EXCLUDED, AND WHY IT IS A DECISION RATHER THAN AN OVERSIGHT:
#   docs/governance/reports|archive   Rule 7 historical record. A closed report
#                                     naming an ADR that was later withdrawn must
#                                     not turn this red forever.
#   docs/adr itself                   an ADR citing its neighbours is not a
#                                     dangling reference.
#   node_modules, dist                not ours.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ADR_DIR="$REPO/docs/adr"

[ -d "$ADR_DIR" ] || { printf '  FAIL  adrs-present: %s does not exist\n' "$ADR_DIR"; exit 1; }

# Every ADR id referenced anywhere that is not historical record.
referenced=$(grep -rhoE 'ADR-[0-9]{3}' "$REPO" \
  --include='*.ts' --include='*.tsx' --include='*.sql' --include='*.md' \
  --include='*.yaml' --include='*.yml' --include='*.json' --include='*.mjs' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  --exclude-dir=reports --exclude-dir=archive --exclude-dir=adr \
  2>/dev/null | sort -u)

[ -n "$referenced" ] || { printf '  FAIL  adrs-present: no ADR reference found anywhere.\n        ^ The scan matched nothing, so it would pass vacuously. That is the empty oracle,\n          not a clean result.\n'; exit 1; }

missing=""
for id in $referenced; do
  # AN ID RESOLVES ONLY IF THE DECISION DOCUMENT ITSELF IS PRESENT.
  #
  # Matching the FILENAME `ADR-NNN-*.md` is not enough, and this was found by the
  # red failing to fire: docs/adr/ also holds `ADR-012-ACCEPTANCE-...` and
  # `ADR-010-AMENDMENT-...`, either of which satisfies that glob. Deleting the
  # actual ADR-012 left the check green, because its acceptance record answered
  # for it — a presence check that an auxiliary file can satisfy is not a presence
  # check.
  #
  # So the test is on the document's own H1, which distinguishes the three kinds:
  #   `# ADR-012 — ...`             the decision  ← this is what must exist
  #   `# ADR-012 core — ...`        an acceptance record
  #   `# ADR-010 AMENDMENT — ...`   an amendment
  # An em dash immediately after the id is what makes it the ADR proper.
  if ! grep -lE "^# ${id}[[:space:]]+—" "$ADR_DIR"/*.md >/dev/null 2>&1; then
    where=$(grep -rlE "\b${id}\b" "$REPO" \
      --include='*.ts' --include='*.sql' --include='*.md' --include='*.yaml' --include='*.json' --include='*.mjs' \
      --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
      --exclude-dir=reports --exclude-dir=archive --exclude-dir=adr 2>/dev/null \
      | sed "s|^$REPO/||" | head -4 | tr '\n' ' ')
    missing="$missing${missing:+$'\n'}$id has no file in docs/adr/ — referenced by: $where"
  fi
done

if [ -n "$missing" ]; then
  printf '  FAIL  adrs-present: the repository references %s ADR(s) it does not contain\n' "$(printf '%s\n' "$missing" | wc -l)"
  printf '%s\n' "$missing" | sed 's/^/          /'
  printf '          ^ Code and schema resting on a decision a reader of this repository cannot open.\n'
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# ARM 2 — every referenced AMENDMENT resolves.
#
# GEN-017's arm resolves an ADR; it cannot see `ADR-003 AM4`, which is a
# reference one level down. Two properties make this arm correct, and each was a
# real risk flagged before it was written:
#
#   FORM-TOLERANT. Amendment letters are declared three different ways in this
#   repository already — `## A1 —` (ADR-007, folded), `### A1 —` (ADR-010's
#   separate file) and `**AM1 —**` (ADR-003, folded by GEN-019). A resolver keyed
#   on one form reds on the other two while nothing is wrong. Existing headings
#   are NOT normalised to suit the checker; the checker accepts them as authored.
#
#   NAMESPACE-SCOPED. The letter namespace is per ADR: `ADR-007 A4`, `ADR-010 A4`
#   and `ADR-011 A4` are three different amendments. A letter is resolved ONLY
#   against its own ADR's documents — the base file plus any `ADR-NNN-AMENDMENT-*`
#   — so one ADR's A4 can never satisfy another's.
#   NO "AT LEAST ONE" VACUITY GUARD HERE, DELIBERATELY — and do not add one.
#   Arms 1 and 3 fail when their scan matches nothing, because an ADR reference
#   and a principle citation always exist in this repository. Amendment
#   references do not: zero of them is a legitimate state, so a numeric guard
#   would red where nothing is wrong. Non-vacuity rests instead on the dangling
#   and namespace reds — `ADR-010 A6` resolving green would mean the scan had
#   silently stopped seeing references, and that red is what surfaces it. Those
#   reds are therefore NOT redundant with each other; do not delete them.
amend_refs=$(grep -rhoE 'ADR-[0-9]{3}[^A-Za-z0-9]{1,4}A[Mm]?[0-9]+' "$REPO" \
  --include='*.ts' --include='*.tsx' --include='*.sql' --include='*.md' \
  --include='*.yaml' --include='*.yml' --include='*.json' --include='*.mjs' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  --exclude-dir=reports --exclude-dir=archive --exclude-dir=adr \
  2>/dev/null | sed -E 's/^(ADR-[0-9]{3})[^A-Za-z0-9]{1,4}(A[Mm]?[0-9]+)$/\1 \2/' | sort -u)

amend_missing=""
if [ -n "$amend_refs" ]; then
  while read -r adr letter; do
    [ -n "$adr" ] || continue
    # The owning ADR's documents: its base file and its own amendment files only.
    owned=$(ls "$ADR_DIR/${adr}-"*.md 2>/dev/null | grep -v -- '-ACCEPTANCE-' || true)
    [ -n "$owned" ] || { amend_missing="$amend_missing${amend_missing:+$'\n'}$adr $letter — $adr itself is not in docs/adr/"; continue; }
    # Form-tolerant: a heading at any depth, or a bold lead, declaring the letter.
    if ! grep -hoE "^(#{1,6}[[:space:]]+|\*\*)${letter}[[:space:]]+—" $owned >/dev/null 2>&1; then
      where=$(grep -rlE "${adr}[^A-Za-z0-9]{1,4}${letter}\b" "$REPO" \
        --include='*.ts' --include='*.sql' --include='*.md' --include='*.yaml' --include='*.json' --include='*.mjs' \
        --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
        --exclude-dir=reports --exclude-dir=archive --exclude-dir=adr 2>/dev/null \
        | sed "s|^$REPO/||" | head -3 | tr '\n' ' ')
      amend_missing="$amend_missing${amend_missing:+$'\n'}$adr $letter is not declared in $adr — referenced by: $where"
    fi
  done <<EOF
$amend_refs
EOF
fi

if [ -n "$amend_missing" ]; then
  printf '  FAIL  adrs-present: %s referenced amendment(s) not declared by their own ADR\n' "$(printf '%s\n' "$amend_missing" | wc -l)"
  printf '%s\n' "$amend_missing" | sed 's/^/          /'
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# ARM 3 — every cited PRINCIPLE resolves.
#
# THIS ARM DELIBERATELY DOES NOT EXCLUDE docs/governance/reports|archive, AND
# THAT ASYMMETRY WITH ARM 1 IS THE POINT. Do not "fix" it into a bug.
#
#   Arm 1 excludes the Rule-7 record because an ADR can legitimately be
#   WITHDRAWN, and a closed report naming a withdrawn ADR would then red forever
#   through no fault of anyone.
#
#   A principle id cannot be withdrawn that way: PID-PRINCIPLES.md's own scheme
#   makes an id PERMANENT and never reused, precisely so that old citations keep
#   resolving. So a dangling principle citation does not mean "this record is
#   old" — it means somebody broke the permanence rule, which is exactly the
#   defect worth catching.
#
#   The cost, accepted knowingly: if a principle is ever genuinely removed, every
#   report citing it reds until that removal is reconciled. That is the check
#   working.
#
#   And without this asymmetry the arm would be VACUOUS — every principle
#   citation in this repository today is inside PID-PRINCIPLES.md itself or
#   inside a Rule-7 record, so the inherited exclusion would leave nothing to
#   check and the arm would pass by examining nothing.
#
# Citations are written as a backticked bracketed slug — never bare — so they
# cannot be confused with a markdown link. (Deliberately not spelled in the
# citation form here: this file is scanned like any other, and a syntax example
# would be read as a citation. GEN-017 hit the same shape when its exemption
# text quoted the very string the checker matched on.)
#
# METASYNTACTIC PLACEHOLDERS ARE DECLARED, NOT GUESSED. A closed list, with the
# reason, in the shape this repository already uses for sanctioned crossings:
# adding to it is a visible diff, never a flag set where it is used.
#
#   other               a template slot in GEN-018's ruling — "distinguished from
#                       [other] by …" — a Rule-7 record, therefore immutable. It
#                       names no principle and never did.
#   slug                the syntax metavariable. GEN-019's reports and its ruling
#                       explain the citation form by writing it, and those records
#                       are immutable once carried.
#   no-such-principle   a deliberate example of a NON-existent id, from GEN-019's
#                       Step 1 list of proposed reds. It exists to not exist.
#
# NOT a place to silence a real dangling citation. Every entry above is a string
# that can never name a principle. A genuine reference whose definition is merely
# LATE is defined, not allowlisted — GEN-019 defined [probe-must-bite] rather than
# listing it here, which is the line between the two.
#
# TRIGGER, recorded so it is not missed: if this list would need ANOTHER entry,
# do the citation-versus-mention syntax cure instead of growing it.
PLACEHOLDERS=" other slug no-such-principle "

# ─────────────────────────────────────────────────────────────────────────────
# A CITATION IS NOT A MENTION, AND THE BRACKETS CANNOT TELL THEM APART.
#
# A backticked, bracketed slug is this corpus's principle-citation form -- the
# shape is not written out here, because writing it would BE one. It is
# ALSO how a validator failure code and a Problem.type slug read in prose — three
# vocabularies, one syntax. GEN-033's close was refused because its report wrote
# the validator code `problem-type-enum-agreement` that way and this arm called it
# a dangling principle.
#
# WHY NOT A SIGIL. The obvious cure is to give citations a distinct form and
# migrate. It is not available: 176 of the corpus's 275 citations live in
# `reports/` and `archive/`, which are Rule-7 records and are NEVER EDITED. A
# migration that cannot touch two thirds of its subject leaves both forms in
# circulation and resolves nothing.
#
# WHY NOT THE ALLOWLIST. It is declared for metavariables — strings that can never
# name a principle. A validator code is a REAL identifier in another namespace;
# listing instances of it would grow a hand-maintained membership list, which is
# the exact shape this PID exists to retire.
#
# SO: RESOLVE AGAINST THE OTHER NAMESPACES, AND DERIVE THEM FROM THE WORLD. A
# bracketed token that IS a known validator code or Problem.type slug is a
# MENTION of that thing, not a dangling principle. Both sets are read from their
# own sources at scan time, so a new code or slug is covered the moment it exists
# and nothing here needs updating.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH: a TYPO of a foreign id still passes as a
# mention. That is the cost, and it is the right way round — those namespaces have
# their own checks (the fixture validator for codes, the registry for slugs), and
# a false alarm here blocks a close while a missed typo in prose does not.
FOREIGN_NS=""
REGISTRY_JSON="$REPO/packages/api-contracts/problem-types.json"
if [ -f "$REGISTRY_JSON" ]; then
  FOREIGN_NS="$FOREIGN_NS $(grep -oE '^    "[a-z0-9][a-z0-9-]*":' "$REGISTRY_JSON" | tr -d ' \":' | tr '\n' ' ')"
fi
# THE VALIDATOR CODES COME FROM THEIR DECLARATION, NOT FROM THE CALL SITES.
#
# GEN-034 gap 2, closed by R5b/H5. This used to grep `fail('<code>'` out of
# validate.mjs, which resolves only the calls that happen to be written that way:
# MEASURED, 120 `fail(` calls yielded 73 codes. A call with the code in a variable
# or wrapped across a line is invisible, and the codes it misses then read as
# DANGLING PRINCIPLE IDS here — a silent narrowing that the vacuity refusal below
# could not see, because the derivation did not resolve NOTHING, it resolved MOST.
# validator-codes.mjs is the declaration, and validate.mjs refuses an undeclared
# code, so the two cannot drift apart.
VALIDATOR_CODES_MJS="$REPO/tests/fixtures/validator-codes.mjs"
if [ -f "$VALIDATOR_CODES_MJS" ]; then
  # THE GRAMMAR IS DERIVED, NEVER RESTATED (GEN-046 G5). Three copies of the
  # character class agreed on `[a-z0-9-]*` and all three lost `openapi-3.1` to
  # the dot. Reading the declaration means this consumer cannot disagree with it.
  VC_PAT="$(node -e "import('file://$VALIDATOR_CODES_MJS').then(m=>process.stdout.write(m.VALIDATOR_CODE_PATTERN))" 2>/dev/null)"
  if [ -z "$VC_PAT" ]; then
    # NO FALLBACK. A default here would be a SECOND copy of the grammar, which is
    # the whole defect this derivation exists to remove — and it would let the
    # check pass with the declaration deleted. Refuse instead.
    printf '  FAIL  adrs-present: validator-codes.mjs declares no VALIDATOR_CODE_PATTERN\n'
    printf '        the validator-code grammar has ONE declared source; this check\n'
    printf '        will not guess it. Restore the export in %s\n' "$VALIDATOR_CODES_MJS"
    exit 1
  fi
  FOREIGN_NS="$FOREIGN_NS $(sed -n "s/^  '\(${VC_PAT}\)',$/\1/p" "$VALIDATOR_CODES_MJS" | sort -u | tr '\n' ' ')"
fi
FOREIGN_NS=" $(printf '%s' "$FOREIGN_NS" | tr -s ' ') "

# VACUITY REFUSAL — AND A COMPLETENESS REFUSAL BESIDE IT.
#
# The first arm catches the derivation resolving NOTHING. That was never the
# failure that actually happened: GEN-034 gap 2 was the derivation resolving MOST,
# which looks healthy from here and quietly reclassifies the missing codes as
# dangling principles. So the second arm compares the COUNT this file derived
# against the count the declaration contains. Partial failure is now as loud as
# total failure, which is the whole of H5.
case "$FOREIGN_NS" in
  *problem-type-enum-agreement*) : ;;
  *) printf '  FAIL  adrs-present: the foreign-namespace derivation resolved nothing.\n'
     printf '        ^ Expected at least the validator codes. A citation/mention check that cannot\n'
     printf '          see the other namespaces will call every foreign id a dangling principle.\n'
     exit 1 ;;
esac

# A TRUNCATION REFUSAL, and deliberately NOT a completeness one.
#
# The first version of this arm looped over the declared codes and checked each
# had reached `FOREIGN_NS` — which is CIRCULAR, because `FOREIGN_NS` is built from
# that same file. It could not fail, and a mutation renaming a declared code
# passed it. Measured, then removed rather than patched.
#
# Declaration-vs-call-site agreement is a real check, but it belongs where it can
# be non-circular: `validator-codes.test.ts` compares the declaration against the
# `fail(` call sites in `validate.mjs`, in BOTH directions. What is left here is
# the one thing this file can honestly assert about a file it also consumes — that
# it did not come back suspiciously small or with duplicates.
if [ -f "$VALIDATOR_CODES_MJS" ]; then
  declared=$(sed -n "s/^  '${VC_PAT}',$/x/p" "$VALIDATOR_CODES_MJS" | wc -l | tr -d ' ')
  distinct=$(sed -n "s/^  '\([a-z0-9][a-z0-9.-]*\)',$/\1/p" "$VALIDATOR_CODES_MJS" | sort -u | wc -l | tr -d ' ')
  if [ "$declared" -lt 50 ]; then
    printf '  FAIL  adrs-present: only %s validator code(s) declared — the declaration looks truncated.\n' "$declared"
    printf '        ^ There were 73 at GEN-036. A sharp drop means the file, not the namespace, changed.\n'
    exit 1
  fi
  [ "$declared" = "$distinct" ] || {
    printf '  FAIL  adrs-present: %s declared validator codes, %s distinct — duplicates in the declaration.\n' "$declared" "$distinct"
    exit 1
  }
fi

PRINCIPLES="$REPO/docs/governance/PID-PRINCIPLES.md"
[ -f "$PRINCIPLES" ] || { printf '  FAIL  adrs-present: %s does not exist\n' "$PRINCIPLES"; exit 1; }

# ─── CONTEXT-SCOPED CITATION RECOGNITION (GEN-050 D4) ────────────────────────
#
# A bracketed token is a CITATION only in citation context. Eight pushes were
# refused because an HTML attribute (data-tree-chrome), named in prose in brackets, was
# read as a dangling principle. The namespace of things a person may bracket in
# prose cannot be enumerated, so the rule reads the CONTEXT instead:
#
#   STRICT context — every bracketed slug must resolve:
#     PID files (pids/, archive/), PID-PRINCIPLES.md itself, and CODE (*.ts,
#     *.sh, *.mjs): a citation there is deliberate, and the definition-context
#     rule (a PID may not bracket-cite a principle it defines) is unchanged.
#   PROSE context — reports, decisions, ADRs, any other *.md:
#     a bracketed slug that is a REGISTERED principle is a citation (counted);
#     one that is not is a MENTION and is ignored.
#   FENCED CODE is never a citation, in either context.
#
# The dangling-citation arm therefore still reds where it always mattered — in
# the register and in code — and stops refusing prose for naming a CSS selector.
strip_fences(){ awk 'BEGIN{f=0} /^```/{f=!f; next} !f' "$1"; }
strict_files=$( { find "$REPO/docs/governance/pids" "$REPO/docs/governance/archive" -name '*.md' 2>/dev/null; \
                  echo "$PRINCIPLES"; \
                  find "$REPO" \( -path '*/node_modules' -o -path '*/dist' -o -path '*/.git' \) -prune -o \
                       \( -name '*.ts' -o -name '*.sh' -o -name '*.mjs' \) -type f -print; } | sort -u )
prose_files=$( find "$REPO" \( -path '*/node_modules' -o -path '*/dist' -o -path '*/.git' \
                  -o -path "$REPO/docs/governance/pids" -o -path "$REPO/docs/governance/archive" \) -prune -o \
                  -name '*.md' -type f -print | grep -vxF "$PRINCIPLES" )
strict_cited=$( for f in $strict_files; do strip_fences "$f"; done | grep -oE '`\[[a-z0-9][a-z0-9-]*\]`' | tr -d '`[]' | sort -u )
prose_cited=$(  for f in $prose_files;  do strip_fences "$f"; done | grep -oE '`\[[a-z0-9][a-z0-9-]*\]`' | tr -d '`[]' | sort -u )
registered=$(grep -oE '^- `\[[a-z0-9][a-z0-9-]*\]`' "$PRINCIPLES" | tr -d '- `[]' | sort -u)
# prose citations that resolve are counted; the rest are mentions
prose_counted=$(comm -12 <(printf '%s\n' "$prose_cited") <(printf '%s\n' "$registered"))
cited=$(printf '%s\n%s\n' "$strict_cited" "$prose_counted" | grep -v '^$' | sort -u)

[ -n "$cited" ] || { printf '  FAIL  adrs-present: no principle citation found anywhere.\n        ^ The scan matched nothing, so this arm would pass vacuously.\n'; exit 1; }

principle_missing=""
for slug in $strict_cited; do
  case "$PLACEHOLDERS" in *" $slug "*) continue ;; esac
  # A MENTION of another namespace's identifier, not a principle citation.
  case "$FOREIGN_NS" in *" $slug "*) continue ;; esac
  if ! grep -qE "^- \`\[${slug}\]\`" "$PRINCIPLES"; then
    where=$(for f in $strict_files; do strip_fences "$f" | grep -qF "\`[$slug]\`" && echo "$f"; done \
      | sed "s|^$REPO/||" | head -3 | tr '\n' ' ')
    principle_missing="$principle_missing${principle_missing:+$'\n'}[$slug] is not defined in PID-PRINCIPLES.md — cited by: $where"
  fi
done

if [ -n "$principle_missing" ]; then
  printf '  FAIL  adrs-present: %s cited principle(s) do not resolve\n' "$(printf '%s\n' "$principle_missing" | wc -l)"
  printf '%s\n' "$principle_missing" | sed 's/^/          /'
  printf '          ^ A principle id is PERMANENT by PID-PRINCIPLES.md own scheme, so a dangling\n            citation means the permanence rule was broken, not that the record is old.\n'
  exit 1
fi

printf '  ok    %-52s %s ADR / %s amendment / %s principle\n' "every governance reference resolves" \
  "$(printf '%s\n' "$referenced" | wc -l)" \
  "$(if [ -n "$amend_refs" ]; then printf '%s\n' "$amend_refs" | wc -l; else echo 0; fi)" \
  "$(printf '%s\n' "$cited" | wc -l)"
