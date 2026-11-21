# UI-045 Step 1 — notices staff screens, part 1 (reads)

**PID:** `UI-045` · **Step:** 1 of 1 · **From:** UI / management-web session · **To:** Product Owner
**Status:** **BUILT, GREEN, AWAITING GATE.** HARD STOP.
**Addendum 2026-09-02 — R1 answered in §8.** The counts in the table below are the post-R1 ones;
the ten mutations were re-run under a corrected harness and **four of them did not survive it**.

**Pin.** Allocation commit `b2d5a3b` on `main`; branch `codex/ui-045-v1.0`, work commit `593b45d`.
Contract `management-web 2.0.0`, `surfaceHash sha256:ea24ba84…`, verified unchanged across GEN-044.
`origin/main` at the time of writing: `a936249`.

**Suites, run locally, counted from the runners:**

| suite | collected | passed | failed | skipped |
|---|---:|---:|---:|---:|
| node (`test:node`) | 116 | 113 | **0** | 3 |
| browser (`test:browser`) | 264 | 259 | **0** | 5 |

The 3 node skips are the live-API cases, which skip when no server is configured and are written to
skip loudly rather than pass; the 5 browser skips are the same live-properties cases. Neither set was
introduced or touched by this PID.

---

## 0. The allocation rule's first live test — it worked

`--next` returned `045` over `pids/` + `archive/` at `6020a54`. I committed two files
(`pids/UI-045.md`, `PID-INDEX.md`), pushed to `main`, and the push was accepted as a fast-forward —
`6020a54..b2d5a3b`. Main CC, contending for the same number as the brief predicted, re-fetched,
re-ran `--next` and took **`GEN-046`**. No collision, no tooling, no coordination.

**The brief's own text now names a PID that does not exist:** the gate work is `GEN-046`, not
`GEN-045`. That is the rule behaving correctly — the number goes to whoever pushes first — and it is
worth recording that the first thing the rule did was invalidate a name in the document that adopted it.

---

## 1. What had to be fixed before a line could be written

**`src/data/corpus.g.ts` was stale on `main`, and nothing said so.** It carried
`contractVersion 0.1.5` and the pre-ADR-019 notice shape while the frozen fixtures were `2.0.0`.
Computed, not eyeballed: **20 of 27 recorded fixture digests did not match the corpus on disk.**

I classified the drift before touching it, because "20 files changed" and "the notices contract
broke" are different problems:

| | count | |
|---|---:|---|
| identical | 7 | the problem fixtures |
| differ **only** in `meta.contractVersion` | 16 | a version stamp; no render impact |
| **structurally reshaped** | **3** | `mob-s5-notices/list.json`, `detail.json`, `lifecycle.json` |

So regeneration was safe, and exactly the three fixtures this PID is about had actually changed
shape. Regenerated through `pnpm run generate`; **no generated file was hand-edited**.

**This is F3 with a body.** The regenerate-and-compare test that catches a stale corpus lives in the
node suite, and no gate runs the node suite — so a stale generated artefact, a stale severity-token
file, and 19 red assertions sat on `main`. The baseline I measured before changing anything was
**101 tests, 79 pass, 19 fail**. A suite no gate runs does not stay green; it stops being true quietly.

---

## 2. What was built

Three screens, one nav row, no router.

| screen id | operation | states | notes |
|---|---|---:|---|
| `s5` | `listNotices` | 9 | type, title, lifecycle state, publish/expire, mandatory-ack; filters on state and type |
| `s5detail` | `getNotice` | 10 | both languages, lifecycle, targeting rule, response options, disposition history |
| `s5ack` | `getNoticeOutstanding` | 9 | **stated gap** — no fixture exists; see finding G1 |

**Three SCREENS, one NAV ENTRY.** `NAV` in `Shell.tsx` lists what a person clicks; `SCREENS` in
`states.ts` lists what the URL can construct. They were never required to be the same list, and
making them the same would have put three rows in the sidebar where the design has one. Detail and
outstanding are reached from the list. The nav stayed flat — five rows, no groups, badges or counts —
and a test asserts that, including that `s5detail` and `s5ack` are absent from it.

The state matrix grew **118 → 154** cells (77 screen-states × 2 locales).

### No lifecycle control is rendered, and none is disabled

The contract carries 18 write operations. This client cannot tell who may invoke them, and per
UI-004's overview ruling it must not acquire a role concept to find out. The eight ADR-019 staff acts
are **named as absent** with the reason stated on screen, and `s5.noActionsBody` carries it.

The state-matrix control guard was **widened, not relaxed**. It read "any control in main is a write",
with `data-tree-chrome` carved out; a read surface that legitimately needs a list→detail link, a
language toggle and two filters made that stop discriminating. Two checks replace it:

