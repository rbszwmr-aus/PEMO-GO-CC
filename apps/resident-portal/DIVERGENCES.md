# Divergences — resident portal shell (UI-028-ST)

**Status:** accumulating. **Nothing here is a defect that ships silently** — each row is either resolved in this PID, deferred with a reason, or raised for another track.

Format follows `UI-019-ST`'s divergence register. "What the design shows" is the export's own data model, read from the `text/x-dc` script block and `README.md` of `Property management End User portal design.zip`.

---

## A. Export ↔ design-system divergences — resolved here

| # | Element | Export | Built | Basis |
|---|---|---|---|---|
| **T1** | Severity tones | **Six** (`critical/warning/advisory/info/normal/unknown`), collapsing `offline`+`unknown`, all strongs on one lightness plane (worst pair `0.20 L*`) | **Seven** per design-system §3, read from `severity.json` at `0.2.0` (worst pair `4.51 L*`) | PID §4 / §3 `Accepted`. The six are the **rejected alternative**, recorded below |
| **T2** | Secondary text on the page ground | `#6E7480` (`neutral.500`) — **4.34:1, fails AA** | `neutral.600` `#5B6172` (5.72:1) | §15.2. Corrected, not reproduced; asserted by `test/tokens/contrast.test.ts` |
| **T3** | `brand.accent` `#F59A08` | used freely | on-brand ground only (badge, active language); 2.21:1 on white — never text on light | §2.1, PID §3 |
| **T4** | `accent.heading` `#E17401` | not used by the portal export (headings are ink) | **ink** (`neutral.950`); the token stays defined and page-title-scoped, with **no current user** | §2.5, Ruling 2. See D-H below |
| **T5** | Breakpoints | export **code** switches the rail at **1120**; export **README** says **1080** | **1080/760** | PID §1, Ruling 6 (the PID is the controlling document). `1120` is the **rejected** value |

### T1 — the rejected six-tone palette (recorded, not reproduced)

The export's inline `T` object, kept here as the alternative that was refused:

`critical #C0271F` · `warning #A85408` · `advisory #8A5A00` · `info #0B6E78` · `normal #1E6B4F` · `unknown #55606E` (offline folded into unknown).

An override is the Product Owner's to make — but it changes `severity.json`, which is a **contract change, not a repaint**.

### D-H — accent.heading reverts to ink; the constraint stays enforced with no current user

The portal export uses ink (`#14161C`/`#2A2F3A`) for headings and **contains no `#E17401`**. Step 2 first applied `accent.heading` to `.pemo-page-title`, reading the PID's "three constraints enforced" as a directive to use it. **Ruling 2 corrected this: a constraint on use is not an instruction to use.** `#E17401` is a **management-surface** token (§2.5 records all eleven occurrences as management page titles), the weakest in the system (3.13:1, large-text AA only), and `PID-INDEX`'s open design item warns that orange page titles read as `warning` warmth — a risk that is *worse* on the resident surface, where the severity system's audience lives.

**Reverted:** `.pemo-page-title` uses `neutral.950` (ink). **The constrained-token machinery stays** — `accent.heading` remains a defined `portalOnly` token in `PAGE_TITLE_ONLY_TOKENS`, so if a designer later wants the accent it can arrive **only** as the `.pemo-page-title` h1 style and nowhere else. The guard is enforced by `test/tokens/contrast.test.ts` (accent.heading has no current user; a use anywhere fails; the token must stay defined for the guard to guard anything). Enforced constraint, no current user — which is the intended end state.

---

## B. The management web's deferred divergences — dispositioned against THIS export

Trap 10: not inherited by silence. Each of `UI-019-ST`'s items, checked here.

| # | Management divergence | Disposition on the resident portal |
|---|---|---|
| A1 | Language selector `ENG/繁/简` (3) | **recurs, reduced** — the portal has `ENG/繁` (two); `简` is open (`A6`/reconciliation §8) and not scaffolded |
| A2 | Menu items text-only, no icons | **inverts** — the portal sidebar is icon-bearing by design (Ruling 1). See F-ICONS: the two surfaces now diverge in the OPPOSITE direction from the export's "matches the console exactly" claim; addressed to the later management design pass |
| B1 | Nav grouped `OPERATE/SAFETY/…` | **does not recur** — a flat All-Services list with LIVE/SOON |
| B2 | Nav badges (counts) | **recurs as primitive, values deferred** — `Badge` is built and space-reserving; the count is data, not rendered |
| B3 | Sidebar collapse `‹` | **does not recur** — fixed 236/196/drawer; no collapse designed |
| B4 | Two-line product mark | **cosmetic** — the top bar shows the single `PEMO` mark per README |
| B5 | Scope selector | **does not recur** — a resident is not multi-scope staff |
| B6 | Breadcrumb band | **does not recur** — the tab bar carries sub-navigation |
| B7 | User identity + role label | **does not recur as management's** — no role label (a resident has no staff role); and the account menu is not rendered at all (Ruling 4, see C1) |
| B8 | `IoT2Hub`/`CMMS` health chips | **does not recur** — no integration chips on the resident surface |
| B9 | S1 filter row | **does not recur** — no safety-events screen; a data screen |
| B10 | S1 event detail tabs | **does not recur** |
| B11 | S2 refresh cadence | **does not recur here** — availability live-refresh is a later data PID |
| B12 | Hierarchy tree (flat vs tree) | **recurs as a named gap** — the zone/location filter `TreeView`, a later data screen (COMPONENT-TRANSLATION.md) |
| B13 | Severity iconography (glyphs vs named icons) | **recurs directly** — text glyphs chosen for the seven shapes (avoids an icon dependency), as the management web did; `severity.json` names icons (`check-circle`, `cloud-off`, …). Glyph-vs-icon stays **open** for the Product Owner |
| B14 | Search box | **recurs as a named gap** — a later data screen |
| B15 | Dev toolbar build-exclusion | **resolved here** — the closed pattern is applied (see C2) and proven over `dist/` |

