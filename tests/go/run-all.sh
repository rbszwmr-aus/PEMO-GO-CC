#!/usr/bin/env bash
# Everything the Go build is checked with, against a local bootstrapped
# database (database/dev/.env) and an API on PEMO_HTTP_PORT (default 23280).
#   tests/go/run-all.sh          (start the API yourself, or use scripts/dev-up.sh --no-ui)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"
set -a; . database/dev/.env; set +a
PORT="${PEMO_HTTP_PORT:-23280}"
(cd backend && go build -o bin/ ./cmd/... && go vet ./... && go test ./... && PEMO_TEST_DB=1 go test ./internal/caseacts/)
backend/bin/pemo verify-boundaries | tail -1
curl -fsS "http://127.0.0.1:$PORT/ready" >/dev/null || { echo "API not running on :$PORT (scripts/dev-up.sh --no-ui)"; exit 1; }
python3 tests/go/fixture_parity.py --pemo backend/bin/pemo --base "http://127.0.0.1:$PORT" | tail -1
python3 tests/go/conformance.py --base "http://127.0.0.1:$PORT" \
  --staff-token "$(backend/bin/pemo dev-token stf_wfg_manager)" \
  --resident-token "$(backend/bin/pemo resident-token res_wfg_000412)" \
  --non-admin-token "$(backend/bin/pemo dev-token stf_wfg_block_a)" | tail -2
