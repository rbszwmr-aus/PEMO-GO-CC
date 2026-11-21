# Shared QR Pass Service v0 — demo implementation notes

**Implements:** [qr-pass-service-v0.md](qr-pass-service-v0.md) (FROZEN `0.1.0`, D1–D8 locked). **That doc is not
changed by this work.** These notes record the demo's transport/key choices, what was skipped, and every place
where the frozen text left a wire-level choice open.
**Scope:** `VISITOR_ACCESS` only, in-memory, inside the PEMO-grok tickets-demo API (`apps/api/src/demo/tickets-demo-server.ts`,
port 3200). D3 says the real service is standalone (own repo, ports, DB). This is a demo stand-in only.
**Code:** `packages/qr-pass-demo-store` (`@pemo/qr-pass-demo-store`), `apps/api/src/demo/qr-pass-demo-routes.ts`.

## 1. Endpoints

| Method | Path | Auth (demo) | Contract |
|---|---|---|---|
| `POST` | `/api/qr-pass/v0/passes` | module = `Authorization: Bearer <any>` + optional `X-PEMO-Demo-Resident`; module is always `pemo` | §5.1 (`Idempotency-Key` honoured) |
| `GET` | `/api/qr-pass/v0/passes/{pass_id}` | module | §5 |
| `POST` | `/api/qr-pass/v0/passes/{pass_id}/revoke` | module | §5.2 |
| `POST` | `/api/qr-pass/v0/passes/{pass_id}/uses` | reader = `Bearer <any>` (e.g. `demo`) | §5, §7 online consume |
| `GET` | `/api/qr-pass/v0/.well-known/jwks.json` | public | §4 |
| `GET` | `/api/qr-pass/v0/revocations[?since=rl_<n>]` | public | §5.3 |
| `GET` | `/api/qr-pass/v0/scans?pass_id=&result=&from=&to=&device_id=` | module | §5.4 query |
| `POST` | `/api/demo/qr-pass/v0/verify` | reader | **DEMO-ONLY, outside 0.1.0** (§3 below) |
| `GET` | `/api/demo/qr-pass/v0/outbox[?type=&pass_id=]` | `Bearer <any>` | **DEMO-ONLY** event transport (§4 below) |

Missing bearer → `401` problem+json `…/qr-pass/unauthorized`. Problem `type` base is the contract's example base,
`https://pemo.example/problems/qr-pass/<suffix>` (§5.6), with `title`, `status`, `detail`, `instance`.

Real auth (§2: client-credentials JWT, `aud` ⊇ `qrpass`, `qrpass_actions`) is **not** implemented; the demo credential
stand-ins are as in the table. Every demo pass belongs to module `pemo`, so any demo bearer can read or revoke any pass;
there is no per-resident ownership.

## 2. Wire format as built

`QP1:` + base45(RFC 9285) of `#6.18([ protected, {}, payload, signature ])`:

- protected = bstr .cbor `{ 1: -8 (EdDSA), 4: kid }`, with `kid` as a **bstr** (UTF-8 of the JWKS `kid`, e.g. `kQ7M2A`).
- payload = CWT claims map, in this order:
  `"v": 1, "p": "VA", "m": "pemo", 2 (sub): subject_ref, "i": pass_id, 7 (cti): bstr(UTF-8 jti), 5 (nbf), 4 (exp), "u": use_limit, "r": module_ref (only if set)`.
- signature = Ed25519 over `Sig_structure = ["Signature1", protected, h'', payload]`.
- No compression (D1). Typical demo visitor pass: **~270 chars, QR v10 at ECC M** (the §6 estimate was ~216 / v8). The
  difference comes from text claim keys (§8 A1), the `r` claim (a visitorId of ~20 chars), and a 14-char subject ref.

JWKS entries: `{ kty: "OKP", crv: "Ed25519", x, kid, use: "sig", alg: "EdDSA", nbf }`. `retire_at` is omitted
because there is a single key and no rotation.

## 3. Demo-only verify route (outside 0.1.0)

