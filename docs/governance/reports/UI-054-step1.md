# UI-054 — Step 1 report: notices part 2b (property-tree compose entry, 2.2.0 bindings, live act exercise)

| | |
|---|---|
| PID | `UI-054` — dispatched as "UI-053"; `GEN-053` took 053 first (`5ac8963`), so the allocation was renumbered to what `--next` gave: `7bd188c` on `main` |
| Pin | `origin/main` at `a85c66b` → `5ac8963` when work began. Contract management-web **2.2.0** (`GEN-052`); `GEN-050` dev-token; fixture corpus **64** |
| Track | UI / management-web session |
| Written | 2026-09-03 |
| Status | Built, green locally, every guard shown biting, D4 exercised. **HARD STOP** for the step ruling. |

Nothing outside `apps/management-web/**`, the UI-owned guide, and this PID's governance
files was written. No contract, fixture or contract-generated file changed.
`src/data/corpus.g.ts` and `corpus-digest.json` are byte-identical to `main`. One NEW
generated file, `src/data/notice-reasons.g.ts`, is produced by this app's own generator
from `packages/api-contracts/notice-reasons.json` (read-only) and guarded by
regenerate-and-compare.

---

## 1. What was built

**D1 — Compose entry on the property tree** (`UI-051` G6, ruled). `ComposeOnNode` in
[`NoticeActions.tsx`](../../../apps/management-web/src/screens/NoticeActions.tsx), the one
act-control file, returns the control iff `permits(node, 'composeNotice')` and null
otherwise; `S3Tree` places it on every row. Floor and unit composing are reachable —
expand the tree, press Compose on `12/F`, and the form opens at `floor:fl_wfg_a_12` with
that node as its first target. The notices list no longer draws an entry from
`getScope`; it carries a note and a link to Properties. `getScope` keeps the shell. The
act-file guard was **widened**: the scope-kind vocabulary (`ScopeRef.kind`, derived from
the contract) and any `depth` read are refused in that file, for the same reason the
lifecycle vocabulary is.

**D2 — 2.2.0 bindings.**
- `s5act/stale-version` → `notices/refusal-stale-version.json` (relabelled at GEN-052);
  new `s5act/wrong-state` → `notices/refusal-wrong-state.json`. The refusal test now
  distinguishes them **by type** with a control that their statuses are equal (both 409),
  so title alone could not tell them apart.
- Also bound, because they are recorded refusals of this surface's acts:
  `s5act/approval-required`, `retargeting-forbidden`, `empty-audience`;
  `s5compose/schedule-inverted`; `s5detail/notice-not-found`. Each renders by its type.
- `reasonCode` is a **select**. `tool/generate-notice-reasons.ts` writes
  `src/data/notice-reasons.g.ts` from the contract package's registry: the union as a
  type (`NoticeReasonCode`) and per-act subsets keyed by operationId. `ActConfirm` reads
  `NOTICE_REASONS[op]`: no field for acts without codes (revise, submit, publish), a
  select over exactly the act's codes otherwise, with a blank option only when the act
  does not require one. Free text is gone. A code outside the union is a **type error**
  (`t(M.reasonCode[c])` is indexed by the generated type); the value map `s5.reasonCode`
  is total over the contract enum.
- **Re-bound after GEN-052's corrections:** `submitNotice` left the ungated drafts in
  `list.json` and `lifecycle.json`; no `UI-051` assertion named it (every act set is
  derived from the fixture), so nothing moved — the per-row exact check simply expects
  the new lists. The mutation m12's plausible state table still disagrees with both
  fixtures and still certifies.

**D3 — Guide.** §2.1 rewritten: live mode is runnable, the dev-token line is there, and
what live covers (scope, tree, the whole notices surface) is stated. §2.5 is "who you
can be — what you can do". §5 B is marked resolved.

**D4 — Live act exercise.** §4.

**D5 — Completeness against the runner.** `inventory-complete.test.ts` now asserts the
inventory's browser sum equals what `playwright test --list` collects, and its node sum
equals the node call-site count. Typed totals are gone from the test.

**D6 — G7.** Not ruled at build time; the named deferral stands on screen.

### Files