---

## C. Structural — raised or resolved, NOT worked around

### C1 — the account menu is not rendered (Ruling 4)

The export's top bar carries an account menu; **no screen exists behind it** (profile `U-14` is one of the five screens the export does not cover, reconciliation §6). It is **not** given a `SOON` tag — `SOON` means "this estate does not have this service yet", a true statement about the estate, and an unbuilt screen is a different fact ("we have not built it"). One tag carrying both tells a resident nothing reliable. **Deferred with reason: present in the export, no screen behind it.** An affordance that opens nothing is a dead control (`UI-019`).

The **notification bell is kept** — `INBOX` is a LIVE service and its empty state is honest.

### C2 — the dev state toolbar is build-excluded, proven over the artefact

`src/shell/DevStateToolbar.tsx` sits behind `__PEMO_DEV_TOOLBAR__`, substituted to `false` at build; the branch folds and the module is tree-shaken. Proven **over `dist/`** by `test/artefact/dev-affordance-excluded.test.ts` (five needles + substitution + source-map checks). The test lives in `test/artefact/`, not `test/build/` — the root `.gitignore`'s `build/` rule swallowed exactly this test on the management web; `test/artefact/no-ignored-files.test.ts` carries the class-level fix.

### C3 — the Explore hero is not rendered (Ruling 5)

The export's Explore carries a quick-search hero. A search bar that cannot search is a **disabled affordance asserting a capability** — the same defect as the account menu. Explore renders its **empty state**; the hero and results arrive with the data PID. Not a scoping convenience — it would be wrong to render.

---

## D. `RESERVED.inherits[]` — the engineering dependency map, kept here, NOT shipped as copy

Ruling 8 / the `UI-022-ST` copy-claims class (fourth instance): read as resident copy, these lines assert capabilities that do not exist. They are **not rendered** (a browser test asserts their absence from the coming-soon panels). They are preserved here because they are a genuinely useful dependency map for the next slices:

- **helpdesk:** identity and unit · the notification centre for replies · document attachments with virus-scan/size rules · bilingual reply rendering
- **notices:** the notification centre and per-category channel switches · scheduled publication · acknowledgement receipts · the document library
- **visitor:** QR delivery (as for booking passes) · the household · the access-control boundary · arrival/sign-out notifications
- **access:** the QR pass component (countdown, offline cache) · the idle-credential prompt · household roles · audit-safe own-events history
- **bills:** the payment gateway and its idempotency guard · invoices/receipts View·Download·Print · loyalty points · overdue handling
- **community:** the booking wizard in class-package shape · session lists/attendance/make-up · passes · the survey renderer

Panel **title and body** describe what each service will do, in product terms, and are rendered.

---

## E. `09` components with no PEMO equivalent yet

Every "named gap" is enumerated with its cost in [COMPONENT-TRANSLATION.md](./COMPONENT-TRANSLATION.md) — the artifact that replaces the void `09` §9.0. Not repeated here.

---

## F. Findings raised for other tracks

### F-ICONS — the export's icon PNGs are absent from the handoff

Ruling 1 directs bundling the export PNGs. **They are in no handoff artifact:** both design bundles ship four files each and **no `icons/` folder**, and the standalone HTML embeds no image data. The export itself is a hybrid — a PNG for eight services, a text glyph for three (`passes`/`bills`/`community`). The sidebar slot is reserved and `tool/generate-icons.ts` gates real `<img>` rendering on a PNG actually being present in `public/icons/` (see `public/icons/README.md`), so no broken image ships and the marks activate the moment the assets arrive. **Addressed to the later management design pass:** the export claims its set "matches the management console exactly", but the console (`A2`) is text-only; adopt this same set on both so they converge on the export's intent.

### F-TOKENS — a third surface now carries shared vocabulary in a surface-specific home