The frozen contract has **no HTTP verify**. Readers verify offline against the JWKS (§2, §7). For the management-web
Visitors check-in demo, `POST /api/demo/qr-pass/v0/verify` runs the reader check on the server:

- body `{ "payload": "QP1:…" }` or `{ "passId": "qp_…" }` (also `pass_id`), plus optional `device_id`, `location_ref`, `module_decision_ref`;
- checks run in this order: `QP1:` prefix, base45 decode, COSE decode, `kid` against the demo JWKS (`UNKNOWN_KEY`), Ed25519 (`REJECTED_SIGNATURE`),
  revocation (`REJECTED_REVOKED`), window with ±120 s skew (`REJECTED_EXPIRED` / `REJECTED_NOT_YET_VALID`), then the use limit
  (`REJECTED_REPLAY` for `u = 1`, `REJECTED_USE_LIMIT` for `u = n`);
- an `ACCEPTED` result consumes one use through `store.scan()`, which is **the same code path as `POST /passes/{id}/uses`**;
- it always answers `200 { result, scan, claims, pass, demo: true }`. `scan` is the §5.4 record. `result`, `claims` (the
  verified §3.3 JSON view, or null when the signature is not trusted), `pass` (`pass_id, status, use_limit, uses_seen,
  uses_remaining, subject_ref, module_ref`) and `demo` are **demo extras**. Check-in can map `pass.module_ref` → `visitorId`.

`POST /passes/{id}/uses` (contract) returns the same body on `200`. After the limit (`REJECTED_USE_LIMIT` / `REJECTED_REPLAY`) it answers
`409 use-limit-reached` problem+json with a `scan` extension member (§5.6). It accepts an optional `payload`; without one it
consumes by `pass_id` from service state.

## 4. Events: demo transport = in-memory outbox

§5.5 says "transport TBD". The demo appends every event to a process-local outbox, readable at
`GET /api/demo/qr-pass/v0/outbox`. The envelope is `{ id: "evt_…", type, occurred_at, module, data }` with the §5.5 `data` shapes:

- `pass.issued`: `{ pass_id, jti, kid, purpose, subject_ref, not_before, expires_at, use_limit }`
- `pass.revoked`: `{ pass_id, reason, revoked_at, revocation_list_version }`
- `pass.scanned`: the §5.4 scan record. It is emitted only when the scanned pass is known to the service; an untrusted scan (bad
  signature, unknown key, undecodable) has no trustworthy `module` to route to, so it produces no event.

No delivery, retry or webhook signing. Everything is lost on restart.

## 5. Keys per restart

One Ed25519 keypair is generated at process start (`kid` = `k` + 5 Crockford chars, logged at startup). **The kid, the key,
all passes, uses, revocations and events change or vanish on every restart** (`scripts/amd128-up.sh --restart-api`).
A QR captured before a restart then verifies as `UNKNOWN_KEY`. There is no pre-publish, overlap or rotation (§4) and no
KMS/HSM.

## 6. PEMO visitor hook (resident-portal demo)

- `POST /api/resident-portal/v0/visitors` issues a `VISITOR_ACCESS` pass automatically: `subject_ref` = a fresh opaque
  `vsr_…` (no PII), `module_ref` = `visitorId`, `use_limit` = 2 (D6), `not_before`/`expires_at` = `expectedFrom`/`expectedTo`.
- Lifetime is **capped** at 7 days (`exp = nbf + 7 d`). The HTTP issue endpoint instead **rejects** lifetime > 7 d with
  `400 invalid-request`, as §5.6 says. Skew is applied only at verification (±120 s); nothing is added to the issued window.
- No window, or an unparsable window, or `to ≤ from`: `now … now + 24 h`. The two seeded visitors (fixed past dates)
  are given passes at startup rebased to `now … now + 24 h` so the demo shows live QRs. A newly created visitor with a
  window already in the past gets its literal (expired) window.
- Every visitor response (list, detail, create, check-out) carries `pass`, the **same object as `GET /passes/{id}`**
  (snake_case, embedded as-is), or `null`.
