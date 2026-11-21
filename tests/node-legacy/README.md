# Node test suites (retired with the Node API)

These `node:test` suites exercised the Node API: they import
`apps/api/dist/**` and the `modules/*` packages, which this repository no
longer contains. They are kept, unchanged, as the **behavioural
specification** the Go port was written against — each file states a rule the
Go build must keep.

What runs instead (see `docs/go-migration/MIGRATION-NOTES.md`):

| Node suite | Go replacement |
|---|---|
| `contract/fixture-parity.test.ts` | `tests/go/fixture_parity.py` — the same 69 resident fixtures, byte-for-byte |
| `contract/openapi-conformance.test.ts`, `severity-and-envelope` | `tests/go/conformance.py` — every response validated against the OpenAPI schema |
| `integration/case-acts.test.ts`, `case-handling` | `backend/internal/caseacts/integration_test.go` |
| `notice-reasons-parity`, case/notice vocabulary generators `--check` | `backend/internal/api/vocabulary_test.go` |
| `cli/verify-boundaries` | `pemo verify-boundaries` |
| `strata-mailer.test.ts` | `backend/internal/api/mail_test.go` (fake SMTP server) |
| demo store tests (`packages/*-demo-store`) | `backend/internal/demo/*_test.go` |

The integration suites that remain only here (grant surface, delegation floors,
idempotency ADR-015, audit provenance, …) are covered at the HTTP level by
`tests/go/conformance.py`; porting each to Go is listed as follow-up work in the
migration notes.