1. every control in `main` must carry an explicit `data-read-affordance` marker — silence is still
   not permission, which was the original's whole value;
2. **no control may bear the name of a deferred act**, derived from the rendered deferred list rather
   than a list kept in the test, so it widens by itself when the acts do.

`select` also joined the selector, which it had been missing — a dropdown could previously have been
added to any screen without tripping this at all.

### Guards re-pointed, never deleted

GEN-043 retired the `notice.approval.steps` object that the corpus guard's supervisor-approval
assertion read — in **two** places, the tool-side guard in `corpus-source.ts` and the runtime copy
emitted into `corpus.g.ts` by the generator. Both were re-pointed, and the generator was edited, not
its output.

**The evidence did not disappear; it moved.** A notice sitting at `pending_approval` that no role in
any current design can approve is still in the corpus — now in `lifecycle.json` — and the approval
concept still appears in `detail.json` as `approval_granted` on the assertion chain. Both halves are
asserted, because either could be smoothed over while the other survived.

The notice-state extractor was **split in two**. `NoticeRow.state` (the S2 overview's retained
pre-ADR-019 shape) and `lifecycleState` overlap on `draft`, `scheduled` and `withdrawn` — the contract
makes lifecycle disjoint from *disposition*, not from the retained row. A single merged set would let
an overview row satisfy a gap declared about the notices list, and the assertion would pass while
measuring the wrong payload.

---

## 3. Acceptance, item by item