| Area | Files |
|---|---|
| New | `tool/generate-notice-reasons.ts`, `src/data/notice-reasons.g.ts` (generated), `tool/live-exercise.ts` (report tool, imported by no test), `test/guard/notice-reasons.test.ts` (4) |
| Changed | `NoticeActions.tsx` (`ComposeOnNode`; `ComposeEntry` removed), `S3Properties.tsx` (places the control), `S5Notices.tsx` (points at Properties), `S5NoticesWrite.tsx` (reason select), `app.tsx` (tree entry, node resolution via the tree fixture, live tree entry), `notice-client.ts` (a plain field instead of a parameter property — node's strip-only mode refused it when the report tool ran), `states.ts` (+7 states), `messages.ts`, `package.json` (`generate` runs the new generator) |
| Tests | `state-matrix.spec.ts` (s3/tree permitted set; per-row compose check), `notices-write.spec.ts` (compose entry → tree; refusals by type; every 2.2.0 refusal bound; reason select), `affordances-read-not-reasoned.test.ts` (scope kinds + depth), `inventory-complete.test.ts` (runner), the inventory and register |
| Tools | `tool/prove-notices.ts` (+6 mutations; m15b re-pointed) |
| Docs | `GUIDE-try-the-ui-locally-2026-09-03.md` §2, §5 |

---

## 2. State × locale matrix

116 screen-states × 2 locales = **232 cells** (was 220). New this PID: `s5act`
wrong-state, approval-required, retargeting-forbidden, empty-audience; `s5compose`
schedule-inverted; `s5detail` notice-not-found; and `s5act/incomplete-translation`
became a problem state in the GEN-052 joint landing. `s3/tree` now also carries
`composeNotice` in its permitted set, checked per visible row against the fixture's
list. The four states on the new surface:

| | loading | empty | error | ready |
|---|---|---|---|---|
| tree compose entry | `loading` | — (a tree with no permitting node has no fixture — §5 G1) | common problems | `tree`: 5 controls after Expand all, 3 by default |
| reason select | — | acts with no codes render no field (revise, submit, publish) | the act's refusal by type | approve / decline / correct / withdraw, the act's subset |

---

## 3. Proof: every guard bites

`pnpm run prove:notices` — **30 / 30 certified** (14 node, 16 browser) under the
four-condition criterion. Additions:

| # | Mutation | Reddens | Radius |
|---|---|---|---|
| m24 | compose control drawn by depth (`depth > 1` → none) | tree compose-entry test (floor and unit missing) | — |
| m24n | compose control drawn by kind (`floor`/`unit` → none) | act-file reasons-about-nothing guard | — |
| m25 | decline's subset typed into the screen | no-typed-reason-code guard | — |
| m25b | a code hand-edited into the generated file | regenerate-and-compare | union-equals-contract |
| m26 | presence-gates count one short | inventory-vs-runner | — |
| m15b | (existing) `data-problem-kind` collapsed | refusals-by-type test | the two other tests that read the discriminator |

One correction by the harness: m24n did not bite at first — the act-file guard refused
lifecycle, disposition and role literals but not scope kinds. The guard was widened
(scope kinds derived from `ScopeRef.kind`, plus `depth`), and m24n certifies. One
re-point: m15b's target had been renamed in this PID; the radius (two other tests read
`data-problem-kind`) is declared.

`pnpm run prove:data-claims` unchanged from UI-051 and green.

---

## 4. D4 — the live act exercise (report, not gate)

Run with `GEN-050`'s `dev-token` for `stf_wfg_manager` (covering), `stf_wfg_block_a`
(non-covering) and `stf_wfg_dual_role` (approver), against `apps/api` at `a85c66b` on
`127.0.0.1:18080` and the shared `pemo-dev-db` seeded world, through the app's own
`LiveManagementClient` and `LiveNoticeActClient`. Tool: `tool/live-exercise.ts`; no
test imports it. Full log below; a "MATCH" is type and status equal to the fixture's.

**18 MATCH, 0 MISMATCH.** Every recorded refusal kind was reproduced live by the act the
fixture names, with the fixture's type and status:

