# Component divergences from the design export

**Status:** accumulating. **Nothing here is fixed.**

The Product Owner ruled on 2026-08-14 that functions are built against the design **layout**, and
every UI element is corrected in a later, separate pass. This file is that pass's work list.

**Why it exists rather than being discovered later:** an unreported divergence and a deferred one
are different things. Deferred means somebody chose; unreported means nobody knew. This list is
what makes the later pass a task rather than an archaeology exercise.

**Source of truth for "what the design shows":** the export's own data model, extracted by the
method in `PEMO_Management_Web_Scope_Analysis_v0.1` §0.1 — line 391 parsed as JSON, then the
`text/x-dc` script block (38,907 characters, byte-exact). Nothing here is derived from a rendering.

## What the deferral does NOT cover

Recorded here because this file is where somebody will look for the boundary. Appearance only. It
does not relax the boundary scan over client copy, the `DOC-014-ST` §2.2 state matrix, the
fixtures-only rule, the positive-assertion guard, `severity.json` as the sole token source, or
deferred writes rendering as **absent**.

**A disabled control is not a visual choice.** It asserts that the capability exists and is merely
unavailable to you. Since `2.1.0` the server states, per notice and per scope node, which acts THIS
caller may perform now (`permittedActions`); a control the server did not list is ABSENT, never
disabled (`GEN-047` A4, `UI-051` D1). `S5`'s stuck approval stays honest in the server's own words:
the pending notice's list is empty for this caller, and the row says so.

**And a transcribed hex would survive the pass meant to fix it.** By then nobody remembers it was
temporary. Tokens keep coming from `severity.json` and `tokens/palette.json` throughout.

---

## A. Named and accepted by the Product Owner

Not findings. Not to be fixed by this PID, and not to be re-reported.

| # | Screen | Element | Design shows | Built |
|---|---|---|---|---|
| **A1** | all | Language selector | Three buttons, top-right: `ENG` `繁` `简`, active on `brand.primary` | Three-segment tab, top-right of the header, active on `brand.primary`. `简` is on screen only; it is not a locale (PID 056). |
| **A2** | all | Left-hand menu items | Each item carries an icon | Text only, plus an active-state dot |

**`A1` has a structural half — see `S3`.** The design's third button is `简`, and whether Simplified
Chinese is a content language or an interface language is an open product decision. The button count
is cosmetic; the third language is not.

---

## B. Component divergences — deferred, listed

| # | Screen | Element | Design shows | Built |
|---|---|---|---|---|
| **B1** | all | Navigation grouping | Five labelled groups: `OPERATE`, `SAFETY AND SECURITY`, `BUILDING SYSTEMS`, `AMENITIES`, `COMMUNICATE` | A flat list of the five in-scope screens, ungrouped |
| **B2** | all | Navigation badges | Counts on items — Cases `14`, Home Safety `3` (critical tone), Help desk `5`, Visitor `6`, Smart IoT `2`, Clubhouse `9` | No badges. See `S4` — the Home Safety badge has no contract source |
| ~~**B3**~~ | all | Sidebar collapse | A `‹` control (collapsed state itself never designed) | ~~Absent~~ — **CLOSED 2026-09-16.** Main nav chevron lives on the brand/title row (ParkCore: expanded shares the title line; collapsed sits under the mark). Properties tree still has a top-cap chevron and collapses to a thin strip. Independent URL params (`nav=collapsed`, `scopeRail=collapsed`). See §D. |
| **B4** | all | Product mark | Two lines, `PEMO` over `MANAGEMENT` | One line, `PEMO Management` |
| **B5** | all | Scope selector | A `SCOPE` label, the estate name in both scripts, and a `3 blocks · 812 units ▾` summary line | PT lock: a persistent left properties tree rail is the everyday picker, not a modal and not a combo. Header crumb shows the selected path. The design card's chevron-dropdown is not the primary control. Estate summary still renders on the nav SCOPE card when the menu is expanded. |
| **B6** | all | Breadcrumb | A band, `{{crumbBand}} › {{crumbPage}}`, derived from the nav group or parent item | Absent. Derivable client-side; no data needed |
| **B7** | all | User identity | Avatar initials `CM`, name `Chan Mei-ling`, role label `Estate manager`, `▾` | Absent. See `S2` — the role label has no contract source |
| **B8** | all | Header integration chips | `IoT2Hub` and `CMMS` chips in the persistent header, on every screen | Rendered on S2 only. See `S1` — no per-screen data source |
| **B9** | S1 | Filter row | Five filters: `All events`, `Needs action`, `In-unit`, `Building`, `Unmapped / quarantined` | Absent. See `S5` — still no fixture exercises a filtered RESULT, even after API-020-ST |
| **B10** | S1 | Event detail | Three mutually exclusive tabs: `Resident view`, `Delivery & timeline`, `Source & mapping` | Three separate URL states. Same three projections, different navigation model |
| **B11** | S2 | Refresh cadence | States `figures refresh every 60 seconds` | No refresh affordance and no stale marker |
| ~~**B12**~~ | S3 | Hierarchy | An expandable tree with open/closed nodes | ~~A flat indented list; every node always visible~~ — **CLOSED 2026-08-26 (PID 057).** Nodes with children expand and collapse. Default: estate + buildings visible; floors and units collapsed. Header actions `Expand all` / `Collapse all`. Nested preorder from 055 is unchanged. See §D. |
| **B13** | all | Severity iconography | `severity.json` names icons — `check-circle`, `information`, `notifications-active`, `warning-triangle`, `emergency-octagon`, `cloud-off`, `help-outline` | Text glyphs `✓ i ! ▲ ◆ ⊘ ?`. Chosen to avoid an icon dependency for seven shapes; the labels and the strong/surface/border set are correct |
| **B16** | S1 | Event source | The contract carries `SafetyEventRow.source` — `in-unit-sensor`, `fire-panel`, `management` — and no screen renders it | Absent. Found by `UI-024-ST`: copy for the three values existed, was registered as a value map, and was indexed nowhere. The copy was deleted; the unrendered contract field is recorded here so deleting it did not delete the information |
| **B14** | S1, S3, S4, S6 | Search | Four screens carry a search box | Absent. No fixture provides a search result, and client-side search would be the same boundary problem as `B9` |
| **B17** | all | Scope jump search | ⌘K / search jump to a node | Deferred this PR. The left tree rail is the picker. |
| ~~**B15**~~ | all | **Built controls the design does NOT have** | — | ~~The toolbar carries `Screen` and `State` selectors~~ — **CLOSED 2026-08-14.** Build-excluded, not run-time-disabled, and asserted over the production build output. See §D |

