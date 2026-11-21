# GEN-047 — Close ruling: notices 2.1.0 (permitted actions, state-entered, fixture parity, UI-045 findings)

Date: 2026-09-03
Merge dfa916f (from 355d217, tree-hash equal via ls-remote, through the hook). Rule 7 close 7832325. GEN-049 allocated 70e1558. Step-2 report docs/governance/reports/GEN-047-step2.md.
Battery 34; contract 110/110; integration 458/458; management-web 113/3 skipped; resident-portal 62/0; manifest 26 proven, 0 failed, 1 unreliable (not run); management-web 2.0.0 → 2.1.0 additive; resident-mobile 0.4.0 untouched; fixtures management-web 57 (+19), resident-mobile 90 (+5).

## Closed. Every item accepted.

C1 Amendment 1 A1–A5 applied and evidenced. `composeNotice`, not `createNotice`: accepted — A1 says the contract's ids govern; the amendment's example name was wrong and the rule was right. `ScopeTreeNode` shared with getPropertyTree: accepted and welcome — the validator caught it on mob-s3-properties/tree.json and both reads now carry the list from one registry, which is the single-source rule doing its work on a surface nobody named.

C2 A3 leak bite is a compile bite (TS2307: `@pemo/access` has no dependency on `@pemo/notices`) — stronger than asked; recorded. The dependency direction is the guard; dependency-cruiser is the second line.

C3 The single surviving hand-written state comparison: notice-acts.ts:517 inside submit, wording only, after canPerform's refusal. Named; accepted.

C4 The object-level bite's declared collateral (diverging the role table breaks approve for every caller) is accepted as proof, not noise: the act reads the same table the list reads. That is the D1 single-source property observed from the outside.

C5 Required fields (ruling b) landed with no UI part-2 finding — the gated management-web suite stayed green on the regenerated fixtures. resident-mobile surface untouched, 0.4.0 stands.

C6 Manifest: the GEN-040 publish-advisory-lock entry stands `unreliable`, owing PID GEN-049.

C7 The seventh `data-tree-chrome` collision refused the first push. Fixed as before. Context-scoped citation recognition is no longer "owed"; it is dispatched (GEN-050). Seven refusals is the cost of not fixing it.

## G7 — put to the PO

Should staff working an outstanding-acknowledgement list see the recipient's name, or only unit and resident id? Held for the PO; UI part 2 binds R3 to whatever the contract carries and defers the identity column to this ruling.

## Owed register after GEN-047

In flight: GEN-048 (CI: Flutter + browser-job verification); GEN-049 (publish serialisation, deterministic bite, `a-race-is-not-a-bite`); GEN-050 (local try-out: dev-token command, Node engines/.nvmrc, README bash/psql line; context-scoped citation recognition).
Still owed: harness classes for ~36 prose bites; exact projection type; multi-node ticket case; destructive-target-confirmed Section 0; S2 overview NoticeRow design intent; Cases field list; Home Safety freshness; object-store decision; G7; grant-admin reads backend PID (revokeGrant/removeMembership ids that no GET returns; grants by node; membership view; effective administrators per node).

## Next

Main CC: start GEN-048 ∥ GEN-049 now; GEN-050 when either lands (two in flight). UI CC: UI part 2 (notices write flow) against frozen 2.1.0 — brief dispatched with this ruling.

---

*Carried in by GEN-050's allocation commit. ONE edit: the HTML attribute in C7 now carries backticks alone, as `data-tree-chrome` — the EIGHTH instance; GEN-050 D4 closes the class.*