| Sequence | Result |
|---|---|
| gated (`planned_interruption` at Block A): compose → publish-from-draft → submit → approve → publish → correct-with-targets → revise-live → withdraw | recorded v1; **approval-required** 409; recorded v2 (`pending_approval`, approver sees `approveNotice, declineNotice`); covering staff approving → **out-of-scope** 404; approver approves v3; publish naming v1 → **stale-version** 409; publish v4 (`live`, `correctNotice, withdrawNotice`); retarget → **retargeting-forbidden** 409; revise a live notice → **wrong-state** 409; withdraw v5; outstanding shows the retained snapshot |
| ungated (`event_community`): compose → publish | recorded v1 with `publishNotice, reviseNotice` (no `submitNotice`, as GEN-052 corrected); publish v2. Submit on the ungated draft: wrong-state 409, "this type is not gated; publish directly" |
| content: half-translated publish; inverted schedule | **incomplete-translation** 422; **schedule-inverted** 422 |
| scope: Block A staff composes at Block C; unknown id | **out-of-scope** 404; **notice-not-found** 404 |

Observed, not mismatches:
- `staffMessage.en` embeds live values ("expected version 1, the notice is at 3"; "state
  is live") where the fixtures carry the recorded world's ("at 7"; "withdrawn"). Prose,
  never asserted by this client.
- **`empty-audience` was not reproduced**: publishing at `unit_wfg_a_12_a1` succeeded,
  so that unit has an occupant in the seed. The fixture stands unexercised live.
- A `reasonCode` outside the act's subset (withdraw with `factual_error`) was refused
  **400 with type `invalid-request`** and a message naming the permitted set. See §5 G2.
- Rows from the first run were gone by the second: the shared dev database is re-seeded
  by the API battery. Eight exercise notices titled "UI-054 live exercise …" may exist
  there at any moment; none is real.

<details><summary>Full log (second run, after the comparator fix)</summary>

```
# UI-054 D4 live exercise — 2026-09-03T07:57:30.312Z against http://127.0.0.1:18080

## 1. Gated type (planned_interruption at Block A): compose → submit → approve → publish
MATCH    covering composes a gated notice at Block A
           got:     recorded → ntc_aa605616563acacb82ca5b411bc533f3 v1
           detail after compose: state=draft permitted=["reviseNotice","submitNotice"]
MATCH    covering publishes from draft (gated) — expected approval-required
           got:     problem 409 notice-approval-required — "This notice type must be approved before it can be published."
MATCH    covering submits → v2
           approver's detail: state=pending_approval permitted=["approveNotice","declineNotice"]
MATCH    covering (estate_staff, not an approver) approves — expected a refusal
           got:     problem 404 notice-out-of-scope — "This notice is not available."
MATCH    dual-role approves → v3
MATCH    covering publishes naming the ORIGINAL version — expected stale-version
           got:     problem 409 notice-stale-version — "The notice has changed. expected version 1, the notice is at 3"
           fixture: 409 notice-stale-version — "The notice has changed. expected version 1, the notice is at 7"   (staffMessage.en differs)
MATCH    covering publishes from approved → v4
           detail after publish: state=live permitted=["correctNotice","withdrawNotice"]
MATCH    covering corrects WITH new targets — expected retargeting-forbidden (409)
MATCH    covering revises a LIVE notice — expected wrong-state
           got:     problem 409 notice-wrong-state — "This notice cannot accept that act right now. state is live"
           fixture: 409 notice-wrong-state — "… state is withdrawn"   (staffMessage.en differs)
INFO     withdraw with a code outside the act's subset: problem 400 invalid-request — "reason_code "factual_error" is not declared for action "withdraw_notice". Permitted: issued_in_error, no_longer_applicable, superseded, wrong_audience. …"
MATCH    covering withdraws → v5
           outstanding after withdraw: 2 recipients

## 2. Ungated type (event_community at Block A): compose → publish
MATCH    covering composes an ungated notice → v1   permitted=["publishNotice","reviseNotice"]
INFO     submit on an ungated type: problem 409 notice-wrong-state — "… this type is not gated; publish directly"
MATCH    covering publishes an ungated draft directly → v2

## 3. Content refusals
MATCH    covering composes a half-translated draft (allowed for a draft) → v1
MATCH    publish the half-translated draft — expected incomplete-translation (422)
MATCH    compose with expiry before publish — expected schedule-inverted (422)
MATCH    compose at one unit → v1
INFO     publish at a single unit: recorded → v2  (empty-audience if that unit has no occupant — it has)

## 4. Scope
MATCH    Block A staff composes at Block C — expected out-of-scope (404)
MATCH    getNotice on an unknown id — expected notice-not-found (404)

## 5. permittedActions as each principal sees the list (4 notices, all from this run)
covering / noncovering / dual: planned_interruption withdrawn []; general live [correct, withdraw];
event_community live [correct, withdraw]; general draft [publish, revise]
```
</details>

---

## 5. Findings

### G — contract / fixture / server (for the backend track; nothing edited here)

| # | Finding | Effect here |
|---|---|---|
| **G1** | `mob-s3-properties/tree.json` lists `composeNotice` on **every** node. The D1 bite the brief names — "a floor lists it and a sibling does not" — has no fixture to red on. | The entry is guarded by two bites that do exist on this fixture (by depth, by kind) and by the source guard. A tree fixture with one non-permitting node would make the list-vs-structure disagreement observable; **not hand-written**. |
| **G2** | A `reasonCode` outside the act's subset is refused live with type **`invalid-request`** (400). That type is **not in the management projection's `Problem.type` enum**, and the contract's `reasonCode` description says the refusal is a `bad-request` Problem; `problem-types.json` scopes `bad-request` to the resident surfaces. A declared-type parity rule (GEN-052 G1) does not see an emitted type that was never declared. | Presented generically (server title) with `data-problem-kind="invalid-request"`; nothing in this client can reach it, since the select offers only the subset. |
| **G3** | `notices/refusal-empty-audience.json` was not reproducible live: the one-unit target has an occupant. Whether any seeded node resolves to nobody is unknown to me. | Bound and rendered from the fixture; unexercised live. |
| **G4** | The shared `pemo-dev-db` is re-seeded by the API battery; the first run's notices were gone by the second. Fine for a dev world, worth knowing for anyone reading it by hand. | Observation. |
| **G7** | The PO's held ruling on the identity column. | Deferral stands. |

### F — this client

| # | Finding | Fix |
|---|---|---|
| F1 | `LiveNoticeActClient` used a TypeScript parameter property; Vite compiles it, but node's strip-only mode — which every tool here runs under — refuses it. No test had ever imported the act client under node, so nothing said so until the report tool did. | A plain field. The live-exercise tool now imports it under node on every run. |
| F2 | The act-file guard refused lifecycle, disposition and role literals but not scope kinds or depth — exactly the vocabulary a compose-by-structure defect would use. Found by m24n not biting. | Widened, derived from `ScopeRef.kind`. |
| F3 | The live-exercise comparator first reported every refusal as MISMATCH: fixture files drop the `notice-` prefix their types carry. | Fixed before the second run; the first run's eighteen results were identical by type. |
| F4 | `inventory-complete` compared against typed totals (the joint-landing defect). | Compares against the runner (D5). |

---

## 6. Counts

| | |
|---|---|
| node suite | 133 tests · 130 pass · 3 live skips (was 129) |
| browser suite | 385 tests · 380 pass · 5 live skips (was 366) |
| state matrix | 232 cells (was 220) |
| presence gates | 80 (was 74) |
| mutations | 30 / 30 certified |
| live exercise | 18 / 18 matched by type and status; 0 mismatch |

---

## 7. Acceptance

1. Gated suite green — locally, above; from a clean clone, §8.
2. Every guard bites — §3.
3. No role or lifecycle-state literal decides visibility — the widened source guard,
   m12/m12n/m24/m24n by mutation.
4. Register complete (value maps `s5.act`, `s5.reasonCode` total; every new string
   classified); matrix §2; G-findings §5; D4 §4.

---

## 8. From a clean clone, and through the gate

**Clean clone** of `UI-054` at `312c645`, `pnpm install --frozen-lockfile`, then in
`apps/management-web`: typecheck clean; build ✓; `pnpm run generate` is a no-op (both
generated files are the committed ones); node 133 tests, 130 pass, 3 live skips;
browser 380 passed, 5 live skips.

**The pre-push gate** (`docs/governance/bin/prove.sh`, this worktree, with the dev
`.env` present this time so the four database checks ran rather than skipping):
**35 passed, 0 failed**, including "notice reason codes agree across registry, type and
contract — 14 codes, 4 acts" (GEN-052's own check) and management-web 130 / 3 skipped.
Citation scan clean: 20 ADR / 7 amendment / 72 principle references resolve.

**HARD STOP.** Awaiting the step ruling before merge.
