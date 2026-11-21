# Alias — PEMO ↔ ParkCore entitlements

This filename is an **alias**. The contract is a **platform** pattern for all current and future modules (PEMO, ParkCore, later HMS, …), with ParkCore as the first worked example.

Canonical note: [platform-module-entitlements.md](platform-module-entitlements.md). ParkCore claims: `parkcore_actions` + optional `parkcore_role` (not `parkcore_features`). EffectiveAllowed = `RoleAllows(role) ∪` filtered `parkcore_actions` (empty/invalid role → no table grants). JWKS cite: [car-park platform-sso-jwks-parkcore.md](https://github.com/rbszwmr-aus/car-park/blob/main/docs/contracts/platform-sso-jwks-parkcore.md) (`PARKCORE_OIDC_AUDIENCE=parkcore`).
