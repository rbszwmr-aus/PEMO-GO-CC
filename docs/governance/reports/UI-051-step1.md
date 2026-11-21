# UI-051 — Step 1 report: notices write flow against frozen 2.1.0

| | |
|---|---|
| PID | `UI-051` (allocated `4161025` on `main`, from `fcd1621`; D0 carry-in `17a5159`) |
| Pin | `origin/main` at `fcd1621` when work began. Contract management-web **2.1.0** (`GEN-047` + Amendment 1, closed `7832325`); fixture corpus **57** files (`index.json`) |
| Track | UI / management-web session |
| Written | 2026-09-03 |
| Status | Built, green locally, every guard shown biting. **HARD STOP** for the step ruling. |

Nothing outside `apps/management-web/**` and this PID's governance files was written. No
contract, fixture or contract-generated file changed. `src/data/corpus.g.ts` and
`corpus-digest.json` are byte-identical to `main` (`GEN-047` regenerated them; `pnpm run
generate` on this tree produces no diff).

---

## 1. What was built

**D1 — Affordances are read, never reasoned.** One function decides whether a control
renders: `permits(target, operationId)` in [`src/data/affordances.ts`](../../../apps/management-web/src/data/affordances.ts),
a membership test on the server's `permittedActions`. One file draws an act control:
[`src/screens/NoticeActions.tsx`](../../../apps/management-web/src/screens/NoticeActions.tsx),
every control carrying `data-act="<operationId>"`. A node guard
(`test/guard/affordances-read-not-reasoned.test.ts`) asserts, over the source: the act
vocabulary the client compiles against equals the contract's enum on all three carriers
(`StaffNoticeListItem`, `StaffNoticeDetail`, `ScopeTreeNode`); `data-act=` appears in
exactly that one file; that file contains no lifecycle, disposition or role literal (all
three vocabularies derived from the contract), no `lifecycleState` read, no `.role`;
`permittedActions` is read by the affordance module and the type layer only. The
browser side checks the other direction on every rendered state: every `data-act` on
screen is in the fixture's permitted set for that state, and on the notices list and
detail the rendered set equals the server's list **exactly, per row**.

**D2 — Compose.** Entry on the Notices list from every scope node whose
`permittedActions` lists `composeNotice` (the container carries the creation act,
Amendment 1 A2). `scope/default.json` and `scope/portfolio-grant.json` differ at the
portfolio node and the screen follows. The form is `ComposeNoticeRequest` field for
field; a browser test derives the property list from the contract and compares it with
the rendered set of field names. On success the URL moves to the recorded response
(fixture mode) or to the notice fetched again (live mode). Refusals are presented by
`Problem.type` through [`src/data/problem-presentation.ts`](../../../apps/management-web/src/data/problem-presentation.ts);
no prose is inspected.

**D3 — Transitions.** revise (content prefilled), submit, approve, decline, publish,
correct (content on a published notice), withdraw. Each: a confirm screen showing the
request that will be sent → the act client → the **response** decides the next route.
Nothing the client holds is changed by pressing a button. The corpus act client returns
the recorded response for that act and the screen says so (`s5.recordedResponseNote`);
the live act client POSTs `/notices` with the contract's `Idempotency-Key` and
`/notices/{id}/{verb}`. `stateEnteredAt` is rendered beside the state as relative time
from the response's own `meta.generatedAt`, so a fixture renders the same words on every
run and a live response's age is a fact about the response.

**D4 — Bilingual.** Both language blocks are on every form whatever the interface
locale; the locale changes labels only. "This language is missing" is a state of the
form, derived from its own emptiness (`data-missing` on the language block), before any
request. Post-act, the publish refusal `notice-incomplete-translation` has its own
presentation, distinct by title and by `data-problem-kind` from every other notices
refusal — a node guard derives the notice-* types from the contract and requires each to
be presented specifically and distinctly. **The corpus carries no fixture of that type**
(§6 G1), so the state is declared as a gap and rendered as one.

**D5 — Matrix.** §3.

**D6 — Outstanding acknowledgements.** `s5ack/outstanding` binds
`notices/outstanding.json`; rows are rendered in the server's order (the contract's
unacknowledged-first rule is not re-implemented client-side), with an acknowledged-of-total
summary computed from the payload. The identity column shows `residentId` and carries a
named deferral to the PO's G7 ruling on screen.

**D7 — Register.** §5.

### Files