- Check-out does **not** revoke the pass (the contract is silent; revoke is the module's call, §5.2).

## 7. Skipped

- `POST /scans` (batch scan ingest, offline replay, over-use flags): not implemented.
- `GET /scans` has no pagination (`next_cursor` is always null; it returns the last 500 records).
- `PAYMENT` purpose (returns `400 purpose-unknown`, "not allowed for this module"), module-namespaced purposes (D4),
  re-issue with a new `jti`, key rotation/compromise flows, `revoked_kids` population, `429 rate-limited`, D8 retention.
- Real module and reader credentials (§2).

## 8. Contract ambiguities and gaps (frozen doc NOT edited)

| # | Where | Frozen text | What the demo did |
|---|---|---|---|
| A1 | §3.1 "CWT label" column | `private` for `v`, `p`, `m`, `i`, `u`, `r`; §6.2: "Estimate assumes 1-byte CBOR labels … spec-compliant private-use labels (< −65536 …)" | **No integer labels are assigned anywhere.** The demo uses CWT **text-string claim names equal to the compact keys** (`"v"`, `"p"`, `"m"`, `"i"`, `"u"`, `"r"`), which RFC 8392 permits, and invents no numbers. Registered labels are used for `sub` 2, `cti` 7, `nbf` 5, `exp` 4. Changing to integer labels changes the wire format; the mapping is one table (`CLAIM` in `store.ts`). **Needs a decision + version bump.** |
| A2 | §3.1 `jti` "string / bytes"; `kid` "string / bytes" | — | `cti` is a **bstr** holding the UTF-8 of the API `jti` (RFC 8392 types `cti` as bstr). `kid` is a **bstr** holding the UTF-8 of the JWKS `kid` (RFC 9052 types `kid` as bstr). Decoder accepts text too. |
| A3 | §3.3 / D1 "CWT in COSE_Sign1" | no tag rule | Emits tag **18** (COSE_Sign1) only, no CWT tag 61. The decoder also accepts untagged. |
| A4 | §3.1 `p` "string / small int" | §3.3 `"p": "VA"` | Text wire code `"VA"`. |
| A5 | §5 `GET /passes/{pass_id}` | "Status of one pass (active / revoked / expired, uses seen)" — **no response shape is frozen** | Returns the §5.1 issue fields plus `module, subject_ref, module_ref, status, issued_at, uses_seen, uses_remaining, revoked_at, revocation_reason`. Only `status` and "uses seen" are named in prose; the field names `uses_seen`, `uses_remaining`, etc. are **demo choices** (snake_case per §5). `use_limit` comes from §5.1. **Gap to raise: the frozen doc has no `uses_seen` field name.** |
| A6 | §5 `status` vocabulary | "active / revoked / expired" | `revoked` beats `expired`, which beats `active`. `expired` means `now > exp` (skew is not applied to status). A not-yet-valid or used-up pass is still `active`; see `uses_seen`/`uses_remaining`. |
| A7 | §5 `POST /passes/{pass_id}/uses` | request/response bodies not defined | Optional body `{ payload?, device_id?, location_ref?, module_decision_ref? }`. `200` → `{ scan, claims, pass }`; limit → `409 use-limit-reached` + `scan`. Other rejections (revoked/expired/…) → `200` with the rejected `scan.result`. |
| A8 | §5.2 revoke `reason` | "short module code" | Optional, `[a-z0-9_.-]{1,40}`, default `unspecified`. |
| A9 | §5.3 `list_version` / cursor | example `1842`, `rl_1842` | Starts at `0`, +1 per revocation; cursor `rl_<n>`; unknown/future cursor → `410 cursor-expired`; malformed → `400`. `since: null` on full snapshots. |
| A10 | §5.4 `device_id` | required in the example | Defaults to `pemo_demo_gate` when the caller omits it. |
| A11 | Timestamps | examples use `…Z` | Contract API uses RFC 3339 UTC `…Z` (whole seconds). Resident-portal envelopes keep `+08:00`. |
| A12 | §5.1 `qr.min_version` | example `8` | Computed from the payload length against the alphanumeric/ECC M capacity table (demo passes → 10). |
