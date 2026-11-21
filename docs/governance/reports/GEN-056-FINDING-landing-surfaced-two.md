# GEN-056 landing — two failures the branch CI surfaced (register + Flutter)

**Date (UTC):** 2026-09-04. Branch `codex/gen-056` @ 245edf9. Both jobs RED. HARD STOP.
**Process note, owned:** I did NOT run the full register set locally for GEN-056 — I judged it Dart-only
and ran the stamp check + run-mutations only. That was the gate-coverage lapse I had just spent GEN-055
establishing the discipline against; these two failures would have surfaced locally. Recorded so the
lesson is not lost to a "this one is different" exception.

The regeneration itself is correct: severity_tokens.g.dart and fixture_corpus.g.dart at 0.4.0, the debt
file empty, the stamp check extended to .g.dart (4 stamped, bite proven), the flutter-gate reporting
`347 gated, 0 exempt (of 0 booked)` — the debt is genuinely paid. The two failures are consequences of
paying it, and they split cleanly on scope.

## 1. register — `flutter-gate.test.ts` is coupled to the real debt entries (IN SCOPE)

`tests/integration/flutter-gate.test.ts` hardcodes the resident-mobile debts as its example:
`EXEMPT_B = 'embedded fixture corpus is byte-identical to the source corpus'` (line 23), and rules 3/4/5
assert the gate's output names those exempt entries (e.g. line 44 `exempt: embedded fixture corpus.*—
owed by`), reading the REAL `flutter-test-debt.json` (line 57). Emptying the debt file — which GEN-056
MUST do — makes those tests fail: there is no longer an exempt entry to name.

This is a test coupled to transient data (whatever debts happen to exist), which is exactly what broke.
**Fix (in GEN-056's tests/ scope):** decouple rules 3/4/5 from the real debt file — drive them from a
SYNTHETIC debt fixture via `PEMO_FLUTTER_DEBT_FILE` (the seam GEN-048 already built for exactly this),
so the gate's behaviour is tested against a controlled debt, not against whatever is currently owed. The
gate's RULES are the subject; the real debt file's contents are not.

## 2. Flutter — `problems/loading` state-coverage render fails (OUT OF SCOPE)

The 0.4.0 source corpus adds a `problems` screen (`bad-request`, `invalid-credential`), which my
regeneration embedded (this is correct — the corpus moved). The Flutter "design system section 18 state
coverage" test then renders every screen in every state, including `problems / loading` (en and zh),
and those two fail. `problems/loading` is NOT a corpus fixture (the corpus has no problems/loading
clientOnly entry) — the test synthesises the loading state, and the `problems` screen widget does not
render it.

**That is a resident-mobile WIDGET gap, not a generated-file one.** GEN-056's write scope is
`apps/resident-mobile/lib/**/*.g.dart` — the generated files only — NOT the app widgets under
`apps/resident-mobile/lib/` that render a screen. The regeneration correctly surfaced a latent gap: the
`problems` screen has no loading state, and section-18 coverage requires one. Fixing it means editing a
resident-mobile widget (or narrowing the coverage list, or adding a problems/loading treatment), which
belongs to a resident-mobile / UI PID, not this one.

## Ask

- **(1) is mine** — I will decouple `flutter-gate.test.ts` to a synthetic debt fixture and re-run the
  full register set locally before re-pushing.
- **(2) needs a ruling:** the `problems/loading` render is outside GEN-056's `.g.dart` scope. Options:
  (a) allocate a small resident-mobile PID (or hand it to UI CC) to give the `problems` screen a loading
  state; (b) narrow the section-18 coverage so `problems` (an error-display screen) is not required to
  render `loading`; (c) let GEN-056's scope widen by ruling to include the one widget. GEN-056 cannot
  land green until (2) is resolved, because the debt file is empty and the gate now runs those tests.

---

## RESOLUTION (after the ruling)

### (1) DONE — flutter-gate.test.ts decoupled to a synthetic debt

Rules 3/4/5 now run the gate against a SYNTHETIC debt file (EXEMPT_A/EXEMPT_B booked) via
`PEMO_FLUTTER_DEBT_FILE`, not the real one. 6/6 pass with the real debt file empty. **What the failure
proved, recorded:** GEN-048's gate tests asserted against whatever was currently owed, so they passed
BECAUSE the debt existed — a test that only holds while the debt is unpaid is a test of the debt, not of
the gate. Same family as `[correlated-lists-certify-nothing]` (expectation and subject drawn from one
file); the synthetic fixture is the correction.

### (2b) STOP AND REPORT — the codebase cannot yet express "sourceless" non-circularly

The ruling: the four-state matrix applies to screens that FETCH; a sourceless screen must NOT present a
loading state; derive "does it fetch" from something real, never a hand-kept list; and **"if the
codebase cannot yet express 'sourceless', stop and report rather than inventing a list."** It cannot,
so I stop.

**Why the actual failure is narrower than "problems has no loading widget":** the test iterates every
corpus `screen` key and calls `screenFor(key)`, which throws for any key it does not map. `problems`
and `notices` are in the corpus but are NOT app screens — they are operation-fixture categories:
`problems` holds Problem bodies (`operationId: acknowledgeSafetyEvent`, `httpStatus: 400`, `bodyKind:
request`, `scenario: null` — "not provoked by anything in the database"); `notices` holds ACT responses
(`operationId: markNoticeRead`, a mutation). Neither is a fetching screen with a state matrix; the test
conflates "corpus screen key" with "app screen."

**The signals available, and why each fails the ruling:**
- `screenFor`'s five keys — a HAND-KEPT list of screen names, exactly what the ruling forbids.
- the corpus `loading` clientOnly entry — CIRCULAR: deriving "fetches" from "declares a loading state"
  and then requiring "fetches ⇒ renders loading / sourceless ⇒ no loading" makes the sourceless side
  vacuously true and cannot red on "remove a real screen's loading" (it silently drops coverage instead).
- the widget's real data dependency (`ref.watch(homeProvider)` etc.) — the genuine signal, but it lives
  in runtime Riverpod calls, not anything a test can introspect.
- the manifest fixture fields (`operationId`, `httpStatus`, `schema`, `bodyKind`) — a screen-data GET
  (`getHome`, 200, a screen schema) vs an error (400) vs an act (`markNoticeRead`, 200) is not cleanly
  separable, because the manifest carries no HTTP METHOD and `notices/read` is a 200 mutation.

So both bite directions cannot be made non-circular with what exists: "add a loading state to a
sourceless screen → red" works (it forces `screenFor` to throw), but "remove a real screen's loading →
red" needs an INDEPENDENT roster of fetching app screens, which today is only the hand-list.

**What "something real" would need to be (proposal, not built):** the manifest declares, per app-screen,
that it has a data source — e.g. a `screenKind: "data" | "operation-fixture"` field, or the fetching
screens declare their provider in a small screen REGISTRY that both the app and the test read. Either is
a real, single-source signal the rule can derive from and both bites can red against. Choosing which is a
design decision on the resident-mobile side (manifest vs registry), and it may touch a non-`.g.dart`
file, so it is outside even the widened scope of GEN-056 (the test file only). **GEN-056 is blocked on
this: the debt file is empty and the gate now runs `problems/loading`, so it cannot land green until the
"sourceless" signal exists and the state-coverage test derives from it.**

## Ownership of apps/resident-mobile (answering the question)

Until ruled otherwise it is MINE — I hold its contract and its gate, and GEN-056 shows contract /
regeneration / test-file / governance work on it is feasible CI-only. **What that means in practice:**
the coming work is not all generated files — (2b)'s "sourceless" signal and the one-world re-recording
will move real widget/manifest code under `apps/resident-mobile/lib`. **Being unable to run Flutter
locally makes WIDGET work fix-by-CI-cycle (~7 min each), blind between pushes** — tolerable for a small,
well-understood change, untenable for iterative widget development. But the toolchain gap is NOT a
differentiator: neither this machine nor the UI track's has Flutter, so reassigning to the UI track buys
no local Flutter either. My recommendation: **keep contract + gate + generated-file + test ownership
with me** (I hold the contract, and that is where the drift-catching lives); route substantial WIDGET
work to whichever track can get a real Flutter host, and if neither can, accept the CI-cycle cost
explicitly rather than pretending widget work is as cheap as node work. If a Flutter toolchain can be
put on the host, resident-mobile becomes fully mine without caveat.

---

## (2b) REVISED RULING — a THIRD category surfaced; stopping again as instructed

The KIND signal you ruled works, and it is derivable from SHAPE with no file move and no list: a group
is a SCREEN iff it has a data-fetch fixture — a GET operation returning 200 — which is exactly what
makes it a screen. I added it to `generate-fixtures.mjs` (emits `FixtureCorpus.screenKind`), derived
from the contract fields `operationId` + `httpStatus`. It classifies:
- `mob-02-home … mob-11-account` → **screen** (each has `getHome`/`getServices`/… at 200);
- `problems` → **operation-fixture** (only 400/401 Problem bodies — no GET-200);
- `notices` → **screen**.

**But `notices` = screen is CORRECT and reveals a third category the kind field does not capture.**
`notices` has `my-notices: getMyNotices 200 MyNoticesResponse` — it genuinely fetches, so it IS a
screen. It is the MOB-06 Inbox, which the app deliberately has NOT built (`InboxPlaceholder`,
"specified but not yet built" — already covered by the "known screen gap" test). So the corpus mixes
**three** kinds, not two:
1. built fetching screens (`mob-*`) — the matrix applies;
2. an UNBUILT fetching screen (`notices`/MOB-06) — no widget; `screenFor` throws;
3. operation-fixtures (`problems`) — not a screen at all.

The kind field cleanly removes (3). It does NOT remove (2): `notices` is a screen by kind, and the
matrix still calls `screenFor('notices')`, which throws. Resolving this needs a SECOND signal —
"is it built" — on top of kind. **Per your instruction ("if D1 needs a design decision larger than a
derived kind field, stop again and report"), I stop.**

### The proposal (small, and it keeps both bites)

Two derived signals, neither a hand-kept kind list:
- **kind** — from the fixture shape (GET-200), already implemented in the generator;
- **built** — from the widget registry itself: make `screenFor` return `Widget?` and `null` for a key
  it does not map, so `built(k) = screenFor(k) != null`. That is the ACTUAL widget wiring (real code),
  not a classification list.

Then the section-18 matrix iterates `screenKind[k] == 'screen' && built(k)` — `problems` excluded by
kind, `notices` excluded by built (and it stays covered by the InboxPlaceholder gap test).

**Bites, both expressible:**
- "mislabel an operation fixture as a screen → reds" — a NODE test (run-mutations, no Flutter) reading
  the generated `screenKind` and asserting `problems == 'operation-fixture'`; mutate the derivation →
  it reds. This is the one that would have hidden this, and it is verifiable off a Flutter host.
- "remove a real screen's loading → reds" — the Flutter matrix asserts every built screen renders its
  loading state; remove it → reds (CI, where Flutter runs).

If you approve the two-signal shape (kind derived + built from a nullable `screenFor`), I implement it —
the `screenFor` change is the ONE thing that reaches a non-generated file under `apps/resident-mobile`,
still inside the widened scope (the section-18 test file plus the manifest/generator), touching no
screen widget. If you would rather notices/MOB-06 be excluded a different way, say so.

## Flutter toolchain

`flutter --version` does not yet resolve on this machine. I will report the moment it does.
