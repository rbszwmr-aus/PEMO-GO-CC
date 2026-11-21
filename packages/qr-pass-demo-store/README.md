# @pemo/qr-pass-demo-store

In-memory demo of the **Shared QR Pass Service v0** (`docs/contracts/qr-pass-service-v0.md`,
FROZEN 0.1.0), **`VISITOR_ACCESS` only**. Pure TypeScript on `node:crypto`, no third-party
deps, no pg. Demo choices and contract gaps: `docs/contracts/qr-pass-service-v0-impl-notes.md`.

- Pass: `QP1:` + base45 (RFC 9285) of a tagged COSE_Sign1 (tag 18) carrying CWT claims, no
  compression (D1); EdDSA/Ed25519, COSE alg −8, `kid` in the protected header (D2).
- Keys: one Ed25519 keypair generated at store construction (`kid` = `k` + 5 Crockford chars).
  **Keys and all passes change on every process restart.**
- Checks: signature → revocation → window (±120 s, D7) → use limit (D6 default `u = 2`);
  results use the §5.4 enum (`ACCEPTED`, `REJECTED_*`, `UNKNOWN_KEY`).
- Revocation list: compact JWS (EdDSA) with the §5.3 payload, full + `?since=rl_<n>` delta.
- Events: in-memory outbox of `pass.issued` / `pass.revoked` / `pass.scanned` (§5.5 envelope).

```sh
pnpm --filter @pemo/qr-pass-demo-store test
```