| Area | Files |
|---|---|
| New | `src/data/affordances.ts`, `src/data/notice-client.ts`, `src/data/problem-presentation.ts`, `src/screens/NoticeActions.tsx`, `src/screens/S5NoticesWrite.tsx` |
| Rewritten | `src/screens/S5Notices.tsx` (list gains per-row action bars, locale-following title, entered-at; detail gains the action bar and the outstanding link; `S5Outstanding` is a renderer, no longer a documented absence), `src/app.tsx` (routes `s5compose`, `s5act`; `node=` param; act handling; live notices reads) |
| Extended | `src/data/types.ts` (`ACT_OPERATION_IDS`, `NOTICE_TRANSITIONS`, 2.1.0 fields, request/response shapes), `src/data/states.ts` (kind `client-form`; `s5compose` 4 states; `s5act` 17 states; `s5ack/outstanding` now `fixture`), `src/i18n/messages.ts`, `src/data/live-client.ts` (three notices reads), `src/format/datetime.ts` (`relativeTime`), `src/components/StateNotice.tsx` (presents by type), `src/shell/Shell.tsx` (titles), `src/theme/base.css` (buttons, fields, forms — tokens only) |
| Tests new | `test/browser/notices-write.spec.ts` (15), `test/guard/affordances-read-not-reasoned.test.ts` (5), `test/guard/problem-presentation.test.ts` (5), `test/format/relative-time.test.ts` (3) |
| Tests changed | `state-matrix.spec.ts` (guard refined, §2), `notices.spec.ts` (outstanding test re-pointed to the renderer), `data-claims.spec.ts` (presence gate for the empty permitted list), `live-client.test.ts` (operation list re-pointed), `client-copy-scan.test.ts` (vocabulary derivation widened — §6 F1), the inventory and register |
| Tools | `tool/prove-notices.ts` (+15 mutations; m3 and m5 re-pointed) |
| Docs | `README.md`, `DIVERGENCES.md` (three stale passages corrected — §6 F4/F5) |

---

## 2. The control guard, before and after

Part 1's state matrix asserted "every control in `main` carries a read-affordance
marker, and no control bears a deferred act's name". Part 2 keeps both and refines,
rather than relaxes, the write rule:

1. every control in `main` is marked as one of: read affordance, tree chrome, a form
   field inside a write form (`data-form-field` under `form[data-form-act]`), or an act
   control (`data-act=<operationId>`);
2. every act control's operationId is in the set the **fixture** permits for that
   state — computed in the test from the corpus, never from the page;
3. on the notices list, each row's act controls equal that row's `permittedActions`
   exactly; on the detail, the action bar equals the notice's list exactly;
4. a form field appears only inside a write form.

The part-1 "notice nobody can approve" test is re-pointed: the pending row now renders
the server's **empty** list as a sentence and no control, and the test asserts the
fixture's `permittedActions === []` as its control before asserting the screen.

---

## 3. State × locale matrix

110 screen-states × 2 locales = **220 cells**, every one rendered with its own
discriminator, the control guard above, and the requested-state check. Kinds: `f`
fixture, `p` problem, `c` client-only / client-form, `n` declared gap.