| # | Required | Evidence |
|---|---|---|
| 1 | 3 screens × 4 states × 2 locales, each failing for its own reason | The matrix covers all 154 cells; every state has a **per-state** discriminator, not a per-kind one. Proven per screen by mutation: `m1` (list), `m2` (detail), `m3` (outstanding) — each reddened its own cell and nothing else. |
| 2 | every rendered claim registered; an unregistered claim reds | 5 gated, 6 policy and 38 label entries added/re-pointed. `m4` added a user-visible sentence with no disposition → `EVERY client-authored string is classified` went red. |
| 3 | byte-faithful from the frozen fixtures; altering a fixture-bound value reds | List and detail compare against the corpus **itself**, never transcribed literals. `m5` (title stops being the fixture's string) and `m6` (history chain reversed) both reddened. **Outstanding is exempt — it has no fixture (G1).** |
| 4 | bilingual; the string scan reds on a hard-coded string | Both languages present in detail with a working toggle. `m7` **did not redden the existing scan** — see §4. A new guard closes the hole and `m7` now reddens it. |
| 5 | a test asserts no lifecycle action element exists | The two-part control guard above, on every cell. `m8` added an `Approve` button → red. |
| 6 | no code path branches on a role name | `test/guard/no-client-role-reasoning.test.ts`, with the role vocabulary **derived from the contract**, matched anchored to its quotes so `residentId` and prose do not report. `m9` (role comparison) and `m10` (token in `localStorage`) both reddened. |
| 7 | nav entry present; URL-as-state round-trips | Asserted for all three screens in both locales, plus the flat-nav assertion. |
| 8 | full suite green; F2/F5 cleaned; UI-004 carried | Counts above. F2 and F5 done. UI-004 in §5. |

`pnpm run prove:notices` — **10 mutations, all PROVEN**, node and browser proven under separate
controls so a browser mutation is never judged by a node run that could not have seen it. The suite
is green before each batch and green again after restoring. **Read §8 before trusting that sentence:
four of these ten were certified by a defective harness the first time round.**

---

## 4. A mutation found a hole in an existing guard

`m7` typed a panel heading straight into JSX, expecting `client-copy-scan.test.ts` to redden.
**The suite stayed green.**

That scan walks `MESSAGES`. So does the data-claim register. So does the forbidden-terms boundary.
A string that never enters `MESSAGES` is invisible to all three — it cannot be translated, cannot be
classified, and cannot be scanned for the terms this surface must not use. The mutation did not prove
the assertion; it proved the assertion had a hole, which is the entire reason for making assertions
fail on purpose rather than arguing that they would.

`test/boundary/no-jsx-literal-copy.test.ts` closes it, with two control tests so the heuristic can
never quietly match nothing, an endonym-only allow-list (`ENG`, `繁`, `简`, `English`, `繁體中文`),
and an assertion that the allow-list stays small. Its limits are written down: it is a heuristic over
source text, not a parser.

I also corrected an inventory count that was understating reality: the presence-gates loop is
**data-dependent** and was recorded at 44 against a loop that collects more. The browser figure now
equals what `playwright test --list` actually collects, 264 in 8 files, which it did not before.

---

## 5. UI-004 — read in full, carried, and proposed for close

**Still valid and now ANSWERED by ADR-019 + contract 2.0.0** (its Notices requests):

- *"notice status enum, audience/scope, timestamps, correction/update linkage"* → `lifecycleState`,
  `targets`, `publishAt`/`expireAt`, and the `history` chain. Built against all four.
- *"a representable stuck-workflow shape — an approval pending with no eligible approver"* → survives
  the reshape as `pending_approval` in `lifecycle.json`, and this PID re-pointed both guards to keep
  it. UI-004 warned against smoothing it over; it has not been.

**Still valid and still OPEN — carried:**

- **Overview has no design intent.** UI-004 Step 1 found *zero* first-build intent for it and asked
  for a pointer or explicit permission. S2 Overview is built and is nav row 1. The PO has named this
  owed, together with the pre-ADR-019 `NoticeRow` it still carries (which GEN-043 retained
  deliberately — this PID kept the two vocabularies apart rather than harmonising them).
- **Cases has no field list** — cut C.
- **Home Safety needs an observation-timestamp / freshness field** to render `offline` and `stale`
  distinctly. Unanswered.
- **UI-004 §4's twist-boundary precedents** are live discipline and were followed here: value maps
  with a fallback that *fails* rather than defaults, and absence copy gated on the field it describes.

**Proposed close, for the PO to rule on:**

> **UI-004 is superseded in subject and should close.** It was filed to author the rewrite's screens
> design-first, so presentation churn would be absorbed in design before code translated it. For
> management-web that ordering has been overtaken: the screens are being built directly against
> frozen contracts and a fixture corpus, with divergences recorded in `DIVERGENCES.md` and contract
> gaps raised as findings — which is what UI-004's CONTRACT FIELD REQUEST list existed to produce,
> arriving by a different route. Its Notices requests are answered by ADR-019; its Overview, Cases and
> Home-Safety-freshness requests are **not**, and must not close with it: they are carried above and
> are owed regardless of what happens to this PID. Its Step 2 artboards for resident-portal (Explore,
> Facility detail) are a different surface and a different track's question. Closing it as
> `superseded` keeps the register honest about what is in flight; leaving it `running` claims a
> session is authoring screens that this track is now building.

I have not moved `UI-004.md` — closing is the PO's act, and the `-RULINGS-` file is the PO's to file.

---

## 6. Findings for the backend track — none edited in place

| # | Finding |
|---|---|
| **G1** | **`getNoticeOutstanding` has no fixture.** GEN-042's report records *"No fixtures were added for the new operations"*, GEN-043 repeats it, and no management-web fixture carries a `residentId`. The brief's *"R3's fixture from GEN-042"* is not the case. `s5ack` renders a stated gap; **no renderer was written**, because a render path no fixture can reach is untested code that looks finished, and the only way to exercise it would be to invent who was told what. |
| **G2** | **`StaffNoticeListItem` carries `titleEn` only** — no `titleZhHant`, while the detail carries both. The list therefore cannot render a Traditional Chinese title, so "title in the current locale" is not satisfiable on the list at 2.0.0. |
| **G3** | **`StaffNoticeListItem.noticeType` is a bare `string` with no enum**, while `StaffNoticeDetail.noticeType` has the four-value enum. Value-map totality can only be derived from the detail. |
| **G4** | **`listNotices` declares no query parameters** — no state or type filter in the contract. The filters here narrow what the server already returned and say so on screen; they decide nothing about access. If filtering is meant to be server-side (ADR-007 D5/A1), the contract needs the parameters. |
| **G5** | **A-05's oldest-first approval queue is not implementable at 2.0.0.** The list item carries no time at which approval was requested — only `publishAt`/`expireAt`, both null for every `pending_approval` row in the corpus, and `version`, which is a counter and not a clock. Ordering by a proxy would put a made-up sequence on an approval queue, so the rows keep the server's order. A `submittedAt` (or `approvalRequestedAt`) would close it. |
| **G6** | **`getNoticeOutstanding` declares only `200` and `404`** — no `401`, `403` or `500`, unlike every sibling operation. Its four required screen states have no contracted responses behind three of them. |
| **G7** | **`NoticeOutstandingResponse` carries no recipient name** — `residentId` and `unitId` only. Whether staff working an outstanding list should see names is a product decision, not an omission to be papered over client-side. |

---

## 7. Where this stops

**The gate does not exist.** Verified at `origin/main` `a936249`: `docs/governance/bin/prove.sh`
contains **0** references to `management-web`, and `.github/workflows/governance.yml` contains **0**.
Per the ruling on F3, a UI PID does not pass through a gate that does not run its tests.

So this is the declared stop: **built, green, awaiting gate.** Nothing has been merged. The work sits
on `codex/ui-045-v1.0` at `593b45d`, rebuilt and re-run against `2.0.0` fixtures, with the mutation
proof reproducible by one command.

When GEN-046 lands the gate, the merge is the standard one — refspec push from this worktree, `main`
never checked out, tree hash re-read via `git ls-remote`, through the hook, no `--no-verify`, then the
rule-7 close with the PO's `-RULINGS-` filed.

**Part 2 is unblocked by nothing here:** it needs `2.1.0`'s permitted actions, and the guard that
currently forbids every act control is written so that adding one must be a conscious act against a
server-stated permission, not an omission nobody notices.


---

## 8. R1 — the harness, answered

**Direct answer: the UI harness never keyed on exit status, so `GEN-044`'s literal defect was not
present. It had the same defect one level in, and four of my ten mutations were false bites.**

**What it did.** `runNode` and `runBrowser` parse failing assertion NAMES out of the runner's output;
a build failure in `runBrowser` throws outside the `try` and aborts the run loudly rather than
scoring. So "any non-zero exit is a red" was never the rule here. But `proveMutations` then matched
the target against that set with `.some()`. Nothing checked that the named case had failed **for its
own reason**, nothing held its **log**, and nothing bounded the **blast radius**. A mutation that
reddened the whole suite certified, because the target was somewhere in the wreckage.

**The fix, applied to `tool/mutate.ts`.** `runSuite` now returns `Map<name, log>`, and a mutation is
certified only when all four hold:

1. the **named** target is red — not "something is red";
2. its **log is present** — a name with no log is a parse artefact;
3. that log is an **assertion** failure, not a timeout, a missing module or a browser that fell over;
4. the **blast radius is declared** — reds beyond `target` + a mutation's declared `alsoRed` are
   collateral, and collateral refuses certification. Declaring the radius is the honest move;
   suppressing it is not.

Plus an instrument control: if the run produced reds and **not one** carried a log, the harness throws
— a broken log parser is otherwise indistinguishable from a run of honest NOT-REDs.

**Each rule is asserted by a case that must NOT certify** (`test/tools/mutation-harness.test.ts`,
6 → 13 tests): a genuine named red with a log certifies; a red with no log does not; an
`ERR_MODULE_NOT_FOUND` does not; a timeout does not; undeclared collateral does not; a declared radius
does; and a run with no logs anywhere throws. A rule with no failing case is a rule nobody has tested.

**Which of the ten did not survive — all four found by the fix, none by inspection:**

| mutation | what the corrected harness said | disposition |
|---|---|---|
| **m1** list discriminator | 3 undeclared reds | It edited `data-testid={testId}` in the **shared `Table` component**, reddening s1, s3, s4 and s5 alike. **Re-aimed** at the notices table's own `testId`; its remaining radius — the list's other state and both locales — is **declared**. |
| **m3** outstanding gap | first 21 undeclared reds, then **nothing red at all** | It broke `StateNotice`'s testid, shared by every no-fixture panel on every screen. Re-aimed at `FixtureView`'s s5ack arm — which this app's own comment records as **unreachable** — so nothing reddened. **Re-aimed a third time** at the assertion that reads the gap's *reason*, which is the one that says something specific about s5ack. |
| **m8** approve button | **the named assertion did not go red** | **A genuine false bite.** The anchor matched the first component of that shape — `S5List`, not `S5Detail` — so the button landed on the list while the mutation claimed to prove the detail's guard. The old `.some()` certified it anyway. Anchor now unique to `S5Detail`. |
| **m9** role branch | 1 undeclared red | Intrinsic and correct: `.role === 'approver'` trips both role guards by design, one on the literal and one on the comparison. **Declared**, not contrived away. |
| **m10** client storage | 1 undeclared red | Its collateral was `ReferenceError: localStorage is not defined` — a **crash**, not a second assertion, in a live-config test that runs in node. That is precisely the shape `GEN-044` found being counted as a bite. **Re-aimed** at a source file the node runtime does not execute; the guard is a static scan, so any file proves it. |

m2, m5, m6, m7 were unaffected beyond declaring m2's other-locale radius.

**Re-run under the corrected harness: 10 of 10 PROVEN**, each on a named red carrying an assertion
headline — for example m8 now certifies on *"an unmarked control appeared in main; deferred writes
must be absent, not drawn"*, which is the guard's own message rather than a reporter's rule line.

**A note on m8, because it is the one that matters.** Under the old harness it read PROVEN while the
button it added was on a different screen from the assertion it claimed to prove. Nothing in the
output looked wrong. It was not found by reading the mutation more carefully; it was found because
the harness was made to demand that the named case fail for its own reason. That is the whole content
of `a-bite-is-a-named-red`, and this PID's ten mutations were 40% wrong without it.

**Suites after the fix:** node 116 / 113 pass / 0 fail / 3 skipped; browser 264 / 259 passed / 0
failed / 5 skipped. Inventory totals moved 373 → 380 with the seven new harness cases, and the reason
for each moved number is recorded beside it.
