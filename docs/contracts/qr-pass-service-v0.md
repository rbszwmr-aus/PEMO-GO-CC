# Shared QR Pass Service — v0 contract (FROZEN 0.1.0)

**Status:** **FROZEN `0.1.0`** — frozen 2026-09-25, locked by PT (via PEMO-grok master). Decisions D1–D8 are **LOCKED** (§10). Field names, paths and defaults in this note are frozen at `0.1.0`; changes need a version bump and a changelog entry (§11). Nothing in this note is implemented yet.
**Lane:** Platform contract for **all current and future modules**. First consumers: PEMO, PEMO Visitor Management, access control, ParkCore (parking + payments). No product code, ports, packages or schema in this note.
**Related:** [platform-module-entitlements.md](platform-module-entitlements.md) (LOCKED 2026-09-21: claims only, JWKS verify, no shared DB, no user-table sync); alias [pemo-parkcore-entitlements.md](pemo-parkcore-entitlements.md); JWKS/`aud` pattern cite: car-park [`docs/contracts/platform-sso-jwks-parkcore.md`](https://github.com/rbszwmr-aus/car-park/blob/main/docs/contracts/platform-sso-jwks-parkcore.md). Consumer docs cited by name only: car-park `docs/contracts/visitor-bookings-ops.md`, car-park lane-displays-ops v1.0.2, PEMO-grok `docs/contracts/resident-portal-v0-notices-visitors-demo.md` (branch `feat/tickets-helpdesk-assign-demo`).

This service does for QR passes what the entitlements doctrine does for sign-in: **one signer, many verifiers, claims only.** Modules keep their own business rules and databases.

## 1. Problem / non-goals

**Problem.** Several modules want to put a QR in front of a person or a reader: a ParkCore exit display showing "pay here", a printed receipt, a visitor pass read by a lane scanner, a PEMO visitor (`vis_…`) invite. Each module building its own signing keys, revocation and scan logs would give us N incompatible QR formats and N key-rotation stories. The service issues **signed, expiring passes** that any reader can verify **offline** with a public key, and it collects the scan log.

**Non-goals (FORBIDDEN):**

| Not the service's job | Who owns it |
|---|---|
| Deciding access (open / deny / hold) | The module that owns the reader (ParkCore lane, access control, PEMO). A valid pass is an **input** to that decision, not the decision. |
| Fees, tariffs, discounts, grace periods | The module (ParkCore tariff engine). |
| Payment settlement, refunds, Stripe objects | The module. ParkCore uses Stripe; a `PAYMENT` pass carries **only** a module-owned payment ref or URL. The service never sees card data or Stripe keys. |
| Door / barrier / BMS unlock | Nobody through this service. No unlock commands, no relay control. |
| Identity, staff, residents, visitors' names, plates | Module DBs. Passes carry an **opaque subject ref** only — no PII. |
| Shared Postgres, user-table sync | Forbidden, same as [platform-module-entitlements.md](platform-module-entitlements.md) §1. The service has its own store; modules consume passes / claims / events only. |

## 2. Actors

| Actor | Role |
|---|---|
| Issuing module | Calls `issue` / `revoke` with a service credential. Owns the meaning of `subject` and any `ref`. |
| QR Pass Service | Signs passes, publishes JWKS, publishes the signed revocation list, stores the scan log, emits events. |
| Reader | Scanner / lane controller / kiosk / app. Verifies signature + window + revocation + replay **locally**, then hands claims to its module. May be offline. |
| Phone camera | For `PAYMENT` only: opens a module-owned HTTPS URL. Does **not** verify anything. |

Service-to-service auth reuses the shared issuer from the entitlements doctrine: modules present a client-credentials JWT with `aud` containing `qrpass` and a closed action list, platform default shape `qrpass_actions` (e.g. `pass.issue`, `pass.revoke`, `scan.ingest`, `scan.read`). A module may only issue, revoke or read scans for **its own** `module` value. Names frozen in `0.1.0`.

## 3. Pass model

### 3.1 Fields

| Field | Compact key (JWS — D1 option A, not used) | CWT label (COSE — wire format, D1) | Type | Notes |
|---|---|---|---|---|
| format version | `v` | private | int | `1` |
| purpose | `p` | private | string / small int | §3.2 |
| issuing module | `m` | private | string | `parkcore`, `pemo`, `access`, … (same values as `modules[]` in the entitlements token) |
| subject | `s` | `sub` (2) | string | Opaque module ref, e.g. `vis_8f3k2q`, ParkCore booking / ticket id. **Never** a name, phone, email or plate. |
| pass id | `i` | private | string | Opaque, stable for the life of the pass (`qp_…`). Revocation key. |
| jti / nonce | `j` | `cti` (7) | string / bytes | Unique per **signed token**. A re-issued QR for the same pass gets a new `jti`. Replay key. |
| not before | `nbf` | `nbf` (5) | int (epoch s) | |
| expires | `exp` | `exp` (4) | int (epoch s) | Required. Service enforces a max lifetime per purpose (D6: `PAYMENT` 24 h, `VISITOR_ACCESS` 7 days). |
| use limit | `u` | private | int | `0` = unlimited within window; `1` = single use; `n` = multi use. §7. |
| module ref | `r` | private | string | Optional. Module-owned opaque ref or URL (e.g. ParkCore payment link). Service does not dereference it. |
| key id | `kid` (header) | `kid` (4, protected header) | string / bytes | Selects the verification key from JWKS. **Required.** |

Issued-at, audience and issuer are implied by the key set (one service = one issuer) and omitted from the QR to save bytes; the service stores them.

### 3.2 Purposes

| Purpose | Initial issuers | Reader | Notes |
|---|---|---|---|
| `PAYMENT` | ParkCore | Phone camera (exit display, receipt); optionally a ParkCore reader | QR encodes a short **module-owned** HTTPS link (D1) to the Stripe link / payment page (`r`). Settlement stays in ParkCore. Default `u = 0`, unlimited uses (D6). |
| `VISITOR_ACCESS` | ParkCore visitor bookings (`visitor-bookings-ops.md`); PEMO Visitor Management (`vis_…`) | Lane QR scanner, access-control reader | COSE + base45 signed pass (D1). Pass says "this booking ref was issued by module X for this window". The reader's module decides entry. Default `u = 2`, in + out (D6). |

Purposes are extensible via a **shared purpose registry** for platform purposes (`PAYMENT`, `VISITOR_ACCESS` and their short wire codes) plus **module-namespaced** `<module>.<name>` purposes for module-private ones (D4, locked). Readers must treat an unknown purpose as "not for me" and log it, never as ACCEPTED for a known purpose.

### 3.3 Example (JSON view of a VISITOR_ACCESS pass)

```json
{ "v": 1, "p": "VA", "m": "pemo", "s": "vis_8f3k2q", "i": "qp_4Z7N2K9W", "j": "Xq3v9LmT",
  "nbf": 1790323200, "exp": 1790409600, "u": 2 }
```

Protected header: `{ alg: EdDSA (COSE −8), kid: "k1" }` (Ed25519, D2). On the wire this is a CWT in COSE_Sign1, base45-encoded, no compression (D1); the JSON view is for readability only. (`VA` / `PAY` are the short wire codes for the two purposes; mapping lives in the shared purpose registry, D4.)

## 4. Keys, JWKS and rotation

Same verification model as the entitlements doctrine and car-park `platform-sso-jwks-parkcore.md`: readers trust a JWKS document, pick the key by `kid`, verify signature, then validate the time window. The QR pass keyset is **separate** from the SSO token keyset (different issuer, different `use`), so rotating one never breaks the other.

| Stage | Rule (frozen `0.1.0`) |
|---|---|
| Pre-publish | New key appears in JWKS ≥ 7 days before it signs anything, so offline readers pick it up on their daily refresh. |
| Active | One active signing key at a time; rotate at most every 90 days. |
| Overlap | Previous key stays in JWKS (verify-only) while any pass it signed can still be valid: `retire_at = max(exp of passes signed) + skew (D7) + 7 days`. |
| Retire | Key removed from JWKS after `retire_at`. Readers then return `UNKNOWN_KEY` for its passes. |
| Compromise | Key removed immediately; revocation list carries a `kid` entry so offline readers reject every pass signed by it; issuers re-issue. |
| Reader refresh | Online readers: JWKS every ≤ 24 h and on any `UNKNOWN_KEY`. Offline readers: ship with a pinned JWKS; must refresh ≥ once per pre-publish window (7 days) or they will start failing new passes. |

JWKS entries follow RFC 7517 (`kty: OKP, crv: Ed25519` only — D2 locked Ed25519), with `kid`, `use: "sig"`, and optional `nbf` / `retire_at` extension members so readers can pre-load.

## 5. HTTP surface (thin)

Base path: `/api/qr-pass/v0`. JSON in/out, `snake_case`. Errors are `application/problem+json` (RFC 9457).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/passes` | module (`pass.issue`) | Issue a pass. Idempotent on `Idempotency-Key`. |
| `GET` | `/passes/{pass_id}` | module (owner) | Status of one pass (active / revoked / expired, uses seen). Also backs online lookup for option (c) in §6 (not used for `VISITOR_ACCESS`; `PAYMENT` links resolve at the module). |
| `POST` | `/passes/{pass_id}/revoke` | module (owner) | Cancel / revoke. Idempotent. |
| `POST` | `/passes/{pass_id}/uses` | reader (`scan.ingest`) | Optional **online** atomic use consume (§7). Offline readers skip it. |
| `GET` | `/.well-known/jwks.json` | public | Pass verification keys (§4). |
| `GET` | `/revocations` | public or reader | Signed revocation list: full snapshot (no `since`) or delta (`?since=<cursor>`). |
| `POST` | `/scans` | reader (`scan.ingest`) | Batch ingest of scan-log records (live or replayed after offline). |
| `GET` | `/scans` | module (`scan.read`, own passes only) | Query scan log. |

### 5.1 Issue

```http
POST /api/qr-pass/v0/passes
Idempotency-Key: 0b7e…
```

```json
{
  "purpose": "VISITOR_ACCESS",
  "subject_ref": "vis_8f3k2q",
  "not_before": "2026-09-26T00:00:00Z",
  "expires_at": "2026-09-27T00:00:00Z",
  "use_limit": 2,
  "module_ref": null
}
```

`module` is taken from the caller's credential, never from the body. `201`:

```json
{
  "pass_id": "qp_4Z7N2K9W",
  "jti": "Xq3v9LmT",
  "kid": "k1",
  "purpose": "VISITOR_ACCESS",
  "not_before": "2026-09-26T00:00:00Z",
  "expires_at": "2026-09-27T00:00:00Z",
  "use_limit": 2,
  "qr": {
    "payload": "QP1:…",
    "mode": "alphanumeric",
    "ecc": "M",
    "min_version": 8
  }
}
```

`qr.payload` is the exact string to encode (§6): for `VISITOR_ACCESS` the `QP1:` base45 COSE string (alphanumeric mode); for `PAYMENT` the short module-owned HTTPS link supplied as `module_ref` (D1). The service does not render images; modules render with their own QR library at the hinted `ecc` / `min_version`.

### 5.2 Revoke

`POST /passes/{pass_id}/revoke` body `{ "reason": "booking_cancelled" }` → `200 { "pass_id", "revoked_at", "revocation_list_version" }`. Revoking an already-revoked pass returns `200` with the original `revoked_at`. Reason is a short module code, no free text / PII.

### 5.3 Revocation list (offline readers)

`GET /revocations` → `200`, `Content-Type: application/jose` — a compact JWS signed by the same keyset (online fetch, so size is not QR-bound). Decoded payload:

```json
{
  "list_version": 1842,
  "cursor": "rl_1842",
  "full": false,
  "since": "rl_1837",
  "issued_at": "2026-09-25T08:00:00Z",
  "max_stale_seconds": 600,
  "revoked": [
    { "pass_id": "qp_4Z7N2K9W", "exp": 1790409600, "revoked_at": "2026-09-25T07:58:12Z" }
  ],
  "revoked_kids": [],
  "pruned": ["qp_1A2B3C4D"]
}
```

- No `since` → `full: true` snapshot of every revoked, not-yet-expired pass.
- `?since=<cursor>` → delta; `410 Gone` (problem+json `cursor-expired`) if the cursor is older than the retained delta window → reader fetches a full snapshot.
- Entries are pruned after `exp + skew`, so the list stays small.
- Readers refresh the list every 60 s (delta pull, D5). Reader tracks `issued_at`; if `now − issued_at > max_stale_seconds` (600 s = 10 min, D5) the reader is **stale** and says so in every scan record.

### 5.4 Scan log

`POST /scans` body `{ "records": [ … ] }` (≤ 500 per batch; idempotent on `scan_id`). `GET /scans?pass_id=&result=&from=&to=&device_id=&cursor=` → `{ "records": [ … ], "next_cursor": … }`.

```json
{
  "scan_id": "scn_01J…",
  "device_id": "pc_lane_exit_2_qr",
  "location_ref": "parkcore:lane:exit-2",
  "pass_id": "qp_4Z7N2K9W",
  "jti": "Xq3v9LmT",
  "kid": "k1",
  "purpose": "VISITOR_ACCESS",
  "result": "ACCEPTED",
  "scanned_at": "2026-09-26T09:14:03Z",
  "received_at": "2026-09-26T09:14:04Z",
  "offline": false,
  "revocation_list_version": 1842,
  "revocation_stale": false,
  "module_decision_ref": "parkcore:decision:dcs_77f1"
}
```

`result` is the **pass verification** result, not the access decision:

| `result` | Meaning |
|---|---|
| `ACCEPTED` | Signature, window, revocation and replay checks passed. Module then decides. |
| `REJECTED_EXPIRED` | `now > exp + skew` |
| `REJECTED_NOT_YET_VALID` | `now < nbf − skew` |
| `REJECTED_REVOKED` | `pass_id` or `kid` on the revocation list |
| `REJECTED_REPLAY` | `jti` already seen for a single-use pass (seen-cache or online consume) |
| `REJECTED_USE_LIMIT` | Use count reached `u` |
| `REJECTED_SIGNATURE` | Signature invalid / payload tampered / undecodable |
| `UNKNOWN_KEY` | `kid` not in reader's JWKS (retired, not yet fetched, or forged) |

`module_decision_ref` is the reader-module's own id for what it did next (open, deny, pay); opaque to the service. `received_at` is set by the service. `device_id` / `location_ref` are module-owned opaque refs. No plates, faces or names.

### 5.5 Events

Delivered to the issuing module (signed webhook or outbox; transport TBD). Envelope:

```json
{ "id": "evt_…", "type": "pass.scanned", "occurred_at": "…", "module": "parkcore", "data": { … } }
```

| Type | `data` |
|---|---|
| `pass.issued` | `{ pass_id, jti, kid, purpose, subject_ref, not_before, expires_at, use_limit }` |
| `pass.revoked` | `{ pass_id, reason, revoked_at, revocation_list_version }` |
| `pass.scanned` | the scan record from §5.4 |

### 5.6 Errors (`application/problem+json`)

| Status | `type` suffix | When |
|---|---|---|
| 400 | `invalid-request` | Missing/invalid field, `exp ≤ nbf`, lifetime > purpose max |
| 400 | `purpose-unknown` | Purpose not registered / not allowed for this module |
| 401 | `unauthorized` | Missing / invalid module or reader credential |
| 403 | `forbidden-module` | Acting on another module's pass or scans |
| 404 | `pass-not-found` | |
| 409 | `idempotency-conflict` | Same `Idempotency-Key`, different body |
| 409 | `use-limit-reached` | Online consume after limit |
| 410 | `cursor-expired` | Revocation delta cursor too old |
| 429 | `rate-limited` | |

```json
{ "type": "https://pemo.example/problems/qr-pass/purpose-unknown", "title": "Unknown purpose",
  "status": 400, "detail": "purpose FOO is not registered", "instance": "/api/qr-pass/v0/passes" }
```

## 6. QR payload size budget

All figures are **estimates** from sample passes (§3.3 visitor pass; payment pass adds `r` = 35-char URL, `m = parkcore`, subject `tkt_91822`). Capacities are the standard ISO/IEC 18004 tables (checked with a QR encoder). Module count = `17 + 4 × version`, plus a 4-module quiet zone per side.

### 6.1 Reference capacities (chars)

| Version | Modules | Byte L / M / Q | Alnum L / M / Q |
|---|---|---|---|
| v2 | 25 | 32 / 26 / 20 | 47 / 38 / 29 |
| v3 | 29 | 53 / 42 / 32 | 77 / 61 / 47 |
| v4 | 33 | 78 / 62 / 46 | 114 / 90 / 67 |
| v6 | 41 | 134 / 106 / 74 | 195 / 154 / 108 |
| v8 | 49 | 192 / 152 / 108 | 279 / 221 / 157 |
| v10 | 57 | 271 / 213 / 151 | 395 / 311 / 221 |
| v12 | 65 | 367 / 287 / 203 | 535 / 419 / 296 |
| v14 | 73 | 458 / 362 / 258 | 667 / 528 / 376 |
| v17 | 85 | 644 / 504 / 364 | 938 / 734 / 531 |

### 6.2 Options

**(a) Compact JWS, short claim names.** Byte mode only (base64url has lowercase).
- Header `{"alg":"EdDSA","kid":"k1"}` 26 B → 35 chars. Signature: Ed25519 = 64 B; ES256 (raw `r‖s`, JWS form) = 64 B → both 86 chars. **Algorithm does not change QR size.**
- Visitor claims 117 B JSON → 156 chars. Total ≈ 35 + 1 + 156 + 1 + 86 = **279 chars**.
- Payment claims 163 B → 218 chars. Total ≈ **341 chars**.

**(b) CWT / COSE_Sign1 + base45** (EU DCC style), prefix `QP1:`. Alphanumeric mode.
- Visitor: CBOR claims ≈ 62 B; COSE_Sign1 (tag + protected `{alg, kid}` + payload + 64 B sig) ≈ **141 B** → base45 `⌈141/2⌉×3 ≈ 212` + 4 prefix ≈ **216 chars**.
- Payment: CBOR ≈ 104 B; COSE ≈ **183 B** → ≈ **279 chars**.
- Deflate (DCC's zlib step) **makes these larger** (visitor 141 → ~152 B, payment 183 → ~188 B): the 64 B signature and random ids don't compress and zlib adds ~6–11 B overhead. Deflate only pays off above a few hundred bytes of claims. **Locked (D1): no deflate / no compression**; reserve a prefix (e.g. `QZ1:`) if ever needed in a later version.
- Estimate assumes 1-byte CBOR labels for private claims. Using spec-compliant private-use labels (< −65536, 5 B each × 5 claims) adds ≈ 20 B → ≈ +30 chars (visitor ≈ 246 chars, still v9-M).

**(c) Opaque pass-id reference + online lookup.** `QP:` + 16 Crockford base32 chars (80-bit id) = **19 chars**; 128-bit id = 29 chars; as an uppercase URL `HTTPS://Q.PARKCORE.EXAMPLE/QP/4Z7N2K9WX3M8QH5T` = 46 chars. Alphanumeric mode. **No offline verification** — reader must call the service (`GET /passes/{id}`) or its module.

### 6.3 Comparison (estimates)

| Option | Chars | Mode | EC L | EC M | EC Q | Offline verify |
|---|---|---|---|---|---|---|
| (a) JWS visitor | ~279 | byte | v11 (61) | v12 (65) | v15 (77) | yes |
| (a) JWS payment | ~341 | byte | v12 (65) | v14 (73) | v17 (85) | yes |
| (b) COSE visitor | ~216 | alnum | v7 (45) | v8 (49) | v10 (57) | yes |
| (b) COSE payment | ~279 | alnum | v8 (49) | v10 (57) | v12 (65) | yes |
| (b) + deflate visitor | ~232 | alnum | v8 (49) | v9 (53) | v11 (61) | yes |
| (c) ref 80-bit | 19 | alnum | v1 (21) | v1 (21) | v2 (25) | **no** |
| (c) ref URL | 46 | alnum | v2 (25) | v3 (29) | v3 (29) | **no** |

(`vN (modules)`; add 8 for quiet zone.)

### 6.4 Display implications

| Surface | Budget (estimate) | Fits |
|---|---|---|
| LED matrix 64 × 64, 1 LED / module | ≤ 64 modules incl. 8-module quiet zone → ≤ v9 (53 + 8 = 61) | (b) visitor at L/M, (b) payment at L only; (c) always. (a) never (needs ≥ v11). |
| LED matrix 64 × 32 (short side 32), 1 LED / module | ≤ 24 modules + quiet zone → v1 only | (c) 80-bit ref at L/M only. |
| LED 96 × 96, 1 LED / module (or 192 × 192 at 2 LEDs / module for scan range) | ≤ v17 (85 + 8 = 93) | all options |
| LCD lane display ≥ 240 px | ~3 px/module at v14 | all options |
| 58 mm thermal receipt (≈ 384 dots @ 203 dpi) | 3 dots/module: v14 = 81 × 3 = 243 dots ≈ 30 mm | all options; prefer M or Q for smudge |

Takeaways: signature algorithm is size-neutral; JSON/base64url costs ~30 % more modules than CBOR/base45; only an opaque ref fits small LED matrices; `PAYMENT` QRs are opened by **phone cameras**, which need an HTTPS URL, so a `PAYMENT` QR encodes a short module-owned HTTPS URL (option (c) form), not a signed blob. **Locked in D1:** option (b) COSE + base45 for scanner-read passes, short module-owned HTTPS link for `PAYMENT`.

### 6.5 ParkCore `{qr}` block (later)

ParkCore lane-displays-ops v1.0.2 reserves a `{qr}` block (rejected in v1) and a per-display `supports_qr` flag. When ParkCore opens it (a ParkCore-owned minor bump; field names are ParkCore's to freeze), this service fills it from the issue response: ParkCore calls `POST /passes`, copies `qr.payload` (+ `ecc`, `min_version`, `expires_at`, `pass_id`) into the display command **only** for displays with `supports_qr = true`, and chooses option by panel size (§6.4). Displays keep rendering; the service never talks to a display.

## 7. Anti-replay and use counts

| Mechanism | Rule |
|---|---|
| `jti` | Unique per signed token; re-issue = new `jti`, same `pass_id`. |
| Single use (`u = 1`) | First ACCEPTED scan consumes. Later scans → `REJECTED_REPLAY`. |
| Multi use (`u = n`) | Each ACCEPTED scan increments the count; at `n` → `REJECTED_USE_LIMIT`. `u = 0` = unlimited within window (still revocable). |
| Online consume | Reader calls `POST /passes/{id}/uses` → atomic, globally exact count. Preferred when the reader is online. |
| Seen-cache (every reader) | Local map `jti → count, last_seen`; TTL = `exp + skew` of the pass (cap 7 days); size cap e.g. 50 000 entries, evict earliest-expiring first. Blocks rapid re-presentation at the same reader even offline. |
| Clock skew | Accept `nbf − skew ≤ now ≤ exp + skew`, skew = ±120 s (D7). Readers report detected drift in scan logs. |
| Revocation staleness | Reader knows `issued_at` of its list; beyond `max_stale_seconds` = 600 s / 10 min (D5; list refreshed every 60 s) scans carry `revocation_stale: true`; the **module** decides fail-open vs fail-closed. |

**What offline readers can and cannot guarantee:**

- **Can:** authenticity (signature), time window (± skew), revocations known as of their last list, no replay **at that reader**.
- **Cannot:** a global use count. With `k` readers offline at once, a pass with limit `u` can be accepted up to `u × k` times in the worst case. Cannot see revocations newer than their list (bounded by D5: 10 min staleness).
- **Reconciliation:** offline readers upload scans (`offline: true`, original `scanned_at`) on reconnect. The service orders by `scanned_at`, flags records beyond `u` as over-use in the query view, and emits `pass.scanned` for each. Over-use handling (charge, flag, ignore) is the **module's** call; the service only reports it.
- For high-value single-use passes, modules should require an online reader or a short `exp`.

## 8. Isolation

- Standalone service (D3, locked): own repo, ports and DB; not a module inside PEMO-grok.
- Own store for passes, revocations, keys and scan logs. **No shared DB**; no module reads it directly, and it reads no module's DB.
- No user-table sync. `subject_ref` is resolved by the issuing module only.
- Modules consume passes (verify locally), claims and events. Same rules as [platform-module-entitlements.md](platform-module-entitlements.md) §1.
- Signing private keys live only in the service (KMS/HSM preferred; `ADR-016`: credentials outside PEMO).

## 9. Delivery sequence

1. Draft (docs only) — done.
2. D1–D8 closed; `0.1.0` frozen 2026-09-25 (this note). Next: reference verifier spec and test vectors (one pass per purpose, one revoked, one bad sig, one unknown `kid`).
3. First issuer: PEMO Visitor Management (`vis_…`) in demo mode; first reader: ParkCore lane scanner in fixture mode.
4. ParkCore `PAYMENT` URL QR on exit displays / receipts once ParkCore opens `{qr}`.

## 10. Decisions — LOCKED 2026-09-25

All eight decisions are **LOCKED** by PT (via PEMO-grok master) on 2026-09-25. The option analysis is kept for the record; the chosen option is marked **✅ LOCKED**.

**D1 — payload format** — LOCKED
- A (not chosen). Compact JWS (§6 a) everywhere — simplest with JOSE libs; too big for LED matrices.
- B (not chosen). COSE_Sign1 + base45 (§6 b) everywhere — ~25–30 % smaller, alnum mode; breaks phone-camera `PAYMENT` links.
- **C ✅ LOCKED** — Per purpose: COSE_Sign1 + base45, no deflate, for reader-verified purposes (`VISITOR_ACCESS`); short module-owned HTTPS URL with opaque ref (§6 c) for phone-opened `PAYMENT` — each surface gets the only format that works for it.

**D2 — signature algorithm** — LOCKED
- **A ✅ LOCKED** — Ed25519 (`EdDSA` / COSE −8) — deterministic, small keys, fast verify on embedded readers; QR size identical to ES256.
- B (not chosen). ES256 (P-256) — widest HSM/KMS and legacy reader-SDK support.
- C (not chosen). Both, selected by `kid` — max compatibility, but every reader must implement both.

**D3 — where the service lives** — LOCKED
- A (not chosen). Platform module inside PEMO-grok — fastest to ship; couples ParkCore-only sales to PEMO.
- **B ✅ LOCKED** — Standalone service (own repo, ports, DB) — works for module-only sales and keeps signing keys outside PEMO (`ADR-016`).
- C (not chosen). Per-module library, no service — no shared revocation or scan log; N key stories.

**D4 — purpose extensibility** — LOCKED
- A (not chosen). Free namespaced strings (`parkcore.exit_voucher`) — no coordination, no shared semantics.
- B (not chosen). Closed central registry only — consistent, but every new purpose needs a platform change.
- **C ✅ LOCKED** — Shared purpose registry for platform purposes (`PAYMENT`, `VISITOR_ACCESS`, short wire codes) + namespaced `<module>.<name>` for module-private ones — shared meaning where it matters, freedom elsewhere.

**D5 — revocation-list cadence / staleness bound** — LOCKED
- **A ✅ LOCKED** — Delta pull every 60 s, `max_stale_seconds = 600` — revocation visible at readers within ~1 min online, bounded at 10 min.
- B (not chosen). Pull every 5 min, bound 1 h — lighter, but a cancelled visitor may still verify for an hour.
- C (not chosen). Push (SSE/webhook) + 5 min pull fallback — fastest, more infra per reader.

**D6 — default use limits per purpose** — LOCKED
- **A ✅ LOCKED** — `PAYMENT`: `u = 0`, unlimited uses (link may be opened repeatedly; payment idempotency is ParkCore's); `VISITOR_ACCESS`: `u = 2` (in + out); issuer may override; max lifetime `PAYMENT` 24 h, `VISITOR_ACCESS` 7 days — matches the real flows.
- B (not chosen). Everything single use — safest, breaks exit after entry.
- C (not chosen). No default; issuer must always set `use_limit` — explicit, more issuer errors.

**D7 — clock skew tolerance** — LOCKED
- **A ✅ LOCKED** — ±120 s — covers typical offline lane-controller drift without widening windows meaningfully.
- B (not chosen). ±300 s — tolerant of poor NTP; widens replay windows.
- C (not chosen). ±30 s with mandatory NTP — tight; offline readers will false-reject.

**D8 — scan-log retention / privacy** — LOCKED
- **A ✅ LOCKED** — 90 days raw, then aggregated counts only; no PII by construction; modules export what they need into their own store — minimal retention, enough for disputes.
- B (not chosen). 13 months raw — full audit year; more exposure.
- C (not chosen). Per-module configurable — flexible, harder to reason about.

### Summary

| # | Decision | LOCKED (2026-09-25) | Not chosen |
|---|---|---|---|
| D1 | Payload format | C: COSE (CWT, no compression) + base45 for scanner-read passes; short module-owned HTTPS link for `PAYMENT` | A JWS, B COSE everywhere |
| D2 | Algorithm | A: Ed25519 | B ES256, C both |
| D3 | Where it lives | B: standalone service | A in PEMO-grok, C library |
| D4 | Purpose extensibility | C: shared purpose registry + module-namespaced purposes | A namespaced only, B registry only |
| D5 | Revocation cadence | A: list refresh every 60 s; readers stale after 10 min | B 5 min / 1 h, C push |
| D6 | Default use limits | A: `PAYMENT` unlimited (`u = 0`), `VISITOR_ACCESS` 2 uses | B all single, C none |
| D7 | Clock skew | A: ±120 s | B ±300 s, C ±30 s |
| D8 | Scan-log retention | A: 90 days raw, then aggregated counts only | B 13 months, C per module |

## 11. Changelog

- `0.1.0` — frozen 2026-09-25, D1–D8 locked (PT via PEMO-grok master).
- `0.1.0-draft` — 2026-09-25, initial draft.