| Screen | States (kind) | Cells |
|---|---|---:|
| s1 Home Safety | unchanged, 19 | 38 |
| s2 Overview | unchanged, 9 | 18 |
| s3 Properties | unchanged, 11 | 22 |
| s4 Cases | unchanged, 10 | 20 |
| s5 Notices list | list f · lifecycle f · empty n · + 6 common | 18 |
| s5detail | detail f · draft-preview n · empty n · not-found p · + 6 | 20 |
| s5ack | **outstanding f** (was n) · empty n · not-found p · + 6 | 18 |
| **s5compose** | blank c (the author's form; pre-act bilingual-missing) · prefilled f · created f · refused p · + 6 | 20 |
| **s5act** | revise / submit / approve / decline / publish / correct / withdraw f (confirms) · the seven `-recorded` f · stale-version p · out-of-scope p · incomplete-translation n · + 6 | 46 |
| | | **220** |

The four states the brief names, on the write surfaces:

| | loading | empty | error | ready |
|---|---|---|---|---|
| compose form | `loading` | `blank` (both languages flagged missing) | `refused` (out-of-scope, by type) + the 5 common problems | `prefilled`, `created` |
| each transition confirm | `loading` | — a confirm has no empty; it is built from a notice — | `stale-version` (409, retryable), `out-of-scope`, + common | the 7 confirms, the 7 recorded |
| detail action bar | `loading` | the empty permitted list (lifecycle pending row; sentence, no control) | common problems | `detail` (2 controls) |
| refusal panel | — | — | stale-version / out-of-scope, distinct `data-problem-kind`; incomplete-translation **declared gap** | — |
| bilingual-missing | — | `blank` (pre-act) | `incomplete-translation` (post-act: presentation guarded, fixture absent) | `prefilled` (none missing) |

---

## 4. Proof: every guard bites

`pnpm run prove:notices` — 25 mutations, **25 certified** under the four-condition
criterion (named red, log present, assertion failure, declared radius). Node 10, browser
15. Full log in the run; the additions:

| # | Mutation | Target reddened | Radius declared |
|---|---|---|---|
| m11 | an Approve control rendered whatever the server said | detail action bar exact-set | detail cells, list cells (per-row exact), pending-row test |
| m12 | visibility from a lifecycle-state table instead of the list | per-row exact on `lifecycle.json` | lifecycle and list cells, pending-row test — **list.json's draft also disagrees with the table** |
| m12n | the same, seen statically | act-file reasons-about-nothing guard | — |
| m13 | a screen reads `permittedActions` itself | single-reader guard | — |
| m14 | `data-act` drawn in a screen file | single-renderer guard | — |
| m15 | incomplete-translation presented with the stale-version title | distinct-presentation guard | names-the-language test |
| m15b | `data-problem-kind` collapsed to "refused" | refusals-differ browser test | — |
| m16 | a `priority` field on the compose form | form-equals-contract test | — |
| m17 | missing-language flag reads only the title | missing-language test | — (see below) |
| m18 | confirm no longer prefilled from the request's `fromVersion` | confirm-prefilled test | — |
| m19 | recorded state shows `version + 1` | compose-recorded test | transition-recorded test |
| m20 | relative time from `Date.now()` | entered-at test | — |
| m21 | outstanding list re-sorted client-side | outstanding-order test | — |
| m22 | a new sentence with no register entry | classification guard | — |
| m23 | a nineteenth act in the client tuple | vocabulary-equals-contract guard | — |

Two corrections made by the harness, recorded because they are the criterion doing its
work:

- **m12 first reported two undeclared reds** (the list cells). Reading them: `list.json`'s
  draft also lists `publishNotice`, so a state table disagrees there too. The radius was
  declared, not suppressed — the collateral is the finding.
- **m17 did not bite on its first run.** The missing-language test cleared a *title* and
  never a *body*, so a flag that read only the title stayed green. The test now clears a
  body (and then both) and m17 certifies. A mutation that does not bite is a question
  about the test first.
- m3 and m5 from part 1 were re-pointed: m3 aimed at the outstanding gap panel's reason,
  which no longer exists (it is a renderer); m5 at the list title expression, which now
  follows the locale.

`pnpm run prove:data-claims` — the absence check fires on a doctored corpus; both
declared violators (`s1.unassignedNote`, `s5.noPermittedActions`) fire when their gate
is removed. Restore verified byte-identical.

---

## 5. D7 — the data-claim register

**Controls → operationId.** Every act control carries `data-act=<operationId>`; the
matrix checks each against the fixture's permitted set for its state (§2). The labels
come from one value map, `s5.act`, declared total over the contract's 18-value act enum on
both `StaffNoticeDetail.permittedActions` and `ScopeTreeNode.permittedActions`
(`VALUE-MAP TOTALITY` reads the contract).

**Rendered fields → fixture path.** Byte-faithful assertions in `notices-write.spec.ts`
and `notices.spec.ts`; the inventory names field and literal for each
(`content-derived`). Summary:

| Screen · element | Fixture · path |
|---|---|
| list row title (locale-following) | `mob-s5-notices/*.json` · `notices[].titleEn` / `titleZhHant` |
| list row state + entered-at | `notices[].lifecycleState`, `notices[].stateEnteredAt`, `meta.generatedAt` |
| list row action bar | `notices[].permittedActions` (exact, per row) |
| compose entry nodes | `scope/*.json` · `nodes[].permittedActions`, `nodes[].node`, `nodes[].label` |
| detail header, action bar, entered-at | `mob-s5-notices/detail.json` · `notice.*`, `notice.permittedActions`, `notice.stateEnteredAt` |
| compose form (prefilled) | `notices/compose-request.json` · every property of `ComposeNoticeRequest` |
| compose recorded | `notices/compose.json` · `noticeId`, `version`, `meta.correlationId` |
| confirm `<verb>` | `notices/<verb>-request.json` · `fromVersion`, `reasonCode`, content fields for revise/correct |
| recorded `<verb>` | `notices/<verb>.json` · `noticeId`, `version` |
| refusal panel | `notices/refusal-wrong-state.json`, `notices/refusal-out-of-scope.json` · `type`, `status`, `staffMessage`, `retryable`, `correlationId` |
| outstanding rows, summary | `notices/outstanding.json` · `recipients[].residentId/unitId/read/acknowledged/response`, `noticeId`, `mandatoryAck` |

**Copy.** Every new client-authored string is classified in `STRING_CLAIMS` (gated
with its gate and assertion, policy with its reason, or label); the completeness guard
is what m22 reddens. Gated and proven: `s5.noPermittedActions` (presence gate + violator).
Gated and asserted in the browser: `s5.languageMissing`/`languagePresent`,
`s5.recordedResponseNote`, `s5.noComposeNode`. Gated with no fixture, declared not dead:
`s5.ackNone`. The three part-1 "no action can be offered" strings were **removed**, not
gated: the evidence they carried is now the server's empty list.

---

## 6. Findings

### G — contract / fixture (for the backend track; nothing edited here)

| # | Finding | Effect here |
|---|---|---|
| **G1** | The contract declares `notice-incomplete-translation` and the corpus carries **no Problem fixture of that type**. The two recorded refusals are `notice-stale-version` (409) and `notice-out-of-scope` (404). D4's post-act bilingual-missing state therefore cannot be rendered from a fixture. | **HARD STOP on that item, as instructed.** The presentation is built and guarded by type (distinct title, distinct `data-problem-kind`, derived from the contract's enum); the state `s5act/incomplete-translation` is declared as a gap and renders as one. No fixture was hand-written. |
| **G2** | `notices/refusal-wrong-state.json` is named and described in `index.json` as "a withdrawn notice is not a draft, so revise refuses on state", but its `type` is `notice-stale-version` and its `staffMessage` says "expected version 1, the notice is at 7". `notice-wrong-state` has no fixture. | Bound as the stale-version state (by its type). The name/notes mismatch is reported; `notice-wrong-state` is presented by type but has no fixture state. |
| **G3** | `NoticeTransitionRequest.reasonCode` is a bare string in the contract. The server's registry (`apps/api/src/management/notice-reasons.ts`, read-only) carries per-act vocabularies: decline 5 codes, correct 4, withdraw 4, approve 2 — none in the contract. | Rendered as a free-text field on every confirm, with a note that the act judges whether one is required. A select needs the contract to carry the codes (`ADR-014` D3 says it should). |
| **G4** | `StaffNoticeListItem.noticeType` is still a bare string while the detail and the request enumerate it (`UI-045` G3, still open at 2.1.0). | Unchanged treatment; value map keyed on the detail's enum. |
| **G5** | `notices/outstanding.json` carries three recipients with `read`, `acknowledged` and `response` all null. The acknowledged/read/response rendering branches and the unacknowledged-first ordering are unfixtured beyond the trivial case. | Rendered; order asserted as "the fixture's order"; the dated branches have no fixture and are not asserted. |
| **G6** | The compose entry reads `getScope`'s nodes. `scope/*.json` carries organization, portfolio, estate, buildings and one location — **no floor or unit** — while `mob-s3-properties/tree.json` (`getPropertyTree`) carries floors and units that also list `composeNotice`. Composing at floor or unit level is unreachable from the scope entry. Both reads carry the container list from one registry (GEN-047 C1), so this is a question of which container the entry hangs off, not a contract defect. | Entry on `getScope` (the brief's "scope-tree node"). Ruling requested: should the property tree also offer compose, or should `getScope` carry the nodes the caller may compose at? |
| **G7** | The PO's held ruling on the recipient identity column (name vs unit + resident id). | Named deferral on screen and in the register; `residentId` shown. |