`B15` was recorded in the opposite direction on purpose. A divergence list that only records what is
missing will not catch what was added — and this one turned out to be the item that shipped a
capability rather than merely looking wrong.

---

## D. B3 — closed

The main nav and the properties tree collapse independently.

- The main nav chevron sits on the brand/title row (ParkCore). Expanded: `[mark] [title+meta] [‹]` on one row. Collapsed: `[›]` centered under the mark on the narrow rail. Brand copy is hidden when collapsed.
- The properties rail still has a visible chevron at the **top** of the rail (Claude Design).
- Expanded nav shows labels (~228px). Collapsed nav is an icons-only strip.
- Expanded properties rail shows the estate → building → floor → unit tree (~260px). Collapsed rail is a thin icon strip.
- The properties rail mounts only on place-scoped screens. Settings / non-place Coming Soon stubs hide it entirely (no empty column). `at=` is kept across that navigation.
- Open/closed persists independently on the URL (`nav=collapsed`, `scopeRail=collapsed`). ParkCore stores this in localStorage; PEMO does not — the client forbids storage APIs (credential-storage guard), so chrome state uses the same URL-constructed model as screens.
- Desktop staff shell only. No phone IA, no drawer close shared with this chevron. ⌘K stays deferred (B17).
- The tree is Wing Fu Garden / 榮富花園 (`est_wing_fu_garden`) with Blocks A/B/C in `sequence` order (1/2/3). Magnitudes follow `database/seeds/15-property-wing-fu-garden-magnitude.sql` (A 8×35=280, B 7×22=154, C 9×42=378, total 812 residential). That is the fixture world. It is **not** Charming Garden 富榮花園 (a different estate, 18 numbered blocks). Do not rename. Sibling order is `sequence` then id, never label.

## D. B12 — closed

The S3 hierarchy is an expandable tree. Not a new corpus state: collapse is client chrome over the nested preorder the server already walks (PID 055).

- A node with children has a disclosure control (`aria-expanded`).
- Default collapsed kinds are `building`, `floor`, `unit`, so estate and buildings are visible and floors/units are not.
- `Expand all` / `Collapse all` are panel header actions. They are not writes. The state matrix still forbids write controls in `main`; tree chrome is named and excluded.
- The HTML pack did not draw these two actions; the copy is `Expand all` / `Collapse all` as specified. No search box (B14 stays).
- Proved against `dist/`. Expand all missing fails a test rather than skipping. Collapse all missing fails for its own reason.

## D. B15 — closed

The screen and state pickers are gone from the production build. Not hidden, not disabled: **absent
from the artefact.**

- `src/shell/DevStateToolbar.tsx` holds them, behind `__PEMO_DEV_TOOLBAR__`.
- `vite.config.ts` replaces that constant with the literal `false` for `vite build` and `true` for
  `vite --serve`. The branch folds, the module becomes unreferenced, and it is tree-shaken out.
  `"sideEffects": ["*.css"]` is what permits the drop.
