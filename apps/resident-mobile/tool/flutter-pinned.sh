#!/usr/bin/env bash
#
# Run Flutter LOCALLY on the exact version the GATE runs (GEN-061).
#
# "Green locally" is only a gate if it ran the toolchain CI runs. This box has had
# Flutter reachable ONLY by an explicit path (never on PATH), and more than one SDK
# can sit under ~/tools — so `flutter test` through PATH does not identify what ran.
# This runner removes both ambiguities: it resolves the SDK the WORKFLOW pins, and
# refuses if the SDK it resolved does not actually report that version.
#
# The pin is DERIVED, never typed here: it is read from .github/workflows/governance.yml's
# `flutter-version`, so this runner cannot drift from the gate. Do NOT hard-code a
# version in this file — that reintroduces the drift it exists to prevent.
#
# Usage:   apps/resident-mobile/tool/flutter-pinned.sh test
#          apps/resident-mobile/tool/flutter-pinned.sh analyze
# Override the SDK location (e.g. to prove the refusal): PEMO_FLUTTER_SDK=<dir>.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WF="$REPO/.github/workflows/governance.yml"

[ -f "$WF" ] || { echo "  REFUSE  $WF not found — cannot read the pin"; exit 1; }

# DERIVE the pin from the gate. One line, one quoted version; anything else is a
# malformed pin and must stop, not guess.
PIN="$(grep -oE "flutter-version:[[:space:]]*'[0-9]+\.[0-9]+\.[0-9]+'" "$WF" \
        | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)"
[ -n "$PIN" ] || { echo "  REFUSE  could not read a flutter-version pin from $WF"; exit 1; }

# Resolve the SDK EXPLICITLY — never through PATH, which is what made "what ran"
# unidentifiable. Convention: ~/tools/flutter-<pin>; overridable for the bite.
SDK="${PEMO_FLUTTER_SDK:-$HOME/tools/flutter-$PIN}"
FLUTTER="$SDK/bin/flutter"
[ -x "$FLUTTER" ] || {
  echo "  REFUSE  the pinned Flutter $PIN is not installed at $SDK/bin/flutter"
  echo "          install it there (git clone the SDK and 'git checkout $PIN'), or set PEMO_FLUTTER_SDK"
  exit 1; }

# The SDK dir NAME is not proof of its version. Ask the binary and compare to the pin.
ACTUAL="$("$FLUTTER" --version 2>/dev/null | grep -oE "Flutter [0-9]+\.[0-9]+\.[0-9]+" \
          | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)"
[ "$ACTUAL" = "$PIN" ] || {
  echo "  REFUSE  resolved Flutter $ACTUAL at $SDK, but the gate pins $PIN — a local run on"
  echo "          the wrong version is a guess, not a gate. Point at the pinned SDK."
  exit 1; }

exec "$FLUTTER" "$@"
