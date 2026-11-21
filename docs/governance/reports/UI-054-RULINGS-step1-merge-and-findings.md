# UI-054 — Step ruling: notices part 2b — MERGE; G2 routed to Main CC

Date: 2026-09-03
Relayed in-message by the Product Owner (not filed to the drive); filed here because a ruling is an artifact, and Rule 7's close check reads `-RULINGS-` under `reports/`, never a relay. Ruled from the step orientation plus the artefacts it points at (`reports/UI-054-step1.md`). Branch UI-054, local and unpushed at ruling time, correctly.

## Accepted as built → MERGE
- **D1** `ComposeOnNode` as the single act-control file, placed by `S3Tree`, with the act-file guard widened to refuse scope-kinds and `depth`. The widening is the right instinct: the guard now forbids the SHAPE of the wrong answer (deciding a control from a node's kind or depth), not only the wrong answer.
- **D2** wrong-state vs stale-version distinguished by type; five more refusals bound; `reasonCode` a select from the generated per-act subsets, with a non-enum code a type error.
- **D3** the guide's dev-token line.
- **D4** the live act exercise, 18/18 matched by type and status, 0 mismatch — **the first time the fixture corpus has been checked against a running server. Recorded in the close report as its own result, not a footnote.**
- **D5** `inventory-complete` comparing against `playwright --list` and real call sites.
- **D6** G7's deferral stands, unruled.
- The 232-cell state × locale matrix, the G-findings table, and the data-claim register with `s5.act` and `s5.reasonCode` total: accepted.

## G2 — a contract defect, and it is Main CC's
The server emits `invalid-request` and the management-web `Problem.type` enum does not declare it. GEN-052 added parity in one direction (declared ⇒ fixtured); nothing guards the other (emitted ⇒ declared), so a real refusal exists that no client can type. Routed to Main CC as its own item. UI does NOT work around it: the existing named handling (`data-problem-kind="invalid-request"`, the server's own title) stays, marked in the report as awaiting the contract.

Other G-findings (G1 the all-nodes tree fixture; G3 empty-audience unreproduced; G4 the re-seeded dev DB; G7 held) — accepted as recorded.

## Merge and close
Standard: refspec push from the worktree, main never checked out, tree-hash re-read via ls-remote, through the hook, no `--no-verify`, `[UI-054]` tag. Rule 7 close; report the merged tree-hash and the closed row. main's CI is green again as of `27eda6c`; after the merge, read the UI's own main run if `gh` is available, else say plainly it cannot be read and the PO relays it once. HARD STOP for the close ruling.