- `test/build/dev-affordance-excluded.test.ts` asserts it **over the emitted bundles** — five
  independent needles, plus a non-vacuity check that the sentinel exists in source, plus a check
  that the constant was substituted rather than shipped as an identifier, plus a source-map check.
- The state matrix no longer reads the picker. It asserts the resolved route from the **URL**, which
  `app.tsx` rewrites — the app's own behaviour, not a seam added for the test.

**Why build-excluded and not disabled:** `GEN-013-ST` `B6`. The `x-pemo-dev-now` seam shipped, was
"off", and was demonstrated to reach `verify()` and accept an expired credential. A dev affordance
that is merely switched off is one flag from being live, because the code is still there and
something still decides at run time. Nothing decides here.

Proven by breaking it four ways — see the step report.

---

## C. Structural — raised, NOT deferred

These look like component divergences and are not. In each case **the design's control implies a
state, a scope or an action the contract cannot express**, and `ADR-007` `D7` settles that the other
way: visual authority from the export, structural authority from the ADRs.

Each is raised for the contract track. **None is worked around here.**

### S1 — persistent integration chips have no per-screen data source

The design shows `IoT2Hub` and `CMMS` health chips in the header of **every** screen.
`integrationHealth` appears in the contract **only inside `OverviewResponse`**. There is no
operation that returns feed health on its own, and no other response carries it.

Rendering the chips everywhere would require caching the Overview response and showing it on
screens that never requested it — presenting a health state whose age nothing on the page states.
On a surface whose whole discipline is that data is never shown as fresher than it is, that is the
wrong shape.

**Needs:** either a small feed-health operation, or the field on every response, or a ruling that
the chips belong to Overview alone.

### S2 — the user identity block asserts a role vocabulary the contract deliberately has none of

The design shows `Chan Mei-ling` with the role label **`Estate manager`**. The contract has **no
principal, current-user or role read** — the thirty operations at `2.1.0` are scoped reads and acts,
and the only role vocabulary is the one `conferGrant` takes as INPUT — and `ADR-007` `A4` records
role differentiation as *entirely undesigned*: the export shows one role and no screen renders
differently for another. (Corrected at `UI-051`: this said "all eleven operations are scoped
reads", which was true at `0.1.x` and false from `GEN-040`.)

Rendering a role label would put a role vocabulary on screen that the contract avoided on purpose.
That is the `ADR-006` failure shape — a decision made by whoever builds first.

**Needs:** the role list decided, which is the same open item `S5`'s stuck approval is evidence for —
now carried as the server's empty `permittedActions` on the pending row rather than by the client's
silence.

### S3 — the third language is a product decision, not a button

`A1`'s three buttons are cosmetic. The third one is not: `简` is Simplified Chinese, and
`ADR-007` `A6` records **whether `zh-Hans` is a content language or an interface language** as an
open product question. `LocalizedText` carries `en` and `zh-Hant` only, and is additive by design so
the answer is not foreclosed.

PID 056 put the third *segment* on screen to match the HTML pack. It does not add a `zh-Hans` string table. Clicking `简` does not write `lang`. The A6 decision is still open.

**Needs:** the `A6` decision before `简` can be a locale. Visible-only is not that decision.

### S4 — the Home Safety nav badge has no contract source

The badge reads `3` with tone `critical`. The nearest contract figure is the Overview counter
`safety-events-window`, whose value is `6` and which counts events in a window rather than critical
ones. They are different numbers measuring different things.

The Cases badge `14` **does** match `counts.open`, so this is specific rather than general.

**Needs:** either a defined per-severity count in the contract, or a ruling that the badge means the
window count and the design's `3` is illustrative.

### S5 — the S1 filter row has a parameter but no fixture

The contract **does** carry `filter` on `listSafetyEvents` with exactly the design's five values
(`all`, `needs-action`, `in-unit`, `building`, `unmapped`), so the parameter is not the gap.

**No fixture exercises any filtered result.** Building the control would leave two options, and both
are barred: filter client-side, which `ADR-007` `D5` forbids in terms — *"filtering happens in the
query, never in the client; a row a client would have to hide has already leaked"* — or invent
fixtures, which the fixtures-only rule forbids.

This is the same class as `F4`: a contract capability the corpus never demonstrates.

**Needs:** filtered fixtures, then the control is ordinary work.

---

## Register

> Corrected at the scope-rail slice. `B3` closed (both rails collapse). `B17`
> records ⌘K as deferred. Counts below match the table: 17 `B` rows, three struck through.

| | Count |
|---|---:|
| Named and accepted by the Product Owner | 2 |
| Component divergences, deferred | 14 |
| Component divergences, **closed** | 3 (`B3`, `B12`, `B15`) |
| **Structural, raised for the contract track** | **5** |