### F — this client (fixed here; recorded because each was a claim that had gone stale)

| # | Finding | Fix |
|---|---|---|
| F1 | The client-copy scan's contract-vocabulary exemption covered problem-type URIs and corpus file/state names, so the contract's own `Idempotency-Key` **header name** — which the write client must send — was reported as a forbidden term. | The derivation widened to the contract's `components.parameters` names (still derived, never hand-kept). Reported here because it is a change to a guard's oracle. |
| F2 | `live-client.test.ts` asserted "only the two allowed operations" and forbade `/notices`. | Re-pointed to enumerate the wired set (scope, tree, notices) and refuse every other surface's path, including the grant-admin paths. |
| F3 | The inventory's `GUARD_ASSERTIONS` entry for the corpus guard still described the retired `approval.steps` shape (`supervisor-approval / pending / awaiting-approval`). | Corrected to `lifecycle.json` pending_approval / `detail.json` approval_granted, which is what the guard asserts since UI-045. |
| F4 | `DIVERGENCES.md` said "all eleven operations are scoped reads", false since `GEN-040`; and described the stuck approval as staying honest by the client's silence. | Corrected: thirty operations at 2.1.0; the evidence is now the server's empty list on the pending row. |
| F5 | `README.md` said "there is no live backend and this app has no network client" and "the contract has no write operations". | Corrected. |
| F6 | The three "No action can be offered here yet" strings and the deferred-acts panel on S5 described a world 2.1.0 ended. | Removed from S5 (S3's revoke deferral stays); register entries removed rather than left classifying deleted copy. |

### Not done, and why

- **Live mode against a running API** was not exercised: the live tests skip without
  `PEMO_LIVE_STAFF_TOKEN`, and no command mints one (`GEN-050` B). The live act client's
  paths and headers are asserted from source; its behaviour on a 4xx/offline is asserted
  with an injected fetch on the read client only. The act client's mapping is the same
  code shape and is untested against a server — stated, not claimed.
- **A/D keyboard acts (A-05)** remain unbound: an act starts from its control and passes
  through a confirm step, and a key with no confirm would contradict D3.
- **Oldest-first approval queue (A-05)**: now possible (`stateEnteredAt` exists) and not
  applied to the mixed list; the age is shown beside each state instead. Carried as a
  design question, not decided here.

---

## 7. Counts

| | |
|---|---|
| node suite | 129 tests · 126 pass · 3 skipped (live, no server) |
| browser suite | 365 tests · 360 pass · 5 skipped (live) · 9 files |
| state matrix | 220 cells (was 154) |
| presence gates | 73 (data-dependent loop; was 53) |
| mutations | 25 / 25 certified |
| inventory total | 494, agreed by the completeness test against the runners |

Commands: `pnpm run typecheck`, `pnpm run test:node`, `pnpm run build`,
`pnpm run test:browser`, `pnpm run prove:notices`, `pnpm run prove:data-claims`.

---

## 8. Acceptance, item by item

1. Green through the gated suite — locally, above. The clean-clone run is recorded in §9.
2. Every guard bites under the four-condition criterion — §4, 25/25.
3. No role or lifecycle-state literal decides a control's visibility — the source guard
   (statically) and m12/m12n (by mutation), plus the part-1 role guard unchanged.
4. D7 complete — §5.
5. G-findings table — §6, each resolved or deferred with its reason.

---

## 9. From a clean clone, and through the gate

**Clean clone.** `git clone --branch UI-051` into a scratch directory at `07d1308`.
`pnpm install --offline --frozen-lockfile` stopped on one tarball absent from the local
store (`abstract-logging`, an API dependency, not this app's); `pnpm install
--frozen-lockfile` with network completed ("Already up to date" for the workspace). Then,
in `apps/management-web`: typecheck clean; `pnpm run build` ✓; browser 360 passed, 5
skipped (live); node 129 tests, 126 pass, 3 skipped — **after** the build, because nine
node tests read `dist/` (the artefact-visibility guards) and my first pass ran them before
building, which reddened exactly those nine and nothing else. `pnpm run generate` on the
clone produces no diff: the generated corpus is the one `GEN-047` committed.

**The pre-push gate** (`docs/governance/bin/prove.sh`, run in this worktree): 25 passed,
1 failed on the first run — the citation gate read a backticked, bracketed word (the HTML name attribute) in this report
as a principle citation (the `GEN-050` context-scoping item). Reworded; `adrs-present.sh`
now resolves 20 ADR / 7 amendment / 75 principle references clean. The four database
checks SKIP loudly here (no `database/dev/.env` in this worktree; they are the API
track's). The gate's own note stands: the management-web **browser** suite is not run by
`prove.sh` (CI job "the app browser suites"); it is run above, locally and from the clone.

**HARD STOP.** Awaiting the step ruling before merge.