`packages/api-contracts/resident-mobile/severity.json` (severity) is now read across a package boundary by three surfaces: resident-mobile, management-web, and this portal. The non-severity palette is transcribed three times (Dart peer, management `palette.json`, this `palette.json`). Two boundary-crossers was debt; **three is a pattern.** The known fix is the one `API-016-ST` applied to the `Problem.type` registry: **raise `packages/design-tokens/`** as one item covering the `Problem.type` registry, `severity.json` and the non-severity palette. Not this PID's scope; raised for the contract track.

**Parity limitation (Ruling 3):** `palette-parity.test.ts` checks this palette against the Dart peer, but the peer is a **transcription** of design-system §2, not the normative source (which is neither machine-readable nor in the repo). The check catches drift between surfaces; it cannot catch all three being wrong together. The check is the mitigation; this sentence is the finding.

### F-COPY-SWEEP — inherited obligation for the data PID

`UI-022-ST`'s mechanism — every client-authored sentence that makes a claim about data is gated on that data, and the gate is asserted — has **no analogue in this PID** because there is no data to gate on. That is correct here and is a **standing obligation for the screens PID that follows**: when data arrives, the copy sweep must arrive with it. Recorded so the data PID does not rediscover that the sweep exists (`D` above is its first instance on this surface, found by reading copy against what exists).

---

# UI-031-ST — the three booking screens render data

The shell's empty panes are now filled from the `resident-portal` fixtures. New entries below; the UI-028 register above stands.

## G. Findings raised for the contract track (read-only artifacts — reported, never edited)

### G1 — `FacetCount.basis` prose is page-scoped while `Facets.scope` is `world` (Finding A)

`explore/*.json` carry `basis: "count of returned facilities whose category == key"` — page-scoped language — while `scope: world`. On `explore/empty.json` (`results: []`, count `3`) that sentence is **literally false**, and false *in the direction the discriminating fixture exists to rule out*: it describes the page-scoped reading. The data is correct and world-scoped on both fixtures; only the prose is wrong. **Handled:** the UI renders `facet.count` and the machine-readable `scope`, and **never reads `basis`** (`FacetCounts.tsx`, `types.ts` mark it not-for-display). Filed for the bundled Contract PID as a **reword** — `scope: world` stays, the sentence changes. Not a schema change; not a fixture edit.

## H. Deferred with reason (API-027-ST `x-deferred` form) — present as a reason, not silently absent

### H1 — `AvailabilityView.view` week and month (Finding C)

The contract's `view` enum is `[day, week, month]`; the corpus supplies **only `day`** (`availability/function-room-day.json`). An unfixtured enum value is a **contract surface with no oracle** — rendering a week grid against nothing would invent the shape of a response nobody specified. So the day grid renders; the week/month views are **deferred with reason** (`SlotGrid.tsx` states it in copy — `viewDeferred`), reachable only when the corpus supplies them.

### H2 — the "Book" control, and every write

The contract has no writes; booking is uncontracted (`ADR-011 D10` was lifted for interests, not booking). No functional Book control is rendered — booking is **deferred with reason** (`FacilityDetail` `bookDeferred`), never a dead button (the UI-028 account-menu rule). Asserted: the facility detail carries no interactive control.

## I. The copy-claims sweep (F-COPY-SWEEP) — delivered, and it caught an inherited crossing

`UI-028-ST` recorded F-COPY-SWEEP as a standing obligation for the screens PID. **This is that PID.** `test/boundary/copy-claims-scan.test.ts` loads the **`resident-portal`** denylist and scans every client-authored string in `MESSAGES`. Its `bookingParty` group (`heldby` / `bookedby` / `reservedby` / `bookername`) is what enforces "`SlotState: unavailable` reveals no holder" at the copy layer.

**It caught an inherited crossing:** the UI-028 `access` coming-soon panel said *"add or suspend a credential"* — and `credential` is a `secrets`-group term on this surface. Reworded to *"add or suspend a card or pass"* (the resident's own access is described without the boundary term). The sweep working, found by reading copy against the boundary — as intended.

## J. Categories — the contract's five win over the export's (Finding B)

The export's `Meeting & conference / Club house / Flexible workspace / MICE venues / Free space` do not appear. The contract's `Category` enum (`function-and-event / sports-and-fitness / wellness / outdoor / community`) is rendered with client-authored bilingual labels (the enum ships bare — Finding D, a claim the client makes, inside the copy-claims sweep).

## K. Pin verification — the gitlink edge case (recorded where the next session will meet it)

The `GEN-029-ST` pin rule (a pin is not verified until the working tree is at it) had its first use here. Ref-derived and tree-derived counts first disagreed by **one**: a linked worktree's `.git` is a **gitlink FILE**, not a directory, so a naive `find` counts it. Diagnosed and excluded; three-way cross-check (`git ls-tree` = `git ls-files` = `find` minus the gitlink) all read **663**. A discrepancy of one is the worst size — investigated, not reconciled. Recorded so the next session meets the exception rather than concluding the rule is noisy.
